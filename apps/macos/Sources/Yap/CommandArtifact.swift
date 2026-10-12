import Darwin
import Foundation

/// The `yap` command at `~/.local/bin/yap`, which a release app keeps byte-identical to its bundled
/// launcher, plus the marked PATH block when no startup file already covers `~/.local/bin`.
///
/// The command is always written as fresh bytes to a temporary name and renamed into place, never
/// copied: a copy carries the bundle's quarantine attribute and stays blocked. Builds without a
/// launcher, and apps outside an Applications folder, are `unavailable` and touch nothing, so a
/// personal build's own command is left alone. Every operation is synchronous.
struct CommandArtifact {
    enum State: String { case installed, missing, different, unavailable, needs_attention }

    struct Status {
        let state: State
        let path: String
        let onPath: Bool
        let profile: String?
        let error: String?

        var json: Data {
            var value: [String: Any] = ["state": state.rawValue, "path": path, "onPath": onPath]
            if let profile { value["profile"] = profile }
            if let error { value["error"] = error }
            return (try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])) ?? Data("{}".utf8)
        }
    }

    let home: URL
    let launcher: URL?
    /// Whether the running app is inside an Applications folder (the launch decision's answer).
    let inApplications: Bool
    /// The account's login shell, which picks the startup file the block goes in.
    let shell: String

    init(home: URL, launcher: URL?, inApplications: Bool = true,
         shell: String = ProcessInfo.processInfo.environment["SHELL"] ?? "/bin/zsh") {
        self.home = home
        self.launcher = launcher
        self.inApplications = inApplications
        self.shell = shell
    }

    var command: URL { home.appendingPathComponent(".local/bin/yap") }

    func status(error: String? = nil) -> Status {
        let files = startupFiles()
        let profile = ShellProfile.startupFiles.first { files[$0].map(ShellProfile.contains) == true }
        let state: State
        if error != nil { state = .needs_attention }
        else if !available { state = .unavailable }
        else if let current = try? Data(contentsOf: command) {
            state = current == bundledBytes() ? .installed : .different
        } else { state = .missing }
        return Status(state: state, path: command.path, onPath: ShellProfile.covered(files: files),
                      profile: profile.map { home.appendingPathComponent($0).path }, error: error)
    }

    func install() -> Status {
        guard available, let launcher else { return status() }
        do {
            let bytes = try Data(contentsOf: launcher)
            if (try? Data(contentsOf: command)) != bytes { try write(bytes) }
            if !ShellProfile.covered(files: startupFiles()) {
                let profile = home.appendingPathComponent(ShellProfile.target(shell: shell))
                let contents = (try? String(contentsOf: profile, encoding: .utf8)) ?? ""
                try ShellProfile.adding(to: contents).write(to: profile, atomically: false, encoding: .utf8)
            }
            return status()
        } catch { return status(error: error.localizedDescription) }
    }

    func uninstall() -> Status {
        guard available else { return status() }
        do {
            if let current = try? Data(contentsOf: command), current == bundledBytes() {
                try FileManager.default.removeItem(at: command)
            }
            for name in ShellProfile.startupFiles {
                let file = home.appendingPathComponent(name)
                guard let contents = try? String(contentsOf: file, encoding: .utf8), ShellProfile.contains(contents)
                else { continue }
                try ShellProfile.removing(from: contents).write(to: file, atomically: false, encoding: .utf8)
            }
            return status()
        } catch { return status(error: error.localizedDescription) }
    }

    private var available: Bool { launcher != nil && inApplications }

    private func bundledBytes() -> Data? { launcher.flatMap { try? Data(contentsOf: $0) } }

    private func startupFiles() -> [String: String] {
        var files: [String: String] = [:]
        for name in ShellProfile.startupFiles {
            files[name] = try? String(contentsOf: home.appendingPathComponent(name), encoding: .utf8)
        }
        return files
    }

    /// Fresh bytes under a temporary name in the same directory, then one rename over the command.
    private func write(_ bytes: Data) throws {
        let directory = command.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let staging = directory.appendingPathComponent("yap.installing-\(getpid())")
        do {
            try bytes.write(to: staging)
            try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: staging.path)
            guard rename(staging.path, command.path) == 0 else {
                throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
            }
        } catch {
            try? FileManager.default.removeItem(at: staging)
            throw error
        }
    }
}

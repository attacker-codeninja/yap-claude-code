import Foundation

/// The account's home for everything this app installs there. `$HOME` wins when set so a check can
/// point the app at a scratch home; `NSHomeDirectory()` alone ignores an overridden `HOME`.
func accountHome() -> URL {
    let home = ProcessInfo.processInfo.environment["HOME"].flatMap { $0.isEmpty ? nil : $0 }
        ?? NSHomeDirectory()
    return URL(fileURLWithPath: home, isDirectory: true).standardizedFileURL
}

/// Where this build's bundled resources are. Release builds carry Node and the signed launcher;
/// every build carries the consumer skill and the pinned `skills` installer. An absent resource is
/// `nil`, never a guess elsewhere on the machine.
struct AppResources: Sendable {
    /// The interpreter this build recorded: the bundled Node when present, otherwise the one the
    /// service manifest names. `NodeRuntime` validates it before anything runs.
    let node: String
    let launcher: URL?
    let skillSource: URL?
    let skillsInstaller: URL?

    static var main: AppResources {
        AppResources(root: Bundle.main.resourceURL ?? Bundle.main.bundleURL)
    }

    /// `root` is a bundle's `Contents/Resources`.
    init(root: URL) {
        let fileManager = FileManager.default
        func existing(_ relative: String, executable: Bool = false) -> URL? {
            let url = root.appendingPathComponent(relative)
            return (executable ? fileManager.isExecutableFile(atPath: url.path) : fileManager.fileExists(atPath: url.path))
                ? url : nil
        }
        launcher = existing("bin/yap", executable: true)
        skillSource = existing("skill/SKILL.md").map { $0.deletingLastPathComponent() }
        skillsInstaller = existing("skills-installer/cli.mjs")
        if let bundled = existing("node/bin/node", executable: true) {
            node = bundled.path
        } else {
            node = Self.recordedNode(service: root.appendingPathComponent("service", isDirectory: true)) ?? ""
        }
    }

    private struct Manifest: Decodable { let nodePath: String }

    private static func recordedNode(service: URL) -> String? {
        guard let data = try? Data(contentsOf: service.appendingPathComponent("runtime.json")),
              let manifest = try? JSONDecoder().decode(Manifest.self, from: data)
        else { return nil }
        return URL(fileURLWithPath: manifest.nodePath, relativeTo: service).standardizedFileURL.path
    }
}

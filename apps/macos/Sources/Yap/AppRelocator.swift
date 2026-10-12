import AppKit
import Foundation

/// Moves a misplaced `Yap.app` into an Applications folder and relaunches the installed copy.
/// Planning reads the disk only through `Effects`; `perform` carries a plan out in an order
/// that never trashes the copy the person opened before an installed copy exists.
struct AppRelocator: Sendable {
    struct Effects: Sendable {
        /// Copies a bundle, creating the destination folder. Attributes travel with the copy,
        /// including the person's Gatekeeper approval.
        var copy: @Sendable (_ from: URL, _ to: URL) throws -> Void
        var trash: @Sendable (URL) throws -> Void
        /// Starts the installed copy.
        var open: @Sendable (URL) throws -> Void
        /// The bundle's `CFBundleVersion`, or nil when it has none.
        var versionAt: @Sendable (URL) -> String?
        var exists: @Sendable (URL) -> Bool
    }

    enum Plan: Equatable, Sendable {
        /// A same-or-newer copy is installed: open it and trash the original.
        case openInstalled(URL)
        /// An older copy is installed: trash it and copy the original to its place.
        case replace(installed: URL)
        /// Nothing installed: copy the original to `$HOME/Applications`.
        case copyHome(URL)
    }

    struct CopyMissing: Error {
        let url: URL
    }

    let effects: Effects

    /// Compares against the copy agents would use: the launcher's lookup order,
    /// `$HOME/Applications` before `/Applications`.
    func plan(original: URL, ownVersion: String, home: URL) -> Plan {
        let homeCopy = home.appendingPathComponent("Applications/Yap.app")
        let candidates = [homeCopy, URL(fileURLWithPath: "/Applications/Yap.app")]
        guard let installed = candidates.first(where: effects.exists) else { return .copyHome(homeCopy) }
        let version = effects.versionAt(installed) ?? ""
        return Self.compare(version, ownVersion) >= 0 ? .openInstalled(installed) : .replace(installed: installed)
    }

    /// Returns the copy that was relaunched. A thrown error leaves the original in place.
    @discardableResult
    func perform(_ plan: Plan, original: URL) throws -> URL {
        let target: URL
        switch plan {
        case .openInstalled(let installed):
            target = installed
        case .replace(let installed):
            // The older copy goes to the Trash, so it is recoverable if the copy below fails.
            try effects.trash(installed)
            try effects.copy(original, installed)
            target = installed
        case .copyHome(let destination):
            try effects.copy(original, destination)
            target = destination
        }
        guard effects.exists(target) else { throw CopyMissing(url: target) }
        try effects.open(target)
        try effects.trash(original)
        return target
    }

    /// Dot-separated integers, compared numerically; missing or non-numeric parts count as 0.
    static func compare(_ left: String, _ right: String) -> Int {
        let parts = { (version: String) in version.split(separator: ".").map { Int($0) ?? 0 } }
        let (a, b) = (parts(left), parts(right))
        for index in 0..<max(a.count, b.count) {
            let (x, y) = (index < a.count ? a[index] : 0, index < b.count ? b[index] : 0)
            if x != y { return x < y ? -1 : 1 }
        }
        return 0
    }
}

extension AppRelocator.Effects {
    /// The real disk and LaunchServices. `open` waits for this process to exit before opening
    /// the installed copy, so its own launch decision does not hand off back to this one; the
    /// caller terminates after `perform` returns.
    static let live = Self(
        copy: { from, to in
            try FileManager.default.createDirectory(
                at: to.deletingLastPathComponent(), withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: from, to: to)
        },
        trash: { url in try FileManager.default.trashItem(at: url, resultingItemURL: nil) },
        open: { url in
            let relaunch = Process()
            relaunch.executableURL = URL(fileURLWithPath: "/bin/sh")
            relaunch.arguments = [
                "-c", "while /bin/kill -0 \"$1\" 2>/dev/null; do /bin/sleep 0.1; done; /usr/bin/open \"$2\"",
                "yap-relaunch", String(ProcessInfo.processInfo.processIdentifier), url.path,
            ]
            try relaunch.run()
        },
        versionAt: { url in
            NSDictionary(contentsOf: url.appendingPathComponent("Contents/Info.plist"))?["CFBundleVersion"] as? String
        },
        exists: { url in FileManager.default.fileExists(atPath: url.path) })
}

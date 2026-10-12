import Darwin
import Foundation

/// Another running copy of the app, excluding this process.
struct RunningCopy: Equatable, Sendable {
    let pid: pid_t
    let bundleURL: URL
}

/// Whether macOS launched this bundle from a randomized read-only mount (App Translocation),
/// and if so where the copy the person opened lives.
enum Translocation: Equatable, Sendable {
    case notTranslocated
    case resolved(URL)
    /// Translocated, but the original path could not be recovered.
    case unresolved

    /// Asks Security's private translocation SPI (probe P4). Without the SPI, a path inside
    /// an `AppTranslocation` mount still reads as translocated so the caller never offers to
    /// move the mount itself.
    static func of(_ url: URL) -> Translocation {
        typealias IsTranslocated = @convention(c) (
            CFURL, UnsafeMutablePointer<Bool>, UnsafeMutablePointer<Unmanaged<CFError>?>?
        ) -> DarwinBoolean
        typealias CreateOriginal = @convention(c) (
            CFURL, UnsafeMutablePointer<Unmanaged<CFError>?>?
        ) -> Unmanaged<CFURL>?
        let mounted = url.pathComponents.contains("AppTranslocation")
        guard let security = dlopen("/System/Library/Frameworks/Security.framework/Security", RTLD_LAZY),
            let isSymbol = dlsym(security, "SecTranslocateIsTranslocatedURL"),
            let originalSymbol = dlsym(security, "SecTranslocateCreateOriginalPathForURL")
        else { return mounted ? .unresolved : .notTranslocated }
        let isTranslocated = unsafeBitCast(isSymbol, to: IsTranslocated.self)
        let createOriginal = unsafeBitCast(originalSymbol, to: CreateOriginal.self)
        var translocated = false
        guard isTranslocated(url as CFURL, &translocated, nil).boolValue else {
            return mounted ? .unresolved : .notTranslocated
        }
        guard translocated else { return .notTranslocated }
        guard let original = createOriginal(url as CFURL, nil)?.takeRetainedValue() else { return .unresolved }
        return .resolved(original as URL)
    }
}

/// Whether this launch proceeds. One ordered rule, decided from values only; the caller
/// gathers the inputs and carries out the result.
enum LaunchDecision {
    enum Decision: Equatable, Sendable {
        case proceed
        /// Not in an Applications folder. `original` is the copy on disk to move, or nil when a
        /// translocated launch could not resolve it (the caller can only offer Quit).
        case offerMove(original: URL?)
        /// Reopen the running copy, which shows its Settings, and quit.
        case handOff(RunningCopy)
    }

    static let updateRelaunchArgument = "--yap-update-relaunch"

    /// A release build carries a Sparkle feed; dev builds carry none (as `SparkleDriver`).
    static func isRelease(_ bundle: Bundle) -> Bool {
        (bundle.object(forInfoDictionaryKey: "SUFeedURL") as? String).map { !$0.isEmpty } ?? false
    }

    static func decide(
        bundle: URL, home: URL, isRelease: Bool, arguments: [String], running: [RunningCopy],
        translocation: Translocation = .notTranslocated
    ) -> Decision {
        // The exiting copy is still visible during an update relaunch; Sparkle already chose
        // this copy, so it neither moves nor hands off.
        if arguments.contains(updateRelaunchArgument) { return .proceed }
        // Dev builds run beside an installed Yap with their own home, so only releases are single.
        // A running copy comes before location: moving would trash the bundle it runs from.
        guard isRelease else { return .proceed }
        if let other = running.first { return .handOff(other) }
        let original = originalLocation(of: bundle, translocation: translocation)
        guard let original, isInApplicationsFolder(original, home: home) else {
            return .offerMove(original: original)
        }
        return .proceed
    }

    /// Where the app really lives: its own path, or the original behind a translocated launch
    /// (nil when that original can't be found).
    static func originalLocation(of bundle: URL, translocation: Translocation) -> URL? {
        switch translocation {
        case .notTranslocated: return bundle
        case .resolved(let url): return url
        case .unresolved: return nil
        }
    }

    /// The bundle's own folder is `/Applications` or `$HOME/Applications`, after symlinks.
    static func isInApplicationsFolder(_ bundle: URL, home: URL) -> Bool {
        let folder = canonical(bundle.deletingLastPathComponent())
        return folder == canonical(URL(fileURLWithPath: "/Applications"))
            || folder == canonical(home.appendingPathComponent("Applications"))
    }

    private static func canonical(_ url: URL) -> String {
        url.standardizedFileURL.resolvingSymlinksInPath().path
    }
}

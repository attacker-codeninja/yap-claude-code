import AppKit

/// Asks the person to move a misplaced `Yap.app` into Applications. Text only; the caller
/// decides and `AppRelocator` moves.
enum MoveToApplicationsPrompt {
    enum Choice: Equatable, Sendable {
        case move
        case quit
    }

    /// Shows the modal. Without an original on disk, Quit is the only choice.
    @MainActor
    static func show(original: URL?) -> Choice {
        let alert = alert(original: original)
        NSApp.activate()
        let response = alert.runModal()
        return original != nil && response == .alertFirstButtonReturn ? .move : .quit
    }

    @MainActor
    static func alert(original: URL?) -> NSAlert {
        let alert = NSAlert()
        alert.messageText = original == nil ? "Move Yap to Applications" : "Almost there!"
        if let original {
            let folder = FileManager.default.displayName(atPath: original.deletingLastPathComponent().path)
            alert.informativeText = "Yap’s camping in \(folder). Let’s move it home to Applications so your agent can find it."
            alert.addButton(withTitle: "Move it home")
        } else {
            alert.informativeText = "Yap needs to live in your Applications folder so your agent can find it. Drag it there in Finder, then open it again."
        }
        alert.addButton(withTitle: "Quit")
        return alert
    }
}

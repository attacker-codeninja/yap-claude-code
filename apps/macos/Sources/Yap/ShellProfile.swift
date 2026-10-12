import Foundation

/// The marked PATH block Yap adds to a login-shell startup file so `~/.local/bin/yap` is found.
/// Pure text rules: whether a person's startup files already cover `~/.local/bin`, how the block
/// is added and removed, and which file a login shell reads. Reading and writing files is the
/// caller's job.
enum ShellProfile {
    static let block = "# >>> yap >>>\nexport PATH=\"$HOME/.local/bin:$PATH\"\n# <<< yap <<<\n"

    /// Every startup file whose PATH line counts, zsh and bash alike, relative to the home.
    static let startupFiles = [".zshenv", ".zprofile", ".zshrc", ".bash_profile", ".bashrc", ".profile"]

    /// True when any file has an uncommented line naming both `PATH` and `.local/bin`.
    /// Deliberately runs nothing: a heuristic over text, never the person's shell.
    static func covered(files: [String: String]) -> Bool {
        files.values.contains { contents in
            contents.split(whereSeparator: \.isNewline).contains { raw in
                let line = raw.trimmingCharacters(in: .whitespaces)
                return !line.hasPrefix("#") && line.contains("PATH") && line.contains(".local/bin")
            }
        }
    }

    static func contains(_ contents: String) -> Bool { contents.contains(block) }

    /// Appends the block once, on its own lines.
    static func adding(to contents: String) -> String {
        if contains(contents) { return contents }
        if contents.isEmpty || contents.hasSuffix("\n") { return contents + block }
        return contents + "\n" + block
    }

    /// Removes exactly the marked block and nothing else.
    static func removing(from contents: String) -> String {
        contents.replacingOccurrences(of: block, with: "")
    }

    /// The startup file a login shell reads: bash reads `.bash_profile`, everything else is
    /// treated as zsh, the macOS default.
    static func target(shell: String) -> String {
        (shell as NSString).lastPathComponent == "bash" ? ".bash_profile" : ".zprofile"
    }
}

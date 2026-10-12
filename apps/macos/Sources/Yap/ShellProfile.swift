import Foundation

/// The marked PATH block Yap adds to a login-shell startup file so `~/.local/bin/yap` is found.
/// Pure text rules: whether a person's startup files already cover `~/.local/bin`, how the block
/// is added and removed, and which file a login shell reads. Reading and writing files is the
/// caller's job.
enum ShellProfile {
    static let block = "# >>> yap >>>\nexport PATH=\"$HOME/.local/bin:$PATH\"\n# <<< yap <<<\n"

    /// Every startup file Yap may have edited, zsh and bash alike, relative to the home.
    static let startupFiles = [".zshenv", ".zprofile", ".zshrc", ".bash_profile", ".bash_login", ".profile", ".bashrc"]

    /// The startup files the login shell actually reads; only their PATH lines count.
    /// A shell Yap doesn't know reads none of them.
    static func files(shell: String) -> [String] {
        switch (shell as NSString).lastPathComponent {
        case "bash": return [".bash_profile", ".bash_login", ".profile", ".bashrc"]
        case "zsh", "": return [".zshenv", ".zprofile", ".zshrc"]
        default: return []
        }
    }

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

    /// The file the block goes in, or nil for a shell Yap doesn't configure. Bash reads only the
    /// first of `.bash_profile`, `.bash_login`, `.profile` that exists, so the block joins that one;
    /// creating `.bash_profile` beside an existing `.profile` would stop `.profile` loading.
    static func target(shell: String, existing: Set<String>) -> String? {
        switch (shell as NSString).lastPathComponent {
        case "bash":
            return [".bash_profile", ".bash_login", ".profile"].first(where: existing.contains) ?? ".bash_profile"
        case "zsh", "": return ".zprofile"
        default: return nil
        }
    }
}

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Render the production move prompt offscreen: the same NSAlert `show` runs, laid out and
// captured from its own window without running it modally or taking focus.
const output = resolve(process.env.SHOTS ?? "/tmp/yap-move-shots");
mkdirSync(output, { recursive: true });
const sources = new URL("../Sources/Yap/", import.meta.url).pathname;
const icon = new URL("../AppIcon.icns", import.meta.url).pathname;
const scratch = mkdtempSync(join(tmpdir(), "yap-move-prompt-"));
try {
  const stub = join(scratch, "Shots.swift");
  writeFileSync(
    stub,
    String.raw`
import AppKit
@main struct Shots {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        let output = CommandLine.arguments[1]
        // A bare executable has no bundle icon; production shows Yap's own.
        let icon = NSImage(contentsOfFile: CommandLine.arguments[2])!
        let variants: [(String, URL?)] = [
            ("move", URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Downloads/Yap.app")),
            ("quit-only", nil),
        ]
        for (theme, appearance) in [("light", NSAppearance.Name.aqua), ("dark", .darkAqua)] {
            for (name, original) in variants {
                let alert = MoveToApplicationsPrompt.alert(original: original)
                alert.icon = icon
                // An offscreen window is never key, so the default button draws without its
                // accent fill; check the default by its Return key instead.
                precondition(alert.buttons.first?.keyEquivalent == "\r", "The first button is the default")
                let look = NSAppearance(named: appearance)!
                alert.window.appearance = look
                alert.layout()
                let window = alert.window
                window.setFrameOrigin(NSPoint(x: -10000, y: -10000))
                window.orderBack(nil)
                RunLoop.current.run(until: Date().addingTimeInterval(0.4))
                let content = window.contentView!
                content.layoutSubtreeIfNeeded()
                let bitmap = content.bitmapImageRepForCachingDisplay(in: content.bounds)!
                content.cacheDisplay(in: content.bounds, to: bitmap)
                // The alert's material is composited by the window server, which an offscreen
                // capture skips; lay the content over the window background colour instead.
                let flat = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: bitmap.pixelsWide,
                    pixelsHigh: bitmap.pixelsHigh, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                    isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
                flat.size = bitmap.size
                NSGraphicsContext.saveGraphicsState()
                NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: flat)
                look.performAsCurrentDrawingAppearance {
                    NSColor.windowBackgroundColor.setFill()
                    NSRect(origin: .zero, size: bitmap.size).fill()
                }
                bitmap.draw(in: NSRect(origin: .zero, size: bitmap.size), from: .zero,
                    operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
                NSGraphicsContext.restoreGraphicsState()
                try! flat.representation(using: .png, properties: [:])!.write(to:
                    URL(fileURLWithPath: "\(output)/\(theme)-\(name).png"))
                window.orderOut(nil)
            }
        }
    }
}
`,
  );
  const executable = join(scratch, "shots");
  execFileSync(
    "swiftc",
    [
      "-swift-version",
      "6",
      "-parse-as-library",
      join(sources, "MoveToApplicationsPrompt.swift"),
      stub,
      "-o",
      executable,
    ],
    { stdio: "pipe", timeout: 60_000 },
  );
  execFileSync(executable, [output, icon], { timeout: 20_000 });
  console.log(output);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

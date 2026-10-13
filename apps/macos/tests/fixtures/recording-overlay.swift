import AppKit
import SwiftUI
import YapControls

/// The floating take controls, drawn by the production view from synthetic facts: no device,
/// service or permission is touched.
@main struct RecordingOverlayCheck {
    @MainActor static func main() {
        NSApplication.shared.setActivationPolicy(.prohibited)
        let output = CommandLine.arguments[1]
        var performed: [ControlsAction] = []
        let model = RecordingOverlayModel()
        model.presentation = .init(elapsed: "0:42", paused: false, symbol: "record.circle.fill")
        model.cameraActive = true
        model.preview = cameraFrame()
        let host = NSHostingView(rootView: RecordingOverlayView(model: model, perform: { performed.append($0) }))
        host.sizingOptions = [.intrinsicContentSize]
        let window = NSWindow(contentRect: NSRect(x: -10000, y: -10000, width: 10, height: 10),
                              styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.isOpaque = false
        window.backgroundColor = .clear
        window.contentView = host
        window.orderBack(nil)

        func settle() {
            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
            host.layoutSubtreeIfNeeded()
            window.setContentSize(host.fittingSize)
            RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        }
        func capture() -> NSBitmapImageRep {
            let bitmap = host.bitmapImageRepForCachingDisplay(in: host.bounds)!
            host.cacheDisplay(in: host.bounds, to: bitmap)
            return bitmap
        }
        /// Every action a sweep of clicks across a strip of the controls sends, in order.
        func offered(y: CGFloat, from: CGFloat = 0, to: CGFloat? = nil) -> [ControlsAction] {
            performed.removeAll()
            var x = from
            while x < (to ?? host.bounds.width) {
                let point = host.convert(NSPoint(x: x, y: y), to: nil)
                for type in [NSEvent.EventType.leftMouseDown, .leftMouseUp] {
                    window.sendEvent(NSEvent.mouseEvent(with: type, location: point, modifierFlags: [], timestamp: 0,
                        windowNumber: window.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1)!)
                }
                RunLoop.current.run(until: Date().addingTimeInterval(0.01))
                x += 4
            }
            var unique: [ControlsAction] = []
            for action in performed where unique.last != action { unique.append(action) }
            return unique
        }
        /// The row of controls sits at the bottom of the panel.
        func row() -> CGFloat { host.isFlipped ? host.bounds.height - 22 : 22 }

        settle()
        let shown = capture()
        // Retain the picture before an assertion can stop the run.
        save(shown, "\(output)/camera-preview.png")
        // The synthetic camera frame carries a yellow border, so it marks the preview's edges.
        guard let frame = bounds(of: shown, where: isFrameBorder) else { preconditionFailure("The camera preview must be drawn") }
        let left = frame.minX, right = shown.pixelsWide - 1 - frame.maxX
        precondition(abs(left - right) <= 2, "The preview must be centred over the controls: \(left) vs \(right) px")
        for (x, y) in [(frame.minX, frame.minY), (frame.maxX, frame.minY), (frame.minX, frame.maxY), (frame.maxX, frame.maxY)] {
            precondition(!isFrameBorder(shown.colorAt(x: x, y: y)), "The preview's corners must be rounded, not square")
        }
        // A 4:3 camera fills the 16:9 card from its centre: its sides reach the card's edges, its
        // top and bottom are cropped.
        let middle = (frame.minY + frame.maxY) / 2
        precondition(isFrameBorder(shown.colorAt(x: frame.minX + 2, y: middle)) && isFrameBorder(shown.colorAt(x: frame.maxX - 2, y: middle)),
                     "The camera picture must fill the card from side to side")
        precondition(!isFrameBorder(shown.colorAt(x: (frame.minX + frame.maxX) / 2, y: frame.minY + 2)),
                     "The camera picture is cropped from its centre, not squeezed into the card")
        let scale = CGFloat(shown.pixelsWide) / host.bounds.width
        let rowPixel = Int((host.isFlipped ? host.bounds.height - 22 : 22) * scale)
        let rowY = shown.pixelsHigh - 1 - rowPixel
        let drawn = (0..<shown.pixelsWide).filter { (shown.colorAt(x: $0, y: rowY)?.alphaComponent ?? 0) > 0.5 }
        precondition(abs((drawn.first ?? 0) - frame.minX) <= 2 && abs((drawn.last ?? 0) - frame.maxX) <= 2,
                     "The picture is exactly as wide as the controls beneath it: \(frame.minX)...\(frame.maxX) vs \(drawn.first ?? -1)...\(drawn.last ?? -1)")

        let cardTop = CGFloat(frame.minY) / scale + 12
        let previewActions = offered(y: host.isFlipped ? cardTop : host.bounds.height - cardTop)
        precondition(previewActions == [.showCameraPreview(false)],
                     "The preview offers only Minimize, which hides the picture without stopping the camera: \(previewActions)")
        let shownRow = offered(y: row())
        precondition(shownRow == [.pauseOrResume, .startOrStop, .cancel], "Take controls with the preview shown: \(shownRow)")
        model.previewShown = false
        settle()
        let minimized = capture()
        precondition(bounds(of: minimized, where: isFrameBorder) == nil, "A minimized preview draws no camera picture")
        precondition(minimized.pixelsHigh < shown.pixelsHigh, "Minimizing the preview shrinks the controls")
        save(minimized, "\(output)/camera-preview-minimized.png")
        let minimizedRow = offered(y: row())
        precondition(minimizedRow == [.pauseOrResume, .startOrStop, .showCameraPreview(true), .cancel],
                     "The minimized preview can be brought back from the controls: \(minimizedRow)")

        model.cameraActive = false
        model.preview = nil
        model.previewShown = true
        settle()
        let noCameraRow = offered(y: row())
        precondition(noCameraRow == [.pauseOrResume, .startOrStop, .cancel], "A take without a camera offers no preview controls: \(noCameraRow)")
        save(capture(), "\(output)/no-camera.png")

        model.cameraActive = true
        model.preview = cameraFrame()
        model.presentation = .init(elapsed: "0:42", paused: true, symbol: "pause.circle.fill")
        settle()
        save(capture(), "\(output)/camera-preview-paused.png")

        window.appearance = NSAppearance(named: .darkAqua)
        model.presentation = .init(elapsed: "0:42", paused: false, symbol: "record.circle.fill")
        settle()
        save(capture(), "\(output)/dark-camera-preview.png")
        model.previewShown = false
        settle()
        save(capture(), "\(output)/dark-camera-preview-minimized.png")
        window.orderOut(nil)
    }

    /// A 4:3 camera picture: a yellow border marks its edges, crosshairs mark its centre.
    @MainActor static func cameraFrame() -> NSImage {
        NSImage(size: NSSize(width: 1440, height: 1080), flipped: false) { rect in
            NSColor(calibratedRed: 0.25, green: 0.45, blue: 0.6, alpha: 1).setFill()
            rect.fill()
            NSColor.systemOrange.setFill()
            NSBezierPath(ovalIn: NSRect(x: rect.midX - 200, y: rect.midY - 200, width: 400, height: 400)).fill()
            let cross = NSBezierPath()
            cross.lineWidth = 10
            cross.move(to: NSPoint(x: rect.midX, y: 0)); cross.line(to: NSPoint(x: rect.midX, y: rect.maxY))
            cross.move(to: NSPoint(x: 0, y: rect.midY)); cross.line(to: NSPoint(x: rect.maxX, y: rect.midY))
            NSColor.white.setStroke()
            cross.stroke()
            let border = NSBezierPath(rect: rect.insetBy(dx: 30, dy: 30))
            border.lineWidth = 60
            NSColor(calibratedRed: 1, green: 1, blue: 0, alpha: 1).setStroke()
            border.stroke()
            return true
        }
    }

    static func isFrameBorder(_ color: NSColor?) -> Bool {
        guard let c = color?.usingColorSpace(.deviceRGB) else { return false }
        return c.redComponent > 0.8 && c.greenComponent > 0.8 && c.blueComponent < 0.35 && c.alphaComponent > 0.9
    }

    static func bounds(of bitmap: NSBitmapImageRep, where match: (NSColor?) -> Bool) -> (minX: Int, minY: Int, maxX: Int, maxY: Int)? {
        var box: (minX: Int, minY: Int, maxX: Int, maxY: Int)?
        for y in 0..<bitmap.pixelsHigh {
            for x in 0..<bitmap.pixelsWide where match(bitmap.colorAt(x: x, y: y)) {
                box = (min(box?.minX ?? x, x), min(box?.minY ?? y, y), max(box?.maxX ?? x, x), max(box?.maxY ?? y, y))
            }
        }
        return box
    }

    static func save(_ bitmap: NSBitmapImageRep, _ path: String) {
        try! bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
    }
}

func diagnostic(_ message: String) {}
enum ControlsProbe { static let observed = true }

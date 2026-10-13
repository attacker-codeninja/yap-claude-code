import AppKit
import Combine
import YapControls
import SwiftUI

/**
 The floating controls a take carries while it runs.

 They are the menu's transport row in a window a person can reach without opening the menu: pause
 or resume, finish, cancel, and the take's own elapsed playback time. Every button sends the same
 action the menu sends, so there is no second device state machine here and no clock of its own —
 what to show, and whether to show anything at all, is decided from the one controls state.
 A take that records a camera also carries its live picture above the row. Minimizing the picture
 hides it without stopping the camera; the camera button in the row turns a reserved camera on or
 off, and a camera that is off has no picture at all.
 */
@MainActor
final class RecordingOverlayPanel {
    static let title = "Yap Controls"
    /// How far above the bottom of the screen a take's controls first appear.
    private static let margin: CGFloat = 72

    private let preferences: Preferences
    private let perform: (ControlsAction) -> Void
    private let model = RecordingOverlayModel()
    private var panel: OverlayPanel?
    private var moved: NSObjectProtocol?
    private var changes: AnyCancellable?

    init(preferences: Preferences, perform: @escaping (ControlsAction) -> Void) {
        self.preferences = preferences
        self.perform = perform
    }

    /// What the controls state says these controls are: on screen saying this, or not on screen.
    func update(_ presentation: RecordingOverlay.Presentation?) {
        guard let presentation else { return hide() }
        model.presentation = presentation
        show()
    }

    /// The take's camera, and whether its live picture is shown or minimized.
    func updateCamera(_ camera: RecordingOverlay.Camera, previewShown: Bool) {
        model.camera = camera
        model.previewShown = previewShown
    }

    func updatePreview(_ image: NSImage?) { model.preview = image }

    private func show() {
        guard panel == nil else { return }
        let content = NSHostingView(
            rootView: RecordingOverlayView(model: model, perform: { [weak self] in self?.perform($0) }))
        // The row decides how wide the controls are, so the space around it is the padding it
        // asked for rather than whatever is left over inside a fixed panel, and a take that runs
        // past an hour widens the panel instead of crowding its own clock.
        content.sizingOptions = [.intrinsicContentSize]
        let size = content.fittingSize
        let panel = OverlayPanel(
            contentRect: NSRect(origin: startingOrigin(size), size: size), level: .floating,
            title: Self.title)
        panel.isMovableByWindowBackground = true
        panel.contentView = content
        // Where a person leaves the controls is where the next take finds them.
        moved = NotificationCenter.default.addObserver(
            forName: NSWindow.didMoveNotification, object: panel, queue: .main
        ) { [weak self, weak panel] _ in
            MainActor.assumeIsolated {
                guard let self, let panel else { return }
                self.preferences.overlayOrigin = panel.frame.origin
            }
        }
        self.panel = panel
        // The picture above the controls comes and goes, and a take that runs past an hour widens
        // the row, so the panel follows what the controls ask for once they have laid themselves
        // out again. The bottom edge holds still: that is where the person's hand is.
        changes = model.objectWillChange.sink { [weak self] _ in
            DispatchQueue.main.async { MainActor.assumeIsolated { self?.fit() } }
        }
        panel.present()
        describe(panel)
    }

    private func fit() {
        guard let panel, let content = panel.contentView else { return }
        content.layoutSubtreeIfNeeded()
        let size = content.fittingSize
        guard size != panel.frame.size else { return }
        let old = panel.frame
        panel.setFrame(NSRect(x: old.midX - size.width / 2, y: old.minY, width: size.width, height: size.height),
                       display: true)
    }

    private func hide() {
        guard let panel else { return }
        if let moved { NotificationCenter.default.removeObserver(moved) }
        moved = nil
        changes = nil
        self.panel = nil
        panel.close()
    }

    /// Where the controls were last left, if that is still somewhere a person can see, and the
    /// bottom of the screen they are working on otherwise.
    private func startingOrigin(_ size: NSSize) -> NSPoint {
        if let saved = preferences.overlayOrigin,
            NSScreen.screens.contains(where: {
                $0.visibleFrame.intersects(NSRect(origin: saved, size: size))
            }) {
            return saved
        }
        let visible = (NSScreen.main ?? NSScreen.screens.first)?.visibleFrame
            ?? NSRect(x: 0, y: 0, width: size.width, height: size.height)
        return NSPoint(x: visible.midX - size.width / 2, y: visible.minY + Self.margin)
    }

    /// Where these controls are on the display a take of that display would record them, so a
    /// check can look at exactly that part of a recorded frame.
    private func describe(_ panel: OverlayPanel) {
        guard let screen = panel.screen ?? NSScreen.main, let id = screen.captureDisplayID,
            let rect = screen.displayLocal(panel.frame)
        else { return }
        diagnostic(
            "recording overlay display=\(id) rect=\(Int(rect.minX)),\(Int(rect.minY)),"
                + "\(Int(rect.width)),\(Int(rect.height))")
    }
}

@MainActor
final class RecordingOverlayModel: ObservableObject {
    @Published var presentation = RecordingOverlay.Presentation(
        elapsed: "0:00", paused: false, symbol: "record.circle.fill")
    /// The take's camera: whether it can be turned on and off, and whether it has a picture.
    @Published var camera = RecordingOverlay.Camera.none {
        didSet { if !camera.recording { preview = nil } }
    }
    /// Whether that picture is shown or minimized; the camera records either way.
    @Published var previewShown = true
    /// The camera's latest picture. A camera that is off has none, so no held picture is shown
    /// and turning it back on waits for a new one.
    @Published var preview: NSImage? {
        didSet { if !camera.recording, preview != nil { preview = nil } }
    }
}

/// The controls themselves: the camera's live picture when the take records one, then a row with
/// a state mark, the take's playback time and the transport actions, each sending the action the
/// menu sends.
struct RecordingOverlayView: View {
    @ObservedObject var model: RecordingOverlayModel
    let perform: (ControlsAction) -> Void

    private var paused: Bool { model.presentation.paused }

    var body: some View {
        PictureAboveRow {
            if model.camera.recording && model.previewShown {
                preview
            }
            controls
        }
    }

    /// The picture fills its card and is cropped from its centre, never squeezed.
    private var preview: some View {
        let card = RoundedRectangle(cornerRadius: 14, style: .continuous)
        return Color.black
            .overlay {
                if let image = model.preview {
                    Image(nsImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } else {
                    Image(systemName: "video")
                        .font(.system(size: 20, weight: .regular))
                        .foregroundStyle(.white.opacity(0.5))
                }
            }
            .clipShape(card)
            .overlay(card.strokeBorder(.white.opacity(0.14), lineWidth: 0.5))
            .overlay(alignment: .topTrailing) {
                Button { perform(.showCameraPreview(false)) } label: {
                    Image(systemName: "minus")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 22, height: 22)
                        .background(.black.opacity(0.5), in: Circle())
                        .overlay(Circle().strokeBorder(.white.opacity(0.25), lineWidth: 0.5))
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .padding(8)
                .help("Minimize camera preview")
                .accessibilityLabel("Minimize camera preview")
            }
    }

    private var controls: some View {
        HStack(spacing: 10) {
            Image(systemName: model.presentation.symbol)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(paused ? AnyShapeStyle(.primary) : AnyShapeStyle(Color.red))
                .frame(width: 15)
                .accessibilityLabel(paused ? "Paused" : "Recording")
            Text(model.presentation.elapsed)
                .font(.system(size: 15, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(paused ? AnyShapeStyle(.secondary) : AnyShapeStyle(.primary))
                .frame(minWidth: 62, alignment: .leading)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
            separator
            HStack(spacing: 2) {
                button(paused ? "play.fill" : "pause.fill",
                    paused ? "Resume Recording" : "Pause Recording", .pauseOrResume)
                button("stop.fill", "Finish Recording", .startOrStop, tint: .red)
            }
            if case .companion(let on) = model.camera {
                separator
                HStack(spacing: 2) {
                    cameraSwitch(on)
                    if on && !model.previewShown { restore }
                }
            } else if model.camera.recording && !model.previewShown {
                separator
                restore
            }
            separator
            button("trash.fill", "Cancel Take", .cancel)
        }
        // A button's tappable box reaches past the mark it draws, so the trailing edge needs less
        // room than the leading one for the two to look the same.
        .padding(.leading, 16)
        .padding(.trailing, 6)
        .padding(.vertical, 5)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(.separator, lineWidth: 0.5))
    }

    /// The camera's state twice over, so neither colour nor a thin slash has to carry it alone: on
    /// is an engaged toggle showing a camera, off a plain one showing the camera struck through.
    /// Off keeps full contrast: it is a state to change, not an unavailable control.
    private func cameraSwitch(_ on: Bool) -> some View {
        let name = on ? "Turn Camera Off" : "Turn Camera On"
        return Toggle(isOn: Binding(get: { on }, set: { perform(.setCamera($0)) })) {
            Image(systemName: on ? "video.fill" : "video.slash.fill")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.primary)
                .frame(width: 30, height: 30)
                .contentShape(Circle())
        }
        .toggleStyle(.button)
        .buttonStyle(.accessoryBar)
        .clipShape(Circle())
        .help(name)
        .accessibilityLabel(name)
    }

    private var restore: some View {
        button("pip.exit", "Show camera preview", .showCameraPreview(true))
    }

    private var separator: some View {
        Rectangle().fill(.separator).frame(width: 1, height: 20)
    }

    private func button(
        _ symbol: String, _ name: String, _ action: ControlsAction, tint: Color? = nil
    ) -> some View {
        Button { perform(action) } label: {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tint ?? .primary)
                .frame(width: 30, height: 30)
                .contentShape(Circle())
        }
        .buttonStyle(.accessoryBar)
        .clipShape(Circle())
        .help(name)
        .accessibilityLabel(name)
    }
}

/// The row of controls decides the width; a picture above it takes that width at 16:9.
private struct PictureAboveRow: Layout {
    private static let spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let row = subviews.last else { return .zero }
        let size = row.sizeThatFits(.unspecified)
        let pictures = CGFloat(subviews.count - 1)
        return CGSize(width: size.width, height: size.height + pictures * (size.width * 9 / 16 + Self.spacing))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let row = subviews.last else { return }
        let size = row.sizeThatFits(.unspecified)
        var y = bounds.minY
        for picture in subviews.dropLast() {
            let height = size.width * 9 / 16
            picture.place(at: CGPoint(x: bounds.minX, y: y), proposal: ProposedViewSize(width: size.width, height: height))
            y += height + Self.spacing
        }
        row.place(at: CGPoint(x: bounds.minX, y: y), proposal: ProposedViewSize(size))
    }
}

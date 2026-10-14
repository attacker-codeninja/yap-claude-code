import AppKit
import AVKit

/// Native presentation only. The preview controller owns readiness, identity and the delivery lease.
@MainActor
final class PreviewWindow: NSObject, PreviewPresenting, NSWindowDelegate {
    private var window: NSWindow?
    private var playerView: AVPlayerView?
    private var playerObservation: NSKeyValueObservation?
    private var compositionTask: Task<Void, Never>?
    private var message: NSTextField?
    private var retry: NSButton?
    private var onRetry: (@MainActor () -> Void)?
    private var onClose: (@MainActor () -> Void)?
    private var timelineBar: NSStackView?
    private var timelineActions: [ObjectIdentifier: @MainActor () -> Void] = [:]
    private var exportAction: (@MainActor () -> Void)?

    /// Checks that intentionally exercise real windows keep them behind the person's work.
    private static let observed = !(ProcessInfo.processInfo.environment["YAP_FIXTURE_CONTROLS"] ?? "")
        .isEmpty

    func open(title: String, retry onRetry: @escaping @MainActor () -> Void,
        closed onClose: @escaping @MainActor () -> Void)
    {
        self.onRetry = onRetry
        self.onClose = onClose
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 800, height: 500),
            styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.title = title
        // Watching an earlier take must stay out of every capture, including one already running.
        window.sharingType = .none
        let view = AVPlayerView(frame: window.contentView!.bounds)
        view.autoresizingMask = [.width, .height]
        view.controlsStyle = .floating
        view.showsSharingServiceButton = false
        view.allowsVideoFrameAnalysis = false
        window.contentView = view
        let bar = NSStackView(frame: NSRect(x: 12, y: view.bounds.height - 38, width: view.bounds.width - 24, height: 28))
        bar.autoresizingMask = [.width, .minYMargin]
        bar.orientation = .horizontal
        bar.alignment = .centerY
        bar.spacing = 6
        bar.distribution = .fillProportionally
        bar.wantsLayer = true
        bar.layer?.backgroundColor = NSColor.windowBackgroundColor.withAlphaComponent(0.9).cgColor
        view.addSubview(bar)
        timelineBar = bar
        let label = NSTextField(wrappingLabelWithString: "Preparing preview…")
        label.frame = NSRect(x: 24, y: 220, width: 752, height: 60)
        label.autoresizingMask = [.width, .minYMargin, .maxYMargin]
        label.alignment = .center
        label.textColor = .white
        view.addSubview(label)
        let button = NSButton(title: "Retry Preview", target: self, action: #selector(retryPreview))
        button.frame = NSRect(x: 330, y: 180, width: 140, height: 32)
        button.autoresizingMask = [.minXMargin, .maxXMargin, .minYMargin, .maxYMargin]
        button.isHidden = true
        view.addSubview(button)
        self.window = window
        playerView = view
        message = label
        retry = button
        window.center()
        // An ordinary user preview comes forward; an explicit window check never takes focus.
        if Self.observed {
            window.orderBack(nil)
        } else {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    func show(title: String, message: String, canRetry: Bool) {
        window?.title = title
        self.message?.stringValue = message
        self.message?.isHidden = false
        retry?.isHidden = !canRetry
    }

    func showTimeline(_ items: [PreviewTimelineItem], selected: String, select: @escaping @MainActor (String) -> Void) {
        guard let bar = timelineBar else { return }
        for view in bar.arrangedSubviews {
            bar.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        timelineActions.removeAll()
        for item in items {
            let button = NSButton(title: item.label, target: self, action: #selector(selectTimeline(_:)))
            button.bezelStyle = .texturedRounded
            button.controlSize = .small
            button.toolTip = item.operation
            button.identifier = .init("timeline.\(item.id)")
            button.state = item.id == selected ? .on : .off
            timelineActions[ObjectIdentifier(button)] = { select(item.id) }
            bar.addArrangedSubview(button)
        }
    }

    func showExport(_ action: @escaping @MainActor () -> Void) {
        exportAction = action
        guard let view = playerView else { return }
        let button = NSButton(title: "Export", target: self, action: #selector(exportPreview(_:)))
        button.bezelStyle = .rounded
        button.controlSize = .small
        button.identifier = .init("inspector.export")
        button.frame = NSRect(x: view.bounds.width - 92, y: view.bounds.height - 38, width: 80, height: 26)
        button.autoresizingMask = [.minXMargin, .minYMargin]
        view.addSubview(button)
    }

    func play(title: String, file: String, mediaType: String,
        failed: @escaping @MainActor (String) -> Void)
    {
        window?.title = title
        message?.isHidden = true
        retry?.isHidden = true
        // Cache names describe ownership, not containers; use the validated receipt's MIME type.
        let asset = AVURLAsset(url: URL(fileURLWithPath: file),
            options: [AVURLAssetOverrideMIMETypeKey: mediaType])
        let item = AVPlayerItem(asset: asset)
        playerObservation = item.observe(\.status, options: [.new]) { item, _ in
            guard item.status == .failed else { return }
            let reason = item.error?.localizedDescription ?? "Preview playback failed."
            Task { @MainActor in failed(reason) }
        }
        playerView?.player = AVPlayer(playerItem: item)
        playerView?.player?.play()
    }

    func playLocalFile(title: String, file: String, mediaType: String) {
        close()
        open(title: title, retry: {}, closed: {})
        play(title: title, file: file, mediaType: mediaType, failed: { _ in })
    }

    /// A captured take stores picture and microphone narration as separate canonical members.
    /// AVPlayer accepts an in-memory composition, so the library can preview both without
    /// manufacturing a derived file or changing the retained source.
    func playLocalRecording(title: String, video: String, narration: String) {
        close()
        open(title: title, retry: {}, closed: {})
        let picture = AVURLAsset(url: URL(fileURLWithPath: video),
            options: [AVURLAssetOverrideMIMETypeKey: "video/quicktime"])
        let voice = AVURLAsset(url: URL(fileURLWithPath: narration),
            options: [AVURLAssetOverrideMIMETypeKey: "video/quicktime"])
        let composition = AVMutableComposition()
        compositionTask = Task { @MainActor [weak self] in
          do {
            let pictureTracks = try await picture.loadTracks(withMediaType: .video)
            let voiceTracks = try await voice.loadTracks(withMediaType: .audio)
            guard let pictureTrack = pictureTracks.first, let voiceTrack = voiceTracks.first else {
                throw NSError(domain: "YapPreview", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Recording media has no playable tracks."])
            }
            guard let composedPicture = composition.addMutableTrack(withMediaType: .video,
                preferredTrackID: kCMPersistentTrackID_Invalid),
                let composedVoice = composition.addMutableTrack(withMediaType: .audio,
                    preferredTrackID: kCMPersistentTrackID_Invalid) else {
                throw NSError(domain: "YapPreview", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "Could not create preview tracks."])
            }
            try composedPicture.insertTimeRange(pictureTrack.timeRange, of: pictureTrack, at: .zero)
            try composedVoice.insertTimeRange(voiceTrack.timeRange, of: voiceTrack, at: .zero)
            let item = AVPlayerItem(asset: composition)
            self?.playerObservation = item.observe(\.status, options: [.new]) { item, _ in
                guard item.status == .failed else { return }
            }
            self?.message?.isHidden = true
            self?.retry?.isHidden = true
            self?.playerView?.player = AVPlayer(playerItem: item)
            self?.playerView?.player?.play()
          } catch {
            guard !Task.isCancelled else { return }
            self?.show(title: title, message: error.localizedDescription, canRetry: false)
          }
        }
    }

    func close() {
        compositionTask?.cancel()
        compositionTask = nil
        playerObservation = nil
        playerView?.player?.pause()
        playerView?.player?.replaceCurrentItem(with: nil)
        playerView?.player = nil
        window?.delegate = nil
        window?.close()
        window = nil
        playerView = nil
        message = nil
        retry = nil
        onRetry = nil
        onClose = nil
        timelineBar = nil
        timelineActions.removeAll()
        exportAction = nil
    }

    func windowWillClose(_ notification: Notification) {
        guard notification.object as? NSWindow === window else { return }
        onClose?()
    }

    @objc private func retryPreview() { onRetry?() }
    @objc private func selectTimeline(_ sender: NSButton) { timelineActions[ObjectIdentifier(sender)]?() }
    @objc private func exportPreview(_ sender: NSButton) { exportAction?() }
}

@preconcurrency import AVFoundation
import Foundation
import YapCapture
import YapMedia

@MainActor
final class FixtureCameraSession: CaptureCameraSession {
    var width = RecoveryFixture.width
    var height = RecoveryFixture.height
    let source: URL
    let origin: () -> Int64
    nonisolated var synchronizationClock: CMClockOrTimebase? { CMClockGetHostTimeClock() }
    var starts = 0
    var stops = 0
    /// Stops that arrived while a start was still running.
    var stopsDuringStart = 0
    private var starting = false
    var failureAfterDelivery: CaptureFailure?
    var deliverFrames = true
    /// Pictures are stamped from the moment this session starts, as a camera opened mid-take is.
    var startsAtNow = false
    /// Delivers only the first picture, lasting this long, so a run is cheap to make.
    var pulseUs: Int64?
    /// Rewraps each picture with an equivalent format description that is not byte-equal, as a
    /// re-created platform session may.
    var equivalentFormat = false
    var holdStart = false
    var holdStop = false
    let stopEntered = InputGate()
    let releaseStop = InputGate()
    let startEntered = InputGate()
    let releaseStart = InputGate()
    var onFailure: (@Sendable (CaptureFailure) -> Void)?
    private var observing = false
    private var ingress: CaptureClockIngress?
    private var lastSample: CMSampleBuffer?
    init(source: URL, origin: @escaping () -> Int64) { self.source = source; self.origin = origin }
    func start(ingress: CaptureClockIngress) async throws {
        starts += 1
        starting = true
        defer { starting = false }
        self.ingress = ingress
        if holdStart { startEntered.release(); await releaseStart.wait() }
        guard deliverFrames else { return }
        let asset = AVURLAsset(url: source)
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        reader.add(output); precondition(reader.startReading())
        let base = startsAtNow ? CaptureHostTime.nowUs() + 1000 : origin() + 200000
        while let sample = output.copyNextSampleBuffer() {
            let host = CMTimeAdd(sample.presentationTimeStamp, CMTime(value: base, timescale: 1000000))
            let picture = equivalentFormat ? try Self.equivalentlyDescribed(sample) : sample
            lastSample = picture
            let timed = try CaptureClockIngress.retime(picture, to: host,
                duration: pulseUs.map { CMTime(value: $0, timescale: 1000000) })
            ingress.writer.queue.sync { () -> Void in ingress.accept(timed, role: .camera, from: synchronizationClock) }
            if pulseUs != nil { break }
            try await Task.sleep(for: .milliseconds(5))
        }
        if let failureAfterDelivery { throw failureAfterDelivery }
    }
    func offer(at hostUs: Int64) throws {
        let ingress = ingress!
        let timed = try CaptureClockIngress.retime(lastSample!, to: CMTime(value: hostUs, timescale: 1000000))
        ingress.writer.queue.sync { () -> Void in ingress.accept(timed, role: .camera, from: synchronizationClock) }
    }
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {
        self.onFailure = onFailure; observing = true
    }
    /// The platform's disconnect notice: it reaches only a session still observing it.
    func loseDevice() {
        if observing { onFailure?(CaptureFailure("SOURCE_LOST", "Fixture camera disconnected")) }
    }
    func stop() async -> CaptureFailure? {
        stops += 1
        if starting { stopsDuringStart += 1 }
        observing = false
        if holdStop { stopEntered.release(); await releaseStop.wait() }
        return nil
    }

    private static func equivalentlyDescribed(_ sample: CMSampleBuffer) throws -> CMSampleBuffer {
        let image = sample.imageBuffer!
        let original = sample.formatDescription!
        var extensions = (CMFormatDescriptionGetExtensions(original) as? [String: Any]) ?? [:]
        extensions["YapFixtureSession"] = "re-created"
        var description: CMVideoFormatDescription?
        let size = CMVideoFormatDescriptionGetDimensions(original)
        guard CMVideoFormatDescriptionCreate(allocator: kCFAllocatorDefault,
            codecType: CMFormatDescriptionGetMediaSubType(original), width: size.width, height: size.height,
            extensions: extensions as CFDictionary, formatDescriptionOut: &description) == noErr, let description else {
            throw CaptureFailure("FIXTURE_FAILED", "Cannot describe fixture picture")
        }
        precondition(!CMFormatDescriptionEqual(original, otherFormatDescription: description))
        var timing = CMSampleTimingInfo(duration: sample.duration, presentationTimeStamp: sample.presentationTimeStamp,
            decodeTimeStamp: .invalid)
        var rewrapped: CMSampleBuffer?
        guard CMSampleBufferCreateReadyWithImageBuffer(allocator: kCFAllocatorDefault, imageBuffer: image,
            formatDescription: description, sampleTiming: &timing, sampleBufferOut: &rewrapped) == noErr, let rewrapped else {
            throw CaptureFailure("FIXTURE_FAILED", "Cannot rewrap fixture picture")
        }
        return rewrapped
    }
}

/// Prepares a screen take with a companion camera exactly as NativeCapture does, with a
/// prerecorded screen and a fixture device in place of the platform's.
@MainActor
func prepareFixtureCompanion(_ request: CaptureRequest, screen: any CaptureInputSession,
    device: FixtureCameraDevice, selection: CaptureCameraSelection) async throws -> any CaptureInputSession {
    var preparation = CaptureInputPreparation()
    preparation.requireScreenAuthorization = { _ in }
    preparation.prepareScreen = { _ in screen }
    preparation.cameraAuthorized = { true }
    preparation.cameras = { [device] }
    return try await preparation.prepare(request, camera: selection, checkInterruption: {})
}

@MainActor
final class FixtureCameraDevice: CaptureCameraDevice {
    let id: String
    /// The session the first open returns.
    let session: FixtureCameraSession
    var opens = 0
    var unavailable = false
    /// Builds the session each later open returns, as the platform builds a new one per open.
    /// Without it every open returns the first session.
    var reopen: (() -> FixtureCameraSession)?
    private(set) var sessions: [FixtureCameraSession] = []
    init(_ id: String, session: FixtureCameraSession) { self.id = id; self.session = session }
    func makeSession(framesPerSecond: Int?, microphone: AVCaptureDevice?) throws -> any CaptureCameraSession {
        opens += 1
        if unavailable { throw CaptureFailure("SOURCE_UNAVAILABLE", "Fixture camera disappeared") }
        let next = sessions.isEmpty ? session : reopen?() ?? session
        sessions.append(next)
        return next
    }
}

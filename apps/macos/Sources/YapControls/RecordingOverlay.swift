import Foundation

/**
 The floating controls a take carries while it runs.

 They are a second view of the same state the menu shows, so what they read is decided here rather
 than by a window watching the device for itself: a take that is recording or paused has controls
 on screen, and anything else — nothing live, a take being finalized, a service that can no longer
 answer — has none.
 */
public enum RecordingOverlay {
    /// What the floating controls say, or nil whenever they must not be on screen at all.
    public struct Presentation: Equatable, Sendable {
        public init(elapsed: String, paused: Bool, symbol: String) {
            self.elapsed = elapsed
            self.paused = paused
            self.symbol = symbol
        }
        /// The take's own playback time, written the way the menu writes it.
        public let elapsed: String
        public let paused: Bool
        /// The mark the status item already carries for this state. The two surfaces say the same
        /// thing with the same shape, and a person who cannot tell the colours apart still can.
        public let symbol: String
    }

    /// The camera a live take's controls offer.
    public enum Camera: Equatable, Sendable {
        case none
        /// The take's own source: its picture is shown, and it cannot be turned off.
        case primary
        /// A companion camera the take reserved, which can be turned on and off.
        case companion(on: Bool)

        /// Whether the camera is recording, so it has a live picture to show.
        public var recording: Bool { self == .primary || self == .companion(on: true) }
    }

    /// What native reports about the live take's camera, never the selection it started from.
    public static func camera(for state: ControlsState) -> Camera {
        guard state.isLive else { return .none }
        if state.selection.source == .camera { return .primary }
        return state.device?.camera.map { .companion(on: $0.state == .on) } ?? .none
    }

    public static func presentation(for state: ControlsState) -> Presentation? {
        guard let device = state.device, device.state == .recording || device.state == .paused
        else { return nil }
        return Presentation(
            elapsed: ElapsedTime.format(device.elapsedUs), paused: device.state == .paused,
            symbol: StatusItemAppearance.symbolName(for: state))
    }
}

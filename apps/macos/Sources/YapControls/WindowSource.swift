/// One on-screen window as the capture system describes it, and whether the window chooser
/// offers it. People record the windows they work in; the menu bar, status items, the Dock,
/// wallpaper, invisible overlays and Yap's own panels are surfaces of the system, not sources.
public struct WindowSource: Sendable {
    public let layer: Int
    public let application: String
    /// Whether the window belongs to this app, by the identity a take's exclusion uses.
    public let isOwn: Bool
    public let width: Double
    public let height: Double

    public init(layer: Int, application: String, isOwn: Bool, width: Double, height: Double) {
        self.layer = layer
        self.application = application
        self.isOwn = isOwn
        self.width = width
        self.height = height
    }

    /// Ordinary app windows live on the normal layer (0); every system surface sits on another.
    private static let normalLayer = 0
    /// Smaller than this is a helper panel or a sliver, not something worth recording on its own.
    private static let minimumSize = (width: 120.0, height: 80.0)

    public var isRecordable: Bool {
        layer == Self.normalLayer
            && !application.isEmpty
            && !isOwn
            && width >= Self.minimumSize.width && height >= Self.minimumSize.height
    }
}

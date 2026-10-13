/// One on-screen window as the capture system describes it, and whether the window chooser
/// offers it. People record the windows they work in; the menu bar, status items, the Dock,
/// wallpaper, invisible overlays and Yap's own panels are surfaces of the system, not sources.
public struct WindowSource: Equatable, Sendable {
    public let layer: Int
    public let title: String
    public let application: String
    public let bundleIdentifier: String?
    public let width: Double
    public let height: Double

    public init(layer: Int, title: String, application: String, bundleIdentifier: String?,
                width: Double, height: Double) {
        self.layer = layer
        self.title = title
        self.application = application
        self.bundleIdentifier = bundleIdentifier
        self.width = width
        self.height = height
    }

    /// Ordinary app windows live on the normal layer (0); every system surface sits on another.
    public static let normalLayer = 0
    /// Smaller than this is a helper panel or a sliver, not something worth recording on its own.
    public static let minimumSize = (width: 120.0, height: 80.0)

    public func isRecordable(ownBundle: String?) -> Bool {
        layer == Self.normalLayer
            && !application.isEmpty
            && width >= Self.minimumSize.width && height >= Self.minimumSize.height
            && (bundleIdentifier == nil || bundleIdentifier != ownBundle)
    }
}

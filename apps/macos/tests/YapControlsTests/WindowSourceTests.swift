import YapControls

/// The window chooser lists the windows a person works in, not the system's own surfaces.
func runWindowSourceTests() {
    func window(layer: Int = 0, title: String = "Inbox", application: String = "Mail",
                bundle: String? = "com.apple.mail", width: Double = 900, height: Double = 600) -> WindowSource {
        WindowSource(layer: layer, title: title, application: application, bundleIdentifier: bundle,
                     width: width, height: height)
    }
    let own = "com.dzhng.yap"
    precondition(window().isRecordable(ownBundle: own), "An ordinary titled app window is listed")
    precondition(!window(layer: 25, title: "Item-0", application: "Control Center").isRecordable(ownBundle: own),
                 "Menu bar items, status items and other non-document layers are not windows to record")
    precondition(!window(layer: -2147483624, title: "Wallpaper-", application: "Dock").isRecordable(ownBundle: own),
                 "The desktop wallpaper is not a window")
    precondition(window(title: "", application: "T3 Code (Alpha)").isRecordable(ownBundle: own),
                 "An app window without a title is still a window to record")
    let untitled = ControlsState.Window(id: 1, title: "", application: "T3 Code (Alpha)")
    let titled = ControlsState.Window(id: 2, title: "Inbox", application: "Mail")
    precondition(untitled.label == "T3 Code (Alpha)" && titled.label == "Mail — Inbox",
                 "A window is named by its app and, when it has one, its title")
    precondition(!window(application: "").isRecordable(ownBundle: own), "A window with no owning app is not offered")
    precondition(!window(width: 64, height: 600).isRecordable(ownBundle: own)
                 && !window(width: 900, height: 40).isRecordable(ownBundle: own),
                 "Slivers and helper panels too small to record are not offered")
    precondition(!window(title: "Yap Controls", application: "Yap", bundle: own).isRecordable(ownBundle: own),
                 "Yap's own windows are never offered as a source")
    precondition(window(width: 120, height: 80).isRecordable(ownBundle: own), "The size floor is inclusive")
}

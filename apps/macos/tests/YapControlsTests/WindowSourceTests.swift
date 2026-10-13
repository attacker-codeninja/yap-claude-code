import YapControls

/// The window chooser lists the windows a person works in, not the system's own surfaces.
func runWindowSourceTests() {
    func window(layer: Int = 0, application: String = "Mail", isOwn: Bool = false,
                width: Double = 900, height: Double = 600) -> WindowSource {
        WindowSource(layer: layer, application: application, isOwn: isOwn, width: width, height: height)
    }
    precondition(window().isRecordable, "An ordinary app window is listed")
    precondition(!window(layer: 25, application: "Control Center").isRecordable,
                 "Menu bar items, status items and other non-document layers are not windows to record")
    precondition(!window(layer: -2147483624, application: "Dock").isRecordable,
                 "The desktop wallpaper is not a window")
    let untitled = ControlsState.Window(id: 1, title: "", application: "T3 Code (Alpha)")
    let titled = ControlsState.Window(id: 2, title: "Inbox", application: "Mail")
    precondition(untitled.label == "T3 Code (Alpha)" && titled.label == "Mail — Inbox",
                 "A window is named by its app and, when it has one, its title")
    precondition(!window(application: "").isRecordable, "A window with no owning app is not offered")
    precondition(!window(width: 64, height: 600).isRecordable && !window(width: 900, height: 40).isRecordable,
                 "Slivers and helper panels too small to record are not offered")
    precondition(!window(application: "Yap", isOwn: true).isRecordable,
                 "Yap's own windows are never offered as a source")
    precondition(window(width: 120, height: 80).isRecordable, "The size floor is inclusive")
}

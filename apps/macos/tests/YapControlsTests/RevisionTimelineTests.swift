import Foundation
import YapControls

func revisionTimelineTests() {
    var state = RevisionTimelineState(projectId: "p", headRevisionId: "r2", revisions: [
        .init(id: "r0", ordinal: 0, createdAt: "0", operation: "create"),
        .init(id: "r1", ordinal: 1, createdAt: "1", operation: "apply"),
        .init(id: "r2", ordinal: 2, createdAt: "2", operation: "apply"),
    ])
    precondition(state.selectedRevisionId == "r2")
    precondition(state.select("r0") && state.isHistorical)
    state.refreshHead("r3", revisions: state.revisions + [.init(id: "r3", ordinal: 3, createdAt: "3", operation: "apply")])
    precondition(state.selectedRevisionId == "r0", "Historical selection must stay pinned")
    precondition(state.select("r3") && !state.isHistorical)
}

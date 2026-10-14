import Foundation

/// Session-local selection for the native inspector. Selecting history never restores or edits.
public struct RevisionTimelineState: Equatable, Sendable {
    public struct Revision: Equatable, Sendable {
        public let id: String
        public let ordinal: Int
        public let createdAt: String
        public let operation: String
        public init(id: String, ordinal: Int, createdAt: String, operation: String) {
            self.id = id; self.ordinal = ordinal; self.createdAt = createdAt; self.operation = operation
        }
    }
    public private(set) var projectId: String
    public private(set) var headRevisionId: String
    public private(set) var selectedRevisionId: String
    public private(set) var revisions: [Revision]

    public init(projectId: String, headRevisionId: String, revisions: [Revision]) {
        self.projectId = projectId
        self.headRevisionId = headRevisionId
        self.revisions = revisions.sorted { $0.ordinal < $1.ordinal }
        self.selectedRevisionId = headRevisionId
    }

    public var selected: Revision? { revisions.first { $0.id == selectedRevisionId } }
    public var isHistorical: Bool { selectedRevisionId != headRevisionId }

    @discardableResult
    public mutating func select(_ revisionId: String) -> Bool {
        guard revisions.contains(where: { $0.id == revisionId }) else { return false }
        selectedRevisionId = revisionId
        return true
    }

    /// A head refresh updates the head marker but never silently retargets a historical tab.
    public mutating func refreshHead(_ revisionId: String, revisions: [Revision]? = nil) {
        headRevisionId = revisionId
        if let revisions { self.revisions = revisions.sorted { $0.ordinal < $1.ordinal } }
        if !isHistorical { selectedRevisionId = revisionId }
    }
}

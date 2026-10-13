import CryptoKit
import Foundation
@testable import YapFrames
import YapMedia

/// Font fallback publishes: the raster draws what CoreText chose and reports the face actually used
/// and the code points it drew, instead of refusing the frame.
func verifyTextFallback() throws {
    let fontURL = URL(fileURLWithPath: "/System/Library/Fonts/Supplemental/Arial.ttf")
    let digest = SHA256.hash(data: try Data(contentsOf: fontURL)).map { String(format: "%02x", $0) }.joined()
    let binding = try JSONDecoder().decode(
        FontAssetBinding.self,
        from: JSONEncoder().encode(["assetId": digest, "path": fontURL.path]),
    )
    func raster(_ text: String, face: String = "ArialMT") throws -> TextRaster {
        try TextRaster(TextSource(
            kind: "text", text: text, font: .init(assetId: digest, postScriptName: face),
            width: 420, height: 120, size: 48, color: "#ffffffff", alignment: "left",
            verticalAlignment: nil, stroke: nil, shadow: nil, background: nil,
            highlight: nil, activeRanges: nil, wrap: true), binding: binding)
    }

    let clean = try raster("Plain")
    precondition(clean.fallbacks.isEmpty, "Text the pinned face covers reports no fallback")

    // ArialMT has no emoji; CoreText draws U+1F600 with another installed face.
    let emoji = try raster("A\u{1F600}B\u{1F600}")
    precondition(emoji.fallbacks.count == 1, "One substitute face is one fallback: \(emoji.fallbacks)")
    let substitute = emoji.fallbacks[0]
    precondition(substitute.face != "ArialMT" && !substitute.face.isEmpty)
    precondition(substitute.substituted == [0x1F600], "Each substituted code point is listed once: \(substitute)")
    precondition(substitute.missing.isEmpty)
    precondition(emoji.layout.lines.flatMap(\.fonts).contains(substitute.face),
        "The layout names the substitute face it drew with")
    precondition(emoji.layout.inkBounds[2] > clean.layout.inkBounds[2] / 5, "The fallback text is drawn")

    // A noncharacter has no glyph in any installed face; it is drawn as a placeholder box, which is
    // a missing glyph, not a substitution.
    let missing = try raster("A\u{FFFF}")
    precondition(missing.fallbacks.count == 1 && missing.fallbacks[0].missing == [0xFFFF]
        && missing.fallbacks[0].substituted.isEmpty,
        "The missing code point and the face that drew its placeholder are reported: \(missing.fallbacks)")

    do {
        _ = try raster("A", face: "NoSuchFace")
        preconditionFailure("A face the font file does not contain must refuse")
    } catch let failure as NativeFailure {
        precondition(failure.code == "FONT_UNAVAILABLE", "An absent face has its own code, got \(failure.code)")
        precondition(failure.message.contains("NoSuchFace"))
    }
    print("PASS native text fallback publishes with the face used and its code points")
}

import FluidAudio
import Foundation
import YapMedia

/// A word as the evaluated FluidAudio CLI reports it: engine seconds and token-averaged confidence,
/// beside its speech-bearing token estimate.
public struct EngineWord: Codable, Sendable {
    public let word: String
    public let startTime: TimeInterval
    public let endTime: TimeInterval
    /// The extent of tokens carrying letters or digits; an estimate, not audible truth.
    /// Delayed punctuation remains in the broader recognition span and raw tokens.
    public let spokenStart: TimeInterval
    public let spokenEnd: TimeInterval
    public let confidence: Float
}

/// A word the engine reported with a malformed token: nonfinite or reversed time, a negative start,
/// or confidence outside 0–1. It is never published; its first malformed token is kept as reported.
public struct DroppedEngineWord: Sendable, Equatable {
    public let text: String
    public let token: Int
    public let startTime: TimeInterval
    public let endTime: TimeInterval
    public let confidence: Float
}

/// Lexical grouping follows FluidAudio 0.15.7
/// `Sources/FluidAudioCLI/.../TranscribeCommand.swift` (`WordTimingMerger.mergeTokensIntoWords`),
/// which lives in the CLI target rather than the library. The model gate evaluated the CLI's word
/// timings, so the worker must group tokens the same way: a token with leading whitespace starts a
/// word, and confidence is the token average. The library's public `buildWordTimings` differs (no
/// confidence, skips blank pieces) and is not a substitute.
///
/// Speech-bearing extent and dropping words with malformed tokens belong to this repository.
public enum WordTimingMerger {
    public static func mergeTokensIntoWords(_ tokenTimings: [TokenTiming])
        -> (words: [EngineWord], dropped: [DroppedEngineWord])
    {
        var wordTimings: [EngineWord] = []
        var dropped: [DroppedEngineWord] = []
        var malformed: (index: Int, timing: TokenTiming)?
        var currentWord = ""
        var currentStartTime: TimeInterval?
        var currentEndTime: TimeInterval = 0
        var currentSpoken: (start: TimeInterval, end: TimeInterval)?
        var currentConfidences: [Float] = []

        /// A token that says something out loud, rather than only marking how a sentence ends.
        func spoken(_ token: String) -> Bool {
            token.contains { $0.isLetter || $0.isNumber }
        }

        func flush() {
            defer { malformed = nil }
            if let malformed {
                dropped.append(DroppedEngineWord(text: currentWord, token: malformed.index,
                    startTime: malformed.timing.startTime, endTime: malformed.timing.endTime,
                    confidence: malformed.timing.confidence))
                return
            }
            guard !currentWord.isEmpty, let startTime = currentStartTime else { return }
            // Nothing in this word was said — it is punctuation on its own — so it keeps the only
            // time the engine gave it.
            let extent = currentSpoken ?? (start: startTime, end: currentEndTime)
            wordTimings.append(
                EngineWord(
                    word: currentWord,
                    startTime: startTime,
                    endTime: currentEndTime,
                    spokenStart: extent.start,
                    spokenEnd: extent.end,
                    confidence: averageConfidence(currentConfidences)
                ))
        }

        for (index, timing) in tokenTimings.enumerated() {
            let valid = timing.startTime.isFinite && timing.endTime.isFinite && timing.startTime >= 0
                && timing.endTime >= timing.startTime && timing.confidence.isFinite
                && timing.confidence >= 0 && timing.confidence <= 1
            let token = timing.token

            if token.hasPrefix(" ") || token.hasPrefix("\n") || token.hasPrefix("\t") {
                flush()
                if !valid { malformed = (index, timing) }

                currentWord = token.trimmingCharacters(in: .whitespacesAndNewlines)
                currentStartTime = timing.startTime
                currentEndTime = timing.endTime
                currentSpoken = spoken(token) ? (timing.startTime, timing.endTime) : nil
                currentConfidences = [timing.confidence]
            } else {
                if !valid && malformed == nil { malformed = (index, timing) }
                if currentStartTime == nil {
                    currentStartTime = timing.startTime
                }
                currentWord += token
                currentEndTime = max(currentEndTime, timing.endTime)
                if spoken(token) {
                    // Tokens may share a frame; preserve the latest speech-bearing endpoint
                    // even when the final token ends earlier.
                    currentSpoken = (
                        currentSpoken?.start ?? timing.startTime,
                        max(currentSpoken?.end ?? timing.endTime, timing.endTime)
                    )
                }
                currentConfidences.append(timing.confidence)
            }
        }

        flush()

        return (wordTimings, dropped)
    }

    private static func averageConfidence(_ confidences: [Float]) -> Float {
        confidences.isEmpty ? 0.0 : confidences.reduce(0, +) / Float(confidences.count)
    }
}

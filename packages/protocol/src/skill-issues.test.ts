import { issuesSchema } from "@yap/composition";
import { describe, expect, it } from "vitest";
// @ts-expect-error The consumer skill's helpers are plain ESM without declarations.
import { dialogueProposals } from "../../../skills/yap/scripts/dialogue-proposals.mjs";

// Skill helpers can't import the issue vocabulary at runtime; this pins their output to it.
const evidence = (clipId: string, integratedLufs: number | null, truePeakDbtp: number | null) => ({
  kind: "loudness",
  domain: "project",
  projectId: "p",
  revisionId: "r",
  tap: { target: { kind: "clip", id: clipId }, point: { kind: "processed" } },
  range: { startUs: 0, endUs: 8_000_000 },
  sampleRange: { start: 0, end: 384_000 },
  sampleRate: 48_000,
  channels: 2,
  unavailable: [{ clipId, ranges: [] }],
  audio: { jobId: `audio-${clipId}`, generation: 1 },
  generation: 1,
  signalRecipe: { sha256: "a".repeat(64) },
  implementationId: "meter",
  truePeak: true,
  channelInterpretation: "native",
  scope: "excerpt",
  measurement: { integratedLufs, truePeakDbtp },
});

describe("skill helper issues", () => {
  it("dialogue proposals emit only registered issues", () => {
    const { proposals } = dialogueProposals({
      projectId: "p",
      revisionId: "r",
      targetIntegratedLufs: -20,
      gainBounds: { minimumDb: 2, maximumDb: 3 },
      truePeakCeilingDbtp: -2,
      minimumDurationUs: 400_000,
      clips: [
        { clipId: "ceiling", evidence: evidence("ceiling", -25, -1) },
        { clipId: "bounded", evidence: evidence("bounded", -25, -12) },
        { clipId: "silent", evidence: evidence("silent", null, null) },
      ],
    }) as { proposals: { issues: unknown[] }[] };
    const codes = proposals.map((proposal) =>
      issuesSchema.parse(proposal.issues).map((issue) => issue.code),
    );
    expect(codes).toEqual([
      ["gain-constrained", "gain-constrained", "gain-bound-breached"],
      ["gain-constrained"],
      ["proposal-unavailable"],
    ]);
  });
});

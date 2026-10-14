import { issueCodes, issuesSchema } from "@yap/composition";
import { describe, expect, it } from "vitest";
// @ts-expect-error The consumer skill's helpers are plain ESM without declarations.
import { captionProposals } from "../../../skills/yap/scripts/caption-proposals.mjs";
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

  it("caption proposals emit only registered issues, bounded at both levels", () => {
    const word = (index: number, text: string, startUs: number, endUs: number, extra = {}) => ({
      type: "word",
      ordinal: index,
      text,
      sourceRange: { startUs, endUs },
      clipId: "take",
      trackId: "speech",
      assetId: "asset",
      streamId: "audio",
      generation: "g",
      segment: 0,
      fragments: [{ source: { startUs, endUs }, project: { startUs, endUs } }],
      ...extra,
    });
    const point = { startUs: 2_000_000, endUs: 2_000_000 };
    const rows = [
      word(0, "trimmed", 0, 1_000_000, { partial: true }),
      word(1, "split", 1_000_000, 2_000_000, {
        fragments: [
          {
            source: { startUs: 1_000_000, endUs: 1_400_000 },
            project: { startUs: 1_000_000, endUs: 1_400_000 },
          },
          {
            source: { startUs: 1_600_000, endUs: 2_000_000 },
            project: { startUs: 1_500_000, endUs: 1_900_000 },
          },
        ],
      }),
      word(2, "um", 2_000_000, 2_000_000, {
        instant: true,
        fragments: [{ source: point, project: point }],
      }),
      word(3, "a\nb\nc", 3_000_000, 9_000_000),
      word(4, "😀".repeat(4100), 10_000_000, 10_100_000),
      word(5, "gone", 11_000_000, 12_000_000),
    ];
    const unknown = Object.fromEntries(Array.from({ length: 1005 }, (_, i) => [`k${i}`, 1]));
    const output = captionProposals({
      entry: {
        identity: { projectId: "p", revisionId: "r" },
        state: "ready",
        complete: true,
        rows,
      },
      rowIndexes: rows.map((_, i) => i),
      corrections: [{ rowIndex: 5, text: " " }],
      trackId: "captions",
      canvas: { width: 640, height: 360 },
      style: {
        font: { assetId: "font", postScriptName: "ArialMT" },
        width: 700,
        height: 90,
        size: 32,
        color: "#ffffffff",
        alignment: "center",
        wrap: false,
      },
      constraints: {
        widthGraphemes: 8,
        maxLines: 2,
        minDwellUs: 500_000,
        maxDwellUs: 3_000_000,
        maxCps: 20,
        pauseUs: 400_000,
        breakOnPunctuation: true,
        separator: " ",
        safeArea: { x: 0, y: 0, width: 640, height: 360 },
        ...unknown,
      },
      maxBytes: 8 * 1024 * 1024,
    }) as { issues: unknown[]; proposals: { issues: unknown[] }[] };
    const top = issuesSchema.parse(output.issues);
    expect(top).toHaveLength(1001);
    expect(top.at(-1)).toMatchObject({ code: "issues-truncated", evidence: { omitted: 5 } });
    const seen = new Set(top.map((issue) => issue.code));
    for (const proposal of output.proposals)
      for (const issue of issuesSchema.parse(proposal.issues)) seen.add(issue.code);

    // The per-cue word-pin limit splits a long selection.
    const long = Array.from({ length: 1001 }, (_, i) => word(i, "x", i * 1000, (i + 1) * 1000));
    const split = captionProposals({
      entry: {
        identity: { projectId: "p", revisionId: "r" },
        state: "ready",
        complete: true,
        rows: long,
      },
      rowIndexes: long.map((_, i) => i),
      trackId: "captions",
      canvas: { width: 640, height: 360 },
      style: {
        font: { assetId: "font", postScriptName: "ArialMT" },
        width: 500,
        height: 90,
        size: 32,
        color: "#ffffffff",
        alignment: "center",
        wrap: true,
      },
      constraints: {
        widthGraphemes: 8192,
        maxLines: 1,
        minDwellUs: 1,
        maxDwellUs: 3_600_000_000,
        maxCps: 1000,
        pauseUs: 400_000,
        breakOnPunctuation: false,
        separator: "",
        safeArea: { x: 0, y: 0, width: 640, height: 360 },
      },
      maxBytes: 8 * 1024 * 1024,
    }) as { issues: unknown[] };
    for (const issue of issuesSchema.parse(split.issues)) seen.add(issue.code);

    expect([...seen].sort()).toEqual(
      issueCodes
        .filter(
          (code) =>
            code.startsWith("caption-") &&
            code !== "caption-omitted" &&
            code !== "caption-overlap-added",
        )
        .concat("issues-truncated")
        .sort(),
    );
  });
});

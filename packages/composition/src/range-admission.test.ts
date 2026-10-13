import { expect, test } from "vitest";
import { applyBatch, validateComposition, type Composition } from "./index.js";

// Receipt 08 (specs/launch-video-feedback): an 11.46 s placement from an 11.444 s movie was refused.
const movieEndUs = 11_444_000;
const assets = [
  {
    id: "movie",
    streams: [
      {
        id: "v",
        kind: "video",
        width: 16,
        height: 16,
        bounds: { startUs: 0, endUs: movieEndUs },
        available: [{ startUs: 0, endUs: movieEndUs }],
      },
    ],
  },
];
const empty: Composition = {
  canvas: {
    width: 16,
    height: 16,
    fps: { numerator: 30, denominator: 1 },
    background: "#000000ff",
  },
  tracks: [
    { id: "t", kind: "video", order: 0 },
    { id: "u", kind: "video", order: 1 },
  ],
  groups: [],
  processing: [],
  syncGroups: [],
  clips: [],
};
const context = { namespace: "range-admission", assets };
const place = (source: { startUs: number; endUs: number }, placement: unknown) => ({
  operation: "place",
  label: "clip",
  clip: {
    trackId: "t",
    assetId: "movie",
    streamId: "v",
    source: { kind: "range", range: source },
    placement,
  },
});

test("a placement past the source's end is shortened to the source, with a range-clamped issue", () => {
  const result = applyBatch(
    empty,
    [
      place(
        { startUs: 0, endUs: 11_460_000 },
        { kind: "project", range: { startUs: 30_000_000, endUs: 41_460_000 } },
      ),
    ],
    context,
  );
  const clip = result.document.clips.find((value) => value.id === result.labels.clip)!;
  expect(clip.source).toEqual({ kind: "range", range: { startUs: 0, endUs: movieEndUs } });
  expect(clip.placement).toEqual({
    kind: "project",
    range: { startUs: 30_000_000, endUs: 30_000_000 + movieEndUs },
  });
  expect(result.issues).toEqual([
    {
      code: "range-clamped",
      message: expect.any(String),
      at: { range: { startUs: 0, endUs: movieEndUs } },
      evidence: {
        requested: { startUs: 0, endUs: 11_460_000 },
        applied: { startUs: 0, endUs: movieEndUs },
        bounds: { startUs: 0, endUs: movieEndUs },
        operationIndex: 0,
      },
    },
  ]);
});

test("a retimed placement keeps its rate when clamped at either end", () => {
  // Source 2x the placement length: rate 2. Clamping 1 s of source removes 0.5 s of placement.
  const result = applyBatch(
    empty,
    [
      place(
        { startUs: movieEndUs - 4_000_000, endUs: movieEndUs + 1_000_000 },
        { kind: "project", range: { startUs: 0, endUs: 2_500_000 } },
      ),
    ],
    context,
  );
  const clip = result.document.clips[0]!;
  expect(clip.placement).toEqual({ kind: "project", range: { startUs: 0, endUs: 2_000_000 } });
  expect(result.issues.map((issue) => issue.code)).toEqual(["range-clamped"]);
});

test("a clip-anchored placement clamps the same fraction of its anchor", () => {
  const parent = applyBatch(
    empty,
    [
      place(
        { startUs: 0, endUs: 4_000_000 },
        { kind: "project", range: { startUs: 0, endUs: 4_000_000 } },
      ),
    ],
    context,
  );
  const result = applyBatch(
    parent.document,
    [
      {
        ...place(
          { startUs: movieEndUs - 1_000_000, endUs: movieEndUs + 1_000_000 },
          {
            kind: "clip",
            clipId: parent.labels.clip,
            start: { numerator: 0, denominator: 1 },
            end: { numerator: 1, denominator: 2 },
          },
        ),
        label: "child",
        clip: {
          ...place(
            { startUs: movieEndUs - 1_000_000, endUs: movieEndUs + 1_000_000 },
            {
              kind: "clip",
              clipId: parent.labels.clip,
              start: { numerator: 0, denominator: 1 },
              end: { numerator: 1, denominator: 2 },
            },
          ).clip,
          trackId: "u",
        },
      },
    ],
    { ...context, namespace: "range-admission-child" },
  );
  const clip = result.document.clips.find((value) => value.id === result.labels.child)!;
  expect(clip.placement).toMatchObject({
    start: { numerator: 0, denominator: 1 },
    end: { numerator: 1, denominator: 4 },
  });
  expect(result.issues.map((issue) => issue.code)).toEqual(["range-clamped"]);
});

test("a selection with no part inside the source stays a refusal that names the bounds", () => {
  expect(() =>
    applyBatch(
      empty,
      [
        place(
          { startUs: movieEndUs, endUs: movieEndUs + 1_000_000 },
          { kind: "project", range: { startUs: 0, endUs: 1_000_000 } },
        ),
      ],
      context,
    ),
  ).toThrow(
    expect.objectContaining({
      code: "INVALID_EDIT",
      details: expect.objectContaining({
        cause: "INVALID_RANGE",
        bounds: { startUs: 0, endUs: movieEndUs },
      }),
    }),
  );
});

test("a clean placement reports no issues, and stored documents stay strictly validated", () => {
  const clean = applyBatch(
    empty,
    [
      place(
        { startUs: 0, endUs: 1_000_000 },
        { kind: "project", range: { startUs: 0, endUs: 1_000_000 } },
      ),
    ],
    context,
  );
  expect(clean.issues).toEqual([]);
  const stored = {
    ...clean.document,
    clips: [
      {
        ...clean.document.clips[0]!,
        source: { kind: "range" as const, range: { startUs: 0, endUs: 11_460_000 } },
      },
    ],
  };
  expect(() => validateComposition(stored, assets)).toThrow(/Selected range exceeds source bounds/);
});

test("a replacement source past the stream's end is clamped before its fit applies", () => {
  const placed = applyBatch(
    empty,
    [
      place(
        { startUs: 0, endUs: 2_000_000 },
        { kind: "project", range: { startUs: 0, endUs: 2_000_000 } },
      ),
    ],
    context,
  );
  const result = applyBatch(
    placed.document,
    [
      {
        operation: "replace",
        clipId: placed.labels.clip,
        kind: "video",
        fit: "hold",
        media: {
          assetId: "movie",
          streamId: "v",
          source: {
            kind: "range",
            range: { startUs: movieEndUs - 500_000, endUs: movieEndUs + 500_000 },
          },
        },
      },
    ],
    { ...context, namespace: "range-admission-replace" },
  );
  expect(result.issues).toMatchObject([
    {
      code: "range-clamped",
      evidence: {
        applied: { startUs: movieEndUs - 500_000, endUs: movieEndUs },
        operationIndex: 0,
      },
    },
  ]);
  expect(result.document.clips.find((clip) => clip.id === placed.labels.clip)!.source).toEqual({
    kind: "range",
    range: { startUs: movieEndUs - 500_000, endUs: movieEndUs },
  });
});

test("a trim range past the clip's interval keeps the overlapping part, with range-clamped", () => {
  const placed = applyBatch(
    empty,
    [
      place(
        { startUs: 0, endUs: 2_000_000 },
        { kind: "project", range: { startUs: 1_000_000, endUs: 3_000_000 } },
      ),
    ],
    context,
  );
  const trim = (range: { startUs: number; endUs: number }) =>
    applyBatch(
      placed.document,
      [{ operation: "trim", clipId: placed.labels.clip, ripple: "none", range }],
      { ...context, namespace: "range-admission-trim" },
    );
  const result = trim({ startUs: 2_000_000, endUs: 4_000_000 });
  expect(result.document.clips).toHaveLength(1);
  expect(result.document.clips[0]!.placement).toEqual({
    kind: "project",
    range: { startUs: 2_000_000, endUs: 3_000_000 },
  });
  expect(result.issues).toEqual([
    {
      code: "range-clamped",
      message: expect.any(String),
      at: { range: { startUs: 2_000_000, endUs: 3_000_000 } },
      evidence: {
        requested: { startUs: 2_000_000, endUs: 4_000_000 },
        applied: { startUs: 2_000_000, endUs: 3_000_000 },
        bounds: { startUs: 1_000_000, endUs: 3_000_000 },
        operationIndex: 0,
      },
    },
  ]);
  expect(() => trim({ startUs: 3_000_000, endUs: 4_000_000 })).toThrow(
    expect.objectContaining({
      code: "INVALID_EDIT",
      details: expect.objectContaining({
        cause: "INVALID_RANGE",
        bounds: { startUs: 1_000_000, endUs: 3_000_000 },
      }),
    }),
  );
});

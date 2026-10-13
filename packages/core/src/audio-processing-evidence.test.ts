import { createCompiler, validateComposition } from "@yap/composition";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "vitest";
import { checkProjectAudioResult } from "./audio-inspection.js";
import {
  audioProcessingIssues,
  normalizationTolerance,
  selectNormalizationAttempt,
  type AudioProcessingEvidence,
} from "./audio-measurement.js";
test("normalization publication requires complete bound evidence whose selected candidate is the best", async () => {
  const dir = await mkdtemp(join(tmpdir(), "normalization-evidence-"));
  try {
    const output = join(dir, "audio.wav"),
      frames = 480;
    const wave = Buffer.alloc(44 + frames * 8);
    wave.write("RIFF");
    wave.writeUInt32LE(wave.length - 8, 4);
    wave.write("WAVEfmt ", 8);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(3, 20);
    wave.writeUInt16LE(2, 22);
    wave.writeUInt32LE(48000, 24);
    wave.writeUInt32LE(384000, 28);
    wave.writeUInt16LE(8, 32);
    wave.writeUInt16LE(32, 34);
    wave.write("data", 36);
    wave.writeUInt32LE(frames * 8, 40);
    await writeFile(output, wave);
    const recipe = {
      type: "normalization" as const,
      mode: "gain-only" as const,
      targetIntegratedLufs: -20,
      truePeakCeilingDbtp: -2,
      maxLoudnessRangeLu: 7,
    };
    const model = validateComposition(
      {
        canvas: {
          width: 16,
          height: 16,
          fps: { numerator: 30, denominator: 1 },
          background: "#000000ff",
        },
        tracks: [{ id: "audio", kind: "audio", order: 0 }],
        groups: [],
        syncGroups: [],
        clips: [
          {
            id: "silence",
            trackId: "audio",
            source: { kind: "silence" },
            placement: { kind: "project", range: { startUs: 0, endUs: 10000 } },
          },
        ],
        processing: [
          {
            target: { kind: "output" },
            steps: [{ id: "normalize", enabled: true, processor: recipe }],
          },
        ],
      },
      [],
    );
    const compiled = createCompiler(model, "revision").audioWindow({
      range: { startUs: 0, endUs: 10000 },
      rendition: { sampleRate: 48000, channels: 2 },
      tap: { target: { kind: "output" }, point: { kind: "processed" } },
    });
    const window = {
      ...compiled,
      manifest: {
        ...compiled.manifest,
        requirements: compiled.manifest.requirements.map((r) => ({
          ...r,
          implementationId: "normalization-runtime",
        })),
      },
    };
    const receipt = {
      file: output,
      bytes: wave.length,
      sampleRate: 48000,
      channels: 2,
      frames,
      peak: 0,
      clippedSamples: 0,
      maximumBlockFrames: 480,
      peakResidentBytes: 0,
      decoderContext: {
        policy: "bounded-current-retained-run",
        sampleRate: 48000,
        maximumPrerollFrames: 0,
        maximumTailFrames: 0,
      },
      unavailable: [],
    };
    const measurement = {
      integratedLufs: -20,
      loudnessRangeLu: 3,
      samplePeakDbfs: -8,
      truePeakDbtp: -7,
      integratedReason: null,
      rangeReason: null,
      algorithm: "meter",
      version: "1",
    };
    const evidence = {
      domainIndex: 0,
      recipe,
      sampleRange: { start: 0, end: 480 },
      implementationId: "normalization-runtime",
      normalization: {
        before: { ...measurement, integratedLufs: -25, truePeakDbtp: -12 },
        after: measurement,
        attempts: [{ offsetDb: null, after: measurement }],
        selectedAttempt: 0,
        meterImplementationId: "meter-runtime",
        tolerances: normalizationTolerance,
      },
    };
    expect(() =>
      checkProjectAudioResult(
        {
          ...receipt,
          processingEvidence: [
            { ...evidence, normalization: { ...evidence.normalization, attempts: [] } },
          ],
        },
        window,
        output,
      ),
    ).toThrow();
    expect(() =>
      checkProjectAudioResult(
        {
          ...receipt,
          processingEvidence: [
            {
              ...evidence,
              normalization: {
                ...evidence.normalization,
                attempts: [{ offsetDb: null, after: { ...measurement, integratedLufs: -21 } }],
              },
            },
          ],
        },
        window,
        output,
      ),
    ).toThrow();
    expect(() =>
      checkProjectAudioResult(
        {
          ...receipt,
          processingEvidence: [
            { ...evidence, normalization: { ...evidence.normalization, selectedAttempt: 1 } },
          ],
        },
        window,
        output,
      ),
    ).toThrow();
    expect(() => checkProjectAudioResult(receipt, window, output)).toThrow();
    expect(() =>
      checkProjectAudioResult(
        {
          ...receipt,
          processingEvidence: [
            {
              ...evidence,
              normalization: {
                ...evidence.normalization,
                after: { ...measurement, integratedLufs: -18 },
              },
            },
          ],
        },
        window,
        output,
      ),
    ).toThrow();
    expect(() =>
      checkProjectAudioResult(
        { ...receipt, processingEvidence: [{ ...evidence, implementationId: "other-runtime" }] },
        window,
        output,
      ),
    ).toThrow();
    expect(() =>
      checkProjectAudioResult(
        { ...receipt, processingEvidence: [evidence, evidence] },
        window,
        output,
      ),
    ).toThrow();
    expect(
      checkProjectAudioResult({ ...receipt, processingEvidence: [evidence] }, window, output)
        .processingEvidence,
    ).toEqual([evidence]);
    // A missed target is published with its issue rather than refused.
    const missed = { ...measurement, integratedLufs: -24 };
    const unmet = {
      ...evidence,
      normalization: {
        ...evidence.normalization,
        after: missed,
        attempts: [{ offsetDb: null, after: missed }],
      },
    };
    expect(
      checkProjectAudioResult({ ...receipt, processingEvidence: [unmet] }, window, output)
        .processingEvidence,
    ).toEqual([unmet]);
    expect(audioProcessingIssues([unmet]).map((issue) => issue.code)).toEqual([
      "normalization-target-unmet",
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const loudness = (
  integratedLufs: number | null,
  loudnessRangeLu: number | null,
  truePeakDbtp: number | null,
) => ({
  integratedLufs,
  loudnessRangeLu,
  samplePeakDbfs: truePeakDbtp,
  truePeakDbtp,
  integratedReason: integratedLufs === null ? ("below-gate" as const) : null,
  rangeReason: loudnessRangeLu === null ? ("below-gate" as const) : null,
  algorithm: "meter",
  version: "1",
});
const dynamic = {
  type: "normalization" as const,
  mode: "dynamic" as const,
  targetIntegratedLufs: -14,
  truePeakCeilingDbtp: -2,
  maxLoudnessRangeLu: 7,
};
function normalized(
  recipe: typeof dynamic | (Omit<typeof dynamic, "mode"> & { mode: "gain-only" }),
  before: ReturnType<typeof loudness>,
  attempts: { offsetDb: number | null; after: ReturnType<typeof loudness> }[],
  selectedAttempt = selectNormalizationAttempt(recipe, attempts),
): AudioProcessingEvidence {
  return {
    domainIndex: 2,
    recipe,
    sampleRange: { start: 0, end: 480 },
    implementationId: "normalization-runtime",
    normalization: {
      before,
      after: attempts[selectedAttempt]!.after,
      attempts,
      selectedAttempt,
      meterImplementationId: "meter",
      tolerances: normalizationTolerance,
    },
  };
}

test("the published candidate is the one with the smallest miss beyond tolerance, then the closest, then the first", () => {
  const met = (integrated: number) => ({ offsetDb: 1, after: loudness(integrated, 3, -3) });
  const missed = (integrated: number, peak: number) => ({
    offsetDb: 1,
    after: loudness(integrated, 3, peak),
  });
  // Among candidates that meet every target, the closest to the loudness target wins.
  expect(selectNormalizationAttempt(dynamic, [met(-14.15), met(-14.05), met(-13.95)])).toBe(1);
  // A candidate meeting every target beats any that misses.
  expect(selectNormalizationAttempt(dynamic, [missed(-14, -1), met(-14.15)])).toBe(1);
  // Otherwise the smallest total miss beyond tolerance, ties to the earliest.
  expect(
    selectNormalizationAttempt(dynamic, [missed(-14, -1.5), missed(-14, -1.7), missed(-14, -1.7)]),
  ).toBe(1);
  expect(selectNormalizationAttempt(dynamic, [missed(-14, -1.7), missed(-14, -1.7)])).toBe(0);
  expect(
    selectNormalizationAttempt(dynamic, [
      { offsetDb: 1, after: loudness(null, 3, -3) },
      missed(-15, -3),
    ]),
  ).toBe(1);
});

test("dynamic issues name each missed target, the attempts and why correction stopped", () => {
  // FEEDBACK §4: −14.1 LUFS / −1.8 dBTP against −14 / −2 is a true-peak miss, not a loudness one.
  const stalled = normalized(dynamic, loudness(-20, 5, -3), [
    { offsetDb: 0, after: loudness(-14.1, 5, -1.8) },
  ]);
  expect(audioProcessingIssues([stalled])).toEqual([
    {
      code: "normalization-target-unmet",
      message: expect.any(String),
      evidence: {
        mode: "dynamic",
        domainIndex: 2,
        missed: [
          { target: "true-peak", requested: -2, achieved: -1.8, excess: expect.closeTo(0.2, 9) },
        ],
        attempts: 1,
        selectedAttempt: 0,
        stopReason: "constraints",
      },
    },
  ]);
  const budget = normalized(dynamic, loudness(-20, 5, -3), [
    { offsetDb: 0, after: loudness(-16, 5, -3) },
    { offsetDb: 2, after: loudness(-15, 5, -3) },
    { offsetDb: 3, after: loudness(-14.5, 5, -3) },
  ]);
  expect(audioProcessingIssues([budget])[0]!.evidence).toMatchObject({
    missed: [{ target: "integrated-loudness", achieved: -14.5, excess: 0.5 }],
    attempts: 3,
    selectedAttempt: 2,
    stopReason: "budget-exhausted",
  });
  const stopped = normalized(dynamic, loudness(-20, 5, -3), [
    { offsetDb: 0, after: loudness(-16, 5, -3) },
  ]);
  expect(() => audioProcessingIssues([stopped])).toThrow("before its correction loop stopped");
});

test("unmeasurable input passes through with an issue; a limited peak over its ceiling is reported", () => {
  const silent = loudness(null, null, null);
  const gainOnly = { ...dynamic, mode: "gain-only" as const };
  expect(
    audioProcessingIssues([
      normalized(gainOnly, silent, [{ offsetDb: null, after: silent }]),
      normalized(dynamic, loudness(-20, 5, -3), [{ offsetDb: null, after: loudness(-20, 5, -3) }]),
    ]).map((issue) => issue.evidence),
  ).toEqual([
    { domainIndex: 2, measurement: "integrated-loudness", reason: "below-gate" },
    { domainIndex: 2, measurement: "dynamic-first-pass", reason: "non-finite" },
  ]);
  const limiter = {
    domainIndex: 0,
    recipe: { type: "limiter" as const, ceilingDbfs: -6, lookaheadMs: 5, releaseMs: 50 },
    sampleRange: { start: 0, end: 480 },
    implementationId: "limiter-runtime",
  };
  const ceiling = 10 ** (-6 / 20);
  expect(
    audioProcessingIssues([
      // Limiter evidence from 0.1.33 records no peak; it was admitted under its ceiling.
      limiter,
      { ...limiter, limiter: { samplePeak: ceiling + 1e-6 } },
      { ...limiter, domainIndex: 1, limiter: { samplePeak: 0.6 } },
    ]),
  ).toEqual([
    {
      code: "limiter-ceiling-unmet",
      message: expect.any(String),
      evidence: { domainIndex: 1, ceilingDbfs: -6, samplePeakDbfs: 20 * Math.log10(0.6) },
    },
  ]);
});

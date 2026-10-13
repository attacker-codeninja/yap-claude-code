import { z } from "zod";
import {
  stateRecipeSchema,
  type Issue,
  type ProcessingStep,
  type normalizationStopReasonSchema,
  type normalizationTargetMissSchema,
} from "@yap/composition";
import { CatalogError } from "./catalog.js";

export const loudnessMeasurementSchema = z.strictObject({
  integratedLufs: z.number().finite().nullable(),
  loudnessRangeLu: z.number().finite().nonnegative().nullable(),
  samplePeakDbfs: z.number().finite().nullable(),
  truePeakDbtp: z.number().finite().nullable(),
  integratedReason: z.enum(["insufficient-duration", "below-gate"]).nullable(),
  rangeReason: z.enum(["insufficient-duration", "below-gate"]).nullable(),
  algorithm: z.string().min(1),
  version: z.string().min(1),
});
export type LoudnessMeasurement = z.infer<typeof loudnessMeasurementSchema>;
export const normalizationTolerance = {
  integratedAbsoluteLu: 0.2,
  rangeMaximumExcessLu: 0.2,
  meterSpecificTruePeakExcessDb: 0.15,
} as const;
export const normalizationCorrectionPolicy = {
  maximumCandidates: 3,
  minimumErrorImprovementLu: 0.02,
  desiredErrorLu: normalizationTolerance.integratedAbsoluteLu / 2,
  minimumOffsetDb: -99,
  maximumOffsetDb: 99,
} as const;
/** A limited sample may pass its linear ceiling by this much before the ceiling counts as unmet. */
export const limiterCeilingTolerance = 1e-6;
const tolerances = z.strictObject({
  integratedAbsoluteLu: z.literal(normalizationTolerance.integratedAbsoluteLu),
  rangeMaximumExcessLu: z.literal(normalizationTolerance.rangeMaximumExcessLu),
  meterSpecificTruePeakExcessDb: z.literal(normalizationTolerance.meterSpecificTruePeakExcessDb),
});
export const audioProcessingEvidenceSchema = z.strictObject({
  domainIndex: z.int().nonnegative(),
  recipe: stateRecipeSchema,
  sampleRange: z.strictObject({ start: z.int().nonnegative(), end: z.int().positive() }),
  implementationId: z.string().min(1),
  normalization: z
    .strictObject({
      before: loudnessMeasurementSchema,
      after: loudnessMeasurementSchema,
      attempts: z
        .array(
          z.strictObject({
            offsetDb: z
              .number()
              .finite()
              .min(normalizationCorrectionPolicy.minimumOffsetDb)
              .max(normalizationCorrectionPolicy.maximumOffsetDb)
              .nullable(),
            after: loudnessMeasurementSchema,
          }),
        )
        .min(1)
        .max(normalizationCorrectionPolicy.maximumCandidates),
      selectedAttempt: z
        .int()
        .nonnegative()
        .max(normalizationCorrectionPolicy.maximumCandidates - 1),
      meterImplementationId: z.string().min(1),
      tolerances,
    })
    .optional(),
  /** The complete limited signal's linear sample peak; evidence from before v2 limiters omits it. */
  limiter: z.strictObject({ samplePeak: z.number().finite().nonnegative() }).optional(),
});
export type AudioProcessingEvidence = z.infer<typeof audioProcessingEvidenceSchema>;
type NormalizationEvidence = NonNullable<AudioProcessingEvidence["normalization"]>;
type Normalization = Extract<ProcessingStep["processor"], { type: "normalization" }>;
type Attempt = NormalizationEvidence["attempts"][number];
type Miss = z.infer<typeof normalizationTargetMissSchema>;
type StopReason = z.infer<typeof normalizationStopReasonSchema>;

/** Why a complete signal gives normalization nothing to measure, or null when it is measurable. */
export function unmeasurableNormalization(before: LoudnessMeasurement) {
  if (before.integratedLufs === null)
    return {
      measurement: "integrated-loudness",
      reason: before.integratedReason ?? "non-finite",
    } as const;
  if (before.loudnessRangeLu === null)
    return { measurement: "loudness-range", reason: before.rangeReason ?? "non-finite" } as const;
  if (before.truePeakDbtp === null) return { measurement: "true-peak", reason: "silent" } as const;
  return null;
}

/**
 * The gain-only gain in dB. When the loudness target and the peak ceiling conflict, the ceiling
 * wins: a ceiling is a limit, loudness the softer target. Null when the input is unmeasurable, so
 * the signal passes through at unity.
 */
export function normalizationGainDb(recipe: Normalization, before: LoudnessMeasurement) {
  if (unmeasurableNormalization(before)) return null;
  const requestedGainDb = recipe.targetIntegratedLufs - before.integratedLufs!;
  return {
    requestedGainDb,
    gainDb: Math.min(requestedGainDb, recipe.truePeakCeilingDbtp - before.truePeakDbtp!),
  };
}

export function normalizationFailures(recipe: Normalization, after: LoudnessMeasurement) {
  return {
    integrated:
      after.integratedLufs === null ||
      Math.abs(after.integratedLufs - recipe.targetIntegratedLufs) >
        normalizationTolerance.integratedAbsoluteLu,
    range:
      after.loudnessRangeLu === null ||
      after.loudnessRangeLu >
        recipe.maxLoudnessRangeLu + normalizationTolerance.rangeMaximumExcessLu,
    peak:
      after.truePeakDbtp === null ||
      after.truePeakDbtp >
        recipe.truePeakCeilingDbtp + normalizationTolerance.meterSpecificTruePeakExcessDb,
  };
}

/** Each target the signal misses beyond its tolerance, with how far past the requested value. */
export function normalizationMisses(recipe: Normalization, after: LoudnessMeasurement): Miss[] {
  const failures = normalizationFailures(recipe, after);
  const miss = (
    target: Miss["target"],
    requested: number,
    achieved: number | null,
    excess: (achieved: number) => number,
  ): Miss => ({
    target,
    requested,
    achieved,
    excess: achieved === null ? null : Math.max(0, excess(achieved)),
  });
  return [
    ...(failures.integrated
      ? [
          miss("integrated-loudness", recipe.targetIntegratedLufs, after.integratedLufs, (value) =>
            Math.abs(value - recipe.targetIntegratedLufs),
          ),
        ]
      : []),
    ...(failures.range
      ? [
          miss(
            "loudness-range",
            recipe.maxLoudnessRangeLu,
            after.loudnessRangeLu,
            (value) => value - recipe.maxLoudnessRangeLu,
          ),
        ]
      : []),
    ...(failures.peak
      ? [
          miss(
            "true-peak",
            recipe.truePeakCeilingDbtp,
            after.truePeakDbtp,
            (value) => value - recipe.truePeakCeilingDbtp,
          ),
        ]
      : []),
  ];
}

const integratedError = (recipe: Normalization, after: LoudnessMeasurement) =>
  after.integratedLufs === null
    ? Infinity
    : Math.abs(recipe.targetIntegratedLufs - after.integratedLufs);
const tolerance = {
  "integrated-loudness": normalizationTolerance.integratedAbsoluteLu,
  "loudness-range": normalizationTolerance.rangeMaximumExcessLu,
  "true-peak": normalizationTolerance.meterSpecificTruePeakExcessDb,
} as const;

/**
 * The candidate to publish: the smallest total miss beyond tolerance, then the smallest integrated
 * error, then the earliest. A candidate that meets every target has no miss, so among those the one
 * closest to the loudness target wins.
 */
export function selectNormalizationAttempt(recipe: Normalization, attempts: readonly Attempt[]) {
  const rank = (attempt: Attempt) =>
    [
      normalizationMisses(recipe, attempt.after).reduce(
        (total, miss) =>
          total + (miss.excess === null ? Infinity : miss.excess - tolerance[miss.target]),
        0,
      ),
      integratedError(recipe, attempt.after),
    ] as const;
  let best = 0;
  for (let index = 1; index < attempts.length; index++) {
    const [miss, error] = rank(attempts[index]!),
      [bestMiss, bestError] = rank(attempts[best]!);
    if (miss < bestMiss || (miss === bestMiss && error < bestError)) best = index;
  }
  return best;
}

/**
 * The bounded dynamic correction loop's next step after the measured attempts: the next offset to
 * render, or why it stops. Retained evidence re-derives its stop reason from the same rule.
 */
export function normalizationStep(
  recipe: Normalization,
  attempts: readonly Attempt[],
): { offsetDb: number } | { stopReason: StopReason } {
  const last = attempts.at(-1)!;
  const failures = normalizationFailures(recipe, last.after);
  if (last.after.integratedLufs === null || failures.range || failures.peak)
    return { stopReason: "constraints" };
  const errorLu = integratedError(recipe, last.after);
  if (errorLu <= normalizationCorrectionPolicy.desiredErrorLu)
    return { stopReason: "target-reached" };
  const previous = attempts.at(-2);
  const previousErrorLu = previous ? integratedError(recipe, previous.after) : Infinity;
  if (previousErrorLu - errorLu < normalizationCorrectionPolicy.minimumErrorImprovementLu)
    return { stopReason: "no-progress" };
  if (attempts.length >= normalizationCorrectionPolicy.maximumCandidates)
    return { stopReason: "budget-exhausted" };
  const offsetDb =
    last.offsetDb === null
      ? NaN
      : last.offsetDb + recipe.targetIntegratedLufs - last.after.integratedLufs;
  if (
    !Number.isFinite(offsetDb) ||
    offsetDb < normalizationCorrectionPolicy.minimumOffsetDb ||
    offsetDb > normalizationCorrectionPolicy.maximumOffsetDb
  )
    return { stopReason: "offset-unavailable" };
  return { offsetDb };
}

/** Whether a normalization domain passed its signal through at unity because nothing was measurable. */
export function normalizationPassedThrough(recipe: Normalization, value: NormalizationEvidence) {
  return (
    unmeasurableNormalization(value.before) !== null ||
    (recipe.mode === "dynamic" && value.attempts[0]!.offsetDb === null)
  );
}

/**
 * Every issue the published signal carries, derived only from its processing evidence. Producers
 * publish exactly these, and retained reads re-derive them to prove the stored issues unchanged.
 */
export function audioProcessingIssues(evidence: readonly AudioProcessingEvidence[]): Issue[] {
  const issues: Issue[] = [];
  for (const item of evidence) {
    const { domainIndex, recipe } = item;
    if (recipe.type === "limiter" && item.limiter) {
      const ceiling = 10 ** (recipe.ceilingDbfs / 20);
      if (item.limiter.samplePeak > ceiling + limiterCeilingTolerance)
        issues.push({
          code: "limiter-ceiling-unmet",
          message: "The limited signal passes its requested sample ceiling",
          evidence: {
            domainIndex,
            ceilingDbfs: recipe.ceilingDbfs,
            samplePeakDbfs: 20 * Math.log10(item.limiter.samplePeak),
          },
        });
    }
    if (recipe.type !== "normalization" || !item.normalization) continue;
    const value = item.normalization;
    if (normalizationPassedThrough(recipe, value)) {
      issues.push({
        code: "normalization-unmeasurable",
        message: "Normalization had nothing to measure, so the signal passed through at unity gain",
        evidence: {
          domainIndex,
          ...(unmeasurableNormalization(value.before) ??
            ({ measurement: "dynamic-first-pass", reason: "non-finite" } as const)),
        },
      });
      continue;
    }
    const missed = normalizationMisses(recipe, value.after);
    if (!missed.length) continue;
    const message = "The published signal misses requested normalization targets";
    if (recipe.mode === "gain-only") {
      const before = value.before as LoudnessMeasurement & {
        integratedLufs: number;
        truePeakDbtp: number;
      };
      const gain = normalizationGainDb(recipe, before)!;
      issues.push({
        code: "normalization-target-unmet",
        message,
        evidence: {
          mode: "gain-only",
          domainIndex,
          missed,
          requestedGainDb: gain.requestedGainDb,
          gainDb: gain.gainDb,
          peakToLoudnessDb: before.truePeakDbtp - before.integratedLufs,
          maximumFeasibleTargetLufs:
            recipe.truePeakCeilingDbtp - before.truePeakDbtp + before.integratedLufs,
        },
      });
    } else {
      const step = normalizationStep(recipe, value.attempts);
      if (!("stopReason" in step))
        throw new CatalogError(
          "INVALID_RESPONSE",
          "Normalization published before its correction loop stopped",
        );
      issues.push({
        code: "normalization-target-unmet",
        message,
        evidence: {
          mode: "dynamic",
          domainIndex,
          missed,
          attempts: value.attempts.length,
          selectedAttempt: value.selectedAttempt,
          stopReason: step.stopReason,
        },
      });
    }
  }
  return issues;
}

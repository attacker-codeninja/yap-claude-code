import { z } from "zod";
import { selectionRangeSchema, timeValueSchema } from "./schema.js";

/**
 * Output by default: an operation that can produce its output does, and reports each problem as an
 * issue on that output. This module is the only issue vocabulary; every code and its evidence shape
 * is registered here. Codes are kebab-case so they never collide with UPPER_SNAKE refusal codes.
 */

export const issueLimit = 1000;

const subjectSchema = z.union([
  z.object({ range: selectionRangeSchema }).strict(),
  z.object({ word: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict(),
  z.object({ step: z.string().min(1) }).strict(),
  z.object({ channel: z.int().nonnegative().max(1024) }).strict(),
]);

function issue<const Code extends string, Evidence extends z.ZodType>(
  code: Code,
  evidence: Evidence,
) {
  return z
    .object({
      code: z.literal(code),
      message: z.string().min(1),
      at: subjectSchema.optional(),
      evidence,
    })
    .strict();
}

export const framingConstraintSchema = z.enum([
  "zoom_cap",
  "zoom_floor",
  "source_bounds",
  "margins_unreachable",
  "target_unreachable",
  "subject_landmarks_partial",
  "subject_landmarks_unavailable",
]);

const boundsSchema = z.object({ startUs: timeValueSchema, endUs: timeValueSchema }).strict();
const domainIndexSchema = z.int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const finite = z.number().finite();

/** One requested normalization target the published signal misses beyond its tolerance. */
export const normalizationTargetMissSchema = z
  .object({
    target: z.enum(["integrated-loudness", "loudness-range", "true-peak"]),
    requested: finite,
    /** Null when the published signal has no measurable value for this target. */
    achieved: finite.nullable(),
    /** How far past the requested value the published signal lands; null when unmeasured. */
    excess: finite.nonnegative().nullable(),
  })
  .strict();

/** Why a dynamic correction loop stopped at the candidate it measured last. */
export const normalizationStopReasonSchema = z.enum([
  "constraints",
  "target-reached",
  "no-progress",
  "budget-exhausted",
  "offset-unavailable",
]);

export const issueSchema = z.discriminatedUnion("code", [
  issue(
    "issues-truncated",
    z.object({ omitted: z.int().positive().max(Number.MAX_SAFE_INTEGER) }).strict(),
  ),
  issue(
    "synchronization-evidence-refused",
    z
      .object({
        angleGroupId: z.string().min(1),
        evidenceId: z.string().min(1),
        generation: z.string().min(1),
        method: z.enum(["waveform", "lexical-anchor", "mixed-reference"]),
        fingerprint: z.string().min(1),
        operationIndex: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      })
      .strict(),
  ),
  issue(
    "gain-constrained",
    z
      .object({
        limit: z.enum(["true-peak-ceiling", "gain-minimum", "gain-maximum"]),
        requestedGainDb: z.number().finite(),
        gainDb: z.number().finite(),
      })
      .strict(),
  ),
  issue(
    "gain-bound-breached",
    z
      .object({
        bound: z.literal("gain-minimum"),
        boundDb: z.number().finite(),
        gainDb: z.number().finite(),
      })
      .strict(),
  ),
  issue(
    "proposal-unavailable",
    z
      .object({
        reason: z.enum(["missing-support", "too-short", "unmeasurable", "gain-unrepresentable"]),
      })
      .strict(),
  ),
  issue(
    "derived-stale-skipped",
    z.object({ kind: z.literal("transcript-generation"), id: z.string().min(1) }).strict(),
  ),
  issue(
    "caption-omitted",
    z
      .object({
        placementId: z.string().min(1),
        reason: z.enum(["no-display-support", "empty-text"]),
      })
      .strict(),
  ),
  issue(
    "caption-overlap-added",
    z
      .object({
        left: z
          .object({ placementId: z.string().min(1), fragment: z.int().nonnegative() })
          .strict(),
        right: z
          .object({ placementId: z.string().min(1), fragment: z.int().nonnegative() })
          .strict(),
        startMs: z.int().nonnegative(),
        endMs: z.int().nonnegative(),
      })
      .strict(),
  ),
  issue(
    "srt-literal-markup",
    z.object({ placementId: z.string().min(1), alternative: z.literal("vtt") }).strict(),
  ),
  issue("framing-constraint-unmet", z.object({ constraint: framingConstraintSchema }).strict()),
  issue(
    "range-clamped",
    z
      .object({
        requested: boundsSchema,
        applied: selectionRangeSchema,
        bounds: boundsSchema,
        operationIndex: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
      })
      .strict(),
  ),
  issue(
    "normalization-target-unmet",
    z.discriminatedUnion("mode", [
      z
        .object({
          mode: z.literal("gain-only"),
          domainIndex: domainIndexSchema,
          missed: z.array(normalizationTargetMissSchema).min(1).max(3),
          /** The gain the loudness target asked for, and the gain applied once the peak ceiling won. */
          requestedGainDb: finite,
          gainDb: finite,
          /** The input's true peak minus its integrated loudness. */
          peakToLoudnessDb: finite,
          /** The loudest integrated target a gain could reach without passing the peak ceiling. */
          maximumFeasibleTargetLufs: finite,
        })
        .strict(),
      z
        .object({
          mode: z.literal("dynamic"),
          domainIndex: domainIndexSchema,
          missed: z.array(normalizationTargetMissSchema).min(1).max(3),
          attempts: z.int().positive().max(Number.MAX_SAFE_INTEGER),
          selectedAttempt: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
          stopReason: normalizationStopReasonSchema,
        })
        .strict(),
    ]),
  ),
  issue(
    "normalization-unmeasurable",
    z
      .object({
        domainIndex: domainIndexSchema,
        measurement: z.enum([
          "integrated-loudness",
          "loudness-range",
          "true-peak",
          "dynamic-first-pass",
        ]),
        reason: z.enum(["insufficient-duration", "below-gate", "silent", "non-finite"]),
      })
      .strict(),
  ),
  issue(
    "limiter-ceiling-unmet",
    z
      .object({
        domainIndex: domainIndexSchema,
        ceilingDbfs: finite,
        samplePeakDbfs: finite,
      })
      .strict(),
  ),
]);

export type Issue = z.infer<typeof issueSchema>;
export type IssueCode = Issue["code"];

export const issueCodes: readonly IssueCode[] = issueSchema.options.map(
  (option) => option.shape.code.value,
);

/** At most `issueLimit` issues, optionally followed by one final `issues-truncated`. */
export const issuesSchema = z
  .array(issueSchema)
  .max(issueLimit + 1)
  .refine(
    (issues) => issues.length <= issueLimit || issues.at(-1)?.code === "issues-truncated",
    "Only a final issues-truncated entry may follow the issue limit",
  );

export function boundedIssues(issues: readonly Issue[]): Issue[] {
  if (issues.length <= issueLimit) return [...issues];
  const omitted = issues.length - issueLimit;
  return [
    ...issues.slice(0, issueLimit),
    {
      code: "issues-truncated",
      message: `${omitted} more issues were omitted`,
      evidence: { omitted },
    },
  ];
}

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
    "proposal-unavailable",
    z
      .object({
        reason: z.enum(["missing-support", "too-short", "unmeasurable", "gain-unrepresentable"]),
      })
      .strict(),
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
    "caption-styling-discarded",
    z.object({ placementIds: z.array(z.string().min(1)).min(1) }).strict(),
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

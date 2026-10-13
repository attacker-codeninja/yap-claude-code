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

const boundsSchema = z.object({ startUs: timeValueSchema, endUs: timeValueSchema }).strict();

export const issueSchema = z.discriminatedUnion("code", [
  issue(
    "issues-truncated",
    z.object({ omitted: z.int().positive().max(Number.MAX_SAFE_INTEGER) }).strict(),
  ),
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

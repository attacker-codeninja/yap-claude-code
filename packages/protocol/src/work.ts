import { issuesSchema, type Issue } from "@yap/composition";
import { z } from "zod";

/**
 * Retained publication identity is separate from a replacement job's attempt. Every publication
 * carries the issues reported with it, empty when the output is clean.
 */
export function publishedOutputSchema<T extends z.ZodType>(output: T) {
  return z.object({
    generation: z.union([z.int().positive().max(Number.MAX_SAFE_INTEGER), z.string().min(1)]),
    attemptId: z.string().min(1).optional(),
    output,
    issues: issuesSchema,
  });
}

/** Expose one domain payload without leaking a queue recipe or serialized worker result. */
export function publishedOutput<
  Publication extends { generation: number | string; attemptId?: string; issues: Issue[] },
  Output,
>(publication: Publication | null, output: (publication: Publication) => Output) {
  return publication
    ? {
        generation: publication.generation,
        ...(publication.attemptId === undefined ? {} : { attemptId: publication.attemptId }),
        output: output(publication),
        issues: publication.issues,
      }
    : null;
}

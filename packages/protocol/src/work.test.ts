import { expect, test } from "vitest";
import { z } from "zod";
import type { Issue } from "@yap/composition";
import { publishedOutput, publishedOutputSchema } from "./work.js";

const truncated: Issue = {
  code: "issues-truncated",
  message: "2 more issues were omitted",
  evidence: { omitted: 2 },
};

test("a published output always carries its issues, empty when clean", () => {
  const schema = publishedOutputSchema(z.object({ assetId: z.string() }));
  for (const issues of [[], [truncated]]) {
    const published = publishedOutput(
      { generation: 3, attemptId: "attempt", issues, assetId: "asset" },
      ({ assetId }) => ({ assetId }),
    );
    expect(published).toEqual({
      generation: 3,
      attemptId: "attempt",
      output: { assetId: "asset" },
      issues,
    });
    expect(schema.parse(published)).toEqual(published);
  }
  expect(
    schema.safeParse({ generation: 3, attemptId: "attempt", output: { assetId: "asset" } }).success,
  ).toBe(false);
});

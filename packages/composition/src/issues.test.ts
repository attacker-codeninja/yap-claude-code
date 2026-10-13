import { describe, expect, it } from "vitest";
import { boundedIssues, issueCodes, issueLimit, issueSchema, issuesSchema, type Issue } from "./issues.js";

const truncated = (omitted: number): Issue => ({
  code: "issues-truncated",
  message: `${omitted} more issues were omitted`,
  evidence: { omitted },
});

describe("issues", () => {
  it("registers only kebab-case codes, so they never collide with UPPER_SNAKE refusal codes", () => {
    expect(issueCodes.length).toBeGreaterThan(0);
    for (const code of issueCodes) expect(code).toMatch(/^[a-z]+(-[a-z0-9]+)*$/);
  });

  it("types evidence per code and rejects unknown codes or fields", () => {
    expect(issueSchema.parse(truncated(3))).toEqual(truncated(3));
    expect(issueSchema.safeParse({ ...truncated(3), evidence: {} }).success).toBe(false);
    expect(issueSchema.safeParse({ ...truncated(3), code: "QUALITY_UNMET" }).success).toBe(false);
    expect(issueSchema.safeParse({ ...truncated(3), extra: true }).success).toBe(false);
    expect(issueSchema.safeParse({ ...truncated(3), message: "" }).success).toBe(false);
  });

  it("places an issue on an explicit subject", () => {
    const at = { range: { startUs: 0, endUs: 1_000_000 } };
    expect(issueSchema.parse({ ...truncated(1), at })).toEqual({ ...truncated(1), at });
    expect(issueSchema.safeParse({ ...truncated(1), at: { range: { startUs: 2, endUs: 1 } } }).success).toBe(false);
  });

  it("bounds an output's issues and reports what it omitted", () => {
    const many = Array.from({ length: issueLimit + 25 }, () => truncated(1));
    const bounded = boundedIssues(many);
    expect(bounded).toHaveLength(issueLimit + 1);
    expect(bounded.at(-1)).toEqual(truncated(25));
    expect(issuesSchema.parse(bounded)).toEqual(bounded);
    expect(boundedIssues(many.slice(0, issueLimit))).toHaveLength(issueLimit);
    expect(issuesSchema.safeParse([...bounded, truncated(1)]).success).toBe(false);
  });

  it("treats an empty list as clean", () => {
    expect(issuesSchema.parse([])).toEqual([]);
  });
});

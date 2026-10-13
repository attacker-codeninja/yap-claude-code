import { describe, expect, it } from "vitest";
import {
  boundedIssues,
  issueCodes,
  issueLimit,
  issueSchema,
  issuesSchema,
  type Issue,
} from "./issues.js";

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
    expect(
      issueSchema.safeParse({ ...truncated(1), at: { range: { startUs: 2, endUs: 1 } } }).success,
    ).toBe(false);
  });

  it("bounds an output's issues and reports what it omitted", () => {
    const many = Array.from({ length: issueLimit + 25 }, (_, index): Issue => ({
      code: "caption-omitted",
      message: "omitted",
      evidence: { placementId: `c${index}`, reason: "empty-text" },
    }));
    const bounded = boundedIssues(many);
    expect(bounded).toHaveLength(issueLimit + 1);
    expect(bounded.at(-1)).toEqual(truncated(25));
    expect(issuesSchema.parse(bounded)).toEqual(bounded);
    expect(boundedIssues(many.slice(0, issueLimit))).toHaveLength(issueLimit);
    expect(issuesSchema.safeParse([...bounded, truncated(1)]).success).toBe(false);
  });

  it("keeps counting what an earlier bound omitted when bounded lists are combined", () => {
    const omittedCaption = (index: number): Issue => ({
      code: "caption-omitted",
      message: `Caption c${index} was omitted: no-display-support`,
      evidence: { placementId: `c${index}`, reason: "no-display-support" },
    });
    // A sidecar bounds its own issues; export status bounds them again beside the job's issues.
    const sidecar = boundedIssues(Array.from({ length: 1500 }, (_, i) => omittedCaption(i)));
    const status = boundedIssues([...sidecar]);
    expect(status).toEqual(sidecar);
    expect(status.at(-1)).toEqual(truncated(500));
    const represented = status.reduce(
      (count, issue) => count + (issue.code === "issues-truncated" ? issue.evidence.omitted : 1),
      0,
    );
    expect(represented).toBe(1500);

    // Two bounded lists: the first keeps its first 1000; everything else is counted, once.
    const combined = boundedIssues([...sidecar, ...sidecar.slice(0, 3)]);
    expect(combined.slice(0, issueLimit)).toEqual(sidecar.slice(0, issueLimit));
    expect(combined.at(-1)).toEqual(truncated(503));
    // A marker inside a short list still stands for its omissions, as the final entry.
    expect(boundedIssues([truncated(7), omittedCaption(1)])).toEqual([
      omittedCaption(1),
      truncated(7),
    ]);
  });

  it("treats an empty list as clean", () => {
    expect(issuesSchema.parse([])).toEqual([]);
  });
});

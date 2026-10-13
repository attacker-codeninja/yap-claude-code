import { boundedIssues, issueSchema, issuesSchema, type Issue } from "@yap/composition";
import type { Catalog } from "./catalog.js";

/**
 * Where an output's issues are stored. A job publication is keyed by the attempt that produced it,
 * which `artifacts.attemptId` names; its generation is the published generation.
 */
export type OutputKey = Readonly<{ outputKind: "artifact"; outputId: string; generation: number }>;

/**
 * Additive storage beside the publication it describes, so retained evidence objects and catalogs
 * written before issues existed stay valid: a publication without rows reads as clean. Issues are
 * retired with their publication, whichever path replaces or deletes the artifact row.
 */
export function createOutputIssues(store: Catalog): void {
  createOutputIssueTable(store);
  store.catalog.exec(`
   CREATE TRIGGER IF NOT EXISTS output_issues_retire_artifact AFTER DELETE ON artifacts BEGIN
    DELETE FROM output_issues WHERE outputKind='artifact' AND outputId=old.attemptId;
   END;
   CREATE TRIGGER IF NOT EXISTS output_issues_replace_artifact AFTER UPDATE OF attemptId ON artifacts
    WHEN old.attemptId<>new.attemptId BEGIN
    DELETE FROM output_issues WHERE outputKind='artifact' AND outputId=old.attemptId;
   END;
  `);
}

/** The table alone, for an owner that reads issues without owning the artifacts they retire with. */
export function createOutputIssueTable(store: Catalog): void {
  store.catalog.exec(`
   CREATE TABLE IF NOT EXISTS output_issues (
    outputKind TEXT NOT NULL,outputId TEXT NOT NULL,generation INTEGER NOT NULL,ordinal INTEGER NOT NULL,issue TEXT NOT NULL,
    PRIMARY KEY(outputKind,outputId,generation,ordinal)
   ) STRICT;
  `);
}

/** Joins the caller's publication transaction; issues past the limit are reported as omitted. */
export function writeOutputIssues(store: Catalog, key: OutputKey, issues: readonly Issue[]): void {
  const bounded = issuesSchema.parse(boundedIssues(issues));
  const values = [key.outputKind, key.outputId, key.generation] as const;
  store.catalog
    .prepare("DELETE FROM output_issues WHERE outputKind=? AND outputId=? AND generation=?")
    .run(...values);
  const insert = store.catalog.prepare(
    "INSERT INTO output_issues(outputKind,outputId,generation,ordinal,issue) VALUES(?,?,?,?,?)",
  );
  for (const [ordinal, issue] of bounded.entries())
    insert.run(...values, ordinal, JSON.stringify(issue));
}

/** The issues of one output in production order; empty when the output is clean. */
export function outputIssues(store: Catalog, key: OutputKey): Issue[] {
  const rows = store.catalog
    .prepare(
      "SELECT issue FROM output_issues WHERE outputKind=? AND outputId=? AND generation=? ORDER BY ordinal",
    )
    .all(key.outputKind, key.outputId, key.generation) as { issue: string }[];
  return rows.map((row) => issueSchema.parse(JSON.parse(row.issue)));
}

/**
 * Issues on words `first` to `last` of the publication one attempt made, by word ordinal. An
 * attempt publishes at most once, so its id alone names the publication.
 */
export function wordIssues(
  store: Catalog,
  attemptId: string,
  words: Readonly<{ first: number; last: number }>,
): Map<number, Issue[]> {
  const rows = store.catalog
    .prepare(
      `SELECT issue FROM output_issues WHERE outputKind='artifact' AND outputId=?
        AND json_extract(issue,'$.at.word') BETWEEN ? AND ? ORDER BY generation,ordinal`,
    )
    .all(attemptId, words.first, words.last) as { issue: string }[];
  const byWord = new Map<number, Issue[]>();
  for (const row of rows) {
    const issue = issueSchema.parse(JSON.parse(row.issue));
    const word = issue.at && "word" in issue.at ? issue.at.word : null;
    if (word !== null) byWord.set(word, [...(byWord.get(word) ?? []), issue]);
  }
  return byWord;
}

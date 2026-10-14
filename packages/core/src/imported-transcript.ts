import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Catalog, CatalogError } from "./catalog.js";
import { parseImportedTranscript, type ImportedCue, type ImportedFormat } from "./transcript-import.js";

export type ImportedTranscriptSource = {
  assetId: string;
  streamId: string;
  acquisitionId?: string;
};
export type ImportedTranscriptReceipt = {
  generation: string;
  source: ImportedTranscriptSource;
  origin: {
    format: ImportedFormat;
    parser: { name: string; version: string };
    timingBasis: "supplied";
    raw: { bytes: number; sha256: string };
    metadata: Record<string, unknown>;
  };
  cues: ImportedCue[];
};

type StoredImport = {
  requestId: string;
  source: string;
  generation: string;
  format: ImportedFormat;
  parser: string;
  timingBasis: "supplied";
  rawSha256: string;
  rawBytes: number;
  metadata: string;
  state: "complete";
};

function sourceKey(source: ImportedTranscriptSource): string {
  return JSON.stringify(source);
}

function parseStored(row: StoredImport, cues: ImportedCue[]): ImportedTranscriptReceipt {
  return {
    generation: row.generation,
    source: JSON.parse(row.source) as ImportedTranscriptSource,
    origin: {
      format: row.format,
      parser: JSON.parse(row.parser) as { name: string; version: string },
      timingBasis: row.timingBasis,
      raw: { bytes: row.rawBytes, sha256: row.rawSha256 },
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    },
    cues,
  };
}

/** Durable source-owned imported transcript generations. Cue timing stays cue-level evidence. */
export class ImportedTranscriptStore {
  constructor(
    private readonly store: Catalog,
    private readonly home: string,
    private readonly validateSource: (source: ImportedTranscriptSource) => void,
  ) {
    store.catalog.exec(`
      CREATE TABLE IF NOT EXISTS imported_transcripts (
        requestId TEXT PRIMARY KEY, source TEXT NOT NULL, generation TEXT NOT NULL UNIQUE,
        format TEXT NOT NULL, parser TEXT NOT NULL, timingBasis TEXT NOT NULL,
        rawSha256 TEXT NOT NULL, rawBytes INTEGER NOT NULL, metadata TEXT NOT NULL,
        state TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS imported_transcript_cues (
        generation TEXT NOT NULL, ordinal INTEGER NOT NULL, id TEXT NOT NULL,
        startUs INTEGER NOT NULL, endUs INTEGER NOT NULL, text TEXT NOT NULL,
        speaker TEXT, settings TEXT, words TEXT NOT NULL,
        PRIMARY KEY(generation, ordinal), FOREIGN KEY(generation) REFERENCES imported_transcripts(generation)
      ) STRICT;
    `);
  }

  async importPath(
    requestId: string,
    source: ImportedTranscriptSource,
    path: string,
    format?: ImportedFormat,
  ): Promise<ImportedTranscriptReceipt> {
    this.validateSource(source);
    const existing = this.store.catalog.prepare("SELECT * FROM imported_transcripts WHERE requestId=?").get(requestId) as StoredImport | undefined;
    if (existing) {
      if (existing.source !== sourceKey(source))
        throw new CatalogError("CONFLICT", "Transcript import request was reused for another source");
      return this.get(source, existing.generation);
    }
    const raw = await readFile(path);
    const parsed = parseImportedTranscript(raw, format === undefined ? {} : { format });
    const generation = randomUUID();
    const output = join(this.home, "transcripts", "imported", source.assetId, generation, `source.${parsed.format}`);
    await mkdir(join(this.home, "transcripts", "imported", source.assetId, generation), { recursive: true });
    await copyFile(path, output);
    this.store.transaction(() => {
      this.store.catalog.prepare(
        "INSERT INTO imported_transcripts(requestId,source,generation,format,parser,timingBasis,rawSha256,rawBytes,metadata,state) VALUES(?,?,?,?,?,?,?,?,?,?)",
      ).run(
        requestId,
        sourceKey(source),
        generation,
        parsed.format,
        JSON.stringify(parsed.parser),
        parsed.timingBasis,
        parsed.raw.sha256,
        parsed.raw.bytes,
        JSON.stringify(parsed.metadata),
        "complete",
      );
      const insert = this.store.catalog.prepare(
        "INSERT INTO imported_transcript_cues(generation,ordinal,id,startUs,endUs,text,speaker,settings,words) VALUES(?,?,?,?,?,?,?,?,?)",
      );
      for (const cue of parsed.cues)
        insert.run(
          generation,
          cue.ordinal,
          cue.id,
          cue.source.startUs,
          cue.source.endUs,
          cue.text,
          cue.speaker ?? null,
          cue.settings ?? null,
          JSON.stringify(cue.words),
        );
    });
    return this.get(source, generation);
  }

  get(source: ImportedTranscriptSource, generation: string): ImportedTranscriptReceipt {
    this.validateSource(source);
    const row = this.store.catalog.prepare("SELECT * FROM imported_transcripts WHERE generation=?").get(generation) as StoredImport | undefined;
    if (!row || row.state !== "complete" || row.source !== sourceKey(source))
      throw new CatalogError("NOT_FOUND", "Imported transcript generation is unavailable", { generation });
    const rows = this.store.catalog.prepare("SELECT * FROM imported_transcript_cues WHERE generation=? ORDER BY ordinal").all(generation) as {
      ordinal: number; id: string; startUs: number; endUs: number; text: string; speaker: string | null; settings: string | null; words: string;
    }[];
    return parseStored(row, rows.map((cue) => ({
      id: cue.id,
      ordinal: cue.ordinal,
      text: cue.text,
      ...(cue.speaker === null ? {} : { speaker: cue.speaker }),
      ...(cue.settings === null ? {} : { settings: cue.settings }),
      source: { startUs: cue.startUs, endUs: cue.endUs },
      words: JSON.parse(cue.words),
    })));
  }

  find(source: ImportedTranscriptSource): ImportedTranscriptReceipt | null {
    const row = this.store.catalog.prepare("SELECT generation FROM imported_transcripts WHERE source=? AND state='complete' ORDER BY rowid DESC LIMIT 1").get(sourceKey(source)) as { generation: string } | undefined;
    return row ? this.get(source, row.generation) : null;
  }
}

import { z } from "zod";
import { CompositionError } from "./errors.js";
import { boundedIssues, type Issue } from "./issues.js";
import type { ValidatedComposition } from "./model.js";
import { ceil, compare, divide, floor, rational, toTime } from "./rational.js";
import type { SelectionRange } from "./schema.js";

export const captionSidecarRequestSchema = z
  .object({
    kind: z.enum(["srt", "vtt"]),
    placementIds: z
      .array(z.string().min(1))
      .min(1)
      .max(1000)
      .refine((ids) => new Set(ids).size === ids.length, "Caption placement IDs must be unique"),
  })
  .strict();
export type CaptionSidecarRequest = z.infer<typeof captionSidecarRequestSchema>;
export type CaptionCue = {
  placementId: string;
  fragment: number;
  text: string;
  exact: SelectionRange;
  startMs: number;
  endMs: number;
};
const stamp = (ms: number, separator: string) => {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(Math.floor(ms / 3600000), 2)}:${pad(Math.floor(ms / 60000) % 60, 2)}:${pad(Math.floor(ms / 1000) % 60, 2)}${separator}${pad(ms % 1000, 3)}`;
};
const escapeVtt = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
// SRT readers can recognize a new cue header inside an otherwise continuous payload.
const srtTimingLine =
  /^[ \t]*[+-]?\d+:[ \t]*[+-]?\d+:[ \t]*[+-]?\d+[,.][ \t]*[+-]?\d+[ \t]*-->[ \t]*[+-]?\d+:[ \t]*[+-]?\d+:[ \t]*[+-]?\d+[,.][ \t]*[+-]?\d+/m;

/** Display support comes from the validated placement graph, never transcript word timing. */
export function captionSidecar(model: ValidatedComposition, input: CaptionSidecarRequest) {
  const request = captionSidecarRequestSchema.parse(input);
  const selected = new Map(model.clips.map((clip) => [clip.clip.id, clip]));
  const issues: Issue[] = [];
  const exactCues: { cue: CaptionCue; range: ValidatedComposition["clips"][number]["range"] }[] =
    [];
  for (const placementId of request.placementIds) {
    const placement = selected.get(placementId);
    if (!placement)
      throw new CompositionError("UNKNOWN_CLIP", "Caption placement does not exist", {
        placementId,
      });
    if (placement.clip.source.kind !== "text")
      throw new CompositionError(
        "INVALID_COMPOSITION",
        "Sidecars require selected text placements",
        { placementId },
      );
    const text = placement.clip.source.text.replace(/\r\n?/g, "\n");
    if (!placement.available.length || !text.trim()) {
      const reason = !placement.available.length ? "no-display-support" : "empty-text";
      issues.push({
        code: "caption-omitted",
        message: `Caption ${placementId} was omitted: ${reason}`,
        evidence: { placementId, reason },
      });
      continue;
    }
    if (
      [...text].some((character) => {
        const code = character.codePointAt(0)!;
        return (
          (code < 32 && code !== 9 && code !== 10) ||
          code === 127 ||
          (code >= 0xd800 && code <= 0xdfff)
        );
      }) ||
      text.split("\n").some((line) => !line.trim())
    ) {
      throw new CompositionError(
        "INVALID_COMPOSITION",
        "Caption payload cannot contain controls, invalid Unicode or blank lines",
        { placementId },
      );
    }
    // A timing line inside a payload splits the file into an unintended cue: malformed for SRT.
    if (request.kind === "srt" && srtTimingLine.test(text))
      throw new CompositionError(
        "UNSUPPORTED_FORMAT",
        "SRT cannot carry a timing line inside a caption; choose VTT",
        { placementId, format: "srt", alternative: "vtt" },
      );
    // Markup only risks being rendered as formatting: write it and report it.
    if (
      request.kind === "srt" &&
      (/<\/?[a-z][^>\n]*>|<[ \t]+\/?[ \t]*[a-z][a-z0-9-]*(?:[ \t]+[^>\n]*)?>/i.test(text) ||
        /&(?:amp|lt|gt|quot|apos|nbsp|#[0-9]+|#x[0-9a-f]+);/i.test(text) ||
        /\{\\[^}]*\}|\\[Nnh]/.test(text))
    )
      issues.push({
        code: "srt-literal-markup",
        message: `Caption ${placementId} contains text an SRT reader may render as formatting`,
        evidence: { placementId, alternative: "vtt" },
      });
    for (const [fragment, range] of placement.available.entries()) {
      if (exactCues.length === 10000)
        throw new CompositionError("LIMIT_EXCEEDED", "Sidecar cue budget exceeded", {
          maximumCues: 10000,
        });
      exactCues.push({
        range,
        cue: {
          placementId,
          fragment,
          text,
          exact: { startUs: toTime(range.start), endUs: toTime(range.end) },
          startMs: floor(divide(range.start, rational(1000n))),
          endMs: ceil(divide(range.end, rational(1000n))),
        },
      });
    }
  }
  exactCues.sort(
    (a, b) =>
      compare(a.range.start, b.range.start) ||
      (a.cue.placementId < b.cue.placementId
        ? -1
        : a.cue.placementId > b.cue.placementId
          ? 1
          : a.cue.fragment - b.cue.fragment),
  );
  let addedOverlaps = 0;
  for (let i = 0; i < exactCues.length; i++) {
    const left = exactCues[i]!;
    for (let j = i + 1; j < exactCues.length && exactCues[j]!.cue.startMs < left.cue.endMs; j++) {
      const right = exactCues[j]!;
      if (compare(left.range.end, right.range.start) <= 0) {
        if (addedOverlaps++ === 10000)
          throw new CompositionError("LIMIT_EXCEEDED", "Sidecar overlap report budget exceeded", {
            maximumAddedOverlaps: 10000,
          });
        issues.push({
          code: "caption-overlap-added",
          message: "Millisecond rounding made two captions overlap",
          evidence: {
            left: { placementId: left.cue.placementId, fragment: left.cue.fragment },
            right: { placementId: right.cue.placementId, fragment: right.cue.fragment },
            startMs: Math.max(left.cue.startMs, right.cue.startMs),
            endMs: Math.min(left.cue.endMs, right.cue.endMs),
          },
        });
      }
    }
  }
  const cues = exactCues.map(({ cue }) => cue);
  const blocks = [request.kind === "vtt" ? "WEBVTT\n\n" : ""];
  let bytes = new TextEncoder().encode(blocks[0]).length;
  for (const [index, cue] of cues.entries()) {
    const block =
      (request.kind === "srt" ? `${index + 1}\n` : "") +
      `${stamp(cue.startMs, request.kind === "srt" ? "," : ".")} --> ${stamp(cue.endMs, request.kind === "srt" ? "," : ".")}\n${request.kind === "vtt" ? escapeVtt(cue.text) : cue.text}\n\n`;
    bytes += new TextEncoder().encode(block).length;
    if (bytes > 16 * 1024 * 1024)
      throw new CompositionError("LIMIT_EXCEEDED", "Sidecar UTF8 budget exceeded", {
        maximumBytes: 16 * 1024 * 1024,
      });
    blocks.push(block);
  }
  const content = blocks.join("");
  const styled = [...new Set(cues.map((cue) => cue.placementId))];
  if (styled.length)
    issues.push({
      code: "caption-styling-discarded",
      message: "Plain sidecars keep caption text but not its styling",
      evidence: { placementIds: styled },
    });
  return { kind: request.kind, cues, issues: boundedIssues(issues), content };
}

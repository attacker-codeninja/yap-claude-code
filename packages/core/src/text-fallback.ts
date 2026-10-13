import { z } from "zod";
import type { fontReferenceSchema, Issue } from "@yap/composition";
import { CatalogError } from "./catalog.js";

const codePoints = z.array(z.int().nonnegative().max(0x10ffff)).max(8192);

/**
 * What native text rendering reports when the platform drew a text clip with something other than
 * its pinned face (`TextFallback` in helpers/mac/Sources/YapFrames/TextRaster.swift): one entry per
 * clip and face. `substituted` lists code points another installed face drew; `missing` those drawn
 * as a placeholder box. Picture receipts retain these facts, so issues are derived from them alone.
 */
export const textFallbacksSchema = z
  .array(
    z
      .object({
        clipId: z.string().min(1),
        face: z.string().min(1),
        substituted: codePoints,
        missing: codePoints,
      })
      .strict()
      .refine((entry) => entry.substituted.length + entry.missing.length > 0),
  )
  .max(10_000);
export type TextFallbacks = z.infer<typeof textFallbacksSchema>;

function spelled(values: readonly number[]) {
  const shown = values
    .slice(0, 8)
    .map((value) => "U+" + value.toString(16).toUpperCase().padStart(4, "0"));
  return shown.join(", ") + (values.length > shown.length ? ` and ${values.length - 8} more` : "");
}

/**
 * The issues a rendering publishes for its font fallbacks. `requested` resolves a clip to its
 * pinned face; a fallback for a clip the rendering did not draw as text is a malformed receipt.
 */
export function textFallbackIssues(
  fallbacks: TextFallbacks | undefined,
  requested: (clipId: string) => z.infer<typeof fontReferenceSchema> | undefined,
): Issue[] {
  const issues: Issue[] = [];
  for (const { clipId, face, substituted, missing } of fallbacks ?? []) {
    const font = requested(clipId);
    if (!font)
      throw new CatalogError("INVALID_RESPONSE", "Text fallback names a clip that drew no text");
    const subject = `Text clip ${clipId} pins ${font.postScriptName}`;
    if (substituted.length)
      issues.push({
        code: "font-substituted",
        message: `${subject}, which has no glyph for ${spelled(substituted)}; ${face} drew ${substituted.length === 1 ? "it" : "them"} instead.`,
        evidence: { clipId, requested: font, used: face, codePoints: substituted },
      });
    if (missing.length)
      issues.push({
        code: "glyph-missing",
        message: `${subject}; no glyph was found for ${spelled(missing)}, so ${face} drew a placeholder box.`,
        evidence: { clipId, requested: font, used: face, codePoints: missing },
      });
  }
  return issues;
}

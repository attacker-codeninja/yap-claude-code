import { expect, test } from "vitest";
import { layoutDiagnostics } from "./layout-diagnostics.js";

test("sampled layout diagnostics report clipping, overlap, glyph and fallback evidence", () => {
  const result = layoutDiagnostics([
    {
      atUs: 125,
      canvas: { width: 100, height: 100 },
      texts: [
        { id: "caption-a", bounds: { x: 90, y: 10, width: 20, height: 20 }, glyphs: ["missing"] },
        { id: "caption-b", bounds: { x: 95, y: 15, width: 5, height: 5 }, fallback: "System" },
      ],
    },
  ]);
  expect(result.coverage).toEqual({ state: "sampled", samples: 1, complete: false });
  expect(result.issues.map((issue) => issue.code)).toEqual([
    "text-off-canvas",
    "text-clipped",
    "missing-glyph",
    "font-fallback",
    "text-overlap",
  ]);
  expect(result.issues.at(-1)?.evidence).toEqual({ atUs: 125 });
});

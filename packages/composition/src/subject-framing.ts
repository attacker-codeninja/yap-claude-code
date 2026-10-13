import { z } from "zod";
import { geometrySchema, type Geometry } from "./geometry.js";
import { framingConstraintSchema, type Issue } from "./issues.js";

const dimension = z.number().int().positive().finite();
const coordinate = z.number().finite();
const boxSchema = z
  .object({ x: coordinate, y: coordinate, width: dimension, height: dimension })
  .strict();
const landmarkGroupSchema = z.enum([
  "face_contour",
  "left_eye",
  "right_eye",
  "left_eyebrow",
  "right_eyebrow",
  "nose",
  "nose_crest",
  "median_line",
  "outer_lips",
  "inner_lips",
  "left_pupil",
  "right_pupil",
]);
const faceSchema = z
  .object({
    id: z.string().min(1),
    boundingBox: boxSchema,
    confidence: z.number().finite().min(0).max(1).optional(),
    landmarkCoverage: z.enum(["core", "partial", "unavailable"]).optional(),
    landmarkGroups: z.array(landmarkGroupSchema).max(12).optional(),
  })
  .strict();
const domainSchema = z.object({ width: dimension, height: dimension }).strict();
const targetSchema = z
  .object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) })
  .strict();
export const subjectFramingRequestSchema = z
  .object({
    source: domainSchema,
    canvas: domainSchema,
    faces: z.array(faceSchema),
    subjectId: z.string().min(1),
    target: targetSchema,
    margins: z
      .object({ x: z.number().finite().nonnegative(), y: z.number().finite().nonnegative() })
      .strict(),
    zoom: z
      .object({ min: z.number().finite().positive(), max: z.number().finite().positive() })
      .strict()
      .refine((value) => value.min <= value.max, "zoom.min must not exceed zoom.max"),
    preservation: z.enum(["contain", "crop"]),
  })
  .strict();

export type SubjectFramingRequest = z.infer<typeof subjectFramingRequestSchema>;
export type SubjectFramingConstraint = z.infer<typeof framingConstraintSchema>;
/**
 * Output by default: geometry is proposed whenever it exists, with each unmet constraint as an
 * issue. A plan is unavailable only when no geometry can be placed for the requested subject.
 */
export type SubjectFramingPlan =
  | { status: "ready"; geometry: Geometry; zoom: number; issues: Issue[] }
  | {
      status: "unavailable";
      geometry: null;
      zoom: null;
      reason: "subject_missing" | "subject_ambiguous" | "subject_out_of_bounds" | "source_bounds";
      issues: Issue[];
    };

const constraintIssue = (constraint: SubjectFramingConstraint): Issue => ({
  code: "framing-constraint-unmet",
  message: `The framing constraint ${constraint} could not be met`,
  evidence: { constraint },
});
const ready = (geometry: Geometry, zoom: number, unmet: SubjectFramingConstraint[]) =>
  ({ status: "ready", geometry, zoom, issues: [...new Set(unmet)].map(constraintIssue) }) as const;
const unavailable = (
  reason: Extract<SubjectFramingPlan, { status: "unavailable" }>["reason"],
  unmet: SubjectFramingConstraint[] = [],
) =>
  ({
    status: "unavailable",
    geometry: null,
    zoom: null,
    reason,
    issues: unmet.map(constraintIssue),
  }) as const;

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function containGeometry(): Geometry {
  return { type: "geometry", fit: "contain" };
}

/**
 * Converts one pinned face observation into ordinary geometry. It never chooses a
 * face, reruns detection, or edits a document; callers decide whether to apply the
 * returned proposal when it carries issues.
 */
export function planSubjectFraming(input: SubjectFramingRequest): SubjectFramingPlan {
  const request = subjectFramingRequestSchema.parse(input);
  const matches = request.faces.filter((face) => face.id === request.subjectId);
  if (!matches.length) return unavailable("subject_missing");
  if (matches.length > 1) return unavailable("subject_ambiguous");

  const face = matches[0]!.boundingBox;
  const inBounds =
    face.x >= 0 &&
    face.y >= 0 &&
    face.x + face.width <= request.source.width &&
    face.y + face.height <= request.source.height;
  if (!inBounds) return unavailable("subject_out_of_bounds");

  const qualityViolation =
    matches[0]!.landmarkCoverage === "partial"
      ? "subject_landmarks_partial"
      : matches[0]!.landmarkCoverage === "unavailable"
        ? "subject_landmarks_unavailable"
        : null;

  if (request.preservation === "contain") {
    const scale = Math.min(
      request.canvas.width / request.source.width,
      request.canvas.height / request.source.height,
    );
    const contentWidth = request.source.width * scale;
    const contentHeight = request.source.height * scale;
    const target = {
      x: request.target.x * request.canvas.width,
      y: request.target.y * request.canvas.height,
    };
    const unmet: SubjectFramingConstraint[] = qualityViolation ? [qualityViolation] : [];
    if (scale > request.zoom.max) unmet.push("zoom_cap");
    if (scale < request.zoom.min) unmet.push("zoom_floor");
    const desiredOffset = {
      x: target.x - (face.x + face.width / 2) * scale,
      y: target.y - (face.y + face.height / 2) * scale,
    };
    const boundedOffset = {
      x: clamp(desiredOffset.x, 0, Math.max(0, request.canvas.width - contentWidth)),
      y: clamp(desiredOffset.y, 0, Math.max(0, request.canvas.height - contentHeight)),
    };
    if (!close(desiredOffset.x, boundedOffset.x) || !close(desiredOffset.y, boundedOffset.y))
      unmet.push("target_unreachable");
    const translation = {
      x: boundedOffset.x - (request.canvas.width - contentWidth) / 2,
      y: boundedOffset.y - (request.canvas.height - contentHeight) / 2,
    };
    const geometry: Geometry =
      close(translation.x, 0) && close(translation.y, 0)
        ? containGeometry()
        : {
            type: "geometry",
            rect: {
              x: translation.x,
              y: translation.y,
              width: request.canvas.width,
              height: request.canvas.height,
            },
            fit: "contain",
          };
    geometrySchema.parse(geometry);
    return ready(geometry, scale, unmet);
  }

  const requiredWidth = face.width + request.margins.x * 2;
  const requiredHeight = face.height + request.margins.y * 2;
  const requestedZoom = Math.min(
    request.canvas.width / requiredWidth,
    request.canvas.height / requiredHeight,
  );
  const sourceZoom = Math.max(
    request.canvas.width / request.source.width,
    request.canvas.height / request.source.height,
  );
  const unmet: SubjectFramingConstraint[] = qualityViolation ? [qualityViolation] : [];
  if (requestedZoom > request.zoom.max) unmet.push("zoom_cap");
  if (requestedZoom < request.zoom.min) unmet.push("zoom_floor");
  const zoom = clamp(Math.max(requestedZoom, sourceZoom), request.zoom.min, request.zoom.max);
  if (zoom < sourceZoom - 1e-9) return unavailable("source_bounds", unmet);
  const cropWidth = Math.min(request.canvas.width / zoom, request.source.width);
  const cropHeight = Math.min(request.canvas.height / zoom, request.source.height);
  const maxX = request.source.width - cropWidth;
  const maxY = request.source.height - cropHeight;
  const centerX = face.x + face.width / 2;
  const centerY = face.y + face.height / 2;
  const unclampedX = centerX - request.target.x * cropWidth;
  const unclampedY = centerY - request.target.y * cropHeight;
  const subjectLeft = face.x - request.margins.x;
  const subjectRight = face.x + face.width + request.margins.x;
  const subjectTop = face.y - request.margins.y;
  const subjectBottom = face.y + face.height + request.margins.y;
  if (
    subjectLeft < 0 ||
    subjectTop < 0 ||
    subjectRight > request.source.width ||
    subjectBottom > request.source.height
  )
    unmet.push("source_bounds");
  if (subjectRight - subjectLeft > cropWidth || subjectBottom - subjectTop > cropHeight)
    unmet.push("margins_unreachable");
  const feasibleMinX = Math.min(Math.max(0, maxX), Math.max(0, subjectRight - cropWidth));
  const feasibleMaxX = Math.max(0, Math.min(Math.max(0, maxX), subjectLeft));
  const feasibleMinY = Math.min(Math.max(0, maxY), Math.max(0, subjectBottom - cropHeight));
  const feasibleMaxY = Math.max(0, Math.min(Math.max(0, maxY), subjectTop));
  const cropX = clamp(unclampedX, feasibleMinX, Math.max(feasibleMinX, feasibleMaxX));
  const cropY = clamp(unclampedY, feasibleMinY, Math.max(feasibleMinY, feasibleMaxY));
  if (!close(cropX, unclampedX) || !close(cropY, unclampedY)) unmet.push("target_unreachable");
  const geometry: Geometry = {
    type: "geometry",
    crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
    rect: { x: 0, y: 0, width: request.canvas.width, height: request.canvas.height },
    fit: "stretch",
  };
  geometrySchema.parse(geometry);
  return ready(geometry, zoom, unmet);
}

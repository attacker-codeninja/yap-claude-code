import { CompositionError } from "./errors.js";
import type { Issue } from "./issues.js";
import {
  add,
  compare,
  divide,
  fromTime,
  multiply,
  subtract,
  toTime,
  type Rational,
} from "./rational.js";
import { selectionRangeSchema, type TimeValue } from "./schema.js";

/**
 * Output by default for ranges: a requested range that partly overlaps its domain is clamped and
 * reported with `range-clamped`; one with no overlap is malformed. This is the only range clamp.
 */
export type Interval = { start: Rational; end: Rational };
export type WireRange = { startUs: TimeValue; endUs: TimeValue };

export const interval = (range: WireRange): Interval => ({
  start: fromTime(range.startUs),
  end: fromTime(range.endUs),
});
export const wire = (range: Interval) => ({
  startUs: toTime(range.start),
  endUs: toTime(range.end),
});

export function admitRange(requested: Interval, domain: Interval) {
  const start = compare(requested.start, domain.start) < 0 ? domain.start : requested.start;
  const end = compare(requested.end, domain.end) > 0 ? domain.end : requested.end;
  if (compare(start, end) >= 0)
    throw new CompositionError("INVALID_RANGE", "Requested range has no part inside its domain", {
      requested: wire(requested),
      bounds: wire(domain),
    });
  const range = { start, end };
  const clamped = compare(start, requested.start) !== 0 || compare(end, requested.end) !== 0;
  return { range, clamped };
}

export function rangeClampedIssue(
  requested: Interval,
  applied: Interval,
  domain: Interval,
  operationIndex?: number,
): Issue {
  return {
    code: "range-clamped",
    message: "The requested range extended outside its domain and was clamped",
    at: { range: wire(applied) },
    evidence: {
      requested: wire(requested),
      applied: wire(applied),
      bounds: wire(domain),
      ...(operationIndex === undefined ? {} : { operationIndex }),
    },
  };
}

/** Map the kept part of `requested` onto another interval that spans it linearly. */
export function keepSameFraction(requested: Interval, kept: Interval, span: Interval): Interval {
  const length = subtract(requested.end, requested.start);
  const spanLength = subtract(span.end, span.start);
  const at = (point: Rational) =>
    add(span.start, multiply(spanLength, divide(subtract(point, requested.start), length)));
  return { start: at(kept.start), end: at(kept.end) };
}

/**
 * A read's range on the wire: the applied range plus its `range-clamped` issue when clamped. A
 * requested range that isn't a nonempty half-open range is malformed.
 */
export function admitReadRange(requested: WireRange, domain: WireRange) {
  if (!selectionRangeSchema.safeParse(requested).success)
    throw new CompositionError(
      "INVALID_RANGE",
      "Requested range must be a nonempty half-open range",
      {
        requested,
        bounds: domain,
      },
    );
  const asked = interval(requested);
  const bounds = interval(domain);
  const { range, clamped } = admitRange(asked, bounds);
  return {
    range: wire(range),
    issues: clamped ? [rangeClampedIssue(asked, range, bounds)] : [],
  };
}

export type MicrosecondRange = { startUs: number; endUs: number };

/** A read over whole microseconds (transcript pages, capture events): a fractional range is malformed. */
export function admitMicrosecondRange(requested: WireRange, domain: MicrosecondRange) {
  if (!Number.isSafeInteger(requested.startUs) || !Number.isSafeInteger(requested.endUs))
    throw new CompositionError("INVALID_RANGE", "Range must use integer microseconds", {
      requested,
      bounds: domain,
    });
  const { range, issues } = admitReadRange(requested, domain);
  return { range: range as MicrosecondRange, issues };
}

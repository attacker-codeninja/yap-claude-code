import { expect, test } from "vitest";
import { omit } from "./omit.js";

test("omit copies every other own property in order and leaves the source intact", () => {
  const source = { first: 1, removed: "x", last: { nested: true }, other: undefined };
  const copy = omit(source, "removed", "other");
  expect(Object.entries(copy)).toEqual([
    ["first", 1],
    ["last", { nested: true }],
  ]);
  expect(copy.last).toBe(source.last);
  expect(source).toEqual({ first: 1, removed: "x", last: { nested: true }, other: undefined });
});

/** Like rest destructuring, the copy's remaining properties are writable. */
export type Omitted<T, K extends keyof T> = { -readonly [P in keyof T as Exclude<P, K>]: T[P] };

/** Shallow copy of `value` without `keys`; the source object is left unchanged. */
export function omit<T extends object, K extends keyof T>(
  value: T,
  ...keys: readonly K[]
): Omitted<T, K> {
  const copy: Omitted<T, K> & Partial<Pick<T, K>> = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

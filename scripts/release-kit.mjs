// The install kit is the one ZIP that a release's SHA256SUMS names. release.mjs gives it a fixed
// name; older releases used versioned names, so consumers read the name rather than build it.
export function kitName(checksums) {
  const zips = checksums
    .split("\n")
    .map((line) => line.split("  ")[1]?.trim())
    .filter((name) => name?.endsWith(".zip"));
  if (zips.length !== 1) throw new Error("SHA256SUMS must name exactly one install kit");
  return zips[0];
}

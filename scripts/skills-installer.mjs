import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// The app installs its skill with the pinned `skills` package (apps/macos/package.json) run by
// the bundled Node, so it needs no host Node, npm or network. Like the service and CLI it ships
// as one file; the notices for libraries the package vendors into its own build travel with it.
export function bundleSkillsInstaller(root, resources) {
  const source = dirname(
    createRequire(join(root, "apps/macos/package.json")).resolve("skills/package.json"),
  );
  const destination = join(resources, "skills-installer");
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  execFileSync(
    "bun",
    [
      "build",
      join(source, "bin/cli.mjs"),
      "--target=node",
      "--outfile",
      join(destination, "cli.mjs"),
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  copyFileSync(
    join(source, "dist/THIRD-PARTY-LICENSES.md"),
    join(destination, "THIRD-PARTY-LICENSES.md"),
  );
  return destination;
}

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { clearPrecache, generatePrecache } from "./precache.mjs";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/KernelHub";
clearPrecache();
const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      KERNELHUB_STATIC_EXPORT: "1",
      NEXT_PUBLIC_BASE_PATH: basePath,
    },
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);
generatePrecache({
  staticDirectory: "out/_next/static",
  outputDirectory: "out",
});
writeFileSync("out/.nojekyll", "");

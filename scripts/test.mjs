import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["electron/test-entry.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".test/core.cjs",
  external: ["electron"],
});
const r = spawnSync(
  process.execPath,
  ["--test", "tests/core.test.cjs", "tests/updates.test.cjs"],
  {
    stdio: "inherit",
  },
);
process.exitCode = r.status || 0;

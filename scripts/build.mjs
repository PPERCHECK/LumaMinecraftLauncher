import { build } from "esbuild";
import fs from "node:fs";
await import("./assets.mjs");
await build({
  entryPoints: ["electron/main.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/main.cjs",
  external: ["electron"],
  sourcemap: true,
});
await build({
  entryPoints: ["electron/preload.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/preload.cjs",
  external: ["electron"],
});
fs.copyFileSync("build/icon.png", "dist/icon.png");

import { spawn } from "node:child_process";
import electron from "electron";
await import("./build.mjs");
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
  stdio: "inherit",
});
for (let n = 0; n < 60; n++) {
  try {
    await fetch("http://127.0.0.1:5173");
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}
const app = spawn(electron, ["."], {
  stdio: "inherit",
  env: { ...process.env, LUMA_DEV: "1" },
});
app.on("exit", (code) => {
  vite.kill();
  process.exit(code || 0);
});

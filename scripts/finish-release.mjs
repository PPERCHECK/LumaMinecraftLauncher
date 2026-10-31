import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
const short = version.split(".").slice(0, 2).join(".");
const out = path.resolve("../../outputs");
const stage = path.resolve("../source-" + version);
const source = path.join(stage, "luma-source");
fs.mkdirSync(out, { recursive: true });
if (!stage.startsWith(path.resolve("..") + path.sep)) throw Error("Invalid stage path");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(source, { recursive: true });
for (const dir of ["src", "electron", "scripts", "tests", "build", ".github"])
  fs.cpSync(dir, path.join(source, dir), { recursive: true });
for (const file of ["package.json", "package-lock.json", "tsconfig.json", "vite.config.ts", "index.html", ".gitignore", "LICENSE", "README.md", "ARCHITECTURE.md", "VERIFICATION.md", "RELEASE.md", "PHOTO_CREDITS.md"])
  fs.copyFileSync(file, path.join(source, file));
const files = [`Luma-Setup-${version}.exe`, `Luma-Setup-${version}.exe.blockmap`, "latest.yml"];
for (const file of files) fs.copyFileSync(path.join("release", file), path.join(out, file));
fs.copyFileSync("RELEASE.md", path.join(out, `Luma-${short}-Инструкция.md`));
const seven = path.resolve("node_modules/electron-winstaller/vendor/7z.exe");
execFileSync(seven, ["a", "-tzip", "-mx=7", path.join(out, `Luma-Source-${version}.zip`), "luma-source"], { cwd: stage, stdio: "pipe", windowsHide: true });
fs.writeFileSync(path.join(out, `Luma-${short}-SHA256.txt`), files.map(f => crypto.createHash("sha256").update(fs.readFileSync(path.join(out, f))).digest("hex") + "  " + f).join("\n") + "\n");
console.log("Setup and source delivered to", out);

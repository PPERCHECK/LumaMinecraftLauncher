import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const testRoot = path.resolve(process.env.LUMA_SMOKE_DIR || "../smoke-data");
fs.mkdirSync(testRoot, { recursive: true });
const env = { ...process.env, LUMA_DATA: testRoot };
delete env.ELECTRON_RUN_AS_NODE;
delete env.LUMA_DEV;
const app = await electron.launch({ args: ["."], env, timeout: 60000 });
const page = await app.firstWindow();
const issues = [];
page.on("pageerror", (e) => issues.push(e.message));
await page.waitForSelector(".hero", { timeout: 30000 });
const call = (method, data) =>
  page.evaluate(async ({ method, data }) => window.luma.call(method, data), {
    method,
    data,
  });
const results = [];
async function test(name, fn) {
  try {
    const info = await fn();
    results.push({ name, status: "passed", info });
    console.log("PASS", name, info || "");
  } catch (e) {
    results.push({ name, status: "failed", error: e.message });
    console.error("FAIL", name, e.message);
  }
}
await test("App opens with isolated data", async () => {
  const s = await call("state");
  assert.equal(s.dataPath, testRoot);
});
await new Promise((r) => setTimeout(r, 3000));
if (!fs.existsSync(path.resolve("../home-preview.png")))
  await page.screenshot({ path: path.resolve("../home-preview.png") });
await test("Official Minecraft manifest includes release / snapshot / Beta / Alpha", async () => {
  const m = await call("versions");
  assert(m.versions.some((v) => v.type === "release"));
  assert(m.versions.some((v) => v.type === "snapshot"));
  assert(m.versions.some((v) => v.type === "old_beta"));
  assert(m.versions.some((v) => v.type === "old_alpha"));
  return m.latest;
});
await test("Real Modrinth search and version list", async () => {
  const r = await call("catalogSearch", {
    source: "modrinth",
    query: "Sodium",
    type: "mod",
    version: "1.20.1",
    loader: "fabric",
  });
  assert(r.projects.length);
  const p = r.projects.find((p) => p.title === "Sodium") || r.projects[0];
  const vs = await call("projectVersions", {
    source: p.source,
    id: p.id,
    version: "1.20.1",
    loader: "fabric",
  });
  assert(vs.length);
  return p.title;
});
await test("CurseForge missing-key error is explicit", async () => {
  const r = await call("catalogSearch", { source: "curseforge", type: "mod" });
  assert.equal(r.projects.length, 0);
  assert(r.errors[0].includes("API key"));
});
await test("All four loader sources return live compatible versions", async () => {
  for (const loader of ["fabric", "quilt", "forge", "neoforge"]) {
    const list = await call("loaders", {
      version: loader === "neoforge" ? "1.21.1" : "1.20.1",
      loader,
    });
    assert(list.length, loader + " has versions");
  }
});
await test("Local account validates name and computes stable UUID", async () => {
  await assert.rejects(() => call("addLocal", { name: "bad name" }));
  await call("addLocal", { name: "LumaTest" });
  const s = await call("state");
  assert.equal(s.accounts[0].name, "LumaTest");
  assert.equal(s.accounts[0].type, "local");
});
let id;
await test("Create isolated instance", async () => {
  await call("createInstance", {
    name: "Smoke Vanilla",
    version: "1.20.1",
    loader: "vanilla",
  });
  const s = await call("state");
  id = s.activeInstance;
  assert(s.instances.some((i) => i.id === id));
  assert(fs.existsSync(path.join(testRoot, "instances", id)));
});
await test("Backup and restore worlds + settings", async () => {
  const dir = path.join(testRoot, "instances", id, "saves");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "world.txt"), "original world");
  await call("backup", id);
  const [file] = await call("backups", id);
  assert(file);
  fs.writeFileSync(path.join(dir, "world.txt"), "changed world");
  await call("updateInstance", { id, memory: 3072 });
  await call("restore", { id, file });
  assert.equal(
    fs.readFileSync(path.join(dir, "world.txt"), "utf8"),
    "original world",
  );
  assert.equal(
    (await call("state")).instances.find((x) => x.id === id).memory,
    4096,
  );
});
await test("Theme validation and persistence", async () => {
  await assert.rejects(() => call("settings", { accent: "url(evil)" }));
  await call("settings", {
    language: "en",
    theme: "light",
    motion: false,
    accent: "#98c3fa",
  });
  assert.equal((await call("state")).settings.theme, "light");
  await call("settings", {
    language: "ru",
    theme: "dark",
    motion: true,
    accent: "#c6abff",
  });
});
await test("DPAPI encrypts API credentials and renderer cannot read them", async () => {
  await call("setKey", {
    key: "curseforge",
    value: "test-secret-must-not-leak",
  });
  const s = await call("state");
  assert(s.keys.curseforge);
  assert(!JSON.stringify(s).includes("test-secret-must-not-leak"));
  const bytes = fs.readFileSync(path.join(testRoot, "vault.bin"));
  assert(!bytes.includes(Buffer.from("test-secret-must-not-leak")));
  await call("setKey", { key: "curseforge", value: "" });
});
await test("Main frame blocks unknown operations", async () => {
  await assert.rejects(() => call("arbitraryCode", { code: "process.exit()" }));
});
if (process.argv.includes("--install")) {
  await test("Download Java + install Vanilla 1.20.1", async () => {
    const jobId = await call("install", id);
    let previous = "";
    const end = Date.now() + 12 * 60 * 1000;
    while (Date.now() < end) {
      const j = (await call("jobs")).find((j) => j.id === jobId);
      if (j.phase !== previous) {
        previous = j.phase;
        console.log("INSTALL", j.phase);
      }
      if (j.status === "error") throw Error(j.error);
      if (j.status === "done") {
        assert(
          (await call("state")).instances.find((i) => i.id === id)
            .installedVersion,
        );
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw Error("Installation timed out");
  });
}
await test("Renderer has no unhandled errors", async () =>
  assert.deepEqual(issues, []));
fs.writeFileSync(
  path.resolve("../smoke-results.json"),
  JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
);
if (process.argv.includes("--keep-open")) {
  console.log("READY FOR VISUAL REVIEW");
  await new Promise((r) => setTimeout(r, 15 * 60 * 1000));
}
await app.close();
if (results.some((r) => r.status === "failed")) process.exitCode = 1;

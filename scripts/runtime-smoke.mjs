import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import AdmZip from "adm-zip";
const root = path.resolve("../smoke-data");
const env = { ...process.env, LUMA_DATA: root, LUMA_HEADLESS: "1" };
delete env.ELECTRON_RUN_AS_NODE;
delete env.LUMA_DEV;
const app = await electron.launch({ args: ["."], env, timeout: 60000 });
const diagnostic = fs.createWriteStream(path.resolve("../runtime-stderr.log"));
app.process().stderr.on("data", (b) => diagnostic.write(b));
app
  .process()
  .on("exit", (code, signal) => console.log("ELECTRON EXIT", code, signal));
const page = await app.firstWindow();
await page.waitForSelector(".hero");
const call = (method, data) =>
  page.evaluate(({ method, data }) => window.luma.call(method, data), {
    method,
    data,
  });
const results = [];
let failed = false;
async function test(name, fn) {
  try {
    const info = await fn();
    console.log("PASS", name, info || "");
    results.push({ name, status: "passed", info });
  } catch (e) {
    failed = true;
    console.error("FAIL", name, e.message.slice(0, 1800));
    results.push({ name, status: "failed", error: e.message.slice(0, 1800) });
  }
}
async function waitJob(id) {
  const end = Date.now() + 8 * 60 * 1000;
  let last = "";
  while (Date.now() < end) {
    const j = (await call("jobs")).find((j) => j.id === id);
    if (Date.now() - Number(last.split("|")[1] || 0) > 15000) {
      console.log("JOB", j.label, j.phase);
      last = j.phase + "|" + Date.now();
    }
    if (j.status === "error") throw Error(j.error);
    if (j.status === "done") return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("Job timed out");
}
const state = await call("state"),
  vanilla = state.instances.find(
    (i) => i.loader === "vanilla" && i.installedVersion === "1.20.1",
  );
if (!vanilla) throw Error("Run smoke.mjs --install first");
await test("Vanilla launches a real Java process and stays running", async () => {
  await waitJob(await call("play", { id: vanilla.id }));
  await new Promise((r) => setTimeout(r, 20000));
  const s = await call("state"),
    log = await call("logs", vanilla.id);
  assert(
    s.running.includes(vanilla.id),
    "Game exited early: " + log.slice(-2000),
  );
  assert(log.length > 100, "Expected real Minecraft console output");
  return log.slice(-350);
});
if (process.argv.includes("--keep-game")) {
  console.log("GAME READY FOR VISUAL REVIEW");
  await new Promise((r) => setTimeout(r, 60000));
}
await call("stop", vanilla.id);
for (let n = 0; n < 50; n++) {
  if (!(await call("state")).running.includes(vanilla.id)) break;
  await new Promise((r) => setTimeout(r, 200));
}
let fabric;
await test("Create Fabric instance using live metadata", async () => {
  const list = await call("loaders", { version: "1.20.1", loader: "fabric" });
  await call("createInstance", {
    name: "Smoke Fabric",
    version: "1.20.1",
    loader: "fabric",
    loaderVersion: list[0],
  });
  fabric = (await call("state")).activeInstance;
});
await test("Install a real Modrinth mod and its required dependencies", async () => {
  const r = await call("catalogSearch", {
    source: "modrinth",
    query: "Sodium Extra",
    type: "mod",
    version: "1.20.1",
    loader: "fabric",
  });
  const p = r.projects.find((p) => p.title === "Sodium Extra") || r.projects[0];
  assert(p);
  const vs = await call("projectVersions", {
    source: p.source,
    id: p.id,
    version: "1.20.1",
    loader: "fabric",
  });
  await waitJob(
    await call("installProject", {
      project: p,
      versionId: vs[0].id,
      instanceId: fabric,
    }),
  );
  const i = (await call("state")).instances.find((i) => i.id === fabric);
  assert(i.mods.length >= 2, "Expected dependency resolution");
  for (const m of i.mods)
    assert(fs.existsSync(path.join(root, "instances", fabric, m.file)));
  return i.mods.map((m) => m.name);
});
await test("Toggle mod without deleting its bytes", async () => {
  let i = (await call("state")).instances.find((i) => i.id === fabric);
  const m = i.mods[0],
    f = path.join(root, "instances", fabric, m.file),
    before = fs.readFileSync(f);
  await call("toggleMod", { id: fabric, file: m.file });
  assert(!fs.existsSync(f));
  assert(fs.readFileSync(f + ".disabled").equals(before));
  await call("toggleMod", { id: fabric, file: m.file });
  assert(fs.existsSync(f));
});
await test("Fabric installs through XMCL and own verified file layer", async () => {
  await waitJob(await call("install", fabric));
  const i = (await call("state")).instances.find((i) => i.id === fabric);
  assert(i.installedVersion?.includes("fabric"));
  return i.installedVersion;
});
await test("Fabric launches with real installed mods", async () => {
  await waitJob(await call("play", { id: fabric }));
  await new Promise((r) => setTimeout(r, 20000));
  const s = await call("state"),
    log = await call("logs", fabric);
  assert(
    s.running.includes(fabric),
    "Fabric exited early: " + log.slice(-2500),
  );
  assert(log.toLowerCase().includes("fabric"), "Expected Fabric console");
  return log.slice(-300);
});
await call("stop", fabric);
for (let n = 0; n < 50; n++) {
  if (!(await call("state")).running.includes(fabric)) break;
  await new Promise((r) => setTimeout(r, 200));
}
const exportFile = path.resolve("../smoke-export.mrpack");
await test("Export real Modrinth instance as mrpack", async () => {
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, exportFile);
  await call("exportPack", { id: fabric, format: "mrpack" });
  const zip = new AdmZip(exportFile),
    index = JSON.parse(zip.readAsText("modrinth.index.json"));
  assert(index.files.length >= 2);
  assert.equal(index.dependencies.minecraft, "1.20.1");
  assert(index.dependencies["fabric-loader"]);
  assert(!zip.getEntries().some((e) => e.entryName.endsWith(".jar")));
});
await test("Import exported mrpack with real URLs and hashes", async () => {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, exportFile);
  await waitJob(await call("importPack"));
  const s = await call("state"),
    i = s.instances.find((x) => x.id === s.activeInstance);
  assert.equal(i.loader, "fabric");
  assert(i.mods.length >= 2);
  assert.notEqual(i.id, fabric);
});
await test("Documented configuration editing and preset restore", async () => {
  const dir = path.join(root, "instances", fabric, "config");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "luma-test.json"), '{"enabled":true}');
  const files = await call("configFiles", fabric);
  assert(files.includes("luma-test.json"));
  await call("savePreset", { id: fabric, name: "Smoke preset" });
  await call("writeConfig", {
    id: fabric,
    file: "luma-test.json",
    text: '{"enabled":false}',
  });
  assert.equal(
    JSON.parse(await call("readConfig", { id: fabric, file: "luma-test.json" }))
      .enabled,
    false,
  );
  await call("restorePreset", { id: fabric, name: "Smoke preset" });
  assert.equal(
    JSON.parse(await call("readConfig", { id: fabric, file: "luma-test.json" }))
      .enabled,
    true,
  );
});
fs.writeFileSync(
  path.resolve("../runtime-results.json"),
  JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
);
await app.close();
if (failed) process.exitCode = 1;

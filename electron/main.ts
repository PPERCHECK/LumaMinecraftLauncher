import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  db,
  initStore,
  save,
  vault,
  root,
  instance,
  instanceDir,
  inside,
  redact,
  defaults,
} from "./storage";
import { Queue, json, download } from "./network";
import { addLocal, loginMicrosoft, loginEly, removeAccount } from "./auth";
import {
  versions,
  loaders,
  installGame,
  launchGame,
  running,
} from "./minecraft";
import * as Catalog from "./catalog";
import * as Packs from "./packs";
import { ping, parseAddress, discoverLan } from "./servers";
import type { Settings } from "../src/shared";
import {
  initUpdates,
  updateStatus,
  checkUpdates as checkLauncherUpdates,
  installUpdate,
  setUpdatesEnabled,
} from "./updates";
app.setName("Luma Launcher");
if (!process.env.LUMA_DATA)
  app.setPath("userData", path.join(app.getPath("appData"), "Luma Launcher"));
if (process.env.LUMA_DATA)
  app.setPath("userData", path.resolve(process.env.LUMA_DATA));
let win: BrowserWindow;
const emit = (event: string, data: any) => {
  if (win && !win.isDestroyed()) win.webContents.send("luma:" + event, data);
};
const queue = new Queue(emit);
async function horizonRelease() {
  const releases = await json("https://api.github.com/repos/horizon-rust/horizon/releases?per_page=30");
  const release = releases.find((r: any) => /^launcher(?:@|-v)\d/.test(r.tag_name) && !r.draft);
  const asset = release?.assets?.find((a: any) => a.name === "horizon-launcher-windows-x64.zip");
  if (!asset) throw Error("Horizon Windows launcher release is unavailable");
  return { tag: release.tag_name, url: release.html_url, published: release.published_at, asset: asset.browser_download_url, name: asset.name, size: asset.size, checksumUrl: release.assets.find((a: any) => a.name === "SHA256SUMS")?.browser_download_url };
}
function state() {
  return {
    ...db(),
    keys: {
      curseforge: !!vault("curseforge"),
      elySecret: !!vault("elySecret"),
    },
    dataPath: root(),
    running: [...running.keys()],
    systemMemory: Math.floor(os.totalmem() / 1024 ** 2),
  };
}
function idle(id: string) {
  instance(id);
  if (queue.has(id) || running.has(id))
    throw Error(
      "Stop the game and wait for this instance’s downloads before editing it",
    );
}
const bound = (v: any, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max)
    throw Error(`Expected number ${min}–${max}`);
  return n;
};
function cleanSettings(input: any) {
  const s: Settings = { ...db().settings };
  for (const key of ["language", "theme", "density", "startPage"] as const)
    if (input[key] !== undefined) {
      const values: Record<string, string[]> = {
        language: ["ru", "en", "uk", "de", "fr", "es", "pl", "pt_br", "zh_cn"],
        theme: ["dark", "light"],
        density: ["comfortable", "compact"],
        startPage: [
          "home",
          "instances",
          "catalog",
          "cheats",
          "servers",
          "friends",
          "downloads",
          "settings",
        ],
      };
      if (!values[key].includes(input[key]))
        throw Error("Invalid setting: " + key);
      (s as any)[key] = input[key];
    }
  for (const key of ["motion", "sidebar", "onboardingDone"] as const)
    if (typeof input[key] === "boolean") s[key] = input[key];
  if (input.accent !== undefined) {
    if (!/^#[a-f0-9]{6}$/i.test(input.accent))
      throw Error("Invalid accent color");
    s.accent = input.accent;
  }
  for (const [key, min, max] of [
    ["scale", 0.75, 1.5],
    ["blur", 0, 80],
    ["opacity", 0.5, 1],
  ] as const)
    if (input[key] !== undefined) s[key] = bound(input[key], min, max);
  for (const key of ["msClientId", "elyClientId", "elyRedirect"] as const)
    if (typeof input[key] === "string")
      s[key] = input[key].trim().slice(0, 500);
  return s;
}
function imageFile() {
  return dialog
    .showOpenDialog(win, {
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      properties: ["openFile"],
    })
    .then(({ filePaths, canceled }) => {
      if (canceled) return null;
      const f = filePaths[0];
      if (fs.statSync(f).size > 8 * 1024 ** 2)
        throw Error("Image maximum size is 8 MB");
      const ext = path.extname(f).slice(1).replace("jpg", "jpeg");
      return (
        "data:image/" + ext + ";base64," + fs.readFileSync(f).toString("base64")
      );
    });
}
function configFiles(id: string) {
  const dir = path.join(instanceDir(id), "config");
  const files: string[] = [];
  const walk = (p: string) => {
    if (!fs.existsSync(p)) return;
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const f = path.join(p, e.name);
      if (e.isDirectory()) walk(f);
      else if (
        e.isFile() &&
        /\.(json|toml|cfg|properties|txt|ini|yaml|yml)$/i.test(e.name)
      )
        files.push(path.relative(dir, f).replaceAll("\\", "/"));
    }
  };
  walk(dir);
  return files.slice(0, 1000);
}
async function call(method: string, d: any = {}) {
  switch (method) {
    case "state":
      return state();
    case "window":
      if (d === "minimize") win.minimize();
      else if (d === "maximize") {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
      } else if (d === "close") win.close();
      return;
    case "versions":
      return versions();
    case "horizonRelease":
      return horizonRelease();
    case "downloadHorizon": {
      const release = await horizonRelease();
      const choice = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath("downloads"), release.name), filters: [{ name: "ZIP archive", extensions: ["zip"] }] });
      if (choice.canceled || !choice.filePath) return null;
      const destination = choice.filePath;
      const checksumText = release.checksumUrl ? await (await fetch(release.checksumUrl)).text() : "";
      const checksum = checksumText.match(/^([a-f\d]{64})\s+\*?horizon-launcher-windows-x64\.zip\s*$/im)?.[1];
      if (!checksum) throw Error("Horizon release checksum is unavailable");
      return queue.add("Horizon " + release.tag, undefined, async ctx => {
        await download(release.asset, destination, ctx, { algorithm: "sha256", value: checksum });
        shell.showItemInFolder(destination);
      });
    }
    case "loaders":
      return loaders(String(d.version), d.loader);
    case "selectAccount":
      if (!db().accounts.some((a) => a.id === d))
        throw Error("Account not found");
      db().activeAccount = d;
      save();
      break;
    case "addLocal":
      addLocal(String(d.name));
      break;
    case "loginMicrosoft":
      await loginMicrosoft(emit);
      break;
    case "loginEly":
      await loginEly();
      break;
    case "removeAccount":
      removeAccount(String(d));
      break;
    case "createInstance": {
      const manifest = await versions();
      if (!manifest.versions.some((v: any) => v.id === d.version))
        throw Error("Select a version from the official manifest");
      if (d.loader !== "vanilla") {
        const vs = await loaders(d.version, d.loader);
        if (!vs.length) throw Error("Loader does not support this version");
        if (d.loaderVersion && !vs.includes(d.loaderVersion))
          throw Error("Unknown loader version");
      }
      Packs.createInstance(d);
      break;
    }
    case "selectInstance":
      instance(d);
      db().activeInstance = d;
      save();
      break;
    case "updateInstance": {
      idle(d.id);
      const i = instance(d.id);
      if (typeof d.name === "string" && d.name.trim())
        i.name = d.name.trim().slice(0, 80);
      for (const k of ["java", "args", "gameArgs", "description"] as const)
        if (typeof d[k] === "string") i[k] = d[k].slice(0, 10000);
      if (d.memory !== undefined)
        i.memory = bound(
          d.memory,
          512,
          Math.max(512, Math.floor(os.totalmem() / 1024 ** 2)),
        );
      if (d.width !== undefined) i.width = bound(d.width, 320, 7680);
      if (d.height !== undefined) i.height = bound(d.height, 240, 4320);
      if (["aurora", "rose", "forest", "ocean", "mountain", "night"].includes(d.cover))
        i.cover = d.cover;
      save();
      break;
    }
    case "removeInstance": {
      idle(d);
      const i = instance(d);
      const r = await dialog.showMessageBox(win, {
        type: "warning",
        buttons: ["Cancel", "Delete"],
        defaultId: 0,
        cancelId: 0,
        message: `Delete “${i.name}”?`,
        detail:
          "A full backup will be created first. The instance folder will be removed.",
      });
      if (r.response !== 1) return;
      Packs.backup(d, "before-delete");
      fs.rmSync(instanceDir(d), { recursive: true, force: true });
      db().instances = db().instances.filter((i) => i.id !== d);
      if (db().activeInstance === d)
        db().activeInstance = db().instances[0]?.id;
      save();
      break;
    }
    case "install":
    case "play": {
      const id = typeof d === "string" ? d : d.id;
      instance(id);
      if (queue.has(id) || running.has(id))
        throw Error("This instance is busy");
      return queue.add(
        method === "play" ? "Minecraft · launch" : "Minecraft · install",
        id,
        (ctx) =>
          method === "play"
            ? launchGame(id, ctx, emit, d.server)
            : installGame(id, ctx).then(() => {}),
      );
    }
    case "playLan": {
      const id = String(d.id);
      const i = instance(id);
      if (!["fabric", "quilt"].includes(i.loader))
        throw Error("Automatic LAN requires a Fabric or Quilt instance");
      if (queue.has(id) || running.has(id)) throw Error("This instance is busy");
      return queue.add("LAN · " + i.name, id, async (ctx) => {
        if (!i.mods.some((m) => m.source === "modrinth" && m.projectId === "MpJfqdMf" && m.enabled)) {
          const versions = await Catalog.projectVersions("modrinth", "MpJfqdMf", i.version, i.loader);
          if (!versions[0]) throw Error("Auto LAN does not support this Minecraft version yet");
          Packs.backup(id, "before-auto-lan");
          await Catalog.installProject({ id: "MpJfqdMf", source: "modrinth", title: "Auto LAN", description: "Automatically opens singleplayer worlds to LAN", downloads: 0, author: "Modrinth", type: "mod", url: "https://modrinth.com/project/MpJfqdMf" }, versions[0].id, id, ctx);
        }
        await launchGame(id, ctx, emit);
      });
    }
    case "stop":
      running.get(d)?.kill();
      return;
    case "jobs":
      return queue.jobs;
    case "cancelJob":
      queue.cancel(d);
      return;
    case "retryJob":
      queue.retry(d);
      return;
    case "catalogSearch":
      return Catalog.search(d);
    case "categories":
      return Catalog.categories(d);
    case "project":
      return Catalog.detail(d);
    case "projectVersions":
      return Catalog.projectVersions(d.source, d.id, d.version, d.loader);
    case "installProject": {
      if (d.project.type === "modpack")
        return queue.add(d.project.title, undefined, (ctx) =>
          Catalog.installPackProject(d.project, d.versionId, ctx),
        );
      idle(d.instanceId);
      return queue.add(d.project.title, d.instanceId, async (ctx) => {
        Packs.backup(d.instanceId, "before-mod-change");
        await Catalog.installProject(d.project, d.versionId, d.instanceId, ctx);
      });
    }
    case "checkUpdates":
      idle(d);
      return Catalog.updates(d);
    case "updateMods": {
      idle(d);
      return queue.add("Update mods", d, async (ctx) => {
        Packs.backup(d, "before-update");
        const updates = await Catalog.updates(d);
        for (const u of updates) {
          const p = await Catalog.detail({
            id: u.mod.projectId!,
            source: u.mod.source as any,
            type: u.mod.kind,
          } as any);
          await Catalog.installProject(p, u.version.id, d, ctx);
        }
      });
    }
    case "toggleMod": {
      idle(d.id);
      const i = instance(d.id),
        m = i.mods.find((x) => x.file === d.file);
      if (!m) throw Error("Mod not found");
      const f = inside(instanceDir(d.id), m.file);
      fs.renameSync(
        f + (m.enabled ? "" : ".disabled"),
        f + (m.enabled ? ".disabled" : ""),
      );
      m.enabled = !m.enabled;
      save();
      break;
    }
    case "addJars": {
      idle(d);
      const r = await dialog.showOpenDialog(win, {
        filters: [{ name: "Java mods", extensions: ["jar"] }],
        properties: ["openFile", "multiSelections"],
      });
      if (r.canceled) return;
      const i = instance(d);
      for (const f of r.filePaths) {
        const rel = "mods/" + path.basename(f),
          dest = inside(instanceDir(d), rel);
        if (fs.existsSync(dest) || i.mods.some((m) => m.file === rel))
          throw Error("File already exists: " + rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(f, dest);
        i.mods.push({
          file: rel,
          name: path.basename(f, ".jar"),
          source: "local",
          kind: "mod",
          enabled: true,
        });
      }
      save();
      break;
    }
    case "openFolder": {
      const allowed = [
        "",
        "mods",
        "saves",
        "screenshots",
        "config",
        "logs",
        "resourcepacks",
        "shaderpacks",
      ];
      if (!allowed.includes(d.folder || "")) throw Error("Unsupported folder");
      const p = path.join(instanceDir(instance(d.id).id), d.folder || "");
      fs.mkdirSync(p, { recursive: true });
      const err = await shell.openPath(p);
      if (err) throw Error(err);
      return;
    }
    case "logs": {
      instance(d);
      const f = path.join(instanceDir(d), "logs", "luma-console.log");
      return fs.existsSync(f) ? fs.readFileSync(f, "utf8").slice(-150000) : "";
    }
    case "backup":
      idle(d);
      Packs.backup(d);
      break;
    case "backups":
      return Packs.backups(d);
    case "restore":
      idle(d.id);
      Packs.restore(d.id, d.file);
      break;
    case "exportPack": {
      idle(d.id);
      const format = d.format === "curseforge" ? "curseforge" : "mrpack";
      const r = await dialog.showSaveDialog(win, {
        defaultPath:
          instance(d.id).name + (format === "mrpack" ? ".mrpack" : ".zip"),
        filters: [
          {
            name: format,
            extensions: [format === "mrpack" ? "mrpack" : "zip"],
          },
        ],
      });
      if (r.canceled || !r.filePath) return;
      return Packs.exportPack(d.id, r.filePath, format);
    }
    case "importPack": {
      const r = await dialog.showOpenDialog(win, {
        filters: [{ name: "Modpacks", extensions: ["mrpack", "zip"] }],
        properties: ["openFile"],
      });
      if (r.canceled) return;
      return queue.add("Import modpack", undefined, (ctx) =>
        Packs.importPack(r.filePaths[0], ctx).then(() => {}),
      );
    }
    case "importFolder": {
      const r = await dialog.showOpenDialog(win, {
        properties: ["openDirectory"],
        title: "Choose an existing Minecraft game folder",
      });
      if (r.canceled) return;
      Packs.importFolder(r.filePaths[0], d);
      break;
    }
    case "configFiles":
      return configFiles(d);
    case "readConfig": {
      if (!configFiles(d.id).includes(d.file))
        throw Error("Unsupported config file");
      const f = inside(path.join(instanceDir(d.id), "config"), d.file);
      if (fs.statSync(f).size > 1024 ** 2)
        throw Error("Open this large file in an external editor");
      return fs.readFileSync(f, "utf8");
    }
    case "writeConfig": {
      idle(d.id);
      if (!configFiles(d.id).includes(d.file))
        throw Error("Config file not found");
      if (typeof d.text !== "string" || d.text.length > 1024 ** 2)
        throw Error("Invalid config content");
      Packs.backup(d.id, "before-config");
      fs.writeFileSync(
        inside(path.join(instanceDir(d.id), "config"), d.file),
        d.text,
      );
      return;
    }
    case "presets": {
      instance(d);
      const dir = path.join(root(), "presets", d);
      return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    }
    case "savePreset": {
      idle(d.id);
      if (!/^[\p{L}\p{N} _-]{1,64}$/u.test(d.name))
        throw Error("Preset name: letters, numbers, spaces, _ or -");
      const src = path.join(instanceDir(d.id), "config"),
        dest = path.join(root(), "presets", d.id, d.name);
      if (!fs.existsSync(src))
        throw Error("Run the game to generate configuration files");
      if (fs.existsSync(dest)) throw Error("Preset already exists");
      fs.cpSync(src, dest, { recursive: true });
      return;
    }
    case "restorePreset": {
      idle(d.id);
      const preset = inside(path.join(root(), "presets", d.id), d.name);
      if (!fs.existsSync(preset)) throw Error("Preset not found");
      Packs.backup(d.id, "before-preset");
      const dir = path.join(instanceDir(d.id), "config");
      fs.rmSync(dir, { recursive: true, force: true });
      fs.cpSync(preset, dir, { recursive: true });
      return;
    }
    case "addServer":
      parseAddress(d.address);
      db().servers.push({
        id: randomUUID(),
        name: String(d.name || d.address).slice(0, 100),
        address: d.address,
      });
      save();
      break;
    case "discoverLan":
      return discoverLan();
    case "addFriend":
      parseAddress(d.address);
      db().friends.push({ id: randomUUID(), name: String(d.name || d.address).trim().slice(0, 100), address: String(d.address) });
      save();
      break;
    case "removeFriend":
      db().friends = db().friends.filter((x) => x.id !== d);
      save();
      break;
    case "removeServer":
      db().servers = db().servers.filter((x) => x.id !== d);
      save();
      break;
    case "ping":
      return ping(d);
    case "settings":
      db().settings = cleanSettings(d);
      save();
      break;
    case "setKey":
      if (!["curseforge", "elySecret"].includes(d.key))
        throw Error("Unknown key");
      vault(d.key, d.value || null);
      break;
    case "chooseJava": {
      const r = await dialog.showOpenDialog(win, {
        filters: [
          {
            name: "Java executable",
            extensions: process.platform === "win32" ? ["exe"] : ["*"],
          },
        ],
        properties: ["openFile"],
      });
      return r.canceled ? null : r.filePaths[0];
    }
    case "coverImage": {
      idle(d);
      const image = await imageFile();
      if (image) instance(d).cover = image;
      save();
      break;
    }
    case "backgroundImage": {
      const image = await imageFile();
      if (image) db().settings.background = image;
      save();
      break;
    }
    case "backgroundPreset":
      if (!["aurora", "rose", "forest", "ocean", "mountain", "night"].includes(d))
        throw Error("Unknown background preset");
      db().settings.background = "photo:" + d;
      save();
      break;
    case "clearBackground":
      delete db().settings.background;
      save();
      break;
    case "exportTheme": {
      const r = await dialog.showSaveDialog(win, {
        defaultPath: "luma-theme.json",
        filters: [{ name: "Luma theme", extensions: ["json"] }],
      });
      if (r.canceled || !r.filePath) return;
      const { msClientId, elyClientId, elyRedirect, onboardingDone, ...theme } = db().settings;
      fs.writeFileSync(
        r.filePath,
        JSON.stringify({ format: "luma-theme", version: 1, theme }, null, 2),
      );
      return;
    }
    case "previewTheme": {
      const r = await dialog.showOpenDialog(win, {
        filters: [{ name: "Luma theme", extensions: ["json"] }],
        properties: ["openFile"],
      });
      if (r.canceled) return null;
      if (fs.statSync(r.filePaths[0]).size > 12 * 1024 ** 2)
        throw Error("Theme too large");
      const v = JSON.parse(fs.readFileSync(r.filePaths[0], "utf8"));
      if (v.format !== "luma-theme" || v.version !== 1)
        throw Error("Unsupported theme format");
      const s = cleanSettings({
        ...v.theme,
        msClientId: db().settings.msClientId,
        elyClientId: db().settings.elyClientId,
        elyRedirect: db().settings.elyRedirect,
      });
      if (
        typeof v.theme.background === "string" &&
        /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(
          v.theme.background,
        )
      )
        s.background = v.theme.background;
      return s;
    }
    case "applyTheme": {
      const old = db().settings;
      const s = cleanSettings(d);
      s.msClientId = old.msClientId;
      s.elyClientId = old.elyClientId;
      s.elyRedirect = old.elyRedirect;
      s.onboardingDone = old.onboardingDone;
      if (
        typeof d.background === "string" &&
        /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(d.background)
      )
        s.background = d.background;
      db().settings = s;
      save();
      break;
    }
    case "openUrl": {
      const u = new URL(d);
      if (u.protocol !== "https:")
        throw Error("Only HTTPS links are supported");
      await shell.openExternal(u.href);
      return;
    }
    case "dataFolder":
      await shell.openPath(root());
      return;
    case "about":
      return {
        version: app.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node,
      };
    case "updateStatus":
      return updateStatus();
    case "checkLauncherUpdates":
      return checkLauncherUpdates();
    case "installLauncherUpdate":
      return installUpdate();
    case "setUpdatesEnabled":
      return setUpdatesEnabled(d);
    default:
      throw Error("Unknown operation");
  }
  emit("refresh", null);
  return state();
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.whenReady().then(async () => {
    initStore();
    await initUpdates(
      emit,
      () =>
        running.size > 0 ||
        queue.jobs.some((j) => ["running", "queued"].includes(j.status)),
    );
    win = new BrowserWindow({
      width: 1380,
      height: 900,
      minWidth: 1050,
      minHeight: 700,
      frame: false,
      backgroundColor: "#0c0c10",
      title: "Luma Launcher",
      icon: path.join(__dirname, "icon.png"),
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    win.setMenuBarVisibility(false);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event, url) => {
      if (url !== win.webContents.getURL()) event.preventDefault();
    });
    ipcMain.handle("luma:call", async (event, method, d) => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame
      )
        throw Error("Unauthorized frame");
      try {
        return { ok: true, value: await call(method, d) };
      } catch (e) {
        return {
          ok: false,
          error: redact(e instanceof Error ? e.message : String(e)),
        };
      }
    });
    win.once("ready-to-show", () => {
      if (process.env.LUMA_HEADLESS !== "1") win.show();
    });
    if (process.env.LUMA_DEV === "1") void win.loadURL("http://127.0.0.1:5173");
    else void win.loadFile(path.join(__dirname, "ui", "index.html"));
    win.on("close", (e) => {
      if (running.size || queue.jobs.some((j) => j.status === "running")) {
        const r = dialog.showMessageBoxSync(win, {
          type: "question",
          buttons: ["Stay", "Close launcher"],
          defaultId: 0,
          cancelId: 0,
          message: "Downloads or games are running",
          detail:
            "Closing Luma cancels downloads. A running game may continue; its session statistics will not be recorded.",
        });
        if (r === 0) e.preventDefault();
      }
    });
  });
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.on("window-all-closed", () => app.quit());
}


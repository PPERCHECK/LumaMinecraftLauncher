import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Version, launch } from "@xmcl/core";
import * as Installer from "@xmcl/installer";
import { XMLParser } from "fast-xml-parser";
import AdmZip from "adm-zip";
import { db, save, root, instance, instanceDir, redact } from "./storage";
import { json, download, type Context } from "./network";
import { credentials } from "./auth";
import { installBaseFiles } from "./game-files";
import { extract } from "./archive";
import type { Instance, Loader } from "../src/shared";
const exec = promisify(execFile);
export const resources = () => path.join(root(), "minecraft");
export const running = new Map<
  string,
  import("node:child_process").ChildProcess
>();
export async function versions() {
  const f = path.join(root(), "versions-cache.json");
  if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 15 * 60 * 1000)
    return JSON.parse(fs.readFileSync(f, "utf8"));
  try {
    const v = await json(
      "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
    );
    fs.writeFileSync(f, JSON.stringify(v));
    return v;
  } catch (e) {
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
    throw e;
  }
}
async function mavenVersions(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error("Loader metadata HTTP " + r.status);
  const v = new XMLParser().parse(await r.text()).metadata.versioning.versions
    .version;
  return (Array.isArray(v) ? v : [v]).map(String);
}
export async function loaders(mc: string, loader: Loader): Promise<string[]> {
  if (loader === "vanilla") return [];
  if (!/^[\w.+-]+$/.test(mc)) throw Error("Invalid Minecraft version");
  if (loader === "fabric" || loader === "quilt") {
    const host =
      loader === "fabric"
        ? "https://meta.fabricmc.net"
        : "https://meta.quiltmc.org";
    const v = await json(
      `${host}/${loader === "quilt" ? "v3" : "v2"}/versions/loader/${encodeURIComponent(mc)}`,
    );
    return v.map((x: any) => x.loader.version);
  }
  if (loader === "forge") {
    const v = await mavenVersions(
      "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml",
    );
    return v
      .filter((x: string) => x.startsWith(mc + "-"))
      .map((x: string) => x.slice(mc.length + 1))
      .reverse();
  }
  const nums = mc.split(".");
  const prefix =
    (Number(nums[0]) >= 26
      ? nums[0] + "." + (nums[1] || "0")
      : (nums[1] || "0") + "." + (nums[2] || "0")) + ".";
  return (
    await mavenVersions(
      "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml",
    )
  )
    .filter((x) => x.startsWith(prefix))
    .reverse();
}
export async function javaMajor(java: string) {
  try {
    const r = await exec(java, ["-version"], {
      windowsHide: true,
      timeout: 15000,
    });
    const m = (r.stderr + r.stdout).match(/version "(\d+)(?:\.(\d+))?/);
    if (!m) throw Error();
    return Number(m[1]) === 1 ? Number(m[2]) : Number(m[1]);
  } catch {
    throw Error("Cannot run Java: " + java);
  }
}
export async function ensureJava(major: number, custom: string, ctx: Context) {
  if (custom) {
    const actual = await javaMajor(custom);
    if (actual !== major)
      throw Error(
        `This version requires Java ${major}; selected Java ${actual}. Clear the Java path to install automatically.`,
      );
    return custom;
  }
  const dest = path.join(root(), "java", String(major));
  const cached = path.join(dest, "java-path.json");
  if (fs.existsSync(cached)) {
    const p = JSON.parse(fs.readFileSync(cached, "utf8"));
    if (fs.existsSync(p)) return p;
  }
  ctx.update({ phase: `Java ${major} · metadata`, progress: 0, total: 0 });
  const os =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "mac"
        : "linux";
  const arch = process.arch === "arm64" ? "aarch64" : "x64";
  let list = await json(
    `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=${arch}&os=${os}&image_type=jre`,
  );
  if (!list.length)
    list = await json(
      `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=${arch}&os=${os}&image_type=jdk`,
    );
  const binary = list.find((x: any) =>
    x.binary.package.name.endsWith(".zip"),
  )?.binary;
  if (!binary)
    throw Error(
      "Automatic Java installation supports Windows ZIP distributions. Select a Java executable manually.",
    );
  const zip = path.join(root(), "cache", `java-${major}.zip`);
  ctx.update({ phase: `Java ${major} · download` });
  await download(binary.package.link, zip, ctx, {
    algorithm: "sha256",
    value: binary.package.checksum,
  });
  ctx.signal.throwIfAborted();
  ctx.update({ phase: `Java ${major} · unpacking`, progress: 0, total: 0 });
  extract(new AdmZip(zip), dest);
  const find = (dir: string): string | undefined => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        const f = find(p);
        if (f) return f;
      } else if (
        e.name === (process.platform === "win32" ? "java.exe" : "java")
      )
        return p;
    }
  };
  const java = find(dest);
  if (!java) throw Error("Java executable missing in archive");
  await javaMajor(java);
  fs.writeFileSync(cached, JSON.stringify(java));
  return java;
}
export async function runTask(task: any, ctx: Context) {
  ctx.signal.throwIfAborted();
  const cancel = () => void task.cancel().catch(() => {});
  ctx.signal.addEventListener("abort", cancel, { once: true });
  let last = 0,
    prev = 0,
    prevTime = Date.now();
  try {
    return await task.startAndWait({
      onStart: (t: any) => {
        ctx.update({ phase: t.path });
      },
      onUpdate: () => {
        const now = Date.now();
        if (now - last < 200) return;
        const p = Math.max(0, task.progress || 0),
          total = Math.max(0, task.total || 0);
        ctx.update({
          progress: p,
          total,
          speed: Math.max(0, (p - prev) / ((now - prevTime) / 1000)),
        });
        prev = p;
        prevTime = now;
        last = now;
      },
    });
  } finally {
    ctx.signal.removeEventListener("abort", cancel);
  }
}
export async function installGame(id: string, ctx: Context) {
  const i = instance(id);
  const manifest = await versions();
  const meta = manifest.versions.find((x: any) => x.id === i.version);
  if (!meta) throw Error("Minecraft version not in official manifest");
  fs.mkdirSync(resources(), { recursive: true });
  const versionFile = path.join(
    resources(),
    "versions",
    i.version,
    i.version + ".json",
  );
  ctx.update({ phase: "Minecraft · version metadata" });
  await download(meta.url, versionFile, ctx, {
    algorithm: "sha1",
    value: meta.sha1,
  });
  const raw = JSON.parse(fs.readFileSync(versionFile, "utf8"));
  const major = raw.javaVersion?.majorVersion || 8;
  const java = await ensureJava(major, i.java, ctx);
  ctx.update({ phase: "Minecraft · client" });
  const client = raw.downloads?.client;
  if (!client) throw Error("No client download in version metadata");
  await download(
    client.url,
    path.join(resources(), "versions", i.version, i.version + ".jar"),
    ctx,
    { algorithm: "sha1", value: client.sha1 },
  );
  await installBaseFiles(await Version.parse(resources(), i.version), ctx);
  let resolved = i.version;
  if (
    i.loader !== "vanilla" &&
    i.installedVersion &&
    i.loaderVersion &&
    fs.existsSync(
      path.join(
        resources(),
        "versions",
        i.installedVersion,
        i.installedVersion + ".json",
      ),
    )
  ) {
    resolved = i.installedVersion;
    await installBaseFiles(await Version.parse(resources(), resolved), ctx);
  } else if (i.loader !== "vanilla") {
    const compatible = await loaders(i.version, i.loader);
    const lv = i.loaderVersion || compatible[0];
    if (!lv || !compatible.includes(lv))
      throw Error(`${i.loader} is not available for Minecraft ${i.version}`);
    ctx.update({ phase: `${i.loader} ${lv}`, progress: 0, total: 0 });
    if (i.loader === "fabric") {
      const art = await Installer.getFabricLoaderArtifact(i.version, lv);
      resolved = await Installer.installFabric(art, resources());
    } else if (i.loader === "quilt") {
      resolved = await Installer.installQuiltVersion({
        minecraftVersion: i.version,
        version: lv,
        minecraft: resources(),
      });
    } else if (i.loader === "forge") {
      resolved = await runTask(
        Installer.installForgeTask(
          {
            mcversion: i.version,
            version: lv,
            installer: {
              path: `https://maven.minecraftforge.net/net/minecraftforge/forge/${i.version}-${lv}/forge-${i.version}-${lv}-installer.jar`,
            },
          },
          resources(),
          { java, mavenHost: "https://maven.minecraftforge.net" },
        ),
        ctx,
      );
    } else {
      resolved = await runTask(
        Installer.installNeoForgedTask("neoforge", lv, resources(), { java }),
        ctx,
      );
    }
    ctx.signal.throwIfAborted();
    await installBaseFiles(await Version.parse(resources(), resolved), ctx);
    i.loaderVersion = lv;
  }
  ctx.signal.throwIfAborted();
  i.installedVersion = resolved;
  fs.mkdirSync(instanceDir(id), { recursive: true });
  save();
  return { version: resolved, java };
}
export function splitArgs(s: string) {
  const out: string[] = [];
  let current = "",
    quote = "",
    started = false;
  for (const c of s) {
    if ((c === '"' || c === "'") && (!quote || quote === c)) {
      quote = quote ? "" : c;
      started = true;
    } else if (/\s/.test(c) && !quote) {
      if (started) {
        out.push(current);
        current = "";
        started = false;
      }
    } else {
      current += c;
      started = true;
    }
  }
  if (quote) throw Error("Unclosed quote in launch arguments");
  if (started) out.push(current);
  return out;
}
export async function launchGame(
  id: string,
  ctx: Context,
  emit: (e: string, v: any) => void,
  server?: string,
) {
  if (running.has(id)) throw Error("This instance is already running");
  const i = instance(id);
  const account = await credentials();
  const game = await installGame(id, ctx);
  ctx.signal.throwIfAborted();
  let agent: any;
  if (account.type === "ely") {
    ctx.update({ phase: "Ely.by · authlib-injector" });
    const meta = await json(
      "https://authlib-injector.yushi.moe/artifact/latest.json",
    );
    const jar = path.join(root(), "agents", `authlib-${meta.build_number}.jar`);
    await download(meta.download_url, jar, ctx, {
      algorithm: "sha256",
      value: meta.checksums.sha256,
    });
    agent = { jar, server: "https://authserver.ely.by" };
  }
  const dir = instanceDir(id);
  syncMinecraftLanguage(dir, db().settings.language);
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  const logfile = path.join(dir, "logs", "luma-console.log");
  fs.writeFileSync(logfile, "");
  const log = (line: string) => {
    const safe = redact(line);
    fs.appendFileSync(logfile, safe);
    emit("log", { id, line: safe });
  };
  const args = splitArgs(i.gameArgs || "");
  if (server) {
    if (
      Number(i.version.split(".")[0]) >= 26 ||
      /^1\.(?:20|21|22)/.test(i.version)
    )
      args.push("--quickPlayMultiplayer", server);
    else {
      const [ip, port] = server.split(":");
      args.push("--server", ip, "--port", port || "25565");
    }
  }
  ctx.update({ phase: "Launching Minecraft", progress: 0, total: 0 });
  const proc = await launch({
    gamePath: dir,
    resourcePath: resources(),
    javaPath: game.java,
    version: game.version,
    gameProfile: { name: account.name, id: account.id },
    accessToken: account.accessToken,
    userType: account.type === "local" ? "legacy" : "mojang",
    launcherName: "Luma",
    launcherBrand: "Luma",
    minMemory: Math.min(1024, i.memory),
    maxMemory: i.memory,
    resolution: { width: i.width, height: i.height },
    extraJVMArgs: splitArgs(i.args),
    extraMCArgs: args,
    yggdrasilAgent: agent,
    extraExecOption: { windowsHide: true },
  });
  running.set(id, proc);
  emit("refresh", null);
  const start = Date.now();
  proc.stdout?.on("data", (b) => log(b.toString()));
  proc.stderr?.on("data", (b) => log(b.toString()));
  proc.on("error", (e) => log(e.message + "\n"));
  proc.once("close", (code) => {
    running.delete(id);
    i.minutes += Math.round((Date.now() - start) / 60000);
    save();
    log(`\n[Luma] Game exited with code ${code}\n`);
    emit("game-exit", { id, code });
    emit("refresh", null);
  });
}

export const minecraftLanguages: Record<string, string> = {
  ru: "ru_ru", en: "en_us", uk: "uk_ua", de: "de_de", fr: "fr_fr",
  es: "es_es", pl: "pl_pl", pt_br: "pt_br", zh_cn: "zh_cn",
};
export function syncMinecraftLanguage(dir: string, language: string) {
  const file = path.join(dir, "options.txt");
  const lang = minecraftLanguages[language] || "en_us";
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  const index = lines.findIndex((line) => line.startsWith("lang:"));
  if (index < 0) lines.push("lang:" + lang);
  else lines[index] = "lang:" + lang;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, lines.filter((line, n) => line || n < lines.length - 1).join("\n") + "\n");
}


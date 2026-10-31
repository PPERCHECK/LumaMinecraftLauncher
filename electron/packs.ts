import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { db, save, root, inside, instance, instanceDir } from "./storage";
import { download, type Context } from "./network";
import { extract } from "./archive";
import { cf } from "./catalog";
import type { Instance, Loader } from "../src/shared";
export function newInstance(input: any): Instance {
  if (!input.name?.trim() || !input.version)
    throw Error("Name and Minecraft version required");
  const i: Instance = {
    id: randomUUID(),
    name: String(input.name).trim().slice(0, 80),
    version: String(input.version),
    loader: input.loader || "vanilla",
    loaderVersion: input.loaderVersion || undefined,
    memory: 4096,
    java: "",
    args: "",
    gameArgs: "",
    width: 1280,
    height: 720,
    cover: "aurora",
    minutes: 0,
    created: new Date().toISOString(),
    mods: [],
    description: "",
  };
  if (!["vanilla", "fabric", "quilt", "forge", "neoforge"].includes(i.loader))
    throw Error("Unknown loader");
  return i;
}
export function createInstance(input: any) {
  const i = newInstance(input);
  fs.mkdirSync(instanceDir(i.id), { recursive: true });
  db().instances.push(i);
  db().activeInstance = i.id;
  save();
  return i;
}
export function backups(id: string) {
  const dir = path.join(root(), "backups", id);
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".zip"))
        .sort()
        .reverse()
    : [];
}
export function backup(id: string, label = "snapshot") {
  const i = instance(id),
    zip = new AdmZip();
  const dir = instanceDir(id);
  if (fs.existsSync(dir)) zip.addLocalFolder(dir, "game");
  zip.addFile("luma-instance.json", Buffer.from(JSON.stringify(i, null, 2)));
  const dest = path.join(
    root(),
    "backups",
    id,
    `${new Date().toISOString().replace(/[:.]/g, "-")}-${label}.zip`,
  );
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  zip.writeZip(dest);
  return dest;
}
export function restore(id: string, file: string) {
  instance(id);
  if (!backups(id).includes(file)) throw Error("Backup not found");
  const source = path.join(root(), "backups", id, file);
  const zip = new AdmZip(source);
  const entry = zip.getEntry("luma-instance.json");
  if (!entry) throw Error("Invalid backup");
  const restored = JSON.parse(entry.getData().toString("utf8")) as Instance;
  if (restored.id !== id) throw Error("Wrong instance backup");
  backup(id, "before-restore");
  const dir = instanceDir(id),
    staging = dir + "-restore-" + randomUUID();
  extract(zip, staging, "game/");
  const old = dir + "-old-" + randomUUID();
  fs.renameSync(dir, old);
  try {
    fs.renameSync(staging, dir);
  } catch (e) {
    fs.renameSync(old, dir);
    throw e;
  }
  fs.rmSync(old, { recursive: true, force: true });
  Object.assign(instance(id), restored);
  save();
}
export async function importPack(file: string, ctx: Context) {
  const zip = new AdmZip(file);
  const mr = zip.getEntry("modrinth.index.json"),
    cfm = zip.getEntry("manifest.json");
  if (!mr && !cfm)
    throw Error("Supported formats: .mrpack and CurseForge manifest ZIP");
  const m = JSON.parse((mr || cfm)!.getData().toString("utf8"));
  let version: string,
    loader: Loader = "vanilla",
    loaderVersion: string | undefined;
  if (mr) {
    if (m.formatVersion !== 1 || m.game !== "minecraft")
      throw Error("Unsupported mrpack format");
    version = m.dependencies.minecraft;
    for (const [key, l] of Object.entries({
      "fabric-loader": "fabric",
      "quilt-loader": "quilt",
      forge: "forge",
      neoforge: "neoforge",
    })) {
      if (m.dependencies[key]) {
        loader = l as Loader;
        loaderVersion = m.dependencies[key];
      }
    }
  } else {
    if (m.manifestType !== "minecraftModpack" || m.manifestVersion !== 1)
      throw Error("Unsupported CurseForge manifest");
    version = m.minecraft.version;
    const l =
      m.minecraft.modLoaders?.find((x: any) => x.primary) ||
      m.minecraft.modLoaders?.[0];
    if (l) {
      const parts = l.id.split("-");
      loader = parts.shift();
      loaderVersion = parts.join("-");
    }
  }
  const i = newInstance({ name: m.name, version, loader, loaderVersion }),
    dir = instanceDir(i.id);
  fs.mkdirSync(dir, { recursive: true });
  try {
    if (mr) {
      for (const f of m.files) {
        ctx.signal.throwIfAborted();
        if (f.env?.client === "unsupported") continue;
        if (!f.hashes?.sha512 || !f.downloads?.length)
          throw Error("Pack file missing SHA-512 or download URL");
        ctx.update({ phase: f.path });
        let last: any;
        for (const url of f.downloads) {
          try {
            await download(url, inside(dir, f.path), ctx, {
              algorithm: "sha512",
              value: f.hashes.sha512,
            });
            last = null;
            break;
          } catch (e) {
            last = e;
          }
        }
        if (last) throw last;
        if (/^(mods|resourcepacks|shaderpacks)\//.test(f.path))
          i.mods.push({
            file: f.path,
            name: path.basename(f.path),
            source: "local",
            kind: f.path.startsWith("mods/")
              ? "mod"
              : f.path.startsWith("shaderpacks/")
                ? "shader"
                : "resourcepack",
            enabled: true,
            url: f.downloads[0],
            hash: f.hashes.sha512,
          });
      }
      extract(zip, dir, "overrides/");
      extract(zip, dir, "client-overrides/");
    } else {
      for (const ref of m.files) {
        ctx.signal.throwIfAborted();
        const project = await cf("/mods/" + ref.projectID);
        if (project.allowModDistribution === false)
          throw Error(
            `Manual download required: ${project.name}. Author distribution restriction.`,
          );
        const f = await cf(`/mods/${ref.projectID}/files/${ref.fileID}`);
        if (!f.downloadUrl)
          throw Error("Manual download required: " + f.fileName);
        const h = f.hashes.find((x: any) => x.algo === 1);
        const folder =
          project.classId === 12
            ? "resourcepacks"
            : project.classId === 6552
              ? "shaderpacks"
              : "mods";
        const rel = folder + "/" + f.fileName;
        await download(
          f.downloadUrl,
          inside(dir, rel),
          ctx,
          h ? { algorithm: "sha1", value: h.value } : undefined,
        );
        i.mods.push({
          file: rel,
          name: project.name,
          source: "curseforge",
          projectId: String(ref.projectID),
          versionId: String(ref.fileID),
          version: f.displayName,
          enabled: ref.required !== false,
          kind:
            folder === "resourcepacks"
              ? "resourcepack"
              : folder === "shaderpacks"
                ? "shader"
                : "mod",
          url: f.downloadUrl,
        });
        if (ref.required === false)
          fs.renameSync(inside(dir, rel), inside(dir, rel + ".disabled"));
      }
      extract(zip, dir, (m.overrides || "overrides").replace(/\/$/, "") + "/");
    }
    ctx.signal.throwIfAborted();
    db().instances.push(i);
    db().activeInstance = i.id;
    save();
    return i;
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}
export function exportPack(
  id: string,
  file: string,
  format: "mrpack" | "curseforge",
) {
  const i = instance(id),
    zip = new AdmZip(),
    dir = instanceDir(id);
  const enabled = i.mods.filter((m) => m.enabled);
  if (format === "mrpack") {
    const unsupported = enabled.filter(
      (m) => !m.url || !m.hash || m.source === "curseforge",
    );
    if (unsupported.length)
      throw Error(
        "mrpack export requires Modrinth files with SHA-512. Excluded/unsupported files: " +
          unsupported.map((m) => m.name).join(", "),
      );
    const deps: Record<string, string> = { minecraft: i.version };
    if (i.loader !== "vanilla") {
      if (!i.loaderVersion) throw Error("Install this loader before exporting");
      deps[
        {
          fabric: "fabric-loader",
          quilt: "quilt-loader",
          forge: "forge",
          neoforge: "neoforge",
        }[i.loader]
      ] = i.loaderVersion;
    }
    zip.addFile(
      "modrinth.index.json",
      Buffer.from(
        JSON.stringify(
          {
            formatVersion: 1,
            game: "minecraft",
            versionId: "1.0.0",
            name: i.name,
            summary: i.description,
            dependencies: deps,
            files: enabled.map((m) => {
              const b = fs.readFileSync(inside(dir, m.file));
              return {
                path: m.file,
                hashes: {
                  sha1: createHash("sha1").update(b).digest("hex"),
                  sha512: createHash("sha512").update(b).digest("hex"),
                },
                fileSize: b.length,
                downloads: [m.url],
                env: { client: "required", server: "optional" },
              };
            }),
          },
          null,
          2,
        ),
      ),
    );
  } else {
    if (enabled.some((m) => m.source !== "curseforge"))
      throw Error(
        "CurseForge export requires only CurseForge-tracked files. Use an instance backup for mixed/local packs.",
      );
    if (i.loader !== "vanilla" && !i.loaderVersion)
      throw Error("Install loader first");
    zip.addFile(
      "manifest.json",
      Buffer.from(
        JSON.stringify(
          {
            minecraft: {
              version: i.version,
              modLoaders:
                i.loader === "vanilla"
                  ? []
                  : [{ id: i.loader + "-" + i.loaderVersion, primary: true }],
            },
            manifestType: "minecraftModpack",
            manifestVersion: 1,
            name: i.name,
            version: "1.0.0",
            author: "Luma user",
            files: enabled.map((m) => ({
              projectID: Number(m.projectId),
              fileID: Number(m.versionId),
              required: true,
            })),
            overrides: "overrides",
          },
          null,
          2,
        ),
      ),
    );
  }
  for (const name of ["config", "options.txt"]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      if (fs.statSync(p).isDirectory())
        zip.addLocalFolder(p, "overrides/" + name);
      else zip.addLocalFile(p, "overrides");
    }
  }
  zip.writeZip(file);
  return file;
}
export function importFolder(folder: string, input: any) {
  const i = newInstance(input),
    dest = instanceDir(i.id);
  fs.cpSync(folder, dest, {
    recursive: true,
    filter: (src) => !fs.lstatSync(src).isSymbolicLink(),
  });
  const mods = path.join(dest, "mods");
  if (fs.existsSync(mods))
    for (const name of fs
      .readdirSync(mods)
      .filter((x) => /\.jar(?:\.disabled)?$/.test(x)))
      i.mods.push({
        file: "mods/" + name.replace(/\.disabled$/, ""),
        name: name.replace(/\.jar(?:\.disabled)?$/, ""),
        source: "local",
        kind: "mod",
        enabled: !name.endsWith(".disabled"),
      });
  db().instances.push(i);
  db().activeInstance = i.id;
  save();
  return i;
}

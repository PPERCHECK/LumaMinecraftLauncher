import fs from "node:fs";
import path from "node:path";
import {
  db,
  instance,
  instanceDir,
  save,
  vault,
  root,
  inside,
} from "./storage";
import { json, download, type Context } from "./network";
import type { Project, ProjectVersion, Mod } from "../src/shared";
const MR = "https://api.modrinth.com/v2";
export async function cf(route: string) {
  const key = vault("curseforge");
  if (!key) throw Error("CurseForge API key required: Settings → Integrations");
  return (
    await json("https://api.curseforge.com/v1" + route, {
      headers: { "x-api-key": key },
    })
  ).data;
}
const loaderIds: Record<string, number> = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6,
};
const classes: Record<string, number> = {
  mod: 6,
  modpack: 4471,
  resourcepack: 12,
  shader: 6552,
};
export async function installPackProject(
  p: Project,
  versionId: string,
  ctx: Context,
) {
  let url: string,
    filename: string,
    hash: { algorithm: string; value: string } | undefined;
  if (p.source === "modrinth") {
    const v = await json(MR + "/version/" + encodeURIComponent(versionId));
    if (v.project_id !== p.id) throw Error("Project/version mismatch");
    const f = v.files.find((x: any) => x.primary) || v.files[0];
    if (!f) throw Error("Pack version has no file");
    url = f.url;
    filename = f.filename;
    hash = { algorithm: "sha512", value: f.hashes.sha512 };
  } else {
    const project = await cf("/mods/" + p.id);
    if (project.allowModDistribution === false)
      throw Error("The author disallows third-party distribution");
    const f = await cf(`/mods/${p.id}/files/${versionId}`);
    if (!f.downloadUrl)
      throw Error("Manual download required from the project page");
    url = f.downloadUrl;
    filename = f.fileName;
    const h = f.hashes.find((x: any) => x.algo === 1);
    hash = h ? { algorithm: "sha1", value: h.value } : undefined;
  }
  const cache = inside(path.join(root(), "cache"), filename);
  await download(url, cache, ctx, hash);
  const { importPack } = await import("./packs");
  await importPack(cache, ctx);
}
function mrProject(x: any): Project {
  return {
    id: x.project_id || x.id,
    source: "modrinth",
    title: x.title,
    description: x.description,
    icon: x.icon_url,
    downloads: x.downloads,
    author: x.author || x.team,
    type: x.project_type,
    url: `https://modrinth.com/${x.project_type}/${x.slug}`,
    body: x.body,
    gallery: x.gallery?.map((g: any) => g.url),
  };
}
function cfProject(x: any, type = "mod"): Project {
  return {
    id: String(x.id),
    source: "curseforge",
    title: x.name,
    description: x.summary,
    icon: x.logo?.thumbnailUrl,
    downloads: x.downloadCount,
    author: x.authors?.map((a: any) => a.name).join(", "),
    type,
    url: x.links.websiteUrl,
    gallery: x.screenshots?.map((g: any) => g.url),
  };
}
export async function search(q: any) {
  const type = classes[q.type] ? q.type : "mod";
  let projects: Project[] = [];
  const errors: string[] = [];
  const sources = q.source === "all" ? ["modrinth", "curseforge"] : [q.source];
  await Promise.all(
    sources.map(async (source) => {
      try {
        if (source === "modrinth") {
          const facets: string[][] = [[`project_type:${type}`]];
          if (q.version) facets.push([`versions:${q.version}`]);
          if (q.loader && q.loader !== "vanilla")
            facets.push([`categories:${q.loader}`]);
          if (q.category) facets.push([`categories:${q.category}`]);
          const p = new URLSearchParams({
            query: String(q.query || ""),
            limit: "24",
            offset: String(q.offset || 0),
            index:
              q.sort === "updated"
                ? "updated"
                : q.sort === "newest"
                  ? "newest"
                  : "downloads",
            facets: JSON.stringify(facets),
          });
          const r = await json(MR + "/search?" + p);
          projects.push(...r.hits.map(mrProject));
        } else if (source === "curseforge") {
          const p = new URLSearchParams({
            gameId: "432",
            classId: String(classes[type]),
            searchFilter: q.query || "",
            pageSize: "24",
            index: String(q.offset || 0),
            sortField:
              q.sort === "updated" ? "3" : q.sort === "newest" ? "11" : "6",
            sortOrder: "desc",
          });
          if (q.version) p.set("gameVersion", q.version);
          if (loaderIds[q.loader])
            p.set("modLoaderType", String(loaderIds[q.loader]));
          if (q.category) p.set("categoryId", q.category);
          projects.push(
            ...(await cf("/mods/search?" + p)).map((x: any) =>
              cfProject(x, type),
            ),
          );
        }
      } catch (e) {
        errors.push(`${source}: ${(e as Error).message}`);
      }
    }),
  );
  if (q.source === "all") projects.sort((a, b) => b.downloads - a.downloads);
  return { projects, errors };
}
export async function categories(source: string) {
  if (source === "curseforge")
    return (await cf("/categories?gameId=432&classesOnly=false")).map(
      (x: any) => ({ id: String(x.id), name: x.name, type: x.classId }),
    );
  return (await json(MR + "/tag/category")).map((x: any) => ({
    id: x.name,
    name: x.name,
    type: x.project_type,
  }));
}
export async function detail(p: Project) {
  if (p.source === "modrinth")
    return mrProject(await json(MR + "/project/" + encodeURIComponent(p.id)));
  const x = cfProject(await cf("/mods/" + encodeURIComponent(p.id)), p.type);
  const html = await cf("/mods/" + encodeURIComponent(p.id) + "/description");
  x.body = String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ");
  return x;
}
export async function projectVersions(
  source: string,
  id: string,
  mc?: string,
  loader?: string,
): Promise<ProjectVersion[]> {
  if (source === "modrinth") {
    const p = new URLSearchParams();
    if (mc) p.set("game_versions", JSON.stringify([mc]));
    if (loader && loader !== "vanilla")
      p.set("loaders", JSON.stringify([loader]));
    return (
      await json(`${MR}/project/${encodeURIComponent(id)}/version?${p}`)
    ).map((v: any) => ({
      id: v.id,
      name: v.name,
      date: v.date_published,
      gameVersions: v.game_versions,
      loaders: v.loaders,
    }));
  }
  const p = new URLSearchParams({ pageSize: "50" });
  if (mc) p.set("gameVersion", mc);
  if (loaderIds[loader || ""])
    p.set("modLoaderType", String(loaderIds[loader!]));
  return (await cf(`/mods/${encodeURIComponent(id)}/files?${p}`)).map(
    (v: any) => ({
      id: String(v.id),
      name: v.displayName,
      date: v.fileDate,
      gameVersions: v.gameVersions,
      loaders: v.gameVersions,
    }),
  );
}
export async function installProject(
  p: Project,
  versionId: string,
  target: string,
  ctx: Context,
  visited = new Map<string, string>(),
) {
  const i = instance(target);
  const key = p.source + ":" + p.id;
  if (visited.has(key)) {
    if (visited.get(key) !== versionId)
      throw Error(
        "Required dependencies select conflicting versions: " + p.title,
      );
    return;
  }
  visited.set(key, versionId);
  ctx.signal.throwIfAborted();
  ctx.update({ phase: p.title, progress: 0, total: 0 });
  let filename: string,
    url: string,
    hash: { algorithm: string; value: string } | undefined,
    version: string,
    kind = p.type;
  if (p.source === "modrinth") {
    const v = await json(MR + "/version/" + encodeURIComponent(versionId));
    if (v.project_id !== p.id) throw Error("Project/version mismatch");
    if (!v.game_versions.includes(i.version))
      throw Error("Incompatible Minecraft version");
    if (kind === "mod" && !v.loaders.includes(i.loader))
      throw Error("Incompatible mod loader: " + i.loader);
    for (const dep of v.dependencies || []) {
      if (
        dep.dependency_type === "incompatible" &&
        i.mods.some(
          (m) =>
            m.enabled &&
            m.source === "modrinth" &&
            (dep.version_id
              ? m.versionId === dep.version_id
              : m.projectId === dep.project_id),
        )
      )
        throw Error(
          "Declared incompatible project is installed: " + dep.project_id,
        );
      if (dep.dependency_type !== "required") continue;
      let depVersion = dep.version_id,
        depProject = dep.project_id;
      if (depVersion && !depProject)
        depProject = (await json(MR + "/version/" + depVersion)).project_id;
      if (!depProject) throw Error("Unresolved required dependency");
      if (!depVersion)
        depVersion = (
          await projectVersions("modrinth", depProject, i.version, i.loader)
        )[0]?.id;
      if (!depVersion)
        throw Error("No compatible required dependency: " + depProject);
      const dp = mrProject(await json(MR + "/project/" + depProject));
      await installProject(dp, depVersion, target, ctx, visited);
    }
    const file = v.files.find((f: any) => f.primary) || v.files[0];
    if (!file) throw Error("Version has no file");
    filename = file.filename;
    url = file.url;
    hash = { algorithm: "sha512", value: file.hashes.sha512 };
    version = v.version_number;
  } else {
    const project = await cf("/mods/" + p.id);
    if (project.allowModDistribution === false)
      throw Error(
        "The author disallows third-party distribution. Download manually from the project page.",
      );
    const f = await cf(`/mods/${p.id}/files/${versionId}`);
    if (!f.gameVersions.includes(i.version))
      throw Error("Incompatible Minecraft version");
    const names: Record<string, string> = {
      fabric: "Fabric",
      forge: "Forge",
      quilt: "Quilt",
      neoforge: "NeoForge",
    };
    if (
      kind === "mod" &&
      (!names[i.loader] || !f.gameVersions.includes(names[i.loader]))
    )
      throw Error("Cannot confirm compatible CurseForge loader");
    for (const dep of f.dependencies || []) {
      if (
        dep.relationType === 5 &&
        i.mods.some(
          (m) =>
            m.enabled &&
            m.source === "curseforge" &&
            m.projectId === String(dep.modId),
        )
      )
        throw Error("Declared incompatible dependency: " + dep.modId);
      if (dep.relationType !== 3) continue;
      const dp = cfProject(await cf("/mods/" + dep.modId));
      const v = (
        await projectVersions(
          "curseforge",
          String(dep.modId),
          i.version,
          i.loader,
        )
      )[0];
      if (!v) throw Error("No compatible required dependency: " + dep.modId);
      await installProject(dp, v.id, target, ctx, visited);
    }
    filename = f.fileName;
    url = f.downloadUrl;
    if (!url)
      throw Error(
        "CurseForge did not provide a download URL. Download manually from the project page.",
      );
    const h = f.hashes?.find((h: any) => h.algo === 1);
    hash = h ? { algorithm: "sha1", value: h.value } : undefined;
    version = f.displayName;
  }
  if (kind === "modpack") {
    const cache = inside(path.join(root(), "cache"), filename);
    await download(url, cache, ctx, hash);
    const { importPack } = await import("./packs");
    await importPack(cache, ctx);
    return;
  }
  const folder =
    kind === "resourcepack"
      ? "resourcepacks"
      : kind === "shader"
        ? "shaderpacks"
        : "mods";
  const rel = folder + "/" + filename;
  const dest = inside(instanceDir(target), rel);
  const old = i.mods.find((m) => m.source === p.source && m.projectId === p.id);
  await download(url, dest, ctx, hash);
  ctx.signal.throwIfAborted();
  if (old && (!old.enabled || old.file !== rel)) {
    const oldPath = inside(
      instanceDir(target),
      old.file + (old.enabled ? "" : ".disabled"),
    );
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  const mod: Mod = {
    file: rel,
    name: p.title,
    source: p.source,
    projectId: p.id,
    versionId,
    version,
    kind,
    enabled: true,
    url,
    hash: hash?.algorithm === "sha512" ? hash.value : undefined,
  };
  i.mods = i.mods.filter(
    (m) => !(m.source === p.source && m.projectId === p.id) && m.file !== rel,
  );
  i.mods.push(mod);
  save();
}
export async function updates(id: string) {
  const i = instance(id);
  const found = [];
  for (const m of i.mods.filter((x) => x.source !== "local" && x.enabled)) {
    const v = (
      await projectVersions(
        m.source,
        m.projectId!,
        i.version,
        m.kind === "mod" ? i.loader : undefined,
      )
    )[0];
    if (v && v.id !== m.versionId) found.push({ mod: m, version: v });
  }
  return found;
}

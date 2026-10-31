import fs from "node:fs";
import path from "node:path";
import type { ResolvedVersion } from "@xmcl/core";
import { root, inside } from "./storage";
import { download, type Context } from "./network";
type File = {
  url: string;
  destination: string;
  sha1?: string;
  size: number;
  name: string;
};
const https = (url: string) => url.replace(/^http:/, "https:");
export async function downloadFiles(
  files: File[],
  ctx: Context,
  phase: string,
) {
  let cursor = 0,
    complete = 0,
    completedBytes = 0,
    last = 0,
    prev = 0,
    prevTime = Date.now(),
    failure: unknown;
  const active = new Map<number, number>(),
    stop = new AbortController(),
    signal = AbortSignal.any([ctx.signal, stop.signal]);
  const total = files.reduce((n, f) => n + Math.max(f.size, 0), 0);
  const update = () => {
    const now = Date.now();
    if (now - last < 200 && complete < files.length) return;
    const progress =
      completedBytes + [...active.values()].reduce((a, b) => a + b, 0);
    ctx.update({
      phase: `${phase} · ${complete}/${files.length}`,
      progress,
      total,
      speed: Math.max(
        0,
        (progress - prev) / Math.max(0.001, (now - prevTime) / 1000),
      ),
    });
    prev = progress;
    prevTime = now;
    last = now;
  };
  await Promise.allSettled(
    Array.from({ length: 6 }, async () => {
      while (cursor < files.length && !signal.aborted) {
        const idx = cursor++,
          f = files[idx];
        try {
          let error: unknown;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              signal.throwIfAborted();
              await download(
                https(f.url),
                f.destination,
                {
                  signal,
                  update: (v) => {
                    active.set(idx, v.progress || 0);
                    update();
                  },
                },
                f.sha1 ? { algorithm: "sha1", value: f.sha1 } : undefined,
              );
              error = null;
              break;
            } catch (e) {
              error = e;
              if (signal.aborted) throw e;
              await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            }
          }
          if (error) throw error;
          active.delete(idx);
          complete++;
          completedBytes += Math.max(f.size, 0);
          update();
        } catch (e) {
          if (!failure) failure = Error(`${f.name}: ${(e as Error).message}`);
          stop.abort();
        }
      }
    }),
  );
  if (failure) throw failure;
  ctx.signal.throwIfAborted();
  ctx.update({
    phase: `${phase} · ${files.length}/${files.length}`,
    progress: total,
    total,
    speed: 0,
  });
}
export async function installBaseFiles(v: ResolvedVersion, ctx: Context) {
  const base = path.join(root(), "minecraft");
  const files: File[] = [];
  for (const l of v.libraries) {
    const d = l.download;
    if (!d.url) throw Error("No download URL for library " + l.name);
    files.push({
      url: d.url,
      destination: inside(path.join(base, "libraries"), l.path),
      sha1: d.sha1 || undefined,
      size: d.size,
      name: l.name,
    });
  }
  const log = v.logging?.client?.file;
  if (log)
    files.push({
      url: log.url,
      destination: inside(path.join(base, "assets", "log_configs"), log.id),
      sha1: log.sha1,
      size: log.size,
      name: log.id,
    });
  await downloadFiles(files, ctx, "Libraries");
  if (!v.assetIndex) return;
  const a = v.assetIndex;
  const indexPath = inside(
    path.join(base, "assets", "indexes"),
    a.id + ".json",
  );
  await download(https(a.url), indexPath, ctx, {
    algorithm: "sha1",
    value: a.sha1,
  });
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const assets: File[] = Object.entries(index.objects).map(
    ([name, obj]: [string, any]) => {
      if (!/^[a-f0-9]{40}$/.test(obj.hash)) throw Error("Invalid asset hash");
      return {
        url: `https://resources.download.minecraft.net/${obj.hash.slice(0, 2)}/${obj.hash}`,
        destination: path.join(
          base,
          "assets",
          "objects",
          obj.hash.slice(0, 2),
          obj.hash,
        ),
        sha1: obj.hash,
        size: obj.size,
        name,
      };
    },
  );
  await downloadFiles(assets, ctx, "Assets");
}

import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { Job } from "../src/shared";
export const UA = "LumaLauncher/0.5.0 (personal desktop Minecraft launcher)";
export async function json(url: string, init: RequestInit = {}) {
  const r = await fetch(url, {
    ...init,
    signal: init.signal || AbortSignal.timeout(45000),
    headers: { "User-Agent": UA, ...init.headers },
  });
  let v: any;
  try {
    v = await r.json();
  } catch {
    throw Error(
      `HTTP ${r.status}: invalid response from ${new URL(url).hostname}`,
    );
  }
  if (!r.ok)
    throw Error(
      `${new URL(url).hostname}: HTTP ${r.status} — ${v.error_description || v.errorMessage || v.message || v.error || "Request failed"}`,
    );
  return v;
}
export const post = (
  url: string,
  data: any,
  headers: Record<string, string> = {},
) =>
  json(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data),
  });
export const form = (url: string, data: Record<string, string>) =>
  json(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(data).toString(),
  });
export type Context = {
  signal: AbortSignal;
  update: (v: Partial<Job>) => void;
};
export async function download(
  url: string,
  dest: string,
  ctx?: Context,
  hash?: { algorithm: string; value: string },
) {
  if (new URL(url).protocol !== "https:")
    throw Error("Only HTTPS downloads are allowed");
  if (hash && fs.existsSync(dest)) {
    const h = createHash(hash.algorithm)
      .update(fs.readFileSync(dest))
      .digest("hex");
    if (h === hash.value.toLowerCase()) return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const temp = dest + "." + randomUUID() + ".part";
  let fd: number | undefined;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ctx
        ? AbortSignal.any([ctx.signal, AbortSignal.timeout(300000)])
        : AbortSignal.timeout(300000),
    });
    if (!r.ok || !r.body)
      throw Error(`Download HTTP ${r.status}: ${new URL(url).hostname}`);
    const total = Number(r.headers.get("content-length") || 0);
    const h = hash ? createHash(hash.algorithm) : null;
    fd = fs.openSync(temp, "w");
    let n = 0,
      last = Date.now(),
      prev = 0;
    for await (const chunk of r.body as any) {
      ctx?.signal.throwIfAborted();
      fs.writeSync(fd, chunk);
      h?.update(chunk);
      n += chunk.length;
      const now = Date.now();
      if (now - last > 200) {
        ctx?.update({
          progress: n,
          total,
          speed: (n - prev) / ((now - last) / 1000),
        });
        prev = n;
        last = now;
      }
    }
    fs.closeSync(fd);
    fd = undefined;
    if (hash && h!.digest("hex") !== hash.value.toLowerCase())
      throw Error("Checksum mismatch: " + path.basename(dest));
    fs.renameSync(temp, dest);
    ctx?.update({ progress: n, total: n, speed: 0 });
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
export class Queue {
  jobs: Job[] = [];
  private controls = new Map<string, AbortController>();
  private tasks = new Map<string, (ctx: Context) => Promise<void>>();
  private active = false;
  constructor(private emit: (event: string, v: any) => void) {}
  add(
    label: string,
    instanceId: string | undefined,
    task: (ctx: Context) => Promise<void>,
  ) {
    const job: Job = {
      id: randomUUID(),
      label,
      instanceId,
      status: "queued",
      progress: 0,
      total: 0,
      speed: 0,
      phase: "",
    };
    this.jobs.unshift(job);
    this.tasks.set(job.id, task);
    this.push();
    void this.pump();
    return job.id;
  }
  push() {
    this.emit("jobs", this.jobs);
  }
  cancel(id: string) {
    const j = this.jobs.find((x) => x.id === id);
    if (!j) return;
    if (j.status === "queued") j.status = "cancelled";
    else this.controls.get(id)?.abort();
    this.push();
  }
  retry(id: string) {
    const j = this.jobs.find((x) => x.id === id);
    if (j && !["running", "queued", "done"].includes(j.status)) {
      j.status = "queued";
      j.error = undefined;
      this.push();
      void this.pump();
    }
  }
  has(id: string) {
    return this.jobs.some(
      (j) => j.instanceId === id && ["running", "queued"].includes(j.status),
    );
  }
  private async pump() {
    if (this.active) return;
    this.active = true;
    try {
      for (;;) {
        const j = this.jobs.findLast((x) => x.status === "queued");
        if (!j) break;
        const ctrl = new AbortController();
        this.controls.set(j.id, ctrl);
        j.status = "running";
        this.push();
        try {
          await this.tasks.get(j.id)!({
            signal: ctrl.signal,
            update: (v) => {
              Object.assign(j, v);
              this.push();
            },
          });
          j.status = "done";
          j.phase = "Completed";
          j.speed = 0;
        } catch (e) {
          j.status = ctrl.signal.aborted ? "cancelled" : "error";
          j.error = (e instanceof Error ? e.message : String(e)).slice(0, 1800);
        } finally {
          this.controls.delete(j.id);
          this.push();
          this.emit("refresh", null);
        }
      }
    } finally {
      this.active = false;
    }
  }
}

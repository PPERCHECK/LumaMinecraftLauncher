import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { State, Settings, Instance } from "../src/shared";
export const root = () => app.getPath("userData");
export const defaults: Settings = {
  language: "ru",
  theme: "dark",
  accent: "#c6abff",
  motion: true,
  scale: 1,
  density: "comfortable",
  sidebar: true,
  startPage: "home",
  blur: 28,
  opacity: 1,
  onboardingDone: false,
  msClientId: "",
  elyClientId: "",
  elyRedirect: "http://localhost:38479/callback",
};
export const billingDefaults = { paymentUrl: "https://boosty.to/v4ytopi228", boostyUrl: "https://boosty.to/v4ytopi228" };
let data: Omit<State, "keys" | "dataPath" | "running">;
export function initStore() {
  fs.mkdirSync(root(), { recursive: true });
  const f = path.join(root(), "state.json");
  data = fs.existsSync(f)
    ? JSON.parse(fs.readFileSync(f, "utf8"))
    : { accounts: [], instances: [], servers: [], friends: [], billing: billingDefaults, settings: defaults };
  data.settings = { ...defaults, ...data.settings };
  data.friends ||= [];
  data.billing = { ...billingDefaults, ...data.billing };
  if (["https://github.com/sponsors/PPERCHECK", "https://boosty.to/luma_launcher"].includes(data.billing.paymentUrl)) data.billing.paymentUrl = billingDefaults.paymentUrl;
  if (!data.billing.boostyUrl || data.billing.boostyUrl === "https://boosty.to/luma_launcher") data.billing.boostyUrl = billingDefaults.boostyUrl;
  save();
}
export function db() {
  return data;
}
export function save() {
  const f = path.join(root(), "state.json");
  fs.writeFileSync(f + ".tmp", JSON.stringify(data, null, 2));
  fs.renameSync(f + ".tmp", f);
}
export function vault(key: string, value?: unknown): any {
  const f = path.join(root(), "vault.bin");
  let entries: Record<string, unknown> = {};
  if (fs.existsSync(f)) {
    if (!safeStorage.isEncryptionAvailable())
      throw Error("System token storage unavailable");
    entries = JSON.parse(safeStorage.decryptString(fs.readFileSync(f)));
  }
  if (value !== undefined) {
    if (
      !safeStorage.isEncryptionAvailable() ||
      (process.platform === "linux" &&
        safeStorage.getSelectedStorageBackend() === "basic_text")
    )
      throw Error("A secure system key store is required");
    if (value === null) delete entries[key];
    else entries[key] = value;
    fs.writeFileSync(f, safeStorage.encryptString(JSON.stringify(entries)));
  }
  return entries[key];
}
export function inside(base: string, relative: string) {
  if (
    !relative ||
    relative.includes("\0") ||
    relative.includes(":") ||
    relative.startsWith("/") ||
    relative.startsWith("\\") ||
    relative.split(/[\\/]/).some((x) => x === "..")
  )
    throw Error("Unsafe archive path");
  const p = path.resolve(base, relative);
  if (!p.startsWith(path.resolve(base) + path.sep))
    throw Error("Path escapes instance");
  return p;
}
export function instanceDir(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Invalid instance ID");
  return path.join(root(), "instances", id);
}
export function instance(id: string): Instance {
  const i = data.instances.find((x) => x.id === id);
  if (!i) throw Error("Instance not found");
  return i;
}
export function offlineUUID(name: string) {
  const b = createHash("md5")
    .update("OfflinePlayer:" + name)
    .digest();
  b[6] = (b[6] & 15) | 48;
  b[8] = (b[8] & 63) | 128;
  return b.toString("hex");
}
export function redact(line: string) {
  for (const a of db().accounts) {
    const t = vault("account:" + a.id);
    for (const v of [t?.accessToken, t?.refreshToken, t?.msAccessToken])
      if (v) line = line.split(v).join("[REDACTED]");
  }
  return line.replace(
    /((?:access_token|accessToken|Authorization)[=: ]+)[^\s,]+/gi,
    "$1[REDACTED]",
  );
}

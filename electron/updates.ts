import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { root } from "./storage";
import { UpdateController } from "./update-controller";
let controller: UpdateController;
export async function initUpdates(
  emit: (e: string, v: any) => void,
  busy: () => boolean,
) {
  const { autoUpdater } = await import("electron-updater");
  let enabled = true;
  const file = path.join(root(), "updates.json");
  if (fs.existsSync(file)) {
    try {
      enabled = JSON.parse(fs.readFileSync(file, "utf8")).enabled !== false;
    } catch {}
  }
  controller = new UpdateController(
    autoUpdater,
    app.getVersion(),
    app.isPackaged,
    enabled,
    (s) => emit("update", s),
    busy,
  );
  if (app.isPackaged) {
    const startup = setTimeout(() => {
      if (controller.state.enabled) void controller.check();
    }, 20000);
    startup.unref();
    const timer = setInterval(
      () => {
        if (controller.state.enabled) void controller.check();
      },
      4 * 60 * 60 * 1000,
    );
    timer.unref();
  }
  return controller;
}
export function updateStatus() {
  return { ...controller.state };
}
export function checkUpdates() {
  return controller.check();
}
export function installUpdate() {
  controller.install();
}
export function setUpdatesEnabled(value: boolean) {
  if (typeof value !== "boolean") throw Error("Boolean required");
  fs.writeFileSync(
    path.join(root(), "updates.json"),
    JSON.stringify({ enabled: value }),
  );
  controller.enable(value);
  return updateStatus();
}

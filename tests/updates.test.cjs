const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { UpdateController } = require("../.test/core.cjs");
class FakeUpdater extends EventEmitter {
  checks = 0;
  installs = 0;
  setFeedURL(v) {
    this.feed = v;
  }
  async checkForUpdates() {
    this.checks++;
    this.emit("checking-for-update");
  }
  quitAndInstall(silent, restart) {
    assert(silent && restart);
    this.installs++;
  }
}
function setup(packaged = true, busy = () => false) {
  const u = new FakeUpdater(),
    events = [];
  const c = new UpdateController(
    u,
    "0.2.0",
    packaged,
    true,
    (s) => events.push(s),
    busy,
  );
  return { u, c, events };
}
test("Updates use the requested GitHub repository and preserve user-controlled restart", () => {
  const { u } = setup();
  assert.equal(u.feed.owner, "PPERCHECK");
  assert.equal(u.feed.repo, "LumaMinecraftLauncher");
  assert.equal(u.autoInstallOnAppQuit, false);
  assert.equal(u.autoDownload, true);
  assert.equal(u.allowDowngrade, false);
});
test("Development mode does not make update requests", async () => {
  const { u, c } = setup(false);
  await c.check();
  assert.equal(u.checks, 0);
  assert.equal(c.state.status, "development");
});
test("Concurrent checks do not duplicate requests", async () => {
  const { u, c } = setup();
  await Promise.all([c.check(), c.check()]);
  assert.equal(u.checks, 1);
});
test("An update downloads, reports progress and becomes ready without restarting", () => {
  const { u, c } = setup();
  u.emit("update-available", { version: "0.3.0" });
  u.emit("download-progress", { percent: 42 });
  assert.equal(c.state.percent, 42);
  u.emit("update-downloaded", { version: "0.3.0" });
  assert.equal(c.state.status, "ready");
  assert.equal(u.installs, 0);
  c.install();
  assert.equal(u.installs, 1);
});
test("A running game or active queue blocks update installation", () => {
  const { u, c } = setup(true, () => true);
  u.emit("update-downloaded", { version: "0.3.0" });
  assert.throws(() => c.install(), /Stop games/);
  assert.equal(u.installs, 0);
});
test("Installation is impossible before verified download completes", () => {
  const { u, c } = setup();
  assert.throws(() => c.install(), /not downloaded/);
  assert.equal(u.installs, 0);
});
test("Missing GitHub release becomes an actionable state without crashing", async () => {
  const { u, c } = setup();
  u.checkForUpdates = async () => {
    throw Error("404 token=secret");
  };
  await c.check();
  assert.equal(c.state.status, "error");
  assert(!c.state.error.includes("secret"));
  u.emit("error", Error("secret"));
  assert(!c.state.error.includes("secret"));
});
test("The automatic-check preference updates state", () => {
  const { c } = setup();
  c.enable(false);
  assert.equal(c.state.enabled, false);
});

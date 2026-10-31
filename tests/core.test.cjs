const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const AdmZip = require("adm-zip");
const {
  inside,
  offlineUUID,
  extract,
  Queue,
  download,
  splitArgs,
  parseAddress,
  varint,
  ping,
  downloadFiles,
  syncMinecraftLanguage,
} = require("../.test/core.cjs");
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), "luma-test-"));
test("Asset downloads recover from a transient connection reset with a verified retry", async () => {
  const dir = temp(),
    destination = path.join(dir, "asset"),
    original = global.fetch;
  let attempts = 0;
  global.fetch = async () => {
    if (++attempts === 1) throw Error("ECONNRESET");
    return new Response("real asset bytes");
  };
  try {
    const bytes = Buffer.from("real asset bytes");
    await downloadFiles(
      [
        {
          url: "https://example.com/asset",
          destination,
          size: bytes.length,
          sha1: crypto.createHash("sha1").update(bytes).digest("hex"),
          name: "asset",
        },
      ],
      { signal: new AbortController().signal, update() {} },
      "Assets",
    );
    assert.equal(attempts, 2);
    assert(fs.readFileSync(destination).equals(bytes));
  } finally {
    global.fetch = original;
  }
});
test("Offline UUID matches Minecraft UUID v3 contract", () => {
  assert.equal(offlineUUID("Steve"), "5627dd98e6be3c21b8a8e92344183641");
  assert.notEqual(offlineUUID("steve"), offlineUUID("Steve"));
});
test("Pack paths cannot escape through Windows or POSIX traversal", () => {
  const root = temp();
  for (const value of [
    "../outside",
    "mods/../../outside",
    "C:/outside",
    "\\outside",
    "/outside",
    "mods\\..\\outside",
    "mod:stream.jar",
    "bad\0name",
  ])
    assert.throws(() => inside(root, value), value);
  assert.equal(
    inside(root, "mods/valid.jar"),
    path.join(root, "mods", "valid.jar"),
  );
});
test("Archive extraction refuses symbolic links", () => {
  const zip = new AdmZip();
  zip.addFile("link", Buffer.from("elsewhere"));
  zip.getEntry("link").header.attr = (0o120777 << 16) >>> 0;
  assert.throws(() => extract(zip, temp()), /symlink/);
});
test("Archive client overrides preserve relative layout", () => {
  const zip = new AdmZip();
  zip.addFile("overrides/config/a.json", Buffer.from('{"value":1}'));
  zip.addFile("client-overrides/config/a.json", Buffer.from('{"value":2}'));
  const dir = temp();
  extract(zip, dir, "overrides/");
  extract(zip, dir, "client-overrides/");
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(dir, "config", "a.json"))).value,
    2,
  );
});
test("Checksum failure preserves an existing file and removes partial downloads", async () => {
  const dir = temp(),
    dest = path.join(dir, "mod.jar");
  fs.writeFileSync(dest, "old-good-file");
  const original = global.fetch;
  global.fetch = async () => new Response("corrupt-content");
  try {
    await assert.rejects(
      download("https://example.com/mod.jar", dest, undefined, {
        algorithm: "sha256",
        value: "0".repeat(64),
      }),
      /Checksum mismatch/,
    );
    assert.equal(fs.readFileSync(dest, "utf8"), "old-good-file");
    assert.deepEqual(fs.readdirSync(dir), ["mod.jar"]);
  } finally {
    global.fetch = original;
  }
});
test("Verified cached download never makes a network request", async () => {
  const dir = temp(),
    dest = path.join(dir, "mod.jar"),
    bytes = Buffer.from("verified-content");
  fs.writeFileSync(dest, bytes);
  const original = global.fetch;
  global.fetch = async () => {
    throw Error("Unexpected network");
  };
  try {
    await download("https://example.com/mod.jar", dest, undefined, {
      algorithm: "sha512",
      value: crypto.createHash("sha512").update(bytes).digest("hex"),
    });
  } finally {
    global.fetch = original;
  }
});
test("Download transport rejects unencrypted sources", async () => {
  await assert.rejects(
    download("http://example.com/mod.jar", path.join(temp(), "a.jar")),
    /HTTPS/,
  );
});
test("Queue is FIFO, serial, and continues after a failed job", async () => {
  const events = [],
    q = new Queue(() => {});
  let active = 0,
    max = 0;
  const ids = [];
  for (let n = 0; n < 3; n++)
    ids.push(
      q.add(String(n), undefined, async () => {
        active++;
        max = Math.max(max, active);
        events.push(n);
        await new Promise((r) => setTimeout(r, 8));
        active--;
        if (n === 1) throw Error("expected failure");
      }),
    );
  while (q.jobs.some((j) => ["queued", "running"].includes(j.status)))
    await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(events, [0, 1, 2]);
  assert.equal(max, 1);
  assert.equal(q.jobs.find((j) => j.id === ids[1]).status, "error");
  assert.equal(q.jobs.find((j) => j.id === ids[2]).status, "done");
});
test("Cancellation prevents a queued task from executing", async () => {
  const q = new Queue(() => {});
  q.add("first", undefined, async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  let ran = false;
  const id = q.add("cancelled", undefined, async () => {
    ran = true;
  });
  q.cancel(id);
  await new Promise((r) => setTimeout(r, 50));
  assert(!ran);
  assert.equal(q.jobs.find((j) => j.id === id).status, "cancelled");
});
test("Arguments preserve quoted paths and do not evaluate shell syntax", () => {
  assert.deepEqual(
    splitArgs("-Dpath=\"C:\\My Folder\" --name 'hello world' $(calc)"),
    ["-Dpath=C:\\My Folder", "--name", "hello world", "$(calc)"],
  );
  assert.throws(() => splitArgs('"broken'), /Unclosed quote/);
});
test("Server address validation supports IPv6 and rejects URLs", () => {
  assert.equal(parseAddress("[::1]:25566").host, "::1");
  assert.equal(parseAddress("play.example.org").port, 25565);
  for (const a of ["https://example.org", "bad host", "host:99999", "x:0"])
    assert.throws(() => parseAddress(a));
});
test("Minecraft status ping handles fragmented packets from a real TCP server", async () => {
  const server = net.createServer((socket) => {
    socket.once("data", () => {
      const body = Buffer.from(
        JSON.stringify({
          version: { name: "Test version" },
          players: { online: 3, max: 20 },
          description: { text: "Hello" },
        }),
      );
      const packet = Buffer.concat([varint(0), varint(body.length), body]);
      const bytes = Buffer.concat([varint(packet.length), packet]);
      socket.write(bytes.subarray(0, 3));
      setTimeout(() => socket.end(bytes.subarray(3)), 5);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const result = await ping("127.0.0.1:" + server.address().port);
    assert(result.online);
    assert.equal(result.players.online, 3);
    assert.equal(result.version, "Test version");
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test("Minecraft language follows the launcher without replacing other options", () => {
  const dir = temp();
  fs.writeFileSync(path.join(dir, "options.txt"), "fov:0.5\nlang:en_us\nmusic:0.2\n");
  syncMinecraftLanguage(dir, "uk");
  const options = fs.readFileSync(path.join(dir, "options.txt"), "utf8");
  assert.match(options, /lang:uk_ua/);
  assert.match(options, /fov:0.5/);
  assert.equal((options.match(/^lang:/gm) || []).length, 1);
});

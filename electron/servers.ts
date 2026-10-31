import net from "node:net";
import dns from "node:dns/promises";
import dgram from "node:dgram";
export function varint(n: number) {
  const b = [];
  do {
    let v = n & 127;
    n >>>= 7;
    if (n) v |= 128;
    b.push(v);
  } while (n);
  return Buffer.from(b);
}
function readVar(b: Buffer, start = 0) {
  let v = 0,
    n = 0;
  while (start + n < b.length && n < 5) {
    const c = b[start + n];
    v |= (c & 127) << (7 * n++);
    if (!(c & 128)) return { v, n };
  }
  return null;
}
export function parseAddress(address: string) {
  if (
    typeof address !== "string" ||
    address.length > 260 ||
    /[/\s\x00]/.test(address)
  )
    throw Error("Invalid server address");
  const match = address.match(/^(\[[\da-f:]+\]|[a-z\d_.-]+)(?::(\d{1,5}))?$/i);
  if (!match) throw Error("Use hostname:port or [IPv6]:port");
  const port = Number(match[2] || 25565);
  if (port < 1 || port > 65535) throw Error("Invalid server port");
  return { host: match[1].replace(/^\[|\]$/g, ""), port, explicit: !!match[2] };
}
export async function ping(address: string) {
  const a = parseAddress(address);
  let host = a.host,
    port = a.port;
  if (!a.explicit && !net.isIP(host)) {
    try {
      const [srv] = await dns.resolveSrv("_minecraft._tcp." + host);
      if (srv) {
        host = srv.name;
        port = srv.port;
      }
    } catch {}
  }
  return new Promise<any>((resolve) => {
    const socket = net.connect({ host, port });
    const start = Date.now();
    let buf = Buffer.alloc(0),
      done = false;
    const finish = (result: any) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(5000, () => finish({ online: false }));
    socket.on("error", () => finish({ online: false }));
    socket.on("connect", () => {
      const name = Buffer.from(a.host),
        p = Buffer.alloc(2);
      p.writeUInt16BE(a.port);
      const handshake = Buffer.concat([
        varint(0),
        varint(767),
        varint(name.length),
        name,
        p,
        varint(1),
      ]);
      socket.write(
        Buffer.concat([
          varint(handshake.length),
          handshake,
          Buffer.from([1, 0]),
        ]),
      );
    });
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length > 2 * 1024 * 1024) return finish({ online: false });
      const size = readVar(buf);
      if (!size || buf.length < size.n + size.v) return;
      const packet = readVar(buf, size.n);
      if (!packet || packet.v !== 0) return finish({ online: false });
      const str = readVar(buf, size.n + packet.n);
      if (!str) return;
      try {
        const r = JSON.parse(
          buf
            .subarray(
              size.n + packet.n + str.n,
              size.n + packet.n + str.n + str.v,
            )
            .toString("utf8"),
        );
        finish({
          online: true,
          latency: Date.now() - start,
          players: r.players,
          version: r.version?.name,
          description:
            typeof r.description === "string"
              ? r.description
              : r.description?.text || "",
        });
      } catch {
        finish({ online: false });
      }
    });
    socket.on("close", () => finish({ online: false }));
  });
}

export function parseLanAnnouncement(text: string, host: string) {
  const motd = text.match(/\[MOTD\]([\s\S]*?)\[\/MOTD\]/)?.[1]?.trim();
  const port = Number(text.match(/\[AD\](\d{1,5})\[\/AD\]/)?.[1]);
  if (!motd || port < 1 || port > 65535 || !net.isIP(host)) return null;
  return { name: motd, address: `${host}:${port}` };
}

export function discoverLan(timeout = 1600) {
  return new Promise<any[]>((resolve) => {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    const found = new Map<string, any>();
    const finish = () => {
      try { socket.close(); } catch {}
      resolve([...found.values()]);
    };
    socket.on("message", (message, remote) => {
      const game = parseLanAnnouncement(message.toString("utf8"), remote.address);
      if (game) found.set(game.address, game);
    });
    socket.on("error", finish);
    socket.bind(4445, () => {
      try { socket.addMembership("224.0.2.60"); } catch { return finish(); }
      setTimeout(finish, timeout);
    });
  });
}

import fs from "node:fs";
import zlib from "node:zlib";
fs.mkdirSync("build", { recursive: true });
const n = 256,
  scan = Buffer.alloc((n * 4 + 1) * n);
const star = (x, y) => {
  const a = Math.atan2(y, x),
    r = Math.hypot(x, y);
  const angle =
    ((((a + Math.PI / 4) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2)) -
    Math.PI / 4;
  const boundary = 25 / (Math.cos(angle) + 2.6 * Math.abs(Math.sin(angle)));
  return r < boundary * 3.3;
};
for (let y = 0; y < n; y++)
  for (let x = 0; x < n; x++) {
    let rgba = [0, 0, 0, 0];
    for (let sy = 0; sy < 3; sy++)
      for (let sx = 0; sx < 3; sx++) {
        const px = x + sx / 3 - 0.5,
          py = y + sy / 3 - 0.5;
        const dx = Math.max(Math.abs(px - 127.5) - 80, 0),
          dy = Math.max(Math.abs(py - 127.5) - 80, 0);
        let c = [0, 0, 0, 0];
        if (dx * dx + dy * dy < 45 * 45) {
          c = [21, 18, 30, 255];
          const fx = px - 127.5,
            fy = py - 127.5;
          if (star(fx, fy)) c = [198, 171, 255, 255];
          if (star(fx * 2.6, fy * 2.6)) c = [21, 18, 30, 255];
        }
        rgba = rgba.map((v, i) => v + c[i] / 9);
      }
    const off = y * (n * 4 + 1) + 1 + x * 4;
    rgba.forEach((v, i) => (scan[off + i] = Math.round(v)));
  }
const crc = (b) => {
  let c = 0xffffffff;
  for (const v of b) {
    c ^= v;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(name, data) {
  const type = Buffer.from(name),
    out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length);
  type.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc(Buffer.concat([type, data])), 8 + data.length);
  return out;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(n, 0);
header.writeUInt32BE(n, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk("IDAT", zlib.deflateSync(scan)),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync("build/icon.png", png);
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
fs.writeFileSync("build/icon.ico", Buffer.concat([ico, png]));
fs.writeFileSync(
  "build/logo.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="#c6abff" d="M20 2 25.5 14.5 38 20 25.5 25.5 20 38 14.5 25.5 2 20 14.5 14.5Z"/><path fill="#15121f" d="m20 12 2.5 5.5L28 20l-5.5 2.5L20 28l-2.5-5.5L12 20l5.5-2.5Z"/></svg>',
);

import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { inside } from "./storage";
export function extract(zip: AdmZip, dest: string, prefix = "") {
  let total = 0;
  for (const e of zip.getEntries()) {
    if (prefix && !e.entryName.startsWith(prefix)) continue;
    const rel = e.entryName.slice(prefix.length);
    if (!rel || e.isDirectory) continue;
    if (((e.header.attr >>> 16) & 0o170000) === 0o120000)
      throw Error("Archive symlinks are not supported");
    total += e.header.size;
    if (total > 8 * 1024 ** 3 || e.header.size > 2 * 1024 ** 3)
      throw Error("Archive exceeds extraction limit");
    const p = inside(dest, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, e.getData());
  }
}

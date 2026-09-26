import { getAllFighters } from "../dist/features/mma/data.js";
import { getFighterPhotoInfo, getFighterPhotoUrl } from "../dist/features/mma/art.js";
import sharp from "sharp";

const OVERRIDE =
  "https://s3.vybebot.ai/images/projects/eEHRNaDzVNXv/assets/5d9745b1feac53a4d12013dae946f5b7cf78df2f7227814f10e1977df06bbc32.png";

function host(u) {
  try {
    return new URL(u).host;
  } catch {
    return "?";
  }
}

async function validImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "image/*", "User-Agent": "MMA audit" } });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return { ok: false, reason: "too small" };
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return { ok: false, reason: "not an image" };
    return { ok: true, w: meta.width, h: meta.height, ct: res.headers.get("content-type") };
  } catch (e) {
    return { ok: false, reason: e?.message || "fetch fail" };
  }
}

const fighters = getAllFighters();
console.log(`Total fighters: ${fighters.length}`);
console.log("");

const missing = [];
const broken = [];
const ok = [];
const overridden = [];

for (const f of fighters) {
  const name = f.name;
  let info;
  try {
    info = await getFighterPhotoInfo(name);
  } catch (e) {
    missing.push({ name, reason: `lookup threw: ${e?.message}` });
    continue;
  }

  if (info.found && info.photoUrl) {
    if (info.photoUrl === OVERRIDE) {
      overridden.push({ name, host: "override(alex perez)" });
      continue;
    }
    const v = await validImage(info.photoUrl);
    if (!v.ok) {
      broken.push({ name, url: info.photoUrl, reason: v.reason });
    } else {
      ok.push({ name, host: host(info.photoUrl), useCutout: !!info.useCutout });
    }
  } else {
    missing.push({ name, reason: "no photo found" });
  }
}

const fmt = (rows) => (rows.length ? rows.map((r) => `  ${r.name}${r.reason ? ` — ${r.reason}` : ""}`).join("\n") : "  (none)");

console.log(`=== MISSING / NO PHOTO (${missing.length}) ===`);
console.log(fmt(missing));
console.log("");
console.log(`=== BROKEN PHOTO URL (${broken.length}) ===`);
console.log(fmt(broken));
console.log("");
console.log(`=== OVERRIDE (${overridden.length}) ===`);
console.log(fmt(overridden));
console.log("");
console.log(`=== OK (${ok.length}) by source ===`);
const byHost = {};
for (const r of ok) byHost[r.host] = (byHost[r.host] || 0) + 1;
console.log(byHost);

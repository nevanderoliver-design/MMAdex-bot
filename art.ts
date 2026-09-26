import sharp from "sharp";
import { readFileSync } from "node:fs";
import { loadConfig } from "../../config.js";
import { createJsonStore } from "../../utils/storage.js";
import { logger } from "../../utils/logger.js";
import { rarityDef, getDivisionRank } from "./data.js";
import type { FighterCard } from "./types.js";

// ── Config / paths ─────────────────────────────────────────────────────────────
const config = loadConfig();

const FONT_FAMILY = "'Bebas Neue', Impact, 'Arial Narrow', 'DejaVu Sans', sans-serif";
const FONT_URL =
  "https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf";

const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const FLAG_BASE = "https://flagcdn.com/w80";

// ── Cached stores ─────────────────────────────────────────────────────────────
interface FighterPhotoInfo {
  photoUrl?: string;
  useCutout?: boolean;
  nationality?: string;
  checkedAt: number;
  found: boolean;
  /** Cache schema version — bumping it re-resolves older, possibly poisoned entries. */
  v?: number;
}

/**
 * Bumping this invalidates every cached entry on read. It exists because an older
 * version could persist a "found" entry with no usable image URL, which then
 * suppressed the Wikipedia fallback and left the fighter permanently photo-less.
 */
const PHOTO_CACHE_VERSION = 3;

/** How long a genuine "no photo" result is trusted before it is re-checked. */
const NEGATIVE_CACHE_MS = 6 * 60 * 60 * 1000;

const photoCache = createJsonStore<Record<string, FighterPhotoInfo>>(
  config,
  "mma-photos.json",
  {},
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Manual photo overrides ───────────────────────────────────────────────────
/**
 * Hand-picked fighter photos that bypass the automatic lookup. The auto-resolver
 * can return a same-named athlete from another sport (e.g. a football player);
 * these overrides pin a verified image so the correct photo always wins.
 * Keyed by lower-cased `searchableName`.
 *
 * Alex Perez (UFC flyweight): Wikipedia's "Alex Perez (fighter)" article has no
 * photo, and the only same-named image on Wikipedia/Commons is the basketball
 * player Alex Pérez — so his verified transparent cutout is pinned here.
 * Max Holloway: the requested post-fight arena photo (Hawaii flag) is pinned so
 * the spawn poster always uses this exact image instead of an auto-resolved one.
 * Justin Gaethje: the requested octagon portrait is pinned the same way.
 */
const PHOTO_OVERRIDES: Record<string, string> = {
  "alex perez":
    "https://s3.vybebot.ai/images/projects/eEHRNaDzVNXv/assets/5d9745b1feac53a4d12013dae946f5b7cf78df2f7227814f10e1977df06bbc32.png",
  "max holloway":
    "https://s3.vybebot.ai/images/projects/eEHRNaDzVNXv/assets/0f1e65d78412009a1e2eff8a054f20c176ccc4af1d86306f06258fb6e5e3f665.jpg",
  "justin gaethje":
    "https://s3.vybebot.ai/images/projects/eEHRNaDzVNXv/assets/fb10f3244163df4bdc8742c3d4eea8c34d2e6e3bbb33581c38b96177f8f323a1.jpg",
};

/** Return a forced photo for a fighter name, or null so the auto-resolver runs. */
function photoOverride(name: string): FighterPhotoInfo | null {
  const url = PHOTO_OVERRIDES[searchableName(name).toLowerCase()];
  if (!url) return null;
  return {
    photoUrl: url,
    useCutout: true,
    found: true,
    checkedAt: Date.now(),
    v: PHOTO_CACHE_VERSION,
  };
}

// ── Name normalization / hashing ──────────────────────────────────────────────

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Normalize a fighter name for API search (bare name, ASCII, lowercase). */
export function searchableName(name: string): string {
  return stripDiacritics(name)
    .replace(/"[^"]*"/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function slugFor(value: string): string {
  return `${hashString(searchableName(value))}`;
}

// ── Country flag support ──────────────────────────────────────────────────────

const COUNTRY_CODES: Record<string, string> = {
  "united states": "us",
  usa: "us",
  america: "us",
  brazil: "br",
  russia: "ru",
  "united kingdom": "gb",
  england: "gb",
  britain: "gb",
  ireland: "ie",
  "northern ireland": "gb",
  scotland: "gb",
  wales: "gb",
  canada: "ca",
  france: "fr",
  germany: "de",
  poland: "pl",
  sweden: "se",
  norway: "no",
  denmark: "dk",
  finland: "fi",
  italy: "it",
  spain: "es",
  portugal: "pt",
  netherlands: "nl",
  belgium: "be",
  switzerland: "ch",
  austria: "at",
  croatia: "hr",
  serbia: "rs",
  ukraine: "ua",
  georgia: "ge",
  armenia: "am",
  azerbaijan: "az",
  kazakhstan: "kz",
  uzbekistan: "uz",
  tajikistan: "tj",
  kyrgyzstan: "kg",
  turkey: "tr",
  "czech republic": "cz",
  czechia: "cz",
  slovakia: "sk",
  hungary: "hu",
  romania: "ro",
  bulgaria: "bg",
  greece: "gr",
  mexico: "mx",
  argentina: "ar",
  colombia: "co",
  peru: "pe",
  chile: "cl",
  venezuela: "ve",
  ecuador: "ec",
  uruguay: "uy",
  panama: "pa",
  cuba: "cu",
  dominican: "do",
  jamaica: "jm",
  nigeria: "ng",
  ghana: "gh",
  cameroon: "cm",
  senegal: "sn",
  morocco: "ma",
  algeria: "dz",
  tunisia: "tn",
  egypt: "eg",
  "south africa": "za",
  kenya: "ke",
  ethiopia: "et",
  india: "in",
  pakistan: "pk",
  bangladesh: "bd",
  china: "cn",
  japan: "jp",
  "south korea": "kr",
  "north korea": "kp",
  thailand: "th",
  vietnam: "vn",
  philippines: "ph",
  indonesia: "id",
  malaysia: "my",
  singapore: "sg",
  australia: "au",
  "new zealand": "nz",
  tonga: "to",
  samoa: "ws",
  fiji: "fj",
  iran: "ir",
  israel: "il",
  lebanon: "lb",
  palestine: "ps",
  jordan: "jo",
  syria: "sy",
  afghanistan: "af",
  taiwan: "tw",
  hongkong: "hk",
};

function countryCode(nationality: string | undefined): string | undefined {
  if (!nationality) return undefined;
  const key = nationality.trim().toLowerCase();
  return (
    COUNTRY_CODES[key] ??
    COUNTRY_CODES[key.split(",")[0]!.trim()] ??
    COUNTRY_CODES[stripDiacritics(key)]
  );
}

const flagCache = new Map<string, string | null>();

/** Download and cache a small flag PNG for a country code, return a local file path or null. */
async function ensureFlag(code: string | undefined): Promise<string | null> {
  if (!code) return null;
  if (flagCache.has(code)) return flagCache.get(code) ?? null;

  const { existsSync } = await import("node:fs");
  const path = await import("node:path");
  const file = path.join(config.storage.dir, "mma-flags", `${code}.png`);

  try {
    if (!existsSync(file)) {
      const { mkdirSync } = await import("node:fs");
      mkdirSync(path.dirname(file), { recursive: true });
      const res = await fetch(`${FLAG_BASE}/${encodeURIComponent(code)}.png`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`flag ${code}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const { writeFileSync } = await import("node:fs");
      writeFileSync(file, buf);
    }
    flagCache.set(code, file);
    return file;
  } catch (err) {
    logger.warn("Flag download failed, omitting flag.", { code, error: err });
    flagCache.set(code, null);
    return null;
  }
}

// ── Font support ──────────────────────────────────────────────────────────────

let fontPath: string | null | undefined; // undefined = not checked yet

/** Ensure the Bebas Neue font file is available locally; returns path or null. */
async function ensureFont(): Promise<string | null> {
  if (fontPath !== undefined) return fontPath;

  const { existsSync, writeFileSync } = await import("node:fs");
  const path = await import("node:path");
  const file = path.join(config.storage.dir, "mma-fonts", "BebasNeue-Regular.ttf");

  try {
    if (!existsSync(file)) {
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(path.dirname(file), { recursive: true });
      const res = await fetch(FONT_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`font ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, buf);
    }
    fontPath = file;
  } catch (err) {
    logger.warn("Bebas Neue font download failed — using fallback fonts.", { error: err });
    fontPath = null;
  }
  return fontPath;
}

function fontFaceSvg(): string {
  const path = fontPath;
  if (!path) return "";
  try {
    const buf = readFileSync(path);
    return `<style>@font-face{font-family:'Bebas Neue';src:url(data:font/ttf;base64,${buf.toString("base64")}) format('truetype');}</style>`;
  } catch {
    return "";
  }
}

// ── Fighter photo service (TheSportsDB) ───────────────────────────────────────

interface SportsDbPlayer {
  strPlayer?: string;
  strCutout?: string;
  strThumb?: string;
  strNationality?: string;
  strSport?: string;
}

/**
 * Whether a TheSportsDB record is a combat athlete safe to use as an MMA photo.
 *
 * TheSportsDB labels MMA fighters "Mixed Martial Arts", so a bare substring check
 * for "mma" misses them. Conversely, a player with no sport tag used to be trusted
 * by default, which let a same-named football/basketball/soccer player become a
 * fighter's photo. We now require a positive combat-sport signal and reject
 * anything else — including records with a missing sport — so the query falls
 * through to the Wikipedia fallback instead of shipping a wrong photo.
 */
function looksLikeMma(info: SportsDbPlayer): boolean {
  const s = (info.strSport ?? "").toLowerCase().trim();
  if (!s) return false;
  return (
    s.includes("mixed martial arts") ||
    s.includes("martial art") ||
    s.includes("mma") ||
    s.includes("ufc") ||
    s.includes("fight") ||
    s.includes("combat") ||
    s.includes("boxing") ||
    s.includes("kickbox") ||
    s.includes("wrestling") ||
    s.includes("judo") ||
    s.includes("jiu-jitsu") ||
    s.includes("karate") ||
    s.includes("taekwondo")
  );
}

const WIKI_API = "https://en.wikipedia.org/w/api.php";
/** Wikimedia asks for a descriptive User-Agent; generic ones get throttled. */
const WIKI_USER_AGENT = "VybeBot-MMA-Card-Game/1.0 (+https://vybebot.ai)";

interface WikiResult {
  photoUrl?: string;
  found: boolean;
  /** True when the lookup hit a transient failure (429/5xx/network) and must be retried later. */
  errored: boolean;
}

function wikiUrl(params: Record<string, string>): string {
  const url = new URL(WIKI_API);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * Query the Wikipedia Action API. Rate-limited (429) and server (5xx) responses
 * and network faults are retried once and then thrown, so callers can tell a
 * genuine "no such page" (null) apart from a transient failure that must NOT be
 * cached as "not found".
 */
async function wikiJson<T>(
  params: Record<string, string>,
  timeoutMs = 8000,
): Promise<T | null> {
  const url = wikiUrl(params);
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json", "User-Agent": WIKI_USER_AGENT },
      });
    } catch (err) {
      if (attempt === 0) {
        await sleep(400);
        continue;
      }
      throw err;
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt === 0) {
        await sleep(res.status === 429 ? 1200 : 500);
        continue;
      }
      throw new Error(`wikipedia ${res.status}`);
    }
    if (!res.ok) return null; // 404/403 etc. — definitively absent.
    return (await res.json()) as T;
  }
  return null;
}

interface WikiPageImage {
  query?: {
    pages?: Array<{
      title?: string;
      missing?: boolean;
      thumbnail?: { source?: string };
      original?: { source?: string };
    }>;
  };
}

/**
 * Lead infobox image for a Wikipedia title, following redirects. Prefers the
 * bounded `thumbnail` over `original` so the base64 we inline into the SVG stays
 * small (multi-megabyte originals slow the render down and can fail outright).
 */
async function wikiLeadImage(title: string, size = 800): Promise<string | null> {
  const data = await wikiJson<WikiPageImage>({
    action: "query",
    prop: "pageimages",
    piprop: "thumbnail|original",
    pithumbsize: String(size),
    titles: title,
    redirects: "1",
  });
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.thumbnail?.source ?? page.original?.source ?? null;
}

/**
 * Fallback photo lookup via the Wikipedia Action API (infobox lead image).
 * The `rest_v1/page/summary` endpoint used previously is aggressively rate
 * limited and answers 429 under normal bot traffic, which silently looked like
 * "fighter has no photo".
 */
async function fetchWikipediaPhoto(name: string): Promise<WikiResult> {
  const result: WikiResult = { found: false, errored: false };
  const bare = searchableName(name).replace(/ /g, "_");

  // Strategy 1: exact article title (safe — an exact title is guaranteed to be
  // the same person, so there is no risk of a wrong photo).
  for (const title of [bare, `${bare}_(fighter)`, `${bare}_mma`]) {
    try {
      const img = await wikiLeadImage(title);
      if (img) {
        result.photoUrl = img;
        result.found = true;
        return result;
      }
    } catch (err) {
      result.errored = true;
      logger.warn("Wikipedia title lookup failed.", { name, title, error: err });
    }
  }

  // Strategy 2: search for the article, then fetch the best candidate's image.
  // Covers the nicknames ("Shogun Rua") and diacritics ("José Aldo") the exact
  // step misses, while title scoring keeps the photo relevant to the fighter.
  try {
    const wanted = searchableName(name).toLowerCase();
    const queries = [
      `${wanted} mixed martial artist`,
      `${wanted} ufc fighter`,
      wanted,
    ];
    const candidates: Array<{ title: string; score: number; fighter: boolean }> = [];
    const seen = new Set<string>();

    const isFighterTitle = (t: string): boolean =>
      /\(fighter\)|mixed martial artist|\(mma|mma fighter|ufc fighter|combat athlete|judoka|kickboxer|boxer/i.test(
        t,
      );

    for (const q of queries) {
      const data = await wikiJson<{ query?: { search?: Array<{ title?: string }> } }>({
        action: "query",
        list: "search",
        srsearch: q,
        srnamespace: "0",
        srlimit: "10",
      });
      for (const r of data?.query?.search ?? []) {
        const raw = r.title ?? "";
        if (!raw || seen.has(raw)) continue;
        seen.add(raw);
        const t = searchableName(raw).toLowerCase();
        let s = 0;
        if (t === wanted) s = 10;
        else if (t.includes(wanted) || wanted.includes(t)) s = 5;
        else if (t.split(" ").some((w) => wanted.split(" ").includes(w))) s = 2;
        if (s >= 5) candidates.push({ title: raw, score: s, fighter: isFighterTitle(raw) });
      }
    }

    // Prefer fighter-specific articles ("Diego Lopes (fighter)") over a bare
    // disambiguation page ("Diego Lopes") that has no photo, then the closest
    // name match. Only the most promising few are tried so a single render never
    // fires a long request chain.
    candidates.sort(
      (a, b) => Number(b.fighter) - Number(a.fighter) || b.score - a.score,
    );
    for (const c of candidates.slice(0, 6)) {
      try {
        const img = await wikiLeadImage(c.title);
        if (img) {
          result.photoUrl = img;
          result.found = true;
          return result;
        }
      } catch (err) {
        result.errored = true;
        logger.warn("Wikipedia candidate image lookup failed.", {
          name,
          title: c.title,
          error: err,
        });
      }
    }
  } catch (err) {
    result.errored = true;
    logger.warn("Wikipedia search lookup failed.", { name, error: err });
  }

  return result;
}

/** Query photo sources once per fighter (cached to disk) and store photo/nationality. */
export async function getFighterPhotoInfo(
  name: string,
): Promise<FighterPhotoInfo> {
  const key = searchableName(name);

  // A manual override always wins: return it before reading the cache so a
  // previously cached (possibly wrong) result can never shadow the chosen photo.
  const forced = photoOverride(key);
  if (forced) return forced;

  const cache = await photoCache.read();
  const cached = cache[key];
  // Only trust entries written by the current schema; older entries may carry a
  // "found" flag with no usable URL and would keep blocking the fallbacks.
  if (
    cached &&
    cached.v === PHOTO_CACHE_VERSION &&
    (cached.found || Date.now() - cached.checkedAt < NEGATIVE_CACHE_MS)
  ) {
    return cached;
  }

  const info: FighterPhotoInfo = {
    found: false,
    checkedAt: Date.now(),
    v: PHOTO_CACHE_VERSION,
  };

  // A lookup that throws (network/API hiccup) must not be persisted as a long-lived
  // "not found". Otherwise one transient failure leaves the fighter photo-less for
  // the whole negative-cache window. We only remember a reliable conclusion.
  let lookupErrored = false;

  try {
    const res = await fetch(
      `${SPORTSDB_BASE}/searchplayers.php?p=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } },
    );
    // TheSportsDB's free key is shared and heavily throttled, so 429/5xx here is
    // transient and must not be remembered as "not found".
    if (res.status === 429 || res.status >= 500) {
      throw new Error(`thesportsdb ${res.status}`);
    }
    if (res.ok) {
      const data = (await res.json()) as { player?: SportsDbPlayer[] };
      const players = (data.player ?? []).filter(looksLikeMma);
      const wanted = key.toLowerCase();
      const score = (p: SportsDbPlayer): number => {
        const pn = searchableName(p.strPlayer ?? "").toLowerCase();
        let s = 0;
        if (pn === wanted) s += 10;
        else if (pn.includes(wanted) || wanted.includes(pn)) s += 5;
        else if (pn.split(" ").some((w) => wanted.split(" ").includes(w))) s += 2;
        if (p.strCutout) s += 1;
        if (p.strThumb) s += 1;
        return s;
      };
      const best = players.sort((a, b) => score(b) - score(a))[0];
      const url = best ? best.strCutout || best.strThumb : undefined;
      // Only accept the hit when it actually yields an image. Previously a name
      // match with no photo still set `found`, which suppressed the Wikipedia
      // fallback and cached a permanently photo-less fighter.
      if (best && url) {
        info.photoUrl = url;
        info.useCutout = Boolean(best.strCutout);
        info.nationality = best.strNationality;
        info.found = true;
      }
    }
  } catch (err) {
    lookupErrored = true;
    logger.warn("Fighter photo lookup failed.", { name, error: err });
  }

  // Fall back to Wikipedia when the sports API had no usable photo.
  if (!info.found) {
    try {
      const wiki = await fetchWikipediaPhoto(name);
      if (wiki.found && wiki.photoUrl) {
        info.photoUrl = wiki.photoUrl;
        info.useCutout = false;
        info.found = true;
      } else if (wiki.errored) {
        lookupErrored = true;
      }
    } catch (err) {
      lookupErrored = true;
      logger.warn("Wikipedia photo fallback failed.", { name, error: err });
    }
  }

  // Persist only a reliable outcome: a found photo (cached indefinitely) or a
  // genuine "not found" (cached for the re-validation window). A network failure
  // is transient — leave it uncached so the next spawn retries and picks the photo up.
  if (info.found || !lookupErrored) {
    await photoCache.update((d) => {
      d[key] = info;
      return d;
    });
  }
  return info;
}

/** Public convenience: photo URL for thumbnails, or null. */
export async function getFighterPhotoUrl(name: string): Promise<string | null> {
  const info = await getFighterPhotoInfo(name);
  return info.found && info.photoUrl ? info.photoUrl : null;
}

/** Drop a cached photo result so the next render re-resolves it from scratch. */
async function invalidatePhoto(name: string): Promise<void> {
  const key = searchableName(name);
  try {
    await photoCache.update((d) => {
      delete d[key];
      return d;
    });
  } catch (err) {
    logger.warn("Could not invalidate cached fighter photo.", { name, error: err });
  }
}

interface ResolvedPhoto {
  localPhoto: string | null;
  flag: string | undefined;
  nationality: string | undefined;
}

/**
 * Full photo pipeline for a render: resolve the source, download and validate the
 * local copy, then preload the flag. A stored URL that no longer produces a usable
 * image is dropped so the next spawn falls through to another source instead of
 * rendering a photo-less card forever.
 */
async function resolvePhotoForRender(name: string): Promise<ResolvedPhoto> {
  const info = await getFighterPhotoInfo(name);

  let localPhoto: string | null = null;
  if (info.found && info.photoUrl) {
    localPhoto = await ensurePhotoLocal(name, info.photoUrl);
    if (!localPhoto) await invalidatePhoto(name);
  }

  const flag = info.nationality ? countryCode(info.nationality) : undefined;
  await preloadFlags([flag]);
  return { localPhoto, flag, nationality: info.nationality };
}

/**
 * Download the fighter photo locally and normalize it to PNG so sharp can embed
 * it. Cached files are validated (and re-downloaded when corrupt), and any
 * response that is not a decodable image is rejected instead of being written to
 * disk as a "photo" that silently draws nothing on the card.
 */
async function ensurePhotoLocal(
  name: string,
  photoUrl: string,
): Promise<string | null> {
  const { existsSync, mkdirSync, writeFileSync } = await import("node:fs");
  const path = await import("node:path");
  // Cache keyed by both the fighter slug and the source URL: if a photo source
  // changes (e.g. a manual override), the existing file for the old URL is not
  // reused, so the new photo is downloaded instead of serving a stale one.
  const file = path.join(
    config.storage.dir,
    "mma-images",
    `${slugFor(name)}-${hashString(photoUrl)}.png`,
  );

  try {
    if (existsSync(file)) {
      try {
        await sharp(file).metadata();
        return file;
      } catch {
        // Corrupt/partial file from an earlier run — fall through and re-download.
      }
    }

    mkdirSync(path.dirname(file), { recursive: true });
    const res = await fetch(photoUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "image/*", "User-Agent": WIKI_USER_AGENT },
    });
    if (!res.ok) throw new Error(`photo ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) throw new Error("photo too small");

    // Decode + downscale + re-encode as PNG: this proves the bytes are a real
    // image and keeps the base64 inlined into the SVG small and fast to render.
    const png = await sharp(buf)
      .resize({ width: 760, height: 760, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    writeFileSync(file, png);
    return file;
  } catch (err) {
    logger.warn("Fighter photo download failed — placeholder will be used.", { name, error: err });
    return null;
  }
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Bebas Neue (the card font) approximate average glyph width as a fraction of
 * font size. Caps are condensed, but using a slightly conservative factor keeps
 * long names from overflowing the card edge.
 */
const GLYPH_WIDTH_FACTOR = 0.48;

/** Estimated rendered width in px for a string in Bebas Neue. */
function textWidthPx(value: string, fontSize: number): number {
  return value.length * fontSize * GLYPH_WIDTH_FACTOR;
}

/**
 * Truncate a name to fit a maximum width: shrink the visible characters until
 * the estimated rendered width (plus the ellipsis) fits, then add an ellipsis.
 */
function truncateToFit(value: string, fontSize: number, maxWidthPx: number): string {
  if (textWidthPx(value, fontSize) <= maxWidthPx) return value;
  let out = value;
  while (out.length > 1 && textWidthPx(`${out}…`, fontSize) > maxWidthPx) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/**
 * Read a local image file and return it as a `data:` URI for SVG <image> tags.
 * sharp cannot resolve external `file://` references inside SVG, so images must
 * be inlined. Sniffs the format so JPEG/WebP sources still render correctly.
 */
function dataUriForFile(localPath: string | null | undefined): string | null {
  if (!localPath) return null;
  try {
    const buf = readFileSync(localPath);
    if (buf.length < 8) return null;
    let mime = "image/png";
    if (buf[0] === 0xff && buf[1] === 0xd8) mime = "image/jpeg";
    else if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      mime = "image/webp";
    } else if (buf[0] === 0x89 && buf[1] === 0x50) {
      mime = "image/png";
    } else if (buf[0] === 0x47 && buf[1] === 0x49) {
      mime = "image/gif";
    }
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

interface RarityVisual {
  color: string;
  glow: string;
  text: string;
}

function rarityVisual(id: FighterCard["rarity"]): RarityVisual {
  const def = rarityDef(id);
  const hex = def.color.toString(16).padStart(6, "0");
  return {
    color: `#${hex}`,
    glow: `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, 0.35)`,
    text: def.label,
  };
}

/** True when a PNG buffer carries an alpha channel (i.e. a cutout image). */
function pngHasAlpha(buf: Buffer): boolean {
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf.length < 25) return false;
  const colorType = buf[24];
  return colorType === 4 || colorType === 6;
}

/** SVG node for a player cutout/photo with optional glow. Images are inlined as
 *  base64 data URIs because sharp cannot resolve external `file://` refs.
 *  Transparent cutouts render whole ("meet"); full photos are cover-cropped
 *  ("slice") so the fighter fills the frame and background is trimmed away. */
function fighterImageNode(
  localPath: string | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  placeholderLabel: string,
): string {
  const uri = dataUriForFile(localPath);
  if (uri) {
    let mode = "xMidYMid slice";
    if (localPath) {
      try {
        if (pngHasAlpha(readFileSync(localPath))) mode = "xMidYMid meet";
      } catch {
        /* keep slice */
      }
    }
    return `<image href="${uri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${mode}"/>`;
  }
  // Clean fallback placeholder: dark rounded panel with a fighter glyph
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="url(#phBg)"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>`,
    `<text x="${x + w / 2}" y="${y + h / 2 + 10}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${Math.round(h / 4)}" fill="rgba(255,255,255,0.35)">${escapeXml(placeholderLabel)}</text>`,
  ].join("");
}

function flagNode(code: string | undefined, size: number): string {
  const path = flagLocalPath(code);
  if (!path) return "";
  const uri = dataUriForFile(path);
  if (!uri) return "";
  return `<image href="${uri}" x="0" y="${-size / 2}" width="${size}" height="${size * 0.75}" preserveAspectRatio="xMidYMid meet"/>`;
}

function flagLocalPath(code: string | undefined): string | null {
  if (!code) return null;
  // Pre-loaded lazily; returns the cached local path when available.
  return flagCache.get(code) ?? null;
}

/** Kick off flag preloads so <image> tags have local files at render time. */
async function preloadFlags(codes: (string | undefined)[]): Promise<void> {
  await Promise.all(
    codes.filter(Boolean).map(async (code) => {
      await ensureFlag(code);
    }),
  );
}

// ── Shared card chrome ────────────────────────────────────────────────────────

function cardShadow(defs: string[], w: number, h: number, corner: number): string {
  defs.push(`
    <filter id="cardShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="rgba(0,0,0,0.65)"/>
    </filter>`);
  return `<rect x="0" y="0" width="${w}" height="${h}" rx="${corner}" fill="#0b0b12" filter="url(#cardShadow)"/>`;
}

// ── Spawn poster (name hidden / revealed) ─────────────────────────────────────

export interface SpawnRenderOptions {
  revealed?: boolean;
}

/**
 * Render the cinematic spawn poster as a PNG buffer.
 * When revealed=false the fighter's name never appears; when revealed=true the
 * name is displayed across the card (used after a claim or expiry).
 */
export async function renderSpawnPoster(
  card: FighterCard,
  opts: SpawnRenderOptions = {},
): Promise<Buffer> {
  const { revealed = false } = opts;
  // 1:1 square canvas with the fighter photo filling the frame.
  const W = 720;
  const H = 720;

  await ensureFont();
  const font = fontFaceSvg();

  let localPhoto: string | null = null;
  try {
    ({ localPhoto } = await resolvePhotoForRender(card.name));
  } catch (err) {
    logger.warn("Spawn poster photo/flag prep failed — rendering placeholders.", {
      name: card.name,
      error: err,
    });
  }

  const rv = rarityVisual(card.rarity);
  const rank = getDivisionRank(card);
  const isChampion = rank === 1;

  const nameUpper = card.name.toUpperCase();
  // Auto-scale the revealed name so it never overflows the square canvas width.
  // Capped well below the old 96px so short MMA names stay proportionate to the
  // 720px poster instead of dominating it.
  const nameBudget = W - 60;
  const bigNameSize = Math.min(
    64,
    Math.max(42, Math.floor(nameBudget / (Math.max(1, nameUpper.length) * 0.62))),
  );

  // The fighter photo fills the entire square canvas.
  const PHOTO_W = W;
  const PHOTO_X = 0;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${font}
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#0a0a12"/>
    <stop offset="55%" stop-color="#12121f"/>
    <stop offset="100%" stop-color="#1b1226"/>
  </linearGradient>
  <radialGradient id="arenaGlow" cx="50%" cy="46%" r="62%">
    <stop offset="0%" stop-color="${rv.glow ?? "#3a3a5c"}" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="${rv.glow ?? "#3a3a5c"}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="revealBar" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgba(8,8,14,0)"/>
    <stop offset="100%" stop-color="rgba(8,8,14,0.94)"/>
  </linearGradient>
  <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="26" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.9)"/>
  </filter>
  <clipPath id="posterClip"><rect x="0" y="0" width="${W}" height="${H}" rx="22"/></clipPath>
</defs>

<g clip-path="url(#posterClip)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- centered arena glow behind the fighter -->
  <rect width="${W}" height="${H}" fill="url(#arenaGlow)"/>

  ${rv.glow ? `<ellipse cx="${W / 2}" cy="${H / 2 + 30}" rx="${PHOTO_W / 2 + 60}" ry="${Math.round(H / 2)}" fill="${rv.glow}" filter="url(#softGlow)" opacity="0.5"/>` : ""}

  <!-- fighter photo, centered and full-height -->
  <g transform="translate(${PHOTO_X}, 0)">
    ${fighterImageNode(localPhoto, 0, 0, PHOTO_W, H, rv.text)}
  </g>

  ${revealed ? `
  <g filter="url(#textShadow)">
    <rect x="0" y="${H - 270}" width="${W}" height="270" fill="url(#revealBar)"/>
    <text x="${W / 2}" y="${H - 150}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${bigNameSize}" font-weight="bold" fill="#ffffff">${escapeXml(truncateToFit(nameUpper, bigNameSize, nameBudget))}</text>
    <text x="${W / 2}" y="${H - 92}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="36" fill="${rv.color}">${escapeXml(card.nickname ? `"${card.nickname}"` : rv.text)}</text>
    <text x="${W / 2}" y="${H - 44}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="26" fill="rgba(255,255,255,0.75)">${escapeXml(card.division)}${isChampion ? " · 👑" : ""}</text>
  </g>` : ""}

  <!-- subtle attribution, kept out of the way at the bottom -->
  <text x="${W / 2}" y="${H - 20}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="18" letter-spacing="3" fill="rgba(255,255,255,0.28)">BUILT WITH VYBE-BOT.AI · MMA CARD GAME</text>
</g>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Vertical premium fight-night card for a single fighter.
 * Includes photo, name, weight class, flag and rarity treatment.
 */
export async function renderFighterCard(card: FighterCard): Promise<Buffer> {
  const W = 600;
  const H = 820;

  await ensureFont();
  const font = fontFaceSvg();

  // Photo/flag prep is best-effort: a lookup or cache write failure must never
  // abort the card render, so fall back to placeholder artwork.
  let localPhoto: string | null = null;
  let flag: string | undefined;
  let nationality: string | undefined;
  try {
    ({ localPhoto, flag, nationality } = await resolvePhotoForRender(card.name));
  } catch (err) {
    logger.warn("Fighter card photo/flag prep failed — rendering placeholders.", {
      name: card.name,
      error: err,
    });
  }

  const rv = rarityVisual(card.rarity);
  const rank = getDivisionRank(card);
  const champion = rank === 1;

  // Auto-scale the big name so it always fits within the card width.
  const nameUpper = card.name.toUpperCase();
  const nameSize = Math.min(64, Math.max(30, Math.floor(540 / (Math.max(1, nameUpper.length) * 0.72))));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${font}
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#0c0c14"/>
    <stop offset="100%" stop-color="#16121f"/>
  </linearGradient>
  <linearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#1d1d31"/>
    <stop offset="100%" stop-color="#0d0d17"/>
  </linearGradient>
  <linearGradient id="phBg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#24243a"/>
    <stop offset="100%" stop-color="#0e0e18"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#f1c40f"/>
    <stop offset="50%" stop-color="#fdf3a5"/>
    <stop offset="100%" stop-color="#f1c40f"/>
  </linearGradient>
  <radialGradient id="powerBg">
    <stop offset="0%" stop-color="${rv.color}"/>
    <stop offset="100%" stop-color="${rv.glow}"/>
  </radialGradient>
  <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="18" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="rgba(0,0,0,0.85)"/>
  </filter>
  <filter id="cardShadow" x="-10%" y="-10%" width="130%" height="130%">
    <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="rgba(0,0,0,0.7)"/>
  </filter>
  <clipPath id="cardClip"><rect x="0" y="0" width="${W}" height="${H}" rx="22"/></clipPath>
  <clipPath id="heroClip"><rect x="0" y="0" width="${W}" height="430" rx="22"/></clipPath>
</defs>

<g clip-path="url(#cardClip)">
  <rect width="${W}" height="${H}" fill="url(#bg)" filter="url(#cardShadow)"/>

  <!-- hero photo zone -->
  <g clip-path="url(#heroClip)">
    <rect width="${W}" height="430" fill="url(#heroBg)"/>
    ${rv.glow ? `<ellipse cx="${W / 2}" cy="330" rx="250" ry="220" fill="${rv.glow}" filter="url(#softGlow)"/>` : ""}
    <g transform="translate(90, 40)">
      ${fighterImageNode(localPhoto, 0, 0, 420, 420, rv.text)}
    </g>
    <!-- readability overlay -->
    <rect x="0" y="300" width="${W}" height="130" fill="url(#bg)" opacity="0.35"/>
  </g>

  <!-- rarity chip -->
  <g>
    <rect x="28" y="24" rx="12" width="150" height="34" fill="${rv.color}"/>
    <text x="103" y="47" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="22" fill="#0b0b12">${rv.text.toUpperCase()}</text>
  </g>

  <!-- power badge -->
  <g filter="url(#textShadow)">
    <circle cx="${W - 74}" cy="298" r="52" fill="url(#powerBg)" opacity="0.95"/>
    <circle cx="${W - 74}" cy="298" r="46" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
    <text x="${W - 74}" y="318" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="42" font-weight="bold" fill="#ffffff">${card.power}</text>
    <text x="${W - 74}" y="336" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="14" letter-spacing="2" fill="rgba(255,255,255,0.7)">POWER</text>
  </g>

  <!-- name block -->
  <g filter="url(#textShadow)">
    <text x="28" y="505" font-family="${FONT_FAMILY}" font-size="${nameSize}" font-weight="bold" fill="#ffffff">${escapeXml(truncateToFit(nameUpper, nameSize, 540))}</text>
    ${card.nickname ? `<text x="28" y="548" font-family="${FONT_FAMILY}" font-size="28" fill="${rv.color}">"${escapeXml(card.nickname)}"</text>` : ""}
  </g>

  <!-- info panel -->
  <g>
    <rect x="28" y="580" rx="14" width="${W - 56}" height="150" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
    ${flag
      ? `<g transform="translate(52, 612)">${flagNode(flag, 60)}</g>
         <text x="128" y="602" font-family="${FONT_FAMILY}" font-size="24" fill="rgba(255,255,255,0.85)">${escapeXml(nationality ?? "International")}</text>`
      : `<text x="52" y="612" font-family="${FONT_FAMILY}" font-size="24" fill="rgba(255,255,255,0.85)">International Fighter</text>`}
    <text x="52" y="658" font-family="${FONT_FAMILY}" font-size="30" letter-spacing="1" fill="#ffffff">${escapeXml(card.division.toUpperCase())}</text>
    <text x="${W - 52}" y="652" text-anchor="end" font-family="${FONT_FAMILY}" font-size="22" fill="${rv.color}">${champion ? "👑 CHAMPION" : ""}</text>
  </g>

  <!-- footer -->
  <text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="16" letter-spacing="2" fill="rgba(255,255,255,0.35)">BUILT WITH VYBE-BOT.AI · MMA CARD GAME</text>
</g>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── Trade VS poster (two fighters) ────────────────────────────────────────────

/**
 * Cinematic matchup poster for trade proposals: both fighters on opposite sides,
 * striking VS badge in the centre, championship treatment when both are Mythic.
 */
export async function renderTradePoster(
  offerCard: FighterCard,
  wantCard: FighterCard,
): Promise<Buffer> {
  const W = 1000;
  const H = 560;

  await ensureFont();
  const font = fontFaceSvg();

  let offerPhoto: string | null = null;
  let wantPhoto: string | null = null;
  let offerFlag: string | undefined;
  let wantFlag: string | undefined;
  try {
    const [offer, want] = await Promise.all([
      resolvePhotoForRender(offerCard.name),
      resolvePhotoForRender(wantCard.name),
    ]);
    offerPhoto = offer.localPhoto;
    wantPhoto = want.localPhoto;
    offerFlag = offer.flag;
    wantFlag = want.flag;
  } catch (err) {
    logger.warn("Trade poster photo/flag prep failed — rendering placeholders.", {
      offer: offerCard.name,
      want: wantCard.name,
      error: err,
    });
  }

  const offerRarity = rarityDef(offerCard.rarity);
  const wantRarity = rarityDef(wantCard.rarity);
  const championship = offerCard.rarity === "mythic" && wantCard.rarity === "mythic";
  const offerRank = getDivisionRank(offerCard);
  const wantRank = getDivisionRank(wantCard);
  const offerChamp = offerRank === 1;
  const wantChamp = wantRank === 1;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${font}
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0a0a12"/>
    <stop offset="50%" stop-color="#12121f"/>
    <stop offset="100%" stop-color="#1b1226"/>
  </linearGradient>
  <linearGradient id="redGlow" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="rgba(255,46,46,0.30)"/>
    <stop offset="100%" stop-color="rgba(255,46,46,0.05)"/>
  </linearGradient>
  <linearGradient id="phBg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#24243a"/>
    <stop offset="100%" stop-color="#0e0e18"/>
  </linearGradient>
  <linearGradient id="vsBg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#ff2e2e"/>
    <stop offset="100%" stop-color="#b31212"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#f1c40f"/>
    <stop offset="50%" stop-color="#fdf3a5"/>
    <stop offset="100%" stop-color="#f1c40f"/>
  </linearGradient>
  <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="24" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="rgba(0,0,0,0.9)"/>
  </filter>
  <filter id="cardShadow" x="-10%" y="-10%" width="130%" height="130%">
    <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="rgba(0,0,0,0.7)"/>
  </filter>
  <clipPath id="posterClip"><rect x="0" y="0" width="${W}" height="${H}" rx="18"/></clipPath>
</defs>

<g clip-path="url(#posterClip)">
  <rect width="${W}" height="${H}" fill="url(#bg)" filter="url(#cardShadow)"/>

  <polygon points="0,560 340,0 520,0 180,560" fill="rgba(255,255,255,0.02)"/>
  <polygon points="660,0 800,0 460,560 320,560" fill="rgba(255,255,255,0.02)"/>

  <!-- champion belt banner -->
  ${championship ? `
  <g>
    <rect x="250" y="18" rx="14" width="500" height="46" fill="url(#gold)" filter="url(#textShadow)"/>
    <text x="500" y="50" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="28" letter-spacing="4" fill="#3a2c00">🏆 CHAMPIONSHIP TRADE 🏆</text>
  </g>` : `
  <g>
    <rect x="330" y="18" rx="14" width="340" height="40" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)"/>
    <text x="500" y="46" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="24" letter-spacing="4" fill="rgba(255,255,255,0.85)">TRADE OFFER</text>
  </g>`}

  <!-- left fighter -->
  <g>
    <ellipse cx="170" cy="270" rx="150" ry="210" fill="rgba(255,60,60,0.14)" filter="url(#softGlow)"/>
    <g transform="translate(-10, 70)">
      ${fighterImageNode(offerPhoto, 0, 0, 380, 420, offerRarity.label)}
    </g>
    <g filter="url(#textShadow)">
      <text x="180" y="438" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="44" fill="#ffffff">${escapeXml(truncate(offerCard.name.toUpperCase(), 20))}</text>
      <text x="180" y="470" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="20" fill="${"#" + offerRarity.color.toString(16).padStart(6, "0")}">${offerRarity.label.toUpperCase()}${offerChamp ? " 👑" : ""}</text>
      <text x="180" y="500" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="18" fill="rgba(255,255,255,0.6)">${escapeXml(offerCard.division)}</text>
      ${offerFlag ? `<g transform="translate(120, 502)">${flagNode(offerFlag, 34)}</g>` : ""}
    </g>
  </g>

  <!-- right fighter -->
  <g>
    <ellipse cx="830" cy="270" rx="150" ry="210" fill="rgba(60,90,255,0.14)" filter="url(#softGlow)"/>
    <g transform="translate(630, 70)">
      ${fighterImageNode(wantPhoto, 0, 0, 380, 420, wantRarity.label)}
    </g>
    <g filter="url(#textShadow)">
      <text x="820" y="438" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="44" fill="#ffffff">${escapeXml(truncate(wantCard.name.toUpperCase(), 20))}</text>
      <text x="820" y="470" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="20" fill="${"#" + wantRarity.color.toString(16).padStart(6, "0")}">${wantRarity.label.toUpperCase()}${wantChamp ? " 👑" : ""}</text>
      <text x="820" y="500" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="18" fill="rgba(255,255,255,0.6)">${escapeXml(wantCard.division)}</text>
      ${wantFlag ? `<g transform="translate(760, 502)">${flagNode(wantFlag, 34)}</g>` : ""}
    </g>
  </g>

  <!-- VS badge -->
  <g filter="url(#textShadow)">
    <circle cx="500" cy="265" r="62" fill="url(#vsBg)"/>
    <circle cx="500" cy="265" r="54" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2.5"/>
    <text x="500" y="290" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="52" font-weight="bold" fill="#ffffff">VS</text>
  </g>

  <!-- footer -->
  <text x="500" y="${H - 24}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="15" letter-spacing="2" fill="rgba(255,255,255,0.35)">BUILT WITH VYBE-BOT.AI · MMA CARD GAME</text>
</g>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export type { FighterPhotoInfo };
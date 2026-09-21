// ─── JW WOL Meeting Workbook: weekly Bible reading + program fetch/parse ─────
//
// Fetches the JW Watchtower ONLINE LIBRARY (WOL) meeting workbook pages and
// extracts the weekly Bible reading and the full weekly meeting program in
// English and Spanish. Parsing is
// regex-based (no runtime dependencies) and isolated here so it is
// unit-testable. Uses a relative import (not the `@/` alias) so this module
// can be compiled standalone with tsc for verification.

import { getIsoWeekMonday } from "../types/presiding";

export type Lang = "en" | "es";

export interface IndexEntry {
  docid: string;
  startDay: number; // 1-31
  startMonth: number; // 0-based, matching Date.getMonth()
}

export interface WorkbookResult {
  weekId: string;
  bibleReadingEn: string;
  bibleReadingEs: string;
  programEn: WorkbookPart[];
  programEs: WorkbookPart[];
}

/** One timed part of the weekly meeting program (opening/concluding have group null). */
export interface WorkbookPart {
  group: "treasures" | "fieldMinistry" | "living" | null;
  title: string;
  minutes: number;
}

export interface ParsedProgram {
  opening: WorkbookPart | null;
  groups: { group: "treasures" | "fieldMinistry" | "living"; parts: WorkbookPart[] }[];
  concluding: WorkbookPart | null;
}

export type WorkbookError =
  | { code: "INVALID_WEEK" }
  | { code: "WEEK_NOT_FOUND" }
  | { code: "FETCH_ERROR"; message: string };

const EN_MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const ES_MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const EN_SLUGS = ["january", "march", "may", "july", "september", "november"];
const ES_SLUGS = ["enero", "marzo", "mayo", "julio", "septiembre", "noviembre"];

/** Workbook month-index slug for a 0-based month index, or throws if out of range. */
export function monthSlugForMonth(monthIndex: number, lang: Lang): string {
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error(`monthSlugForMonth: monthIndex out of range: ${monthIndex}`);
  }
  const pair = Math.floor(monthIndex / 2);
  return lang === "es" ? ES_SLUGS[pair] : EN_SLUGS[pair];
}

/** Absolute WOL library URL for a workbook month index page. */
export function buildIndexUrl(year: number, slug: string, lang: Lang): string {
  const guide = encodeURIComponent("guía-de-actividades");
  if (lang === "es") {
    return `https://wol.jw.org/es/wol/library/r4/lp-s/biblioteca/${guide}/${guide}-${year}/${slug}`;
  }
  return `https://wol.jw.org/en/wol/library/r1/lp-e/all-publications/meeting-workbooks/life-and-ministry-meeting-workbook-${year}/${slug}`;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Parse `(docid, startDay, startMonth)` pairs from a month index page. */
export function parseMonthIndex(html: string, lang: Lang): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const cardRe = /href="\/[a-z]{2}\/wol\/d\/r\d+\/lp-[a-z0-9-]+\/(\d+)"[\s\S]*?cardLine1[\s\S]*?<span class="sectionIcon"><\/span>([\s\S]*?)<\/div>/g;
  let card: RegExpExecArray | null;
  while ((card = cardRe.exec(html)) !== null) {
    const docid = card[1];
    const label = collapseWhitespace(decodeEntities(card[2].replace(/<[^>]*>/g, " ")));
    const parsed = lang === "es" ? parseEsLabel(label) : parseEnLabel(label);
    if (parsed) entries.push({ docid, ...parsed });
  }
  return entries;
}

function parseEnLabel(label: string): Pick<IndexEntry, "startDay" | "startMonth"> | null {
  const m = new RegExp(`\\b(${EN_MONTHS.join("|")})\\s+(\\d{1,2})\\b`, "i").exec(label);
  if (!m) return null;
  const startMonth = EN_MONTHS.indexOf(m[1].toLowerCase());
  if (startMonth < 0) return null;
  return { startDay: Number(m[2]), startMonth };
}

function parseEsLabel(label: string): Pick<IndexEntry, "startDay" | "startMonth"> | null {
  const m = /(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i.exec(label);
  if (!m) return null;
  const startMonth = ES_MONTHS.indexOf(m[2].toLowerCase());
  if (startMonth < 0) return null;
  return { startDay: Number(m[1]), startMonth };
}

/**
 * Extract the reading from a weekly page: the first `<h2>` containing a
 * `class="b"` link. All `<strong>` contents inside that heading are joined
 * with a single space (ES readings can be split across multiple `<strong>`s).
 */
export function parseReading(html: string): string {
  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/g;
  let h2: RegExpExecArray | null;
  while ((h2 = h2Re.exec(html)) !== null) {
    const block = h2[1];
    if (!/class="b"/.test(block)) continue;
    const strongs: string[] = [];
    const strongRe = /<strong>(.*?)<\/strong>/g;
    let strong: RegExpExecArray | null;
    while ((strong = strongRe.exec(block)) !== null) {
      strongs.push(collapseWhitespace(decodeEntities(strong[1])));
    }
    const reading = collapseWhitespace(strongs.join(" "));
    if (reading) return reading;
  }
  return "";
}

/** Strip a leading part number like "1. " / "10) " from a part title. */
function stripPartNumber(title: string): string {
  return title.replace(/^(\d+)[.)\s]+/, "").trim();
}

/** Extract "(N min.)" / "(N mins.)" from an HTML block's plain text. */
function parseMinutesFromHtml(html: string): number | null {
  const text = collapseWhitespace(decodeEntities(html.replace(/<[^>]*>/g, " ")));
  const m = /\((\d+)\s+mins?\.\)/i.exec(text);
  return m ? Number(m[1]) : null;
}

/** Plain-text of an h2/h3 block, used for keyword matching and titles. */
function headingText(html: string): string {
  return collapseWhitespace(decodeEntities(html.replace(/<[^>]*>/g, " ")));
}

/** Concatenated `<strong>` text of a heading block (part titles live in strongs). */
function headingStrongText(html: string): string {
  const strongs: string[] = [];
  const strongRe = /<strong>([\s\S]*?)<\/strong>/g;
  let strong: RegExpExecArray | null;
  while ((strong = strongRe.exec(html)) !== null) {
    strongs.push(collapseWhitespace(decodeEntities(strong[1].replace(/<[^>]*>/g, " "))));
  }
  return collapseWhitespace(strongs.join(" "));
}

/**
 * Parse the full weekly meeting program from a workbook weekly page (EN or
 * ES). Walks `<h2>`/`<h3>` headings in document order: group `<h2>` banners
 * are matched by keyword, timed parts are the `<h3>`s with a "(N min[s].)"
 * duration (inline or in the following `<p>`). Song-only headers and untimed
 * headings are skipped. Never throws; returns a best-effort structure.
 */
export function parseProgram(html: string, lang: Lang): ParsedProgram {
  const empty: ParsedProgram = { opening: null, groups: [], concluding: null };
  try {
    const openingRe = lang === "es" ? /palabras de introducci/i : /opening comments/i;
    const concludingRe = lang === "es" ? /^palabras de conclusi/i : /^concluding comments/i;
    const songRe = lang === "es" ? /^canci[oó]n\s+\d+/i : /^song\s+\d+/i;
    const groupKeywords: {
      group: "treasures" | "fieldMinistry" | "living";
      re: RegExp;
    }[] = [
      { group: "treasures", re: lang === "es" ? /TESOROS DE LA BIBLIA/i : /TREASURES FROM GOD/i },
      { group: "fieldMinistry", re: lang === "es" ? /SEAMOS MEJORES/i : /APPLY YOURSELF/i },
      { group: "living", re: lang === "es" ? /NUESTRA VIDA CRISTIANA/i : /LIVING AS CHRISTIANS/i },
    ];

    const program: ParsedProgram = { opening: null, groups: [], concluding: null };
    let current: ParsedProgram["groups"][number] | null = null;

    // Walk h2/h3 headings in document order; for each h3, look for a duration
    // inline, else in the text up to the next heading (covers the following
    // `<p>(10 min.)</p>` block).
    const headingRe = /<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/g;
    const matches: { tag: "h2" | "h3"; block: string; start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(html)) !== null) {
      matches.push({ tag: m[1] as "h2" | "h3", block: m[2], start: m.index, end: m.index + m[0].length });
    }

    for (let i = 0; i < matches.length; i++) {
      const { tag, block, start, end } = matches[i];
      const plain = headingText(block);
      if (!plain) continue;

      if (tag === "h2") {
        const hit = groupKeywords.find((g) => g.re.test(plain));
        if (hit) {
          current = { group: hit.group, parts: [] };
          program.groups.push(current);
        }
        continue;
      }

      // h3 part candidate.
      const songOnly = songRe.test(plain) && !/\((\d+)\s+mins?\.\)/i.test(plain);
      if (songOnly) continue;

      // Duration: inline in the h3, else in the following inter-heading text.
      let minutes = parseMinutesFromHtml(block);
      if (minutes === null) {
        const nextStart = i + 1 < matches.length ? matches[i + 1].start : html.length;
        const between = html.slice(end, nextStart);
        minutes = parseMinutesFromHtml(between);
      }
      if (minutes === null) continue;

      const title = stripPartNumber(headingStrongText(block) || plain);
      if (!title) continue;

      const part: WorkbookPart = { group: null, title, minutes };
      if (openingRe.test(plain)) {
        if (!program.opening) {
          // "Song N and Prayer | Opening Comments" → keep from the keyword on.
          const kw = title.search(openingRe);
          program.opening = { group: null, title: kw >= 0 ? title.slice(kw).trim() : title, minutes };
        }
        continue;
      }
      if (concludingRe.test(plain)) {
        if (!program.concluding) {
          // "Concluding Comments | Song N" → drop the trailing song segment.
          const clean = title.split("|")[0].trim() || title;
          program.concluding = { group: null, title: clean, minutes };
        }
        continue;
      }
      if (current) {
        current.parts.push({ ...part, group: current.group });
      }
      // Parts before the first group h2 (other than opening) are ignored.
    }

    return program;
  } catch {
    return empty;
  }
}

/** Flatten a ParsedProgram into an ordered part list (opening, groups, concluding). */
function flattenProgram(program: ParsedProgram): WorkbookPart[] {
  const parts: WorkbookPart[] = [];
  if (program.opening) parts.push(program.opening);
  for (const g of program.groups) parts.push(...g.parts);
  if (program.concluding) parts.push(program.concluding);
  return parts;
}

const USER_AGENT = "Mozilla/5.0 (compatible; ServiceFlow/1.0)";

/** Fetch a URL as text, throwing on non-200 responses. */
export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return await res.text();
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { result: WorkbookResult; expiresAt: number }>();

/** Resolve a weekId to the EN/ES Bible reading + program, caching for 24h. */
export async function getWorkbookReading(weekId: string): Promise<WorkbookResult | WorkbookError> {
  if (!/^\d{4}-W\d{2}$/.test(weekId)) return { code: "INVALID_WEEK" };

  const cached = cache.get(weekId);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const monday = getIsoWeekMonday(weekId);
  if (!monday) return { code: "INVALID_WEEK" };

  // Resolve workbook year + month-index slug from the week's Monday (handles
  // month boundaries like W36 2026 = Monday Aug 31 -> July workbook, and year
  // boundaries like 2027-W01 = Monday Dec 28 2026 -> 2026 workbook).
  const year = monday.getFullYear();
  const month = monday.getMonth();
  const enSlug = monthSlugForMonth(month, "en");

  try {
    const enIndexHtml = await fetchText(buildIndexUrl(year, enSlug, "en"));
    const entry = parseMonthIndex(enIndexHtml, "en").find(
      (e) => e.startDay === monday.getDate() && e.startMonth === month,
    );
    if (!entry) return { code: "WEEK_NOT_FOUND" };

    // Docids are shared between languages: same id serves EN and ES weekly pages.
    const enHtml = await fetchText(`https://wol.jw.org/en/wol/d/r1/lp-e/${entry.docid}`);
    const esHtml = await fetchText(`https://wol.jw.org/es/wol/d/r4/lp-s/${entry.docid}`);
    const bibleReadingEn = parseReading(enHtml);
    const bibleReadingEs = parseReading(esHtml);
    const programEn = flattenProgram(parseProgram(enHtml, "en"));
    const programEs = flattenProgram(parseProgram(esHtml, "es"));
    if (!bibleReadingEn) {
      return { code: "FETCH_ERROR", message: "No reading found on EN weekly page" };
    }

    const result: WorkbookResult = {
      weekId,
      bibleReadingEn,
      bibleReadingEs,
      programEn,
      programEs,
    };
    cache.set(weekId, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    return {
      code: "FETCH_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
// ─── Presiding Sheet & Timer Types ────────────────────────────────────────────

export type SectionGroup = "treasures" | "fieldMinistry" | "living" | null;
export type TimerRole = "assignee" | "presiding";

export interface PresidingSection {
  id: string;
  titleEn: string;
  titleEs: string;
  duration: number; // minutes (for group headers: total of subsections)
  assigneeName: string;
  subsections: PresidingSection[];
  group: SectionGroup;
  /** Local-only timer configuration; absent values are inferred from the section. */
  timerRoles?: TimerRole[];
  /** Minutes after the meeting start. */
  scheduledStartMinute?: number;
  /** Minutes after the meeting start. */
  scheduledEndMinute?: number;
  /** Client/server conflict timestamp. */
  updatedAt?: string;
}

export interface ProgramWeek {
  weekId: string;           // "2026-W31" format
  weekRangeEn: string;      // "AUGUST 3-9"
  weekRangeEs: string;      // "3-9 DE AGOSTO"
  bibleReading: string;
  bibleReadingEs?: string;
  sections: PresidingSection[];
  updatedAt?: string;
}

export interface ProgramWeekCatalogEntry {
  weekId: string;
  weekRangeEn: string;
  weekRangeEs: string;
  bibleReading: string;
  bibleReadingEs?: string;
}

/** Local JW WOL weekly metadata; keep the dashboard independent of the network. */
export const JW_WOL_WEEKLY_PROGRAM_CATALOG: Record<string, ProgramWeekCatalogEntry> = {
  "2026-W32": {
    weekId: "2026-W32",
    weekRangeEn: "AUGUST 3-9",
    weekRangeEs: "3-9 DE AGOSTO",
    bibleReading: "Jeremiah 22, 23",
    bibleReadingEs: "JEREMÍAS 22, 23",
  },
  "2026-W33": {
    weekId: "2026-W33",
    weekRangeEn: "AUGUST 10-16",
    weekRangeEs: "10-16 DE AGOSTO",
    bibleReading: "Jeremiah 24, 25",
    bibleReadingEs: "JEREMÍAS 24, 25",
  },
  "2026-W34": {
    weekId: "2026-W34",
    weekRangeEn: "AUGUST 17-23",
    weekRangeEs: "17-23 DE AGOSTO",
    bibleReading: "Jeremiah 26-28",
    bibleReadingEs: "JEREMÍAS 26-28",
  },
};

export function getJwWolWeekCatalogEntry(weekId: string): ProgramWeekCatalogEntry | undefined {
  const staticEntry = JW_WOL_WEEKLY_PROGRAM_CATALOG[weekId];
  if (staticEntry) return staticEntry;
  const range = formatWeekRange(weekId);
  if (!range) return undefined;
  return { weekId, ...range, bibleReading: "", bibleReadingEs: "" };
}

export interface PresidingConfig {
  weeks: ProgramWeek[];
  activeWeekId: string | null;
}

export function getDefaultWeek(): ProgramWeek {
  return {
    weekId: "default",
    weekRangeEn: "",
    weekRangeEs: "",
    bibleReading: "",
    bibleReadingEs: "",
    sections: DEFAULTS.map(mk),
  };
}

export interface PresidingPrefs {
  autoAdvance: boolean;
  meetingStartHour: number;   // 0-23
  meetingStartMinute: number; // 0-59
  timeFormat: "24h" | "12h";
  chairmanExpectedCount: number;
  chairmanExpectedSeconds: number; // 0-59
  updatedAt?: string;
}

export interface TimerLogEntry {
  id?: string;
  sectionId: string;
  titleEn: string;
  titleEs: string;
  scheduledDurationMin: number;
  actualStartISO: string;
  actualEndISO: string;
  actualDurationMin: number;
  wasOvertime: boolean;
  /** Role is absent on legacy single-timer entries. */
  role?: TimerRole;
  /** Second precision for ascending timers; legacy entries use actualDurationMin. */
  actualDurationSec?: number;
  /** Client/server conflict timestamp. */
  updatedAt?: string;
}

export interface MeetingSession {
  id?: string;
  weekId?: string;
  date: string;               // "yyyy-MM-dd"
  startedAt: string;          // ISO datetime
  log: TimerLogEntry[];
  updatedAt?: string;
}

export type ProgramTombstoneType = "week" | "intervention" | "session" | "log";

export interface ProgramTombstone {
  entityType: ProgramTombstoneType;
  entityKey: string;
  deletedAt: string;
  updatedAt: string;
}

function isBibleReadingTitle(title: string): boolean {
  const normalized = title.trim().toLocaleLowerCase();
  return normalized === "bible reading" || normalized === "lectura de la biblia";
}

export function getDefaultTimerRoles(section: Pick<PresidingSection, "id" | "titleEn" | "titleEs" | "group">): TimerRole[] {
  if (
    section.group === "fieldMinistry" ||
    section.id === "def_reading" ||
    isBibleReadingTitle(section.titleEn) ||
    isBibleReadingTitle(section.titleEs)
  ) {
    return ["assignee", "presiding"];
  }

  return ["assignee"];
}

export function getTimerRoles(
  section: Pick<PresidingSection, "id" | "titleEn" | "titleEs" | "group" | "timerRoles">,
  inheritedGroup: SectionGroup = null,
): TimerRole[] {
  if (section.timerRoles) {
    return section.timerRoles.length > 0 ? [...section.timerRoles] : ["assignee"];
  }

  return getDefaultTimerRoles({
    id: section.id,
    titleEn: section.titleEn,
    titleEs: section.titleEs,
    group: section.group ?? inheritedGroup,
  });
}

/** Local-calendar ISO week identity, stable across timezone offsets. */
export function getProgramWeekId(date = new Date()): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay() || 7;
  local.setDate(local.getDate() + 4 - day);
  const yearStart = new Date(local.getFullYear(), 0, 1);
  const week = Math.ceil((((local.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${local.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** ISO week id ("2026-W34") → the Monday that starts that ISO week (local calendar), or null if unparseable. */
export function getIsoWeekMonday(weekId: string): Date | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  // ISO Jan-4 rule: week 1 contains Jan 4; its Monday may fall in the prior year.
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(year, 0, 4 - ((jan4.getDay() || 7) - 1));
  monday.setDate(monday.getDate() + (week - 1) * 7);
  return monday;
}

const MONTHS_EN = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];
const MONTHS_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

/** Monday–Sunday date range for an ISO week id in JW catalog style (uppercase, month names only), or null if unparseable. */
export function formatWeekRange(weekId: string): { weekRangeEn: string; weekRangeEs: string } | null {
  const monday = getIsoWeekMonday(weekId);
  if (!monday) return null;
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const weekRangeEn = sameMonth
    ? `${MONTHS_EN[monday.getMonth()]} ${monday.getDate()}-${sunday.getDate()}`
    : `${MONTHS_EN[monday.getMonth()]} ${monday.getDate()}-${MONTHS_EN[sunday.getMonth()]} ${sunday.getDate()}`;
  const weekRangeEs = sameMonth
    ? `${monday.getDate()}-${sunday.getDate()} DE ${MONTHS_ES[monday.getMonth()]}`
    : `${monday.getDate()} DE ${MONTHS_ES[monday.getMonth()]}-${sunday.getDate()} DE ${MONTHS_ES[sunday.getMonth()]}`;
  return { weekRangeEn, weekRangeEs };
}

/** ISO week id `weeksAhead` weeks from `date` (0 = the week containing `date`). */
export function getProgramWeekIdOffset(weeksAhead: number, date = new Date()): string {
  const clone = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  clone.setDate(clone.getDate() + weeksAhead * 7);
  return getProgramWeekId(clone);
}

/** How many future weeks (beyond the current one) default configs seed. */
export const PROGRAM_WEEKS_AHEAD = 4;

// ─── Default config (S-38 meeting template) ───────────────────────────────────

const DEFAULTS: { id: string; titleEn: string; titleEs: string; duration: number; group: SectionGroup }[] = [
  { id: "def_opening", titleEn: "Opening Comments", titleEs: "Palabras de introducción", duration: 1, group: null },
  { id: "def_treasures", titleEn: "Treasures From God's Word", titleEs: "Tesoros de la Biblia", duration: 24, group: "treasures" },
  { id: "def_talk", titleEn: "Treasure Talk", titleEs: "Discurso de los Tesoros", duration: 10, group: "treasures" },
  { id: "def_gems", titleEn: "Spiritual Gems", titleEs: "Busquemos perlas escondidas", duration: 10, group: "treasures" },
  { id: "def_reading", titleEn: "Bible Reading", titleEs: "Lectura de la Biblia", duration: 3, group: "treasures" },
  { id: "def_reading_cond", titleEn: "Conductor's Comments", titleEs: "Palabras del conductor", duration: 1, group: "treasures" },
  { id: "def_field", titleEn: "Apply Yourself to the Field Ministry", titleEs: "Seamos mejores maestros", duration: 12, group: "fieldMinistry" },
  { id: "def_start", titleEn: "Starting a Conversation", titleEs: "Empiece conversaciones", duration: 4, group: "fieldMinistry" },
  { id: "def_follow", titleEn: "Following Up", titleEs: "Haga revisitas", duration: 4, group: "fieldMinistry" },
  { id: "def_talk2", titleEn: "Talk", titleEs: "Discurso", duration: 4, group: "fieldMinistry" },
  { id: "def_living", titleEn: "Living as Christians", titleEs: "Nuestra vida cristiana", duration: 45, group: "living" },
  { id: "def_local", titleEn: "Local Needs", titleEs: "Necesidades locales", duration: 15, group: "living" },
  { id: "def_study", titleEn: "Congregation Bible Study", titleEs: "Estudio bíblico de la congregación", duration: 30, group: "living" },
  { id: "def_concluding", titleEn: "Concluding Comments", titleEs: "Palabras de conclusión", duration: 3, group: null },
];

function mk(d: typeof DEFAULTS[0], scheduledStartMinute?: number): PresidingSection {
  return {
    ...d,
    assigneeName: "",
    subsections: [],
    timerRoles: getDefaultTimerRoles(d),
    ...(scheduledStartMinute === undefined ? {} : { scheduledStartMinute }),
  };
}

/** Fresh S-38 template sections; call per week so no week shares section objects. */
function buildS38Sections(): PresidingSection[] {
  return [
    mk(DEFAULTS[0]), // opening
    { ...mk(DEFAULTS[1]), subsections: [mk(DEFAULTS[2]), mk(DEFAULTS[3]), mk(DEFAULTS[4]), mk(DEFAULTS[5])] }, // treasures
    { ...mk(DEFAULTS[6]), subsections: [mk(DEFAULTS[7]), mk(DEFAULTS[8]), mk(DEFAULTS[9])] }, // field ministry
    { ...mk(DEFAULTS[10]), subsections: [mk(DEFAULTS[11]), mk(DEFAULTS[12])] }, // living
    mk(DEFAULTS[13]), // concluding
  ];
}

export function getDefaultPresidingConfig(date = new Date()): PresidingConfig {
  const weekIds = Array.from({ length: PROGRAM_WEEKS_AHEAD + 1 }, (_, i) => getProgramWeekIdOffset(i, date));
  return {
    weeks: weekIds.map((weekId) => {
      const entry = getJwWolWeekCatalogEntry(weekId);
      return {
        weekId,
        weekRangeEn: entry?.weekRangeEn ?? "",
        weekRangeEs: entry?.weekRangeEs ?? "",
        bibleReading: entry?.bibleReading ?? "",
        bibleReadingEs: entry?.bibleReadingEs ?? "",
        sections: buildS38Sections(),
      };
    }),
    activeWeekId: weekIds[0],
  };
}

export function getDefaultPresidingPrefs(): PresidingPrefs {
  return { autoAdvance: false, meetingStartHour: 19, meetingStartMinute: 30, timeFormat: "24h", chairmanExpectedCount: 1, chairmanExpectedSeconds: 0 };
}

let _counter = 0;
export function newSectionId(): string { return `sec_${Date.now()}_${++_counter}`; }

export function createPresidingSection(titleEn = "", titleEs = "", duration = 5, group: SectionGroup = null): PresidingSection {
  const section = { id: newSectionId(), titleEn, titleEs, duration, assigneeName: "", subsections: [], group };
  return { ...section, timerRoles: getDefaultTimerRoles(section), scheduledStartMinute: 0 };
}

export function totalPresidingMinutes(sections: PresidingSection[]): number {
  let total = 0;
  for (const s of sections) {
    if (s.subsections.length > 0) total += s.subsections.reduce((sum, sub) => sum + sub.duration, 0);
    else total += s.duration;
  }
  return total;
}

// ─── JW section colors ────────────────────────────────────────────────────────

export const SECTION_COLORS: Record<string, string> = {
  treasures: "#2B579A",      // blue
  fieldMinistry: "#B8761F",   // brown / orange
  living: "#8B3A2E",          // dark red
};

export const SECTION_ICONS: Record<string, string> = {
  treasures: "diamond",
  fieldMinistry: "wheat",
  living: "sheep",
};

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
  sections: PresidingSection[];
  updatedAt?: string;
}

export interface ProgramWeekCatalogEntry {
  weekId: string;
  weekRangeEn: string;
  weekRangeEs: string;
  bibleReading: string;
}

/** Local JW WOL weekly metadata; keep the dashboard independent of the network. */
export const JW_WOL_WEEKLY_PROGRAM_CATALOG: Record<string, ProgramWeekCatalogEntry> = {
  "2026-W32": {
    weekId: "2026-W32",
    weekRangeEn: "AUGUST 3-9",
    weekRangeEs: "3-9 DE AGOSTO",
    bibleReading: "JEREMIAH 22-23",
  },
  "2026-W33": {
    weekId: "2026-W33",
    weekRangeEn: "AUGUST 10-16",
    weekRangeEs: "10-16 DE AGOSTO",
    bibleReading: "JEREMIAH 24-25",
  },
  "2026-W34": {
    weekId: "2026-W34",
    weekRangeEn: "AUGUST 17-23",
    weekRangeEs: "17-23 DE AGOSTO",
    bibleReading: "JEREMIAH 26-28",
  },
};

export function getJwWolWeekCatalogEntry(weekId: string): ProgramWeekCatalogEntry | undefined {
  return JW_WOL_WEEKLY_PROGRAM_CATALOG[weekId];
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
    sections: DEFAULTS.map(mk),
  };
}

export interface PresidingPrefs {
  autoAdvance: boolean;
  meetingStartHour: number;   // 0-23
  meetingStartMinute: number; // 0-59
  timeFormat: "24h" | "12h";
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

export function getDefaultPresidingConfig(): PresidingConfig {
  return {
    weeks: [{
      weekId: "2026-W32",
      weekRangeEn: "AUGUST 3-9",
      weekRangeEs: "3-9 DE AGOSTO",
      bibleReading: "JEREMIAH 22, 23",
      sections: [
        mk(DEFAULTS[0]), // opening
        { ...mk(DEFAULTS[1]), subsections: [mk(DEFAULTS[2]), mk(DEFAULTS[3]), mk(DEFAULTS[4]), mk(DEFAULTS[5])] }, // treasures
        { ...mk(DEFAULTS[6]), subsections: [mk(DEFAULTS[7]), mk(DEFAULTS[8]), mk(DEFAULTS[9])] }, // field ministry
        { ...mk(DEFAULTS[10]), subsections: [mk(DEFAULTS[11]), mk(DEFAULTS[12])] }, // living
        mk(DEFAULTS[13]), // concluding
      ],
    }],
    activeWeekId: "2026-W32",
  };
}

export function getDefaultPresidingPrefs(): PresidingPrefs {
  return { autoAdvance: false, meetingStartHour: 19, meetingStartMinute: 30, timeFormat: "24h" };
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
  fieldMinistry: "agriculture",
  living: "pets",
};

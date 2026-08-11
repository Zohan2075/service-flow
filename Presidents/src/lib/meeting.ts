import { Section, SectionGroup, MeetingConfig } from "@/types";

let counter = 0;
function newId(): string { return `sec_${Date.now()}_${++counter}`; }

type DefaultDef = { id: string; titleEn: string; titleEs: string; duration: number; group: SectionGroup };

// Stable IDs for default sections to avoid hydration mismatches
const DEFAULTS = {
  opening: { id: "default_opening", titleEn: "Opening Comments", titleEs: "Palabras de introducción", duration: 1, group: null as SectionGroup },
  treasures: { id: "default_treasures", titleEn: "Treasures From God's Word", titleEs: "Tesoros de la Biblia", duration: 24, group: "treasures" as SectionGroup },
  talk: { id: "default_talk", titleEn: "The Importance of Good Shepherds", titleEs: "¡Qué importante es tener buenos pastores!", duration: 10, group: "treasures" as SectionGroup },
  gems: { id: "default_gems", titleEn: "Spiritual Gems", titleEs: "Busquemos perlas escondidas", duration: 10, group: "treasures" as SectionGroup },
  reading: { id: "default_reading", titleEn: "Bible Reading", titleEs: "Lectura de la Biblia", duration: 4, group: "treasures" as SectionGroup },
  field: { id: "default_field", titleEn: "Apply Yourself to the Field Ministry", titleEs: "Seamos mejores maestros", duration: 12, group: "fieldMinistry" as SectionGroup },
  start: { id: "default_start", titleEn: "Starting a Conversation", titleEs: "Empiece conversaciones", duration: 4, group: "fieldMinistry" as SectionGroup },
  follow: { id: "default_follow", titleEn: "Following Up", titleEs: "Haga revisitas", duration: 4, group: "fieldMinistry" as SectionGroup },
  talk2: { id: "default_talk2", titleEn: "Talk", titleEs: "Discurso", duration: 4, group: "fieldMinistry" as SectionGroup },
  living: { id: "default_living", titleEn: "Living as Christians", titleEs: "Nuestra vida cristiana", duration: 45, group: "living" as SectionGroup },
  local: { id: "default_local", titleEn: "Local Needs", titleEs: "Necesidades locales", duration: 15, group: "living" as SectionGroup },
  study: { id: "default_study", titleEn: "Congregation Bible Study", titleEs: "Estudio bíblico de la congregación", duration: 30, group: "living" as SectionGroup },
  concluding: { id: "default_concluding", titleEn: "Concluding Comments", titleEs: "Palabras de conclusión", duration: 3, group: null as SectionGroup },
};

function makeSection(d: DefaultDef, subs: Section[] = []): Section {
  return { id: d.id, titleEn: d.titleEn, titleEs: d.titleEs, duration: d.duration, assigneeName: "", subsections: subs, group: d.group };
}

export function getDefaultConfig(): MeetingConfig {
  return {
    weekRangeEn: "AUGUST 3-9",
    weekRangeEs: "3-9 DE AGOSTO",
    bibleReading: "JEREMIAH 22, 23",
    sections: getDefaultSections(),
  };
}

export function getDefaultSections(): Section[] {
  return [
    makeSection(DEFAULTS.opening),
    makeSection(DEFAULTS.treasures, [makeSection(DEFAULTS.talk), makeSection(DEFAULTS.gems), makeSection(DEFAULTS.reading)]),
    makeSection(DEFAULTS.field, [makeSection(DEFAULTS.start), makeSection(DEFAULTS.follow), makeSection(DEFAULTS.talk2)]),
    makeSection(DEFAULTS.living, [makeSection(DEFAULTS.local), makeSection(DEFAULTS.study)]),
    makeSection(DEFAULTS.concluding),
  ];
}

export function totalDuration(sections: Section[]): number {
  let total = 0;
  for (const s of sections) {
    if (s.subsections.length > 0) total += s.subsections.reduce((sum, sub) => sum + sub.duration, 0);
    else total += s.duration;
  }
  return total;
}

export function createSection(titleEn = "", titleEs = "", duration = 5, group: SectionGroup = null): Section {
  return { id: newId(), titleEn, titleEs, duration, assigneeName: "", subsections: [], group };
}
export type SectionGroup = "treasures" | "fieldMinistry" | "living" | null;

export interface Section {
  id: string;
  titleEn: string;
  titleEs: string;
  duration: number;
  assigneeName: string;
  subsections: Section[];
  group: SectionGroup;
}

export interface MeetingConfig {
  weekRangeEn: string;
  weekRangeEs: string;
  bibleReading: string;
  sections: Section[];
}

export interface AppPreferences {
  language: "en" | "es";
  theme: "light" | "dark";
  autoAdvance: boolean;
  meetingStartHour: number;
  meetingStartMinute: number;
  timeFormat: "24h" | "12h";
}

export type TimerStatus = "idle" | "running" | "paused" | "warning" | "overtime" | "finished";

export interface TimerState {
  status: TimerStatus;
  currentSectionIndex: number;
  masterSecondsRemaining: number;
  sectionSecondsRemaining: number;
}
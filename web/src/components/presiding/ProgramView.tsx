"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useSync } from "@/lib/sync";
import type {
  PresidingSection,
  PresidingConfig,
  PresidingPrefs,
  ProgramWeek,
  MeetingSession,
  SectionGroup,
  TimerLogEntry,
  TimerRole,
} from "@/types/presiding";
import {
  SECTION_COLORS,
  SECTION_ICONS,
  totalPresidingMinutes,
  createPresidingSection,
  getDefaultWeek,
  getIsoWeekMonday,
  getJwWolWeekCatalogEntry,
  getProgramWeekId,
  getTimerRoles,
} from "@/types/presiding";

/* ---------- helpers ---------- */

interface FlatSection {
  sectionId: string; parentId: string | null;
  titleEn: string; titleEs: string; assigneeName: string;
  durationSec: number; group: SectionGroup; flatIdx: number;
}

function flattenAll(sections: PresidingSection[]): FlatSection[] {
  const out: FlatSection[] = [];
  let i = 0;
  for (const s of sections) {
    if (s.subsections.length > 0) {
      for (const sub of s.subsections) {
        out.push({ sectionId: sub.id, parentId: s.id, titleEn: sub.titleEn, titleEs: sub.titleEs,
          assigneeName: sub.assigneeName, durationSec: sub.duration * 60, group: s.group, flatIdx: i++ });
      }
    } else {
      out.push({ sectionId: s.id, parentId: null, titleEn: s.titleEn, titleEs: s.titleEs,
        assigneeName: s.assigneeName, durationSec: s.duration * 60, group: s.group, flatIdx: i++ });
    }
  }
  return out;
}

function fmtTime(sec: number, showSign = false): string {
  const a = Math.abs(sec); const m = Math.floor(a / 60); const s = a % 60;
  return `${showSign && sec < 0 ? "-" : ""}${m}:${s.toString().padStart(2, "0")}`;
}

function fmtClock(totalMin: number, is24: boolean): string {
  const h = Math.floor(totalMin / 60) % 24; const m = totalMin % 60;
  if (is24) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  const ampm = h >= 12 ? "PM" : "AM"; const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ---------- labels ---------- */

function SectionIcon({ icon, className }: { icon: string | null; className?: string }) {
  if (!icon) return null;
  if (icon === "sheep") {
    return (
      <svg viewBox="0 0 100 100" width="1em" height="1em" className={className} fill="currentColor">
        <path d="M84.6,28c-1-2,0.2-6.4-7.9-6.4c-1,0-1.9,0.2-2.8,0.5c-1.7-2.6-4.6-2-4.6-2c-0.4,2-0.2,3.4,0.2,4.5c-1.7,1.4-3.1,3.1-4.3,4.6  c-2.2,2.9-5.4,4.9-9,5.4c-4,0.6-8.8,1.3-10.1,1.3c-4.2,0-8.9-2.7-15.5-2.7c-3.5,0-7.1,0.3-9.8,1.7c-0.6-0.4-1.3-0.6-2.1-0.6  c-4.7,0-5.2,5.4-5.2,5.4c0,1.7,0.9,2.9,2.1,3.4c0,10.5,4.1,10.9,4.2,15c0.1,3.3-3.7,2-3.7,7.9c0,4.7,0.2,9,0.3,11.6  c0.1,1.4,1.2,2.5,2.6,2.5h4.4c0.2-2-1.2-3-0.7-11.3c0-0.3,0.2-0.7,0.5-1.3c0.1,0.2,0.2,0.4,0.3,0.6c1,2.1,1.2,4.9,2,8.7  c0.4,1.9,2.2,3.4,4.1,3.4l3.5,0c0-3-1.5-2.7-2.2-13.8c0.4-0.6,2.5-3.6,4.8-6.8c4.5,0.8,9.7,0.7,13.8,0.3c1.6-0.2,5.1-0.7,7.6-1.4  c0.3-0.1,0.4,0.3,0.2,0.4l-3.2,1.1c0.5,2.8,0.9,5.9,0.8,8.9c0,1.7-0.4,3.2-0.4,7.4c0,3,1.7,3.9,3.2,3.9h3.9c0-4.2-2.1-4.7-0.7-11.8  c0.1-0.3,0.1-0.7,0.2-1.1l1.8,7.9l0.6,2.8c0.3,1.3,1.4,2.2,2.8,2.2h4.1c0-3.5-1.2-4.3-1.5-9.4c-0.2-4.2-0.2-4.2-0.2-7.4  c0.5-6.4,6.7-4.2,8.1-20.7c0.2-2.5,2.5-4.2,5.9-4.2c3.5,0,3.5-1.7,4.7-3.5S85.6,29.9,84.6,28z" />
      </svg>
    );
  }
  if (icon === "wheat") {
    return (
      <svg viewBox="0 0 24 24" width="1em" height="1em" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.2109 8.78899L3.4653 20.5347M8.90748 15.0925L9.10982 14.9292C9.30611 14.7589 9.48392 14.5681 9.64012 14.3598C10.854 12.7413 10.526 10.4451 8.90748 9.23119L8.70514 9.39448C8.50885 9.56474 8.33104 9.75557 8.17484 9.96383C6.96092 11.5824 7.28893 13.8786 8.90748 15.0925ZM8.90748 15.0925L9.07078 15.2948C9.24104 15.4911 9.43188 15.6689 9.64016 15.8252C11.2587 17.039 13.5548 16.711 14.7687 15.0925L14.6054 14.8901C14.4352 14.6938 14.2443 14.516 14.036 14.3598C12.4175 13.1459 10.1214 13.4739 8.90748 15.0925ZM11.8381 12.1618L12.0404 11.9985C12.2367 11.8283 12.4145 11.6375 12.5707 11.4292C13.7847 9.81064 13.4566 7.51447 11.8381 6.30055L11.6358 6.46384C11.4395 6.6341 11.2617 6.82492 11.1055 7.03319C9.89154 8.65174 10.2195 10.9479 11.8381 12.1618ZM11.8381 12.1618L12.0014 12.3642C12.1717 12.5605 12.3625 12.7383 12.5708 12.8945C14.1893 14.1084 16.4854 13.7804 17.6993 12.1618L17.536 11.9595C17.3658 11.7632 17.1749 11.5854 16.9667 11.4292C15.3481 10.2153 13.052 10.5433 11.8381 12.1618ZM14.7687 9.23119L14.9711 9.0679C15.1673 8.89764 15.3452 8.70682 15.5014 8.49855C16.7153 6.88 16.3873 4.58383 14.7687 3.36991L14.5664 3.5332C14.3701 3.70346 14.1923 3.89428 14.0361 4.10255C12.8222 5.7211 13.1502 8.01727 14.7687 9.23119ZM14.7687 9.23119L14.932 9.43354C15.1023 9.62984 15.2931 9.80766 15.5014 9.96387C17.1199 11.1778 19.4161 10.8497 20.6299 9.23119L20.4667 9.02885C20.2964 8.83254 20.1056 8.65473 19.8973 8.49852C18.2787 7.28463 15.9826 7.61266 14.7687 9.23119ZM5.90748 18.0925L6.10982 17.9292C6.30611 17.7589 6.48392 17.5681 6.64012 17.3598C7.85405 15.7413 7.52603 13.4451 5.90748 12.2312L5.70514 12.3945C5.50885 12.5647 5.33104 12.7556 5.17484 12.9638C3.96092 14.5824 4.28893 16.8786 5.90748 18.0925ZM5.90748 18.0925L6.07078 18.2948C6.24104 18.4911 6.43188 18.6689 6.64016 18.8252C8.25869 20.039 10.5548 19.711 11.7687 18.0925L11.6054 17.8901C11.4352 17.6938 11.2443 17.516 11.036 17.3598C9.41751 16.1459 7.12137 16.4739 5.90748 18.0925ZM17.6292 7.40757C17.3714 7.44439 17.1108 7.45359 16.8516 7.43518L16.593 7.40753C16.3069 5.40469 17.6986 3.54913 19.7014 3.26301C20.045 3.21392 20.3939 3.21392 20.7375 3.26301C21.0237 5.26589 19.632 7.12145 17.6292 7.40757Z" />
      </svg>
    );
  }
  return <span className={cn("material-symbols-outlined", className)}>{icon}</span>;
}

const L = {
  en: {
     chairman: "CHAIRMAN", expected: "expected", seconds: "sec.", song: "Song & Prayer", openingCmt: "Opening Comments",
    min: "min.", addPart: "Add Part", done: "Done",
    namePlaceholder: "Name", remove: "Remove", removeConfirm: "Remove this part?",
    master: "Active timer", current: "Now", start: "Start", pause: "Pause",
    resume: "Resume", reset: "Reset", skip: "Next", timer: "Timer",
    assignee: "Assignee", presiding: "Presiding", reader: "Reader", conductor: "Chairman",
    stop: "Stop",
    overtime: "Overtime", complete: "Complete", restart: "Restart",
     totalTime: "Total", sessionLog: "Session Log", logEmpty: "No parts timed yet.", end: "End", editLog: "Edit log", deleteLog: "Delete log", save: "Save", cancel: "Cancel",
     saving: "Saving", saved: "Saved", offline: "Offline — saved locally", saveError: "Save error", retry: "Retry", resetUnsaved: "Reset unsaved time",
    noSections: "No parts. Reset in Settings.", 
    weekLabel: "Week", newWeek: "New Week", deleteWeek: "Delete Week",
    deleteWeekConfirm: "Delete this week's program?",
    congrats: "Congregation Bible Study", concluding: "Concluding Comments", edit: "Edit",
    legend: "Timer legend", activeRole: "Active", assigneeRole: "Assignee / Reader", presidingRole: "Presiding / Chairman",
  },
  es: {
     chairman: "PRESIDENTE", expected: "esperados", seconds: "seg.", song: "Canción y Oración", openingCmt: "Palabras de introducción",
    min: "min.", addPart: "Agregar Parte", done: "Listo",
    namePlaceholder: "Nombre", remove: "Eliminar", removeConfirm: "¿Eliminar esta parte?",
    master: "Temporizador activo", current: "Ahora", start: "Iniciar", pause: "Pausar",
    resume: "Reanudar", reset: "Reiniciar", skip: "Sig.", timer: "Temporizador",
    assignee: "Asignado", presiding: "Presidente", reader: "Lector", conductor: "Presidente",
    stop: "Detener",
    overtime: "Excedido", complete: "Completa", restart: "Reiniciar",
      totalTime: "Total", sessionLog: "Registro", logEmpty: "Aún no se ha medido ninguna parte.", end: "Fin", editLog: "Editar registro", deleteLog: "Eliminar registro", save: "Guardar", cancel: "Cancelar",
       saving: "Guardando", saved: "Guardado", offline: "Sin conexión — guardado localmente", saveError: "Error al guardar", retry: "Reintentar", resetUnsaved: "Restablecer tiempo sin guardar",
    noSections: "No hay partes. Restablecer en Configuración.",
    weekLabel: "Semana", newWeek: "Nueva Semana", deleteWeek: "Eliminar Semana",
    deleteWeekConfirm: "¿Eliminar el programa de esta semana?",
    congrats: "Estudio Bíblico de la Congregación", concluding: "Palabras de conclusión", edit: "Editar",
    legend: "Leyenda de temporizadores", activeRole: "Activo", assigneeRole: "Asignado / Lector", presidingRole: "Presidente",
  },
};

/* ---------- ascending role timers ---------- */

interface TimerRecord {
  persistedSec: number;
  unsavedSec: number;
  logId?: string;
}

interface ActiveTimer {
  key: string;
  sectionId: string;
  role: TimerRole | null;
  startedAtISO: string;
  startedAtMs: number;
  titleEn: string;
  titleEs: string;
  scheduledDurationMin: number;
}

function timerKey(sectionId: string, role: TimerRole | null): string {
  return `${sectionId}:${role ?? "single"}`;
}

function logDurationSec(entry: TimerLogEntry): number {
  if (typeof entry.actualDurationSec === "number" && Number.isFinite(entry.actualDurationSec)) {
    return Math.max(0, Math.round(entry.actualDurationSec));
  }
  return Math.max(0, Math.round(entry.actualDurationMin * 60));
}

function hydrateTimerRecords(sessionLog: TimerLogEntry[]): Record<string, TimerRecord> {
  const records: Record<string, TimerRecord> = {};

  for (const entry of sessionLog) {
    const durationSec = logDurationSec(entry);
    const key = timerKey(entry.sectionId, entry.role ?? null);
    records[key] = { persistedSec: durationSec, unsavedSec: 0, logId: entry.id };
  }

  return records;
}

export function useProgramTimers(
  sections: PresidingSection[],
  sessionLog: TimerLogEntry[],
  onLog: (entry: TimerLogEntry) => void,
  onUpdateLog?: (logId: string, patch: Partial<TimerLogEntry>) => void,
  onDeleteLog?: (logId: string) => void,
  chairmanExpectedCount: number = 1,
  chairmanExpectedSeconds: number = 0,
) {
  const flat = useMemo(() => flattenAll(sections), [sections]);
  const hydratedRecords = useMemo(
    () => hydrateTimerRecords(sessionLog),
    [sessionLog],
  );
  const [records, setRecords] = useState<Record<string, TimerRecord>>(() => hydratedRecords);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const recordsR = useRef<Record<string, TimerRecord>>(records);
  const activeR = useRef<ActiveTimer | null>(null);
  const intvR = useRef<ReturnType<typeof setInterval> | null>(null);

  const commitRecords = useCallback((next: Record<string, TimerRecord>) => {
    recordsR.current = next;
    setRecords(next);
  }, []);

  const stopInterval = useCallback(() => {
    if (intvR.current) {
      clearInterval(intvR.current);
      intvR.current = null;
    }
  }, []);

  const refreshActive = useCallback(() => {
    const active = activeR.current;
    if (!active) return;
    const current = recordsR.current[active.key] ?? { persistedSec: 0, unsavedSec: 0 };
    const unsavedSec = Math.max(0, Math.floor((Date.now() - active.startedAtMs) / 1000));
    commitRecords({ ...recordsR.current, [active.key]: { ...current, unsavedSec } });
  }, [commitRecords]);

  const finalizeActive = useCallback(() => {
    const active = activeR.current;
    if (!active) return;
    stopInterval();
    const segmentSec = Math.max(0, Math.floor((Date.now() - active.startedAtMs) / 1000));
    const current = recordsR.current[active.key] ?? { persistedSec: 0, unsavedSec: 0 };
    const totalSec = current.persistedSec + segmentSec;
    const actualEndISO = new Date().toISOString();
    const next = {
      ...recordsR.current,
      [active.key]: { ...current, persistedSec: totalSec, unsavedSec: 0 },
    };
    activeR.current = null;
    setActiveKey(null);
    commitRecords(next);
    if (current.logId && onUpdateLog) {
      onUpdateLog(current.logId, {
        actualEndISO,
        actualDurationMin: Math.round(totalSec / 60),
        actualDurationSec: totalSec,
        wasOvertime: totalSec > (active.role === "presiding" ? chairmanExpectedCount * 60 + chairmanExpectedSeconds : active.scheduledDurationMin * 60),
      });
    } else if (!current.logId) {
      onLog({
        sectionId: active.sectionId,
        titleEn: active.titleEn,
        titleEs: active.titleEs,
        scheduledDurationMin: active.scheduledDurationMin,
        actualStartISO: active.startedAtISO,
        actualEndISO,
        actualDurationMin: Math.round(totalSec / 60),
        actualDurationSec: totalSec,
        role: active.role ?? undefined,
        wasOvertime: totalSec > (active.role === "presiding" ? chairmanExpectedCount * 60 + chairmanExpectedSeconds : active.scheduledDurationMin * 60),
      });
    }
  }, [chairmanExpectedCount, chairmanExpectedSeconds, commitRecords, onLog, onUpdateLog, stopInterval]);

  const toggleTimer = useCallback((sectionId: string, role: TimerRole | null) => {
    const item = flat.find((candidate) => candidate.sectionId === sectionId);
    if (!item) return;
    const key = timerKey(sectionId, role);
    if (activeR.current?.key === key) {
      finalizeActive();
      return;
    }

    if (activeR.current) finalizeActive();
    const startedAt = new Date();
    const active: ActiveTimer = {
      key,
      sectionId,
      role,
      startedAtISO: startedAt.toISOString(),
      startedAtMs: startedAt.getTime(),
      titleEn: item.titleEn,
      titleEs: item.titleEs,
      scheduledDurationMin: Math.round(item.durationSec / 60),
    };
    activeR.current = active;
    const current = recordsR.current[key] ?? { persistedSec: 0, unsavedSec: 0 };
    commitRecords({
      ...recordsR.current,
      [key]: { ...current, unsavedSec: 0 },
    });
    setActiveKey(key);
    intvR.current = setInterval(refreshActive, 1000);
  }, [commitRecords, finalizeActive, flat, refreshActive]);

  const resetTimer = useCallback((sectionId: string, role: TimerRole | null) => {
    const key = timerKey(sectionId, role);
    if (activeR.current?.key === key) {
      stopInterval();
      activeR.current = null;
      setActiveKey(null);
    }

    const current = recordsR.current[key];
    if (current?.logId && onDeleteLog) onDeleteLog(current.logId);
    commitRecords({ ...recordsR.current, [key]: { persistedSec: 0, unsavedSec: 0 } });
  }, [commitRecords, onDeleteLog, stopInterval]);

  useEffect(() => {
    const active = activeR.current;
    const activeUnsavedSec = active ? recordsR.current[active.key]?.unsavedSec ?? 0 : 0;
    const next = { ...hydratedRecords };
    if (active) {
      const current = next[active.key] ?? { persistedSec: 0, unsavedSec: 0 };
      next[active.key] = { ...current, unsavedSec: activeUnsavedSec };
    }
    commitRecords(next);
  }, [commitRecords, hydratedRecords]);

  useEffect(() => () => stopInterval(), [stopInterval]);

  const getTimerState = useCallback((sectionId: string, role: TimerRole | null) => {
    const key = timerKey(sectionId, role);
    const record = records[key];
    return {
      elapsedSec: record ? record.persistedSec + record.unsavedSec : 0,
      running: activeKey === key,
    };
  }, [activeKey, records]);

  const activeItem = activeR.current ? flat.find((item) => item.sectionId === activeR.current?.sectionId) : null;
  const activeTimer = activeR.current && activeItem ? {
    ...activeR.current,
    titleEn: activeItem.titleEn,
    titleEs: activeItem.titleEs,
    elapsedSec: (() => {
      const record = records[activeR.current.key];
      return record ? record.persistedSec + record.unsavedSec : 0;
    })(),
  } : null;

  return { getTimerState, toggleTimer, resetTimer, stopActive: finalizeActive, activeTimer };
}

/* ---------- active timer bar (page-level overlay) ---------- */

export function ActiveTimerBar({ activeTimer, accentColor, isEs, onStop }: {
  activeTimer: ActiveTimer & { elapsedSec: number }; accentColor: string; isEs: boolean; onStop: () => void;
}) {
  const barL = isEs
    ? { master: "Temporizador activo", current: "Ahora", assignee: "Asignado", presiding: "Presidente", timer: "Temporizador", stop: "Detener" }
    : { master: "Active timer", current: "Now", assignee: "Assignee", presiding: "Presiding", timer: "Timer", stop: "Stop" };
  return (
    <div className="shrink-0 sticky top-0 z-40 px-4 md:px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-surface via-surface to-surface/95 backdrop-blur shadow-lg shadow-slate-200/50 dark:shadow-black/25">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="relative flex size-3 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
          </span>
          <div className="text-center shrink-0 min-w-[4.5rem]">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">{barL.master}</p>
            <p className="font-mono text-2xl font-black leading-none tabular-nums">{fmtTime(activeTimer.elapsedSec)}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[10px] uppercase tracking-wider font-bold truncate text-emerald-600">{barL.current}</p>
          <p className="text-sm font-bold tabular-nums truncate text-slate-700 dark:text-slate-100">
            {isEs ? (activeTimer.titleEs || activeTimer.titleEn) : (activeTimer.titleEn || activeTimer.titleEs)}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-bold",
            activeTimer.role === "presiding"
              ? "text-white"
              : activeTimer.role === "assignee"
                ? "bg-primary text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
          )}
          style={activeTimer.role === "presiding" ? { backgroundColor: accentColor } : undefined}>
          {activeTimer.role ? (activeTimer.role === "assignee" ? barL.assignee : barL.presiding) : barL.timer}
        </span>
        <button onClick={onStop}
          className="min-h-11 shrink-0 rounded-xl bg-amber-500 px-4 text-sm font-black text-black shadow-md active:scale-95">
          {barL.stop}
        </button>
      </div>
    </div>
  );
}

/* ---------- main component ---------- */

interface Props {
  lang: "en" | "es"; config: PresidingConfig; prefs: PresidingPrefs;
  sessionLog: TimerLogEntry[]; sessionHistory?: MeetingSession[]; onConfigChange: (cfg: PresidingConfig) => void;
   onDeleteLog?: (logId: string) => void;
  onUpdateLog?: (logId: string, patch: Partial<TimerLogEntry>) => void;
  timerProps: {
    getTimerState: (sectionId: string, role: TimerRole | null) => { elapsedSec: number; running: boolean };
    toggleTimer: (sectionId: string, role: TimerRole | null) => void;
    resetTimer: (sectionId: string, role: TimerRole | null) => void;
    stopActive: () => void;
    activeTimer: (ActiveTimer & { elapsedSec: number }) | null;
  };
}

export default function ProgramView({ lang, config, prefs, sessionLog, sessionHistory = [], onConfigChange, onDeleteLog, onUpdateLog, timerProps }: Props) {
  const { getTimerState, toggleTimer, resetTimer, stopActive, activeTimer } = timerProps;
  const isEs = lang === "es"; const lbl = L[lang];
  const accentColor = useStore((state) => state.settings.accentColor);

  const activeWeek = useMemo(() =>
    config?.weeks?.find((w) => w.weekId === config.activeWeekId) ?? config?.weeks?.[0], [config]);
  const sections = activeWeek?.sections ?? [];
  const sectionGroupById = useMemo(() => {
    const map = new Map<string, SectionGroup>();
    for (const flat of flattenAll(sections)) map.set(flat.sectionId, flat.group);
    return map;
  }, [sections]);
  const sectionColorFor = (sectionId: string): string => {
    const group = sectionGroupById.get(sectionId);
    return (group && SECTION_COLORS[group]) || accentColor;
  };
  const catalogEntry = activeWeek ? getJwWolWeekCatalogEntry(activeWeek.weekId) : undefined;
  const weekRangeEn = catalogEntry?.weekRangeEn ?? activeWeek?.weekRangeEn ?? "";
  const weekRangeEs = catalogEntry?.weekRangeEs ?? activeWeek?.weekRangeEs ?? "";
  const bibleReading = isEs
    ? (catalogEntry?.bibleReadingEs || activeWeek?.bibleReadingEs || activeWeek?.bibleReading || "")
    : (catalogEntry?.bibleReading || activeWeek?.bibleReading || "");

  const updateActiveWeek = useCallback((fn: (w: ProgramWeek) => ProgramWeek) => {
    if (!config || !activeWeek) return;
    onConfigChange({ ...config, weeks: config.weeks.map(w => w.weekId === activeWeek.weekId ? fn(w) : w) });
  }, [config, activeWeek, onConfigChange]);

  // Week management
  const [showWeekMenu, setShowWeekMenu] = useState(false);
  const weekDisplay = isEs ? (weekRangeEs || weekRangeEn) : (weekRangeEn || weekRangeEs);

  const switchWeek = (weekId: string) => {
    onConfigChange({ ...config, activeWeekId: weekId });
    setShowWeekMenu(false);
  };
  const createWeek = () => {
    const def = getDefaultWeek();
    const isoIds = config.weeks.map(w => w.weekId).filter(id => /^\d{4}-W\d{2}$/.test(id)).sort();
    const monday = isoIds.length > 0 ? getIsoWeekMonday(isoIds[isoIds.length - 1]) : null;
    const nextId = monday
      ? getProgramWeekId(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7))
      : getProgramWeekId();
    onConfigChange({
      weeks: [...config.weeks, { ...def, ...(getJwWolWeekCatalogEntry(nextId) ?? {}), weekId: nextId }],
      activeWeekId: nextId,
    });
    setShowWeekMenu(false);
  };
  const deleteWeek = () => {
    if (config.weeks.length <= 1) return;
    if (!window.confirm(lbl.deleteWeekConfirm)) return;
    const remaining = config.weeks.filter(w => w.weekId !== activeWeek!.weekId);
    onConfigChange({ weeks: remaining, activeWeekId: remaining[0]?.weekId ?? null });
    setShowWeekMenu(false);
  };

  // Inline editing state
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [inlineField, setInlineField] = useState<"title" | "assignee" | "duration" | "start" | "end" | null>(null);

  const updateSection = (id: string, fn: (s: PresidingSection) => PresidingSection) => {
    const walk = (list: PresidingSection[]): PresidingSection[] => list.map(s => {
      if (s.id === id) return fn({ ...s });
      if (s.subsections.some(sub => sub.id === id)) return { ...s, subsections: walk(s.subsections) };
      return s;
    });
    updateActiveWeek((w) => ({ ...w, sections: walk(w.sections) }));
  };

  const removeSection = (id: string) => {
    if (!window.confirm(lbl.removeConfirm)) return;
    const walk = (list: PresidingSection[]): PresidingSection[] => list
      .filter(s => s.id !== id)
      .map(s => ({ ...s, subsections: s.subsections.some(sub => sub.id === id) ? s.subsections.filter(sub => sub.id !== id) : walk(s.subsections) }));
    updateActiveWeek((w) => ({ ...w, sections: walk(w.sections) }));
    if (inlineId === id) setInlineId(null);
  };

  const addSubsection = (parentId: string, group: SectionGroup) => {
    updateActiveWeek((w) => ({
      ...w,
      sections: w.sections.map(s => s.id === parentId ? { ...s, subsections: [...s.subsections, createPresidingSection("", "", 5, group)] } : s),
    }));
  };

  const addTopSection = () => {
    updateActiveWeek((w) => ({ ...w, sections: [...w.sections, createPresidingSection("", "", 10)] }));
  };

  // Find editing section
  let editingSection: PresidingSection | null = null;
  if (inlineId) {
    for (const s of sections) {
      if (s.id === inlineId) { editingSection = s; break; }
      for (const sub of s.subsections) { if (sub.id === inlineId) { editingSection = sub; break; } }
      if (editingSection) break;
    }
  }

  const totalMin = totalPresidingMinutes(sections);
  const clock = (m: number) => fmtClock(m, prefs.timeFormat === "24h");
  const startMinTotal = prefs.meetingStartHour * 60 + prefs.meetingStartMinute;

  let legacyOffset = 0; const startTimes: number[] = []; const endTimes: number[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (s.subsections.length > 0) {
        for (const sub of s.subsections) {
          const offset = sub.scheduledStartMinute ?? legacyOffset;
          const endOffset = sub.scheduledEndMinute ?? (offset + sub.duration);
          startTimes.push(startMinTotal + offset);
          endTimes.push(startMinTotal + endOffset);
          legacyOffset = Math.max(legacyOffset, endOffset);
      }
    } else {
      const offset = s.scheduledStartMinute ?? legacyOffset;
      const endOffset = s.scheduledEndMinute ?? (offset + s.duration);
      startTimes.push(startMinTotal + offset);
      endTimes.push(startMinTotal + endOffset);
      legacyOffset = Math.max(legacyOffset, endOffset);
    }
    // Song & Prayer offset: first timed part after opening starts 5 min later
    if (i === 0) legacyOffset += 5;
  }

  // Keep the active timer visible while minimized: document.title + App Badge (installed PWA only).
  const activeKey = activeTimer?.key ?? null;
  const activeElapsedSec = activeTimer?.elapsedSec ?? 0;
  const activeSectionTitle = activeTimer
    ? (isEs ? (activeTimer.titleEs || activeTimer.titleEn) : (activeTimer.titleEn || activeTimer.titleEs))
    : "";
  const originalTitleR = useRef<string | null>(null);

  // Lifecycle: save/restore the original title and clear the badge on stop/unmount.
  useEffect(() => {
    const nav = navigator as unknown as {
      setAppBadge?: (n: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    const clearTitleAndBadge = () => {
      if (originalTitleR.current !== null) {
        document.title = originalTitleR.current;
        originalTitleR.current = null;
      }
      if (nav.clearAppBadge) nav.clearAppBadge().catch(() => undefined);
    };
    if (activeKey === null) {
      clearTitleAndBadge();
      return;
    }
    if (originalTitleR.current === null) originalTitleR.current = document.title;
    return clearTitleAndBadge;
  }, [activeKey]);

  // Per tick: refresh title + badge (elapsed derives from timestamps, so it stays correct when throttled).
  useEffect(() => {
    if (activeKey === null) return;
    document.title = `⏱ ${fmtTime(activeElapsedSec)} · ${activeSectionTitle} — ServiceFlow`;
    const nav = navigator as unknown as { setAppBadge?: (n: number) => Promise<void> };
    if (nav.setAppBadge) nav.setAppBadge(Math.max(0, Math.floor(activeElapsedSec / 60))).catch(() => undefined);
  }, [activeKey, activeElapsedSec, activeSectionTitle]);

  if (sections.length === 0) {
    return <div className="flex items-center justify-center h-full"><p className="text-sm text-slate-500">{lbl.noSections}</p></div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-canvas overflow-hidden">
      {/* ===== HEADER: Week selector + info ===== */}
      <div className="shrink-0 px-4 md:px-5 pt-4 pb-2 space-y-3">
        {/* Week selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <button onClick={() => setShowWeekMenu(!showWeekMenu)}
              className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-surface px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span className="truncate">{lbl.weekLabel}: {weekDisplay || activeWeek?.weekId}</span>
              <span className="material-symbols-outlined text-base text-slate-500 dark:text-slate-400">{showWeekMenu ? "expand_less" : "expand_more"}</span>
            </button>
            {showWeekMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg py-1 max-h-48 overflow-y-auto">
                {config.weeks.map(w => (
                  <button key={w.weekId} onClick={() => switchWeek(w.weekId)}
                    className={cn("w-full text-left px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                      w.weekId === activeWeek?.weekId ? "text-primary bg-primary/5" : "text-slate-600 dark:text-slate-300")}>
                    {isEs ? (w.weekRangeEs || w.weekId) : (w.weekRangeEn || w.weekId)}
                  </button>
                ))}
                <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                  <button onClick={createWeek}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors">
                    + {lbl.newWeek}
                  </button>
                  {config.weeks.length > 1 && (
                    <button onClick={deleteWeek}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                      {lbl.deleteWeek}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Stop the one active timer without competing intervals. */}
          <button onClick={stopActive} disabled={!activeTimer}
            className={cn("shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all",
              activeTimer ? "bg-amber-500 active:scale-95" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed")}>
            <span className="material-symbols-outlined text-xl">{activeTimer ? "stop" : "timer"}</span>
          </button>
        </div>
        <div className="flex justify-end">
          <SaveStatus lbl={lbl} />
        </div>

        {/* Week info is catalog-driven; only the selector above changes weeks. */}
        <div className="text-center">
          <div className="space-y-0.5">
            <h2 className="text-lg md:text-xl font-black tracking-wide text-slate-800 dark:text-slate-100">{weekDisplay}</h2>
            {bibleReading && <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400">{bibleReading}</p>}
          </div>
        </div>
      </div>

      {/* ===== PROGRAM BODY ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-5 pt-3 pb-6 space-y-4">
        <TimerLegend isEs={isEs} lbl={lbl} accentColor={accentColor} />

        {/* Opening section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-1">
               <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2" style={{ color: accentColor }}>{lbl.chairman} ({prefs.chairmanExpectedCount} {lbl.expected}):</p>
              <input value={sections[0]?.assigneeName || ""}
                onChange={e => updateSection(sections[0]?.id ?? "", s => ({ ...s, assigneeName: e.target.value }))}
                placeholder="————" className="w-full bg-transparent text-sm italic text-slate-500 dark:text-slate-400 focus:outline-none border-b border-dashed border-slate-200 dark:border-slate-700 pb-0.5" />
            </div>
            <TimerButton role={null} label={lbl.timer}
               {...getTimerState(sections[0]?.id ?? "", null)}
               onClick={() => toggleTimer(sections[0]?.id ?? "", null)}
               onReset={() => resetTimer(sections[0]?.id ?? "", null)}
               actionLabels={lbl} />
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span>{lbl.song}</span>
            <span>{lbl.openingCmt} ({sections[0]?.duration ?? 1} {lbl.min})</span>
          </div>
        </div>

        {/* Main sections */}
        {(() => {
          let partNum = 1; let intIdx = 1; // skip opening (index 0)
          const cards: React.ReactNode[] = [];

          for (let i = 1; i < sections.length; i++) {
            const sec = sections[i];
            const grp = sec.group;
            const isGroup = sec.subsections.length > 0;
            const col = grp ? SECTION_COLORS[grp] : "#2B579A";
            const icon = grp ? SECTION_ICONS[grp] : null;
            const isConc = !isGroup && sec.titleEn?.toLowerCase().includes("concluding");

            if (isConc) {
              cards.push(
                <div key={sec.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-base font-bold text-slate-700 dark:text-slate-200">
                        {isEs ? (sec.titleEs || sec.titleEn) : (sec.titleEn || sec.titleEs)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sec.duration} {lbl.min} · ♫ {lbl.song}</p>
                    </div>
                     <TimerButton role={null} label={lbl.timer}
                       {...getTimerState(sec.id, null)}
                       onClick={() => toggleTimer(sec.id, null)}
                       onReset={() => resetTimer(sec.id, null)}
                       actionLabels={lbl} />
                  </div>
                </div>
              );
              intIdx++;
              continue;
            }

            if (isGroup && grp) {
              cards.push(
                <div key={sec.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface shadow-sm overflow-hidden">
                  {/* Group header */}
                  <div className="px-4 md:px-5 py-3 flex items-center gap-3 border-b bg-slate-50 dark:bg-slate-800/40" style={{ borderColor: col + "40" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: col }}>
                      <SectionIcon icon={icon} className="text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-black uppercase tracking-wide" style={{ color: col }}>
                        {isEs ? (sec.titleEs || sec.titleEn) : (sec.titleEn || sec.titleEs)}
                      </h3>
                    </div>
                    <button onClick={() => removeSection(sec.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                  {/* Subsections */}
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {sec.subsections.map(sub => {
                      const flatIdx = intIdx++; const num = partNum++;
                      const timerRoles = getTimerRoles(sub, grp);
                      return <InterventionRow key={sub.id} num={num} section={sub} color={col}
                         startTime={clock(startTimes[flatIdx] ?? 0)} endTime={clock(endTimes[flatIdx] ?? 0)} meetingStartMinute={startMinTotal} timerRoles={timerRoles}
                        getTimerState={getTimerState} isEs={isEs} lbl={lbl}
                        inlineId={inlineId} inlineField={inlineField}
                        onTap={() => { setInlineId(sub.id); setInlineField("title"); }}
                        onEditField={(f) => { setInlineId(sub.id); setInlineField(f); }}
                        onClose={() => setInlineId(null)}
                         onUpdate={(fn) => updateSection(sub.id, fn)}
                         onRemove={() => removeSection(sub.id)}
                         onToggleTimer={(role) => toggleTimer(sub.id, role)}
                         onResetTimer={(role) => resetTimer(sub.id, role)} />;
                    })}
                  </div>
                  {/* Add part */}
                  <button onClick={() => addSubsection(sec.id, grp)}
                    className="w-full py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors border-t border-slate-200 dark:border-slate-800">
                    + {lbl.addPart}
                  </button>
                </div>
              );
            } else {
              // Standalone section (no group)
              const flatIdx = intIdx++; const num = partNum++;
              const timerRoles = getTimerRoles(sec);
              cards.push(
                <InterventionRow key={sec.id} num={num} section={sec} color={col}
                   startTime={clock(startTimes[flatIdx] ?? 0)} endTime={clock(endTimes[flatIdx] ?? 0)} meetingStartMinute={startMinTotal} timerRoles={timerRoles}
                  getTimerState={getTimerState} isEs={isEs} lbl={lbl}
                  inlineId={inlineId} inlineField={inlineField}
                  onTap={() => { setInlineId(sec.id); setInlineField("title"); }}
                  onEditField={(f) => { setInlineId(sec.id); setInlineField(f); }}
                  onClose={() => setInlineId(null)}
                   onUpdate={(fn) => updateSection(sec.id, fn)}
                   onRemove={() => removeSection(sec.id)}
                   onToggleTimer={(role) => toggleTimer(sec.id, role)}
                   onResetTimer={(role) => resetTimer(sec.id, role)}
                   standalone />
              );
            }
          }
          return cards;
        })()}

        {/* Add section */}
        <button onClick={addTopSection}
          className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors text-center">
          + {isEs ? "Agregar Sección" : "Add Section"}
        </button>

        {/* Totals */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-1">
          {lbl.totalTime}: {totalMin} {lbl.min} · {clock(startMinTotal)} → {clock(startMinTotal + totalMin)}
        </p>
      </div>

      {/* ===== SESSION REVIEW ===== */}
      <SessionReview sessionLog={sessionLog} sessionHistory={sessionHistory} activeWeekId={activeWeek?.weekId ?? null} prefs={prefs} isEs={isEs} lbl={lbl}
        accentColor={accentColor} sectionColorFor={sectionColorFor}
        chairmanExpectedCount={prefs.chairmanExpectedCount} chairmanExpectedSeconds={prefs.chairmanExpectedSeconds}
        onDeleteLog={onDeleteLog} onUpdateLog={onUpdateLog} />
    </div>
  );
}

function isBibleReading(section: Pick<PresidingSection, "id" | "titleEn" | "titleEs">): boolean {
  const titles = [section.titleEn, section.titleEs].map((title) => title.trim().toLocaleLowerCase());
  return section.id === "def_reading" || titles.includes("bible reading") || titles.includes("lectura de la biblia");
}

function roleLabel(role: TimerRole | null, section: PresidingSection, lbl: typeof L.en): string {
  if (!role) return lbl.timer;
  if (isBibleReading(section)) return role === "assignee" ? lbl.reader : lbl.conductor;
  return role === "assignee" ? lbl.assignee : lbl.presiding;
}

function SaveStatus({ lbl }: { lbl: typeof L.en }) {
  const { status, error, isOnline, syncNow } = useSync();
  const hasPendingChanges = useStore((state) => state.syncMetadata.hasPendingChanges);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isError = mounted && status === "error";
  const isSaving = mounted && !isError && isOnline && (status === "syncing" || hasPendingChanges);
  const isOffline = mounted && !isOnline;
  const icon = isError ? "error" : isSaving ? "sync" : isOffline ? "cloud_off" : "cloud_done";
  const text = isError ? lbl.saveError : isSaving ? lbl.saving : isOffline ? lbl.offline : lbl.saved;

  return (
    <div role="status" aria-live="polite" title={isError ? (error ?? lbl.saveError) : text}
      className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold", isError ? "text-red-500" : isOffline ? "text-amber-600" : isSaving ? "text-primary" : "text-emerald-600")}>
      <span className={cn("material-symbols-outlined text-sm", isSaving && "animate-spin")}>{icon}</span>
      <span>{text}</span>
      {isError && (
        <button type="button" onClick={() => { void syncNow().catch(() => undefined); }}
          className="font-bold underline underline-offset-2 hover:text-red-700">{lbl.retry}</button>
      )}
    </div>
  );
}

function TimerButton({ role, label, elapsedSec, running, onClick, onReset, actionLabels }: {
  role: TimerRole | null; label: string; elapsedSec: number; running: boolean;
  onClick: () => void; onReset: () => void;
  actionLabels: Pick<typeof L.en, "start" | "resume" | "stop" | "reset" | "resetUnsaved">;
}) {
  const presiding = role === "presiding";
  const actionLabel = running ? actionLabels.stop : elapsedSec > 0 ? actionLabels.resume : actionLabels.start;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }}
        className={cn(
          "size-12 sm:size-14 rounded-full flex flex-col items-center justify-center gap-0 shadow-sm transition-all active:scale-95 shrink-0",
          running ? "bg-amber-500 text-black" : presiding ? "bg-violet-600" : "bg-primary",
          !running && (presiding ? "active:bg-violet-800" : "active:bg-primary/80"),
        )}
        aria-label={`${label} ${actionLabel}`} aria-pressed={running}>
        <span className="material-symbols-outlined text-xs sm:text-sm leading-none">{running ? "stop" : "play_arrow"}</span>
        <span className="font-mono text-[10px] sm:text-[11px] font-bold leading-none tabular-nums">{fmtTime(elapsedSec)}</span>
      </button>
      <button type="button" onClick={(event) => { event.stopPropagation(); onReset(); }}
        className="size-11 rounded-full border border-slate-200 bg-surface text-slate-400 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-500 active:scale-95 dark:border-slate-700 dark:hover:border-red-800 dark:hover:bg-red-950/20"
        aria-label={`${actionLabels.resetUnsaved}: ${label}`} title={actionLabels.resetUnsaved}>
        <span className="material-symbols-outlined text-base leading-none">restart_alt</span>
      </button>
    </div>
  );
}

function TimerLegend({ isEs, lbl, accentColor }: { isEs: boolean; lbl: typeof L.en; accentColor: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
      <span className="uppercase tracking-wider">{lbl.legend}</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-primary" />{isEs ? lbl.assigneeRole : lbl.assigneeRole}</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full" style={{ backgroundColor: accentColor }} />{isEs ? lbl.presidingRole : lbl.presidingRole}</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" />{lbl.activeRole}</span>
    </div>
  );
}

/* ---------- InterventionRow (card-based) ---------- */

function InterventionRow({
  num, section, color, startTime, endTime, meetingStartMinute, timerRoles, getTimerState, isEs, lbl,
  inlineId, inlineField, onTap, onEditField, onClose, onUpdate, onRemove, onToggleTimer, onResetTimer,
  standalone = false,
}: {
  num: number; section: PresidingSection; color: string; startTime: string; endTime: string; meetingStartMinute: number;
  timerRoles: TimerRole[];
  getTimerState: (sectionId: string, role: TimerRole | null) => { elapsedSec: number; running: boolean };
  isEs: boolean; lbl: typeof L.en;
  inlineId: string | null; inlineField: "title" | "assignee" | "duration" | "start" | "end" | null;
  onTap: () => void; onEditField: (f: "title" | "assignee" | "duration" | "start" | "end") => void;
  onClose: () => void; onUpdate: (fn: (s: PresidingSection) => PresidingSection) => void;
  onRemove: () => void; onToggleTimer: (role: TimerRole | null) => void; onResetTimer: (role: TimerRole | null) => void;
  standalone?: boolean;
}) {
  const isThisInline = inlineId === section.id;
  const title = isEs ? (section.titleEs || section.titleEn || "") : (section.titleEn || section.titleEs || "");
  const startOffset = section.scheduledStartMinute ?? 0;
  const endOffset = section.scheduledEndMinute ?? (startOffset + section.duration);
  const startInput = (() => {
    const minute = (meetingStartMinute + startOffset) % (24 * 60);
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  })();
  const endInput = (() => {
    const minute = (meetingStartMinute + endOffset) % (24 * 60);
    return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  })();

  const wrapperClass = standalone
    ? "rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface shadow-sm"
    : "";

  return (
    <div className={cn("group relative", wrapperClass)}>
      {isThisInline ? (
        /* INLINE EDIT MODE */
        <div className={cn("p-4 md:p-5 space-y-3", standalone ? "" : "px-4 md:px-5 py-3")}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{lbl.edit}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          {/* Field tabs */}
          <div className="flex gap-1 flex-wrap">
            {(["title", "assignee", "duration", "start", "end"] as const).map(f => (
              <button key={f} onClick={() => onEditField(f)}
                className={cn("rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                  inlineField === f ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
                   {f === "title" ? (isEs ? "ES/EN" : "EN/ES") : f === "assignee" ? (isEs ? "Nombre" : "Name") : f === "start" ? (isEs ? "Inicio" : "Start") : f === "end" ? lbl.end : lbl.min}
              </button>
            ))}
          </div>
          {/* Editor */}
          {inlineField === "duration" ? (
            <input type="number" min={1} max={120} value={section.duration}
              onChange={e => onUpdate(s => ({ ...s, duration: Math.max(1, parseInt(e.target.value) || 1) }))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
          ) : inlineField === "start" ? (
            <input type="time" value={startInput}
              onChange={e => {
                const [hours, minutes] = e.target.value.split(":").map(Number);
                if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
                const target = hours * 60 + minutes;
                const offset = (target - meetingStartMinute + 24 * 60) % (24 * 60);
                onUpdate(s => ({ ...s, scheduledStartMinute: offset }));
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
          ) : inlineField === "end" ? (
            <input type="time" value={endInput}
              onChange={e => {
                const [hours, minutes] = e.target.value.split(":").map(Number);
                if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
                const target = hours * 60 + minutes;
                const offset = (target - meetingStartMinute + 24 * 60) % (24 * 60);
                onUpdate(s => ({ ...s, scheduledEndMinute: Math.max(s.scheduledStartMinute ?? 0, offset) }));
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
          ) : inlineField === "assignee" ? (
            <input type="text" value={section.assigneeName}
              onChange={e => onUpdate(s => ({ ...s, assigneeName: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={isEs ? "Nombre del hermano/a" : "Brother/Sister name"} autoFocus />
          ) : (
            <div className="space-y-2">
              <input type="text" value={section.titleEn}
                onChange={e => onUpdate(s => ({ ...s, titleEn: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="English title" />
              <input type="text" value={section.titleEs}
                onChange={e => onUpdate(s => ({ ...s, titleEs: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Título en español" />
            </div>
          )}
          <button onClick={onRemove}
            className="w-full rounded-lg border border-red-200 dark:border-red-800 py-2 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            {lbl.remove}
          </button>
        </div>
      ) : (
        /* DISPLAY MODE */
        <div className={cn("flex items-center gap-3", standalone ? "p-4 md:p-5" : "px-4 md:px-5 py-3")}
          onDoubleClick={onTap}>
          <span className="font-bold text-sm shrink-0 w-6" style={{ color }}>{num}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-bold text-sm truncate" style={{ color }}>{title}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-semibold tabular-nums shrink-0 whitespace-nowrap">{startTime} → {endTime}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">{section.duration} {lbl.min}</span>
              {section.assigneeName && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-slate-500 dark:text-slate-400"
                  style={{ backgroundColor: color + "15" }}>
                  {section.assigneeName}
                </span>
              )}
            </div>
          </div>
          {/* Edit button — always visible */}
          <button onClick={(e) => { e.stopPropagation(); onTap(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
            title={lbl.edit}>
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <div className={cn("flex shrink-0 gap-1.5", timerRoles.length > 1 ? "flex-col sm:flex-row" : "")}>
            {timerRoles.map((role) => {
              const state = getTimerState(section.id, role);
              return <TimerButton key={role} role={role} label={roleLabel(role, section, lbl)} {...state}
                onClick={() => onToggleTimer(role)} onReset={() => onResetTimer(role)} actionLabels={lbl} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Session Review ---------- */

function LogEditor({ entry, lbl, chairmanExpectedCount, chairmanExpectedSeconds, onCancel, onSave }: {
  entry: TimerLogEntry; lbl: typeof L.en; chairmanExpectedCount: number; chairmanExpectedSeconds: number;
  onCancel: () => void; onSave: (patch: Partial<TimerLogEntry>) => void;
}) {
  const [role, setRole] = useState<TimerRole | "none">(entry.role ?? "none");
  const initialDurationSec = logDurationSec(entry);
  const [durationMinutes, setDurationMinutes] = useState(Math.floor(initialDurationSec / 60));
  const [durationSeconds, setDurationSeconds] = useState(initialDurationSec % 60);
  const [scheduledDurationMin, setScheduledDurationMin] = useState(entry.scheduledDurationMin);
  const save = () => {
    const durationSec = Math.max(0, Math.floor(durationMinutes)) * 60
      + Math.min(59, Math.max(0, Math.floor(durationSeconds)));
    const startMs = Date.parse(entry.actualStartISO);
    const actualEndISO = new Date(startMs + durationSec * 1000).toISOString();
    const overtimeLimitSec = role === "presiding" ? chairmanExpectedCount * 60 + chairmanExpectedSeconds : scheduledDurationMin * 60;
    onSave({
      role: role === "none" ? undefined : role,
      actualStartISO: entry.actualStartISO,
      actualEndISO,
      actualDurationSec: durationSec,
      actualDurationMin: Math.round(durationSec / 60),
      scheduledDurationMin,
      wasOvertime: durationSec > overtimeLimitSec,
    });
  };
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
      <label className="min-w-0 text-[11px] font-semibold">Role
        <select value={role} onChange={(event) => setRole(event.target.value as TimerRole | "none")} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700">
          <option value="none">{lbl.timer}</option><option value="assignee">{lbl.assignee}</option><option value="presiding">{lbl.conductor}</option>
        </select>
      </label>
      <label className="min-w-0 text-[11px] font-semibold">{lbl.min}
        <input type="number" min={0} max={240} value={scheduledDurationMin} onChange={(event) => setScheduledDurationMin(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700" />
      </label>
      <label className="min-w-0 text-[11px] font-semibold">{lbl.min} (actual)
        <input type="number" min={0} max={240} value={durationMinutes} onChange={(event) => setDurationMinutes(Math.max(0, Math.min(240, Number(event.target.value) || 0)))} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700" />
      </label>
      <label className="min-w-0 text-[11px] font-semibold">{lbl.seconds} (actual)
        <input type="number" min={0} max={59} value={durationSeconds} onChange={(event) => setDurationSeconds(Math.min(59, Math.max(0, Number(event.target.value) || 0)))} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700" />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" onClick={save} className="min-h-10 flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">{lbl.save}</button>
        <button type="button" onClick={onCancel} className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">{lbl.cancel}</button>
      </div>
    </div>
  );
}

function SessionReview({ sessionLog, sessionHistory, activeWeekId, prefs, isEs, lbl, accentColor, sectionColorFor, chairmanExpectedCount, chairmanExpectedSeconds, onDeleteLog, onUpdateLog }: {
  sessionLog: TimerLogEntry[]; sessionHistory: MeetingSession[]; activeWeekId: string | null; prefs: PresidingPrefs; isEs: boolean; lbl: typeof L.en;
  accentColor: string; sectionColorFor: (sectionId: string) => string;
  chairmanExpectedCount: number; chairmanExpectedSeconds: number;
  onDeleteLog?: (logId: string) => void;
  onUpdateLog?: (logId: string, patch: Partial<TimerLogEntry>) => void;
}) {
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const weekSessions = sessionHistory.filter((s) => s.weekId === activeWeekId);
  const reviewEntries = weekSessions.length > 0
    ? weekSessions.flatMap((session) => session.log.map((entry) => ({ entry, date: session.date })))
    : sessionLog.map((entry) => ({ entry, date: "" }));
  const roleName = (entry: TimerLogEntry) => {
    if (!entry.role) return lbl.timer;
    const bible = isBibleReading({ id: entry.sectionId, titleEn: entry.titleEn, titleEs: entry.titleEs });
    if (bible) return entry.role === "assignee" ? lbl.reader : lbl.conductor;
    return entry.role === "assignee" ? lbl.assignee : lbl.presiding;
  };
  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-surface/95 pb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:pb-0">
      {show && (
         <div id="session-review-log" className="min-h-0 max-h-[min(16rem,45vh)] sm:max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-5 pt-3 pb-2 space-y-2">
          {reviewEntries.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{lbl.logEmpty}</p>
          ) : (
             reviewEntries.map(({ entry, date }, i) => {
               const cf = (iso: string) => { const d = new Date(iso); return fmtClock(d.getHours() * 60 + d.getMinutes(), prefs.timeFormat === "24h"); };
               const editing = editingId === entry.id;
               const chairmanLimitSec = chairmanExpectedCount * 60 + chairmanExpectedSeconds;
               const durSec = logDurationSec(entry);
               const isOvertime = entry.wasOvertime || (entry.role === "presiding" && durSec > chairmanLimitSec);
               const limitSec = entry.role === "presiding" ? chairmanLimitSec : entry.scheduledDurationMin * 60;
               const overage = Math.max(0, durSec - limitSec);
               const chipColor = entry.role === "presiding" ? accentColor : sectionColorFor(entry.sectionId);
               return (
                 <div key={entry.id ?? `${date}-${entry.sectionId}-${i}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-canvas px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                   {editing && entry.id && onUpdateLog ? (
                     <LogEditor entry={entry} lbl={lbl} chairmanExpectedCount={prefs.chairmanExpectedCount} chairmanExpectedSeconds={prefs.chairmanExpectedSeconds} onCancel={() => setEditingId(null)} onSave={(patch) => { onUpdateLog(entry.id!, patch); setEditingId(null); }} />
                   ) : (
                     <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                       <span className="text-slate-500 dark:text-slate-400 text-[10px]">{i + 1}.</span>
                       <div className="min-w-0 break-words">{date && <span className="mr-2 text-[10px] text-slate-500 dark:text-slate-400">{date}</span>}<span>{isEs ? (entry.titleEs || entry.titleEn) : (entry.titleEn || entry.titleEs)}</span></div>
                       <div className="flex flex-wrap justify-end gap-1">
                         <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ color: chipColor, backgroundColor: chipColor + "15" }}>{roleName(entry)}</span>
                         {entry.id && onUpdateLog && <button type="button" onClick={() => setEditingId(entry.id!)} aria-label={`${lbl.editLog}: ${entry.titleEn}`} className="min-h-8 min-w-8 rounded-lg p-1 text-slate-400 hover:bg-primary/10 hover:text-primary"><span className="material-symbols-outlined text-base">edit</span></button>}
                         {onDeleteLog && entry.id && <button type="button" onClick={() => onDeleteLog(entry.id!)} aria-label={`${lbl.deleteLog}: ${entry.titleEn}`} className="min-h-8 min-w-8 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"><span className="material-symbols-outlined text-base">delete</span></button>}
                       </div>
                       <span className="col-span-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{cf(entry.actualStartISO)} - {cf(entry.actualEndISO)}</span>
                        <span className={cn("justify-self-end font-mono font-semibold", isOvertime ? "text-red-500" : "text-emerald-600")}>
                      {fmtTime(durSec)}{isOvertime ? ` (+${overage > 0 ? fmtTime(overage) : "0:00"})` : ""}
                        </span>
                     </div>
                   )}
                 </div>
              );
            })
          )}
         </div>
      )}
      <button type="button" onClick={() => setShow((current) => !current)} aria-expanded={show}
        aria-controls="session-review-log"
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 active:bg-slate-50 dark:active:bg-slate-800/50 sticky bottom-0 z-10 bg-surface/95">
        <span>⏱ {lbl.sessionLog} {reviewEntries.length > 0 && `(${reviewEntries.length})`}</span>
        <span className="text-slate-400 text-lg leading-none">{show ? "▲" : "▼"}</span>
      </button>
    </div>
  );
}

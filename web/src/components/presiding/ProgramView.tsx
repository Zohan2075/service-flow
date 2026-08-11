"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
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
  getJwWolWeekCatalogEntry,
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
      <svg viewBox="0 0 36 36" className={className} fill="currentColor">
        <path d="M11.983 3.562c4.543-.262 7.824 1.597 8.089 6.826.215 4.19-5.184 6.79-8.046 6.879-2.462.077-1.353-1.852.61-2.334 1.576-.387 4.124-2.413 3.602-4.44-.597-2.32-4.315-2.684-6.351.292-.798 1.167-3.554.873-4.096-.434-.958-2.309 1.211-6.502 6.192-6.789z" opacity=".6" />
        <path d="M35.75 21.384c0-7.783-4.495-11.407-14.519-11.407-1.087 0-2.083.051-3.018.137-1.36-2.423-4.845-2.828-8.213-2.828-4.304 0-10 6.145-10 10.839 0 4.608 3.606 4.866 7.811 4.874.233 3.245 1.226 5.647 3.249 7.26C11.337 31.409 12.594 36 15 36c1.353 0 2.099-1.695 2.51-3.417 1.128.136 2.359.209 3.722.209 1.733 0 3.288-.116 4.695-.335C26.017 34.114 26.458 36 28 36c2.317 0 4.273-4.956 4.834-6.521 1.969-1.87 2.916-4.545 2.916-8.095z" opacity=".85" />
        <circle cx="4.5" cy="15.786" r="1.5" />
        <path d="M17.562 4.339c4.312 1.455 5.74 4.148 4.034 9.099-1.367 3.967-7.345 4.361-10.034 3.375C9.25 15.964 11 14.589 13 14.875c1.606.23 4.727-.698 5-2.773C18.312 9.727 15 8 12 10c-1.177.785-5.774.43-5.5-.958.638-3.226 6.335-6.298 11.062-4.703z" opacity=".4" />
      </svg>
    );
  }
  if (icon === "wheat") {
    return (
      <svg viewBox="0 0 36 36" className={className} fill="currentColor">
        <path d="M21.388.62c-1.852 0-4.235 1.849-6.22 4.826-2.322 3.483-1.069 5.989-.062 8.002.155.31.459.517.805.549.029.001.059.003.089.003.313 0 .61-.147.8-.4 2.394-3.193 6.211-8.196 6.907-8.893C23.895 4.52 24 4.265 24 4 24 1.508 22.65.62 21.388.62zm2.378 8.995c-1.21 0-2.575 1.132-4.565 3.785-2.124 2.831-2.461 5.313-1.095 8.047.151.302.444.507.779.546.038.005.077.007.115.007.295 0 .577-.131.769-.359 1.719-2.063 5.173-6.168 5.938-6.934.188-.188.293-.442.293-.707 0-1.085 0-4.385-2.234-4.385z" opacity=".5" />
        <path d="M29.874 11.517c-.268-.482-.878-.654-1.359-.385-7.171 3.983-13.783 14.15-16.367 19.609.838-10.195 5.569-20.044 13.559-28.034.391-.391.391-1.023 0-1.414s-1.023-.391-1.414 0C16.33 9.256 11.466 19.01 10.288 29.174c-.674-5.697-.978-13.91 1.625-19.768.225-.505-.003-1.096-.507-1.32-.505-.226-1.096.003-1.32.507-1.326 2.983-1.945 6.501-2.162 10.009C7.04 16.718 6.001 15 4.472 15h-.046c-.91 0-1.691.466-2.321 1.726-.247.494-.047.922.447 1.169.495.248 1.095.046 1.342-.447.311-.622.525-.77.521-.792.636.196 1.744 2.696 2.162 3.642.196.443.374.842.527 1.15.148.296.425.478.728.529.026 4.957.698 9.53 1.163 12.091l.02.11c.088.483.509.822.984.822.059 0 .119-.005.179-.016.122-.023.231-.071.331-.132.147.086.308.148.491.148s.344-.062.492-.147c.144.085.302.147.482.147H12c.53 0 .971-.448 1-.98.057-1.037 2.494-6.014 6.143-11.043.104-.015.207-.033.305-.082.244-.122.517-.272.808-.433.934-.517 2.494-1.38 3.106-1.02.149.088.638.535.638 2.558 0 .553.447 1 1 1s1-.447 1-1c0-2.236-.53-3.636-1.622-4.28-.783-.461-1.668-.424-2.54-.174 2.32-2.714 4.938-5.165 7.647-6.67.484-.269.658-.876.389-1.359z" opacity=".85" />
      </svg>
    );
  }
  return <span className={cn("material-symbols-outlined", className)}>{icon}</span>;
}

const L = {
  en: {
    chairman: "CHAIRMAN", song: "Song & Prayer", openingCmt: "Opening Comments",
    min: "min.", addPart: "Add Part", done: "Done",
    namePlaceholder: "Name", remove: "Remove", removeConfirm: "Remove this part?",
    master: "Active timer", current: "Now", start: "Start", pause: "Pause",
    resume: "Resume", reset: "Reset", skip: "Next", timer: "Timer",
    assignee: "Assignee", presiding: "Presiding", reader: "Reader", conductor: "Conductor",
    stop: "Stop",
    overtime: "Overtime", complete: "Complete", restart: "Restart",
     totalTime: "Total", sessionLog: "Session Log", logEmpty: "No parts timed yet.", end: "End", editLog: "Edit log", deleteLog: "Delete log", save: "Save", cancel: "Cancel",
    noSections: "No parts. Reset in Settings.", 
    weekLabel: "Week", newWeek: "New Week", deleteWeek: "Delete Week",
    deleteWeekConfirm: "Delete this week's program?",
    congrats: "Congregation Bible Study", concluding: "Concluding Comments", edit: "Edit",
    legend: "Timer legend", activeRole: "Active", assigneeRole: "Assignee / Reader", presidingRole: "Presiding / Conductor",
  },
  es: {
    chairman: "PRESIDENTE", song: "Canción y Oración", openingCmt: "Palabras de introducción",
    min: "min.", addPart: "Agregar Parte", done: "Listo",
    namePlaceholder: "Nombre", remove: "Eliminar", removeConfirm: "¿Eliminar esta parte?",
    master: "Temporizador activo", current: "Ahora", start: "Iniciar", pause: "Pausar",
    resume: "Reanudar", reset: "Reiniciar", skip: "Sig.", timer: "Temporizador",
    assignee: "Asignado", presiding: "Presidente", reader: "Lector", conductor: "Conductor",
    stop: "Detener",
    overtime: "Excedido", complete: "Completa", restart: "Reiniciar",
     totalTime: "Total", sessionLog: "Registro", logEmpty: "Aún no se ha medido ninguna parte.", end: "Fin", editLog: "Editar registro", deleteLog: "Eliminar registro", save: "Guardar", cancel: "Cancelar",
    noSections: "No hay partes. Restablecer en Configuración.",
    weekLabel: "Semana", newWeek: "Nueva Semana", deleteWeek: "Eliminar Semana",
    deleteWeekConfirm: "¿Eliminar el programa de esta semana?",
    congrats: "Estudio Bíblico de la Congregación", concluding: "Palabras de conclusión", edit: "Editar",
    legend: "Leyenda de temporizadores", activeRole: "Activo", assigneeRole: "Asignado / Lector", presidingRole: "Presidente / Conductor",
  },
};

/* ---------- ascending role timers ---------- */

interface TimerRecord {
  elapsedSec: number;
  startedAtISO: string | null;
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

function useProgramTimers(sections: PresidingSection[], onLog: (entry: TimerLogEntry) => void) {
  const flat = useMemo(() => flattenAll(sections), [sections]);
  const [records, setRecords] = useState<Record<string, TimerRecord>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const recordsR = useRef<Record<string, TimerRecord>>({});
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
    const current = recordsR.current[active.key] ?? { elapsedSec: 0, startedAtISO: active.startedAtISO };
    const elapsedSec = Math.max(0, Math.floor((Date.now() - active.startedAtMs) / 1000));
    commitRecords({ ...recordsR.current, [active.key]: { ...current, elapsedSec } });
  }, [commitRecords]);

  const finalizeActive = useCallback(() => {
    const active = activeR.current;
    if (!active) return;
    stopInterval();
    const elapsedSec = Math.max(0, Math.floor((Date.now() - active.startedAtMs) / 1000));
    const next = {
      ...recordsR.current,
      [active.key]: { elapsedSec, startedAtISO: active.startedAtISO },
    };
    activeR.current = null;
    setActiveKey(null);
    commitRecords(next);
    onLog({
      sectionId: active.sectionId,
      titleEn: active.titleEn,
      titleEs: active.titleEs,
      scheduledDurationMin: active.scheduledDurationMin,
      actualStartISO: active.startedAtISO,
      actualEndISO: new Date().toISOString(),
      actualDurationMin: Math.round(elapsedSec / 60),
      actualDurationSec: elapsedSec,
      role: active.role ?? undefined,
      wasOvertime: elapsedSec > active.scheduledDurationMin * 60,
    });
  }, [commitRecords, onLog, stopInterval]);

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
    commitRecords({
      ...recordsR.current,
      [key]: { elapsedSec: 0, startedAtISO: active.startedAtISO },
    });
    setActiveKey(key);
    intvR.current = setInterval(refreshActive, 1000);
  }, [commitRecords, finalizeActive, flat, refreshActive]);

  useEffect(() => () => stopInterval(), [stopInterval]);

  const getTimerState = useCallback((sectionId: string, role: TimerRole | null) => {
    const key = timerKey(sectionId, role);
    return {
      elapsedSec: records[key]?.elapsedSec ?? 0,
      running: activeKey === key,
    };
  }, [activeKey, records]);

  const activeItem = activeR.current ? flat.find((item) => item.sectionId === activeR.current?.sectionId) : null;
  const activeTimer = activeR.current && activeItem ? {
    ...activeR.current,
    titleEn: activeItem.titleEn,
    titleEs: activeItem.titleEs,
    elapsedSec: records[activeR.current.key]?.elapsedSec ?? 0,
  } : null;

  return { getTimerState, toggleTimer, stopActive: finalizeActive, activeTimer };
}

/* ---------- main component ---------- */

interface Props {
  lang: "en" | "es"; config: PresidingConfig; prefs: PresidingPrefs;
  sessionLog: TimerLogEntry[]; sessionHistory?: MeetingSession[]; onConfigChange: (cfg: PresidingConfig) => void; onLogEntry: (entry: TimerLogEntry) => void;
   onDeleteLog?: (logId: string) => void;
  onUpdateLog?: (logId: string, patch: Partial<TimerLogEntry>) => void;
}

export default function ProgramView({ lang, config, prefs, sessionLog, sessionHistory = [], onConfigChange, onLogEntry, onDeleteLog, onUpdateLog }: Props) {
  const isEs = lang === "es"; const lbl = L[lang];

  const activeWeek = useMemo(() =>
    config?.weeks?.find((w) => w.weekId === config.activeWeekId) ?? config?.weeks?.[0], [config]);
  const sections = activeWeek?.sections ?? [];
  const catalogEntry = activeWeek ? getJwWolWeekCatalogEntry(activeWeek.weekId) : undefined;
  const weekRangeEn = catalogEntry?.weekRangeEn ?? activeWeek?.weekRangeEn ?? "";
  const weekRangeEs = catalogEntry?.weekRangeEs ?? activeWeek?.weekRangeEs ?? "";
  const bibleReading = catalogEntry?.bibleReading ?? activeWeek?.bibleReading ?? "";

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
    const id = `w${Date.now()}`;
    onConfigChange({ weeks: [...config.weeks, { ...def, weekId: id }], activeWeekId: id });
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

  const timer = useProgramTimers(sections, onLogEntry);
  const { getTimerState, toggleTimer, stopActive, activeTimer } = timer;

  if (sections.length === 0) {
    return <div className="flex items-center justify-center h-full"><p className="text-sm text-slate-500">{lbl.noSections}</p></div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-canvas overflow-hidden">
      {/* ===== HEADER: Week selector + info ===== */}
      <div className="shrink-0 px-4 pt-4 pb-2 space-y-3">
        {/* Week selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <button onClick={() => setShowWeekMenu(!showWeekMenu)}
              className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-surface px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span className="truncate">{lbl.weekLabel}: {weekDisplay || activeWeek?.weekId}</span>
              <span className="material-symbols-outlined text-base text-slate-400">{showWeekMenu ? "expand_less" : "expand_more"}</span>
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

        {/* Week info is catalog-driven; only the selector above changes weeks. */}
        <div className="text-center">
          <div className="space-y-0.5">
            <h2 className="text-lg font-black tracking-wide text-slate-800 dark:text-slate-100">{weekDisplay}</h2>
            {bibleReading && <p className="text-[11px] font-semibold tracking-wider text-slate-400">{bibleReading}</p>}
          </div>
        </div>
      </div>

      {/* ===== ACTIVE TIMER BAR ===== */}
      {activeTimer && (
        <div className="shrink-0 sticky top-0 z-40 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-surface/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500 animate-pulse" />
            <div className="text-center shrink-0 min-w-[3.5rem]">
              <p className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">{lbl.master}</p>
              <p className="font-mono text-sm font-bold tabular-nums">{fmtTime(activeTimer.elapsedSec)}</p>
            </div>
            <div className="flex-1 min-w-0 text-center">
              <p className="text-[8px] uppercase tracking-wider font-bold truncate text-emerald-600">{lbl.current}</p>
              <p className="font-mono text-xs font-bold tabular-nums truncate text-slate-700 dark:text-slate-200">
                {isEs ? (activeTimer.titleEs || activeTimer.titleEn) : (activeTimer.titleEn || activeTimer.titleEs)}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-500">
              {activeTimer.role ? (activeTimer.role === "assignee" ? lbl.assignee : lbl.presiding) : lbl.timer}
            </span>
            <button onClick={stopActive} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black active:scale-95">{lbl.stop}</button>
          </div>
        </div>
      )}

      {/* ===== PROGRAM BODY ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-6 space-y-4">
        <TimerLegend isEs={isEs} lbl={lbl} />

        {/* Opening section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{lbl.chairman}:</p>
              <input value={sections[0]?.assigneeName || ""}
                onChange={e => updateSection(sections[0]?.id ?? "", s => ({ ...s, assigneeName: e.target.value }))}
                placeholder="————" className="w-full bg-transparent text-sm italic text-slate-500 dark:text-slate-400 focus:outline-none border-b border-dashed border-slate-200 dark:border-slate-700 pb-0.5" />
            </div>
            <TimerButton role={null} label={lbl.timer}
              {...getTimerState(sections[0]?.id ?? "", null)}
              onClick={() => toggleTimer(sections[0]?.id ?? "", null)} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {isEs ? (sec.titleEs || sec.titleEn) : (sec.titleEn || sec.titleEs)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{sec.duration} {lbl.min} · ♫ {lbl.song}</p>
                    </div>
                    <TimerButton role={null} label={lbl.timer}
                      {...getTimerState(sec.id, null)}
                      onClick={() => toggleTimer(sec.id, null)} />
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
                  <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: col + "40" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: col }}>
                      <SectionIcon icon={icon} className="text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: col }}>
                        {isEs ? (sec.titleEs || sec.titleEn) : (sec.titleEn || sec.titleEs)}
                      </h3>
                    </div>
                    <button onClick={() => removeSection(sec.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors shrink-0">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                  {/* Subsections */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
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
                        onToggleTimer={(role) => toggleTimer(sub.id, role)} />;
                    })}
                  </div>
                  {/* Add part */}
                  <button onClick={() => addSubsection(sec.id, grp)}
                    className="w-full py-2 text-center text-xs font-medium text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors border-t border-slate-100 dark:border-slate-800">
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
                  standalone />
              );
            }
          }
          return cards;
        })()}

        {/* Add section */}
        <button onClick={addTopSection}
          className="w-full rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-3 text-sm font-medium text-slate-400 hover:border-primary hover:text-primary transition-colors text-center">
          + {isEs ? "Agregar Sección" : "Add Section"}
        </button>

        {/* Totals */}
        <p className="text-center text-xs text-slate-400 pt-1">
          {lbl.totalTime}: {totalMin} {lbl.min} · {clock(startMinTotal)} → {clock(startMinTotal + totalMin)}
        </p>
      </div>

      {/* ===== SESSION REVIEW ===== */}
      <SessionReview sessionLog={sessionLog} sessionHistory={sessionHistory} prefs={prefs} isEs={isEs} lbl={lbl}
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

function TimerButton({ role, label, elapsedSec, running, onClick }: {
  role: TimerRole | null; label: string; elapsedSec: number; running: boolean;
  onClick: () => void;
}) {
  const presiding = role === "presiding";
  return (
    <button onClick={(event) => { event.stopPropagation(); onClick(); }}
      className={cn(
        "size-12 sm:size-14 rounded-full flex flex-col items-center justify-center gap-0 shadow-sm transition-all active:scale-95 shrink-0",
        running ? "bg-amber-500 text-black" : presiding ? "bg-violet-600" : "bg-primary",
        !running && (presiding ? "active:bg-violet-800" : "active:bg-primary/80"),
      )}
      aria-label={`${label} ${running ? "stop" : "start"}`}>
      <span className="material-symbols-outlined text-xs sm:text-sm leading-none">{running ? "stop" : "play_arrow"}</span>
      <span className="font-mono text-[9px] sm:text-[10px] font-bold leading-none tabular-nums">{fmtTime(elapsedSec)}</span>
    </button>
  );
}

function TimerLegend({ isEs, lbl }: { isEs: boolean; lbl: typeof L.en }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px] font-semibold text-slate-400">
      <span className="uppercase tracking-wider">{lbl.legend}</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-primary" />{isEs ? lbl.assigneeRole : lbl.assigneeRole}</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-violet-600" />{isEs ? lbl.presidingRole : lbl.presidingRole}</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" />{lbl.activeRole}</span>
    </div>
  );
}

/* ---------- InterventionRow (card-based) ---------- */

function InterventionRow({
  num, section, color, startTime, endTime, meetingStartMinute, timerRoles, getTimerState, isEs, lbl,
  inlineId, inlineField, onTap, onEditField, onClose, onUpdate, onRemove, onToggleTimer,
  standalone = false,
}: {
  num: number; section: PresidingSection; color: string; startTime: string; endTime: string; meetingStartMinute: number;
  timerRoles: TimerRole[];
  getTimerState: (sectionId: string, role: TimerRole | null) => { elapsedSec: number; running: boolean };
  isEs: boolean; lbl: typeof L.en;
  inlineId: string | null; inlineField: "title" | "assignee" | "duration" | "start" | "end" | null;
  onTap: () => void; onEditField: (f: "title" | "assignee" | "duration" | "start" | "end") => void;
  onClose: () => void; onUpdate: (fn: (s: PresidingSection) => PresidingSection) => void;
  onRemove: () => void; onToggleTimer: (role: TimerRole | null) => void;
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
        <div className={cn("p-4 space-y-3", standalone ? "" : "px-4 py-3")}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{lbl.edit}</span>
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
        <div className={cn("flex items-center gap-3", standalone ? "p-4" : "px-4 py-3")}
          onDoubleClick={onTap}>
          <span className="font-bold text-sm shrink-0 w-6" style={{ color }}>{num}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-bold text-sm truncate" style={{ color }}>{title}</span>
               <span className="text-[10px] text-slate-400 font-mono shrink-0 whitespace-nowrap">{startTime} → {endTime}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{section.duration} {lbl.min}</span>
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
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
            title={lbl.edit}>
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <div className={cn("flex shrink-0 gap-1.5", timerRoles.length > 1 ? "flex-col sm:flex-row" : "")}>
            {timerRoles.map((role) => {
              const state = getTimerState(section.id, role);
              return <TimerButton key={role} role={role} label={roleLabel(role, section, lbl)} {...state}
                onClick={() => onToggleTimer(role)} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Session Review ---------- */

function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function LogEditor({ entry, lbl, onCancel, onSave }: {
  entry: TimerLogEntry; lbl: typeof L.en;
  onCancel: () => void; onSave: (patch: Partial<TimerLogEntry>) => void;
}) {
  const [role, setRole] = useState<TimerRole | "none">(entry.role ?? "none");
  const [start, setStart] = useState(toLocalDateTimeInput(entry.actualStartISO));
  const [end, setEnd] = useState(toLocalDateTimeInput(entry.actualEndISO));
  const [scheduledDurationMin, setScheduledDurationMin] = useState(entry.scheduledDurationMin);
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
      <label className="min-w-0 text-[11px] font-semibold">Role
        <select value={role} onChange={(event) => setRole(event.target.value as TimerRole | "none")} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700">
          <option value="none">{lbl.timer}</option><option value="assignee">{lbl.assignee}</option><option value="presiding">{lbl.presiding}</option>
        </select>
      </label>
      <label className="min-w-0 text-[11px] font-semibold">{lbl.min}
        <input type="number" min={0} max={240} value={scheduledDurationMin} onChange={(event) => setScheduledDurationMin(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700" />
      </label>
      <label className="min-w-0 text-[11px] font-semibold">Start
        <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700" />
      </label>
      <label className="min-w-0 text-[11px] font-semibold">{lbl.end}
        <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-surface px-2 py-2 text-sm dark:border-slate-700" />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" onClick={() => onSave({ role: role === "none" ? undefined : role, actualStartISO: fromLocalDateTimeInput(start), actualEndISO: fromLocalDateTimeInput(end), scheduledDurationMin })} className="min-h-10 flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">{lbl.save}</button>
        <button type="button" onClick={onCancel} className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">{lbl.cancel}</button>
      </div>
    </div>
  );
}

function SessionReview({ sessionLog, sessionHistory, prefs, isEs, lbl, onDeleteLog, onUpdateLog }: {
  sessionLog: TimerLogEntry[]; sessionHistory: MeetingSession[]; prefs: PresidingPrefs; isEs: boolean; lbl: typeof L.en;
  onDeleteLog?: (logId: string) => void;
  onUpdateLog?: (logId: string, patch: Partial<TimerLogEntry>) => void;
}) {
  const [show, setShow] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const reviewEntries = sessionHistory.length > 0
    ? sessionHistory.flatMap((session) => session.log.map((entry) => ({ entry, date: session.date })))
    : sessionLog.map((entry) => ({ entry, date: "" }));
  const roleName = (entry: TimerLogEntry) => {
    if (!entry.role) return lbl.timer;
    const bible = isBibleReading({ id: entry.sectionId, titleEn: entry.titleEn, titleEs: entry.titleEs });
    if (bible) return entry.role === "assignee" ? lbl.reader : lbl.conductor;
    return entry.role === "assignee" ? lbl.assignee : lbl.presiding;
  };
  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-surface/95 pb-safe-mobile">
      <button type="button" onClick={() => setShow((current) => !current)} aria-expanded={show}
        aria-controls="session-review-log"
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 active:bg-slate-50 dark:active:bg-slate-800/50 sticky bottom-0 z-10 bg-surface/95">
        <span>⏱ {lbl.sessionLog} {reviewEntries.length > 0 && `(${reviewEntries.length})`}</span>
        <span className="text-slate-400 text-lg leading-none">{show ? "▲" : "▼"}</span>
      </button>
      {show && (
         <div id="session-review-log" className="min-h-0 max-h-[min(28rem,55vh)] overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-5 pb-5 space-y-2">
          {reviewEntries.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">{lbl.logEmpty}</p>
          ) : (
             reviewEntries.map(({ entry, date }, i) => {
               const cf = (iso: string) => { const d = new Date(iso); return fmtClock(d.getHours() * 60 + d.getMinutes(), prefs.timeFormat === "24h"); };
               const editing = editingId === entry.id;
               return (
                 <div key={entry.id ?? `${date}-${entry.sectionId}-${i}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-canvas px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                   {editing && entry.id && onUpdateLog ? (
                     <LogEditor entry={entry} lbl={lbl} onCancel={() => setEditingId(null)} onSave={(patch) => { onUpdateLog(entry.id!, patch); setEditingId(null); }} />
                   ) : (
                     <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                       <span className="text-slate-400 text-[10px]">{i + 1}.</span>
                       <div className="min-w-0 break-words">{date && <span className="mr-2 text-[10px] text-slate-400">{date}</span>}<span>{isEs ? (entry.titleEs || entry.titleEn) : (entry.titleEn || entry.titleEs)}</span></div>
                       <div className="flex flex-wrap justify-end gap-1">
                         <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-500">{roleName(entry)}</span>
                         {entry.id && onUpdateLog && <button type="button" onClick={() => setEditingId(entry.id!)} aria-label={`${lbl.editLog}: ${entry.titleEn}`} className="min-h-8 min-w-8 rounded-lg p-1 text-slate-400 hover:bg-primary/10 hover:text-primary"><span className="material-symbols-outlined text-base">edit</span></button>}
                         {onDeleteLog && entry.id && <button type="button" onClick={() => onDeleteLog(entry.id!)} aria-label={`${lbl.deleteLog}: ${entry.titleEn}`} className="min-h-8 min-w-8 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"><span className="material-symbols-outlined text-base">delete</span></button>}
                       </div>
                       <span className="col-span-2 font-mono text-[11px] text-slate-400">{cf(entry.actualStartISO)} - {cf(entry.actualEndISO)}</span>
                       <span className={cn("justify-self-end font-mono font-semibold", entry.wasOvertime ? "text-red-500" : "text-emerald-600")}>
                      {fmtTime(entry.actualDurationSec ?? Math.max(0, entry.actualDurationMin * 60))}{entry.wasOvertime ? ` (+${Math.max(0, (entry.actualDurationSec ?? entry.actualDurationMin * 60) - entry.scheduledDurationMin * 60) > 0 ? fmtTime(Math.max(0, (entry.actualDurationSec ?? entry.actualDurationMin * 60) - entry.scheduledDurationMin * 60)) : "0:00"})` : ""}
                       </span>
                     </div>
                   )}
                 </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

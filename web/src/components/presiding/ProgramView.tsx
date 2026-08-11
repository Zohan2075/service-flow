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
    totalTime: "Total", sessionLog: "Session Log", logEmpty: "No parts timed yet.",
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
    totalTime: "Total", sessionLog: "Registro", logEmpty: "Aún no se ha medido ninguna parte.",
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
}

export default function ProgramView({ lang, config, prefs, sessionLog, sessionHistory = [], onConfigChange, onLogEntry, onDeleteLog }: Props) {
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
  const [inlineField, setInlineField] = useState<"title" | "assignee" | "duration" | "start" | null>(null);

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

  let legacyOffset = 0; const startTimes: number[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (s.subsections.length > 0) {
      for (const sub of s.subsections) {
        const offset = sub.scheduledStartMinute ?? legacyOffset;
        startTimes.push(startMinTotal + offset);
        legacyOffset = Math.max(legacyOffset, offset + sub.duration);
      }
    } else {
      const offset = s.scheduledStartMinute ?? legacyOffset;
      startTimes.push(startMinTotal + offset);
      legacyOffset = Math.max(legacyOffset, offset + s.duration);
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
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-canvas">
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
                      <span className="material-symbols-outlined text-sm">{icon}</span>
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
                         startTime={clock(startTimes[flatIdx] ?? 0)} meetingStartMinute={startMinTotal} timerRoles={timerRoles}
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
                  startTime={clock(startTimes[flatIdx] ?? 0)} meetingStartMinute={startMinTotal} timerRoles={timerRoles}
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
        onDeleteLog={onDeleteLog} />
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
        "size-14 rounded-full flex flex-col items-center justify-center gap-0.5 text-white shadow-sm transition-all active:scale-95 shrink-0",
        running ? "bg-amber-500 text-black" : presiding ? "bg-violet-600 hover:bg-violet-700" : "bg-primary hover:bg-primary/90",
      )}
      aria-label={`${label} ${running ? "stop" : "start"}`}>
      <span className="material-symbols-outlined text-sm leading-none">{running ? "stop" : "play_arrow"}</span>
      <span className="font-mono text-[10px] font-bold leading-none tabular-nums">{fmtTime(elapsedSec)}</span>
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
  num, section, color, startTime, meetingStartMinute, timerRoles, getTimerState, isEs, lbl,
  inlineId, inlineField, onTap, onEditField, onClose, onUpdate, onRemove, onToggleTimer,
  standalone = false,
}: {
  num: number; section: PresidingSection; color: string; startTime: string; meetingStartMinute: number;
  timerRoles: TimerRole[];
  getTimerState: (sectionId: string, role: TimerRole | null) => { elapsedSec: number; running: boolean };
  isEs: boolean; lbl: typeof L.en;
  inlineId: string | null; inlineField: "title" | "assignee" | "duration" | "start" | null;
  onTap: () => void; onEditField: (f: "title" | "assignee" | "duration" | "start") => void;
  onClose: () => void; onUpdate: (fn: (s: PresidingSection) => PresidingSection) => void;
  onRemove: () => void; onToggleTimer: (role: TimerRole | null) => void;
  standalone?: boolean;
}) {
  const isThisInline = inlineId === section.id;
  const title = isEs ? (section.titleEs || section.titleEn || "") : (section.titleEn || section.titleEs || "");
  const startOffset = section.scheduledStartMinute ?? 0;
  const startInput = (() => {
    const minute = (meetingStartMinute + startOffset) % (24 * 60);
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
            {(["title", "assignee", "duration", "start"] as const).map(f => (
              <button key={f} onClick={() => onEditField(f)}
                className={cn("rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                  inlineField === f ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
                  {f === "title" ? (isEs ? "ES/EN" : "EN/ES") : f === "assignee" ? (isEs ? "Nombre" : "Name") : f === "start" ? (isEs ? "Inicio" : "Start") : lbl.min}
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
              <span className="text-[10px] text-slate-400 font-mono shrink-0">{startTime}</span>
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

function SessionReview({ sessionLog, sessionHistory, prefs, isEs, lbl, onDeleteLog }: {
  sessionLog: TimerLogEntry[]; sessionHistory: MeetingSession[]; prefs: PresidingPrefs; isEs: boolean; lbl: typeof L.en;
  onDeleteLog?: (logId: string) => void;
}) {
  const [show, setShow] = useState(true);
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
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-surface/70">
      <button type="button" onClick={() => setShow((current) => !current)} aria-expanded={show}
        aria-controls="session-review-log"
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <span>⏱ {lbl.sessionLog} {sessionLog.length > 0 && `(${sessionLog.length})`}</span>
        <span className="text-slate-400">{show ? "▲" : "▼"}</span>
      </button>
      {show && (
        <div id="session-review-log" className="min-h-0 max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain px-5 pb-5 space-y-2">
          {reviewEntries.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">{lbl.logEmpty}</p>
          ) : (
            reviewEntries.map(({ entry, date }, i) => {
              const cf = (iso: string) => { const d = new Date(iso); return fmtClock(d.getHours() * 60 + d.getMinutes(), prefs.timeFormat === "24h"); };
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-canvas px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                   <span className="w-5 text-slate-400 text-[10px]">{i + 1}.</span>
                   {date && <span className="text-[10px] text-slate-400">{date}</span>}
                   <span className="min-w-0 flex-1 basis-[10rem] truncate">{isEs ? (entry.titleEs || entry.titleEn) : (entry.titleEn || entry.titleEs)}</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-500">{roleName(entry)}</span>
                  <span className="font-mono text-slate-400">{cf(entry.actualStartISO)} - {cf(entry.actualEndISO)}</span>
                   <span className={cn("font-mono font-semibold", entry.wasOvertime ? "text-red-500" : "text-emerald-600")}>
                     {fmtTime(entry.actualDurationSec ?? Math.max(0, entry.actualDurationMin * 60))}{entry.wasOvertime ? ` (+${Math.max(0, (entry.actualDurationSec ?? entry.actualDurationMin * 60) - entry.scheduledDurationMin * 60) > 0 ? fmtTime(Math.max(0, (entry.actualDurationSec ?? entry.actualDurationMin * 60) - entry.scheduledDurationMin * 60)) : "0:00"})` : ""}
                   </span>
                   {onDeleteLog && entry.id && (
                     <button onClick={(e) => { e.stopPropagation(); onDeleteLog(entry.id!); }}
                       className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                       title="Delete log">
                       <span className="material-symbols-outlined text-[14px]">close</span>
                     </button>
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

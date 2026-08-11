"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "./AppProvider";
import { Section, SectionGroup, TimerStatus } from "@/types";
import { loadConfig, saveConfig } from "@/lib/storage";
import { getDefaultConfig, createSection, totalDuration } from "@/lib/meeting";

/* ---------- JW section colors (matching wol.jw.org exactly) ---------- */

const GROUP_META: Record<string, { icon: string; color: string }> = {
  treasures: { icon: "\u{1F4D6}", color: "#2B579A" },       // Blue + gem icon
  fieldMinistry: { icon: "\u{1F465}", color: "#B8761F" },    // Brown/orange + person icon
  living: { icon: "\u{1F3E0}", color: "#8B3A2E" },          // Dark red + church icon
};

/* ---------- flatten ---------- */

interface FlatSection {
  sectionId: string; parentId: string | null;
  titleEn: string; titleEs: string; assigneeName: string;
  durationSec: number; group: SectionGroup;
  flatIdx: number;
}

function flattenAll(sections: Section[]): FlatSection[] {
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

function fmtClock(totalMinutes: number, is24: boolean = true): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  if (is24) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function makeFmtClock(is24: boolean) {
  return (totalMinutes: number) => fmtClock(totalMinutes, is24);
}

/* ---------- timer hook ---------- */

function useTimer(sections: Section[]) {
  const flat = flattenAll(sections);
  const totalSec = flat.reduce((s, f) => s + f.durationSec, 0);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [masterDisplay, setMasterDisplay] = useState(totalSec);
  const [sectionDisplay, setSectionDisplay] = useState(flat[0]?.durationSec ?? 0);
  const masterR = useRef(totalSec); const sectionR = useRef(flat[0]?.durationSec ?? 0);
  const idxR = useRef(0); const lastTickR = useRef(0);
  const intvR = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoR = useRef(false);
  const setAuto = (v: boolean) => { autoR.current = v; };
  const stopTimer = () => { if (intvR.current) { clearInterval(intvR.current); intvR.current = null; } };

  const tick = useCallback(() => {
    const now = Date.now();
    const elapsed = lastTickR.current ? now - lastTickR.current : 1000;
    const ticks = Math.max(1, Math.round(elapsed / 1000));
    lastTickR.current = now;
    let m = masterR.current - ticks; let s = sectionR.current - ticks; let i = idxR.current;
    if (s <= 0 && i < flat.length - 1) {
      if (autoR.current) { i++; s = flat[i].durationSec + s; idxR.current = i; }
      else { s = 0; setStatus("finished"); masterR.current = m; sectionR.current = s;
        setMasterDisplay(m); setSectionDisplay(s); setCurrentIdx(i); stopTimer(); return; }
    }
    if (m <= 0) { m = 0; s = 0; setStatus("finished"); stopTimer(); }
    masterR.current = m; sectionR.current = s; idxR.current = i;
    setMasterDisplay(m); setSectionDisplay(s); setCurrentIdx(i);
    if (status !== "finished") {
      if (s <= 0 && i >= flat.length - 1) setStatus("finished");
      else if (s < 0) setStatus("overtime");
      else if (s <= 60) setStatus("warning");
      else setStatus("running");
    }
  }, [flat, status]);

  const start = useCallback(() => {
    if (flat.length === 0) return;
    if (status === "finished") {
      masterR.current = totalSec; sectionR.current = flat[0].durationSec; idxR.current = 0;
      setMasterDisplay(totalSec); setSectionDisplay(flat[0].durationSec); setCurrentIdx(0);
    }
    setStatus("running"); lastTickR.current = Date.now(); intvR.current = setInterval(tick, 1000);
  }, [flat, status, totalSec, tick]);

  const pause = useCallback(() => { setStatus("paused"); stopTimer(); }, []);
  const resetAll = useCallback(() => {
    stopTimer();
    masterR.current = totalSec; sectionR.current = flat[0]?.durationSec ?? 0; idxR.current = 0;
    setMasterDisplay(totalSec); setSectionDisplay(flat[0]?.durationSec ?? 0); setCurrentIdx(0);
    setStatus("idle"); lastTickR.current = 0;
  }, [totalSec, flat]);

  const goTo = useCallback((flatIdx: number, autoStart = false) => {
    if (flatIdx < 0 || flatIdx >= flat.length) return;
    stopTimer();
    let remaining = 0;
    for (let k = flatIdx; k < flat.length; k++) remaining += flat[k].durationSec;
    masterR.current = remaining; sectionR.current = flat[flatIdx].durationSec; idxR.current = flatIdx;
    setMasterDisplay(remaining); setSectionDisplay(flat[flatIdx].durationSec); setCurrentIdx(flatIdx);
    if (autoStart) { setStatus("running"); lastTickR.current = Date.now(); intvR.current = setInterval(tick, 1000); }
    else setStatus("idle");
  }, [flat, tick]);

  const skip = useCallback(() => {
    if (idxR.current >= flat.length - 1) { resetAll(); return; }
    const ni = idxR.current + 1;
    const wr = status === "running" || status === "warning" || status === "overtime";
    sectionR.current = flat[ni].durationSec; idxR.current = ni;
    setSectionDisplay(flat[ni].durationSec); setCurrentIdx(ni);
    if (wr) { setStatus("running"); lastTickR.current = Date.now(); }
    else setStatus("idle");
  }, [flat, status, resetAll]);

  useEffect(() => () => stopTimer(), []);
  useEffect(() => {
    if (status === "idle") {
      masterR.current = totalSec; sectionR.current = flat[0]?.durationSec ?? 0;
      setMasterDisplay(totalSec); setSectionDisplay(flat[0]?.durationSec ?? 0); setCurrentIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const current = flat[currentIdx] ?? null;
  const progress = totalSec > 0 ? Math.min(((totalSec - masterDisplay) / totalSec) * 100, 100) : 0;
  return { status, currentIdx, current, masterDisplay, sectionDisplay, progress, totalSec, flat, start, pause, reset: resetAll, skip, setAuto, goTo };
}

/* ---------- main component ---------- */

export default function PresidingSheet() {
  const { t } = useTranslation();
  const { prefs } = useApp();
  const isEs = prefs.language === "es";
  const fmt = makeFmtClock(prefs.timeFormat === "24h");

  const [sections, setSections] = useState<Section[]>(() => getDefaultConfig().sections);
  const [weekRangeEn, setWeekRangeEn] = useState("AUGUST 3-9");
  const [weekRangeEs, setWeekRangeEs] = useState("3-9 DE AGOSTO");
  const [bibleReading, setBibleReading] = useState("JEREMIAH 22, 23");
  const [mounted, setMounted] = useState(false);

  const [editingWeek, setEditingWeek] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<"titleEn" | "titleEs" | "duration" | "assignee">("titleEn");

  useEffect(() => {
    const saved = loadConfig();
    setWeekRangeEn(saved.weekRangeEn);
    setWeekRangeEs(saved.weekRangeEs);
    setBibleReading(saved.bibleReading);
    setSections(saved.sections);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) saveConfig({ weekRangeEn, weekRangeEs, bibleReading, sections });
  }, [mounted, weekRangeEn, weekRangeEs, bibleReading, sections]);

  const timer = useTimer(sections);
  useEffect(() => { timer.setAuto(prefs.autoAdvance); }, [prefs.autoAdvance, timer]);

  const updateSection = (id: string, fn: (s: Section) => Section) => {
    setSections(prev => {
      const walk = (list: Section[]): Section[] => list.map(s => {
        if (s.id === id) return fn({ ...s });
        if (s.subsections.some(sub => sub.id === id)) return { ...s, subsections: walk(s.subsections) };
        return s;
      });
      return walk(prev);
    });
  };
  const removeSection = (id: string) => {
    if (!window.confirm(t("program.removeConfirm"))) return;
    setSections(prev => {
      const walk = (list: Section[]): Section[] => list.filter(s => s.id !== id).map(s => ({
        ...s, subsections: s.subsections.some(sub => sub.id === id) ? s.subsections.filter(sub => sub.id !== id) : walk(s.subsections),
      }));
      return walk(prev);
    });
    if (editingId === id) setEditingId(null);
  };
  const addSubsection = (parentId: string, group: SectionGroup) => {
    setSections(prev => prev.map(s => s.id === parentId ? { ...s, subsections: [...s.subsections, createSection("", "", 5, group)] } : s));
  };
  const addTopSection = () => setSections(prev => [...prev, createSection("", "", 10)]);

  let editingSection: Section | null = null;
  if (editingId) {
    for (const s of sections) {
      if (s.id === editingId) { editingSection = s; break; }
      for (const sub of s.subsections) { if (sub.id === editingId) { editingSection = sub; break; } }
      if (editingSection) break;
    }
  }

  const weekDisplay = isEs ? (weekRangeEs || weekRangeEn) : (weekRangeEn || weekRangeEs);
  const totalMin = totalDuration(sections);

  // Calculate start times for each intervention
  const startTimes: number[] = []; // minutes from start
  const startMinTotal = prefs.meetingStartHour * 60 + prefs.meetingStartMinute;
  let acc = 0;
  for (const s of sections) {
    if (s.subsections.length > 0) {
      for (const sub of s.subsections) {
        startTimes.push(startMinTotal + acc);
        acc += sub.duration;
      }
    } else {
      startTimes.push(startMinTotal + acc);
      acc += s.duration;
    }
  }

  if (!mounted) {
    return (
      <div className="flex flex-col">
        <div className="pt-4 pb-2 -mx-4 px-5 text-center">
          <h2 className="text-xl font-black tracking-widest">{weekDisplay}</h2>
          <p className="text-sm font-bold tracking-wider opacity-70 mt-0.5">{bibleReading}</p>
        </div>
        <div className="px-5 py-8 text-center text-muted-foreground text-sm">Cargando...</div>
      </div>
    );
  }

  if (sections.length === 0) {
    return <p className="text-muted-foreground text-center py-12 text-sm">{t("program.noSections")}</p>;
  }

  const { status, currentIdx, current, masterDisplay, sectionDisplay, progress, flat, start, pause, reset, skip, goTo } = timer;
  const statusClass = status === "overtime" ? "text-danger" : status === "warning" ? "text-warning" : "";
  const isRunning = status === "running" || status === "warning" || status === "overtime";
  const isFinished = status === "finished";
  const isIdle = status === "idle";

  return (
    <div className="flex flex-col gap-0">
      {/* ===== WEEK HEADER ===== */}
      <div className="pt-4 pb-3 -mx-4 px-5">
        {editingWeek ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="text" value={weekRangeEn} onChange={e => setWeekRangeEn(e.target.value)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm font-bold tracking-wide bg-card focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="text" value={weekRangeEs} onChange={e => setWeekRangeEs(e.target.value)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm font-bold bg-card focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <input type="text" value={bibleReading} onChange={e => setBibleReading(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-center text-sm font-bold bg-card focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={() => setEditingWeek(false)} className="w-full text-xs font-bold text-primary touch-target py-1">{t("program.done")}</button>
          </div>
        ) : (
          <div className="text-center cursor-pointer" onClick={() => setEditingWeek(true)}>
            <h2 className="text-xl font-black tracking-widest">{weekDisplay}</h2>
            <p className="text-sm font-bold tracking-wider opacity-70 mt-0.5">{bibleReading}</p>
          </div>
        )}
      </div>

      {/* ===== TOP TIMER BAR (compact, only when running/paused) ===== */}
      {(isRunning || status === "paused" || isFinished) && (
        <div className={`sticky top-[49px] z-40 -mx-4 px-4 py-2 border-b border-border bg-background/95 backdrop-blur ${
          status === "overtime" ? "bg-danger/5" : status === "warning" ? "bg-warning/5" : ""
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isRunning ? "animate-pulse" : ""}`}
              style={{ backgroundColor: isFinished ? "#22c55e" : (current?.group ? GROUP_META[current.group]?.color : "#2B579A") }} />
            <div className="text-center flex-shrink-0">
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">{t("timer.master")}</p>
              <p className="font-mono text-sm font-bold tabular-nums">{fmtTime(Math.max(masterDisplay, 0))}</p>
            </div>
            {current && (
              <div className="flex-1 min-w-0 text-center px-2">
                <p className="text-[8px] uppercase tracking-wider font-bold truncate" style={{ color: current.group ? GROUP_META[current.group]?.color : undefined }}>{t("timer.current")}</p>
                <p className="font-mono text-sm font-bold tabular-nums truncate" style={{ color: current.group ? GROUP_META[current.group]?.color : undefined }}>
                  {isEs ? (current.titleEs || current.titleEn) : (current.titleEn || current.titleEs)}
                </p>
              </div>
            )}
            <div className="flex gap-1 flex-shrink-0">
              {isFinished ? (
                <button onClick={start} className="touch-target rounded-lg bg-[#2B579A] px-3 py-1.5 text-xs font-bold text-white active:scale-95">{t("timer.restart")}</button>
              ) : isIdle ? (
                <button onClick={start} className="touch-target rounded-lg bg-[#2B579A] px-3 py-1.5 text-xs font-bold text-white active:scale-95">{t("timer.start")}</button>
              ) : status === "paused" ? (
                <button onClick={start} className="touch-target rounded-lg bg-[#2B579A] px-3 py-1.5 text-xs font-bold text-white active:scale-95">{t("timer.resume")}</button>
              ) : (
                <button onClick={pause} className="touch-target rounded-lg bg-warning px-3 py-1.5 text-xs font-bold text-black active:scale-95">{t("timer.pause")}</button>
              )}
              {isRunning && <button onClick={skip} className="touch-target rounded-lg border border-border px-2 py-1.5 text-xs font-medium active:scale-95">{t("timer.skip")}</button>}
              <button onClick={reset} className="touch-target rounded-lg border border-danger/30 px-2 py-1.5 text-xs font-medium text-danger active:scale-95">{t("timer.reset")}</button>
            </div>
          </div>
          <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${progress >= 90 ? "bg-danger" : progress >= 70 ? "bg-warning" : "bg-[#2B579A]"}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* ===== PROGRAM BODY (JW workbook layout) ===== */}
      <div className="pt-3 pb-6">
        {/* Opening: Chairman + song/prayer + opening comments */}
        <div className="px-5 pb-3 border-b border-border/60">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("program.meetingChairman")}:</p>
          <p className="text-sm italic text-muted-foreground min-h-[18px] mt-0.5">
            {sections[0]?.assigneeName || "\u2014\u2014\u2014\u2014"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1.5 flex justify-between">
            <span>{t("program.song")} &amp; {t("program.prayer")}</span>
            <span>{t("program.openingComments")} ({sections[0]?.duration ?? 1} {t("program.minAbbr")})</span>
          </p>
        </div>

        {/* Main sections + their interventions */}
        <div>
          {(() => {
            let partNumber = 1;
            const elements: React.ReactNode[] = [];
            let interventionIdx = 0; // index into startTimes array

            for (let i = 1; i < sections.length; i++) {
              const section = sections[i];
              const meta = section.group ? GROUP_META[section.group] : null;
              const isGroup = section.subsections.length > 0;

              if (isGroup && meta) {
                // Section header (JW style: icon box + colored title + underline)
                elements.push(
                  <div key={section.id} className="mt-5">
                    <div className="flex items-center gap-2.5 px-5 py-2">
                      <div className="w-6 h-6 rounded-sm flex items-center justify-center text-white text-sm flex-shrink-0" style={{ backgroundColor: meta.color }}>
                        {meta.icon}
                      </div>
                      <h3 className="text-base font-black uppercase tracking-wide" style={{ color: meta.color }}>
                        {isEs ? (section.titleEs || section.titleEn) : (section.titleEn || section.titleEs)}
                      </h3>
                    </div>
                    <div className="mx-5 border-b mb-2" style={{ borderColor: meta.color, opacity: 0.4 }} />

                    {/* Interventions (numbered, with play button on the right) */}
                    {section.subsections.map(sub => {
                      const flatIdx = interventionIdx;
                      const isActive = flatIdx === currentIdx;
                      const isPast = flatIdx < currentIdx;
                      const num = partNumber++;
                      const startT = startTimes[flatIdx] ?? 0;
                      const endT = startT + sub.duration;
                      const isRunningHere = isActive && isRunning;

                      interventionIdx++;

                      return (
                        <div key={sub.id} className="px-5 py-2.5">
                          {/* Title row: number + title + play button on right */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className={`font-bold text-sm ${isPast ? "opacity-50" : ""}`} style={{ color: meta.color }}>
                                  {num}.
                                </span>
                                <span className={`font-bold text-sm ${isPast ? "line-through opacity-50" : ""}`} style={{ color: meta.color }}>
                                  {isEs ? (sub.titleEs || sub.titleEn) : (sub.titleEn || sub.titleEs)}
                                </span>
                                {/* Start time */}
                                <span className="text-[10px] text-muted-foreground font-mono tabular-nums ml-1">
                                  {fmt(startT)}
                                </span>
                                {/* Active timer inline */}
                                {isActive && (
                                  <span className={`ml-1 font-mono text-base font-bold tabular-nums ${statusClass}`} style={{ color: statusClass ? undefined : meta.color }}>
                                    {status === "overtime" ? `+${fmtTime(Math.abs(sectionDisplay))}` : fmtTime(Math.max(sectionDisplay, 0))}
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 ml-1 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">({sub.duration} {t("program.minAbbr")})</span>
                                {sub.assigneeName && <span className="text-[10px] text-muted-foreground">| {sub.assigneeName}</span>}
                              </div>
                            </div>

                            {/* Play button on the right */}
                            <button
                              onClick={(e) => { e.stopPropagation();
                                if (isActive && isRunning) pause();
                                else goTo(flatIdx, true);
                              }}
                              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm shadow-sm active:scale-90 transition-transform"
                              style={{ backgroundColor: isPast ? "#94a3b8" : meta.color }}
                              aria-label={isActive && isRunning ? "pause" : "play"}
                            >
                              {isPast ? "\u2713" : isActive && isRunning ? "\u23F8" : "\u25B6"}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add subsection */}
                    <button onClick={() => addSubsection(section.id, section.group)}
                      className="ml-12 mt-1 mb-2 touch-target rounded px-2 py-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
                      + {t("program.addPart")}
                    </button>
                  </div>
                );
              } else {
                // Standalone (e.g., Concluding Comments)
                const flatIdx = interventionIdx;
                interventionIdx++;
                const isActive = flatIdx === currentIdx;
                const isPast = flatIdx < currentIdx;
                const isConclusion = section.titleEn.toLowerCase().includes("concluding");

                if (isConclusion) {
                  elements.push(
                    <div key={section.id} className="px-5 pt-4 pb-2 border-t border-border/40 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold">
                            {isEs ? (section.titleEs || section.titleEn) : (section.titleEn || section.titleEs)} ({section.duration} {t("program.minAbbr")})
                          </p>
                          {section.assigneeName && <p className="text-[10px] text-muted-foreground">{section.assigneeName}</p>}
                        </div>
                        <button onClick={() => goTo(flatIdx, true)}
                          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm shadow-sm active:scale-90"
                          style={{ backgroundColor: "#2B579A" }}>
                          {"\u25B6"}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                        <span>{"\u266B"}</span> {t("program.song")} &amp; {t("program.prayer")}
                      </p>
                    </div>
                  );
                  continue;
                }

                const num = partNumber++;
                const startT = startTimes[flatIdx] ?? 0;
                elements.push(
                  <div key={section.id} className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="font-bold text-sm" style={{ color: meta?.color || "#2B579A" }}>{num}.</span>
                          <span className="font-bold text-sm" style={{ color: meta?.color || "#2B579A" }}>
                            {isEs ? (section.titleEs || section.titleEn) : (section.titleEn || section.titleEs)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono tabular-nums ml-1">{fmt(startT)}</span>
                        </div>
                        <div className="mt-0.5 ml-1 flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">({section.duration} {t("program.minAbbr")})</span>
                          {section.assigneeName && <span className="text-[10px] text-muted-foreground">| {section.assigneeName}</span>}
                        </div>
                      </div>
                      <button onClick={() => goTo(flatIdx, true)}
                        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm shadow-sm active:scale-90"
                        style={{ backgroundColor: meta?.color || "#2B579A" }}>
                        {"\u25B6"}
                      </button>
                    </div>
                  </div>
                );
              }
            }
            return elements;
          })()}
        </div>

        {/* Add section */}
        <button onClick={addTopSection}
          className="touch-target rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-[#2B579A] hover:text-[#2B579A] transition-colors mt-4"
          style={{ width: "calc(100% - 2.5rem)", marginLeft: "1.25rem" }}>
          + {t("program.addSection")}
        </button>

        <p className="text-center text-xs text-muted-foreground pt-3 px-5">
          {t("program.totalTime")}: {totalMin} {t("program.minAbbr")} | {fmt(startMinTotal)} - {fmt(startMinTotal + totalMin)}
        </p>
      </div>

      {/* ===== EDIT MODAL ===== */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditingId(null)}>
          <div className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border border-border p-5 space-y-3 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{t("program.edit")}</h3>
              <button onClick={() => setEditingId(null)} className="touch-target rounded-lg px-3 py-1 text-sm font-medium hover:bg-muted">{t("program.done")}</button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["titleEn", "titleEs", "duration", "assignee"] as const).map(f => (
                <button key={f} onClick={() => setEditField(f)}
                  className={`touch-target rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    editField === f ? "bg-[#2B579A] text-white" : "bg-muted text-muted-foreground"
                  }`}>
                  {f === "titleEn" ? "EN" : f === "titleEs" ? "ES" : f === "duration" ? t("program.minAbbr") : t("program.namePlaceholder")}
                </button>
              ))}
            </div>
            {editField === "duration" ? (
              <input type="number" min="1" max="120" value={editingSection.duration}
                onChange={e => updateSection(editingSection.id, s => ({ ...s, duration: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-lg text-center focus:outline-none focus:ring-2 focus:ring-[#2B579A]" autoFocus />
            ) : editField === "assignee" ? (
              <input type="text" value={editingSection.assigneeName}
                onChange={e => updateSection(editingSection.id, s => ({ ...s, assigneeName: e.target.value }))}
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-[#2B579A]"
                placeholder={t("program.namePlaceholder")} autoFocus />
            ) : (
              <input type="text"
                value={editField === "titleEn" ? editingSection.titleEn : editingSection.titleEs}
                onChange={e => updateSection(editingSection.id, s => editField === "titleEn" ? { ...s, titleEn: e.target.value } : { ...s, titleEs: e.target.value })}
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-[#2B579A]"
                placeholder={editField === "titleEn" ? "English title" : "Título en español"} autoFocus />
            )}
            <button onClick={() => { removeSection(editingSection.id); setEditingId(null); }}
              className="w-full touch-target rounded-xl border border-danger/30 py-3 text-sm font-medium text-danger hover:bg-danger/5 transition-colors">
              {t("program.remove")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
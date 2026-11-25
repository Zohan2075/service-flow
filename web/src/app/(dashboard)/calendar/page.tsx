"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getWeek,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { useStore } from "@/lib/store";
import { isoWeekKey, isInterestedPersonCompleted } from "@/lib/isoWeek";
import { calendarDateKey, computeDurationSeconds, durationDisplay, isPlannedEntry, isUnitsEntry } from "@/types/data";
import type {
  TimeEntry,
  ServiceType,
  CalendarDay,
  InterestedPerson,
  DayMoveMode,
  DayMoveResult,
} from "@/types/data";
import { cn, capProgressColor } from "@/lib/utils";
import { useT, monthYear, shortDate, weekdayLabels as getWeekdayLabels } from "@/lib/i18n";
import { useSync } from "@/lib/sync";
import AddEntryModal from "@/components/entries/AddEntryModal";
import toast from "react-hot-toast";
import { motion } from "motion/react";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { SPRING_SOFT, StaggerGroup, StaggerItem } from "@/components/ui/motion";

const InterestedPersonModal = dynamic(
  () => import("@/components/interested/InterestedPersonModal"),
  { ssr: false }
);

/* ─── Day drag & drop (desktop) ───────────────────────────────────────────── */

interface DayDragSession {
  pointerId: number;
  fromKey: string;
  entries: TimeEntry[];
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  active: boolean;
  overKey: string | null;
  mode: DayMoveMode;
  scrollRaf: number | null;
  moveHandler: (event: PointerEvent) => void;
  upHandler: (event: PointerEvent) => void;
  cancelHandler: () => void;
  keyHandler: (event: KeyboardEvent) => void;
  modifierHandler: (event: KeyboardEvent) => void;
}

interface DayDragView {
  fromKey: string;
  overKey: string | null;
  mode: DayMoveMode;
  count: number;
  summary: string;
  dateLabel: string;
  initialX: number;
  initialY: number;
}

interface KeyboardDrag {
  fromKey: string;
  overKey: string;
}

/** Parses `YYYY-MM-DD` as a local calendar date (never UTC). */
function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/* ─── Day plan-state badge (plan / mixed / no plan) ──────────────────────── */

function DayPlanBadge({
  state,
  regularCount,
}: {
  state: "plan" | "mixed" | "none";
  regularCount: number;
}) {
  const { t } = useT();
  const base =
    "inline-flex shrink-0 items-center justify-center gap-0.5 rounded-full px-0.5 py-0.5 text-[9px] font-black uppercase tracking-wide md:gap-1 md:px-1.5";
  const labelClass = "hidden md:inline";

  if (state === "plan") {
    return (
      <span
        title={t("calendar.planOnly")}
        className={cn(base, "bg-amber-500/15 text-amber-700 dark:text-amber-300")}
      >
        <span className="material-symbols-outlined text-[11px] leading-none">flag</span>
        <span className={labelClass}>{t("calendar.plannedShort")}</span>
      </span>
    );
  }

  if (state === "mixed") {
    return (
      <span
        title={t("calendar.planMixed")}
        className={cn(base, "bg-amber-500/10 text-slate-600 dark:text-slate-300")}
      >
        <span className="flex items-center gap-0.5">
          <span className="size-1.5 rounded-full bg-amber-400" />
          <span className="size-1.5 rounded-full bg-primary" />
        </span>
        <span className={labelClass}>
          {t("calendar.plannedShort")} +{regularCount}
        </span>
      </span>
    );
  }

  return (
    <span
      title={t("calendar.noPlan")}
      className={cn(base, "bg-slate-500/10 text-slate-500 dark:text-slate-400")}
    >
      <span className="material-symbols-outlined text-[11px] leading-none">remove</span>
      <span className={labelClass}>{t("calendar.noPlan")}</span>
    </span>
  );
}

export default function CalendarPage() {
  const { t, language } = useT();
  const { syncNow, isOnline } = useSync();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editingInterestedPerson, setEditingInterestedPerson] = useState<InterestedPerson | null>(null);
  const [viewMode, setViewMode] = useState<"monthly" | "weekly">("monthly");

  // Day-level drag & drop (desktop pointer + keyboard).
  const moveDay = useStore((s) => s.moveDay);
  const undoDayMove = useStore((s) => s.undoDayMove);
  const [dragView, setDragView] = useState<DayDragView | null>(null);
  const [keyboardDrag, setKeyboardDrag] = useState<KeyboardDrag | null>(null);
  const [justMovedKey, setJustMovedKey] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const dragRef = useRef<DayDragSession | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLDivElement>());
  const suppressClickRef = useRef(false);
  const undoRef = useRef<{ result: DayMoveResult; toastId: string; timeout: number } | null>(null);
  const liveTimerRef = useRef<number | null>(null);
  const undoLastMoveRef = useRef<() => void>(() => {});

  const currentDate = useStore((s) => s.uiState.viewedMonth);
  const setViewedMonth = useStore((s) => s.setViewedMonth);
  const goToPreviousViewedMonth = useStore((s) => s.goToPreviousViewedMonth);
  const goToNextViewedMonth = useStore((s) => s.goToNextViewedMonth);
  const goToToday = useStore((s) => s.goToToday);

  const timeEntries = useStore((s) => s.timeEntries);
  const serviceTypes = useStore((s) => s.serviceTypes);
  const ensureDefaultServiceType = useStore((s) => s.ensureDefaultServiceType);
  const planModeEnabled = useStore((s) => s.settings.planModeEnabled);
  const monthlyCapEnabled = useStore((s) => s.settings.monthlyCapEnabled);
  const monthlyCapHours = useStore((s) => s.settings.monthlyCapHours);
  const weekStartsOnSetting = useStore((s) => s.settings.weekStartsOn);
  const deleteTimeEntry = useStore((s) => s.deleteTimeEntry);
  const interestedPeople = useStore((s) => s.interestedPeople);
  const interestedStatuses = useStore((s) => s.interestedStatuses);

  useEffect(() => {
    if (serviceTypes.length === 0) {
      ensureDefaultServiceType();
    }
  }, [ensureDefaultServiceType, serviceTypes.length]);

  useEffect(() => {
    if (isSameMonth(selectedDate, currentDate)) {
      return;
    }

    const lastDayOfMonth = endOfMonth(currentDate).getDate();
    setSelectedDate(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        Math.min(selectedDate.getDate(), lastDayOfMonth)
      )
    );
  }, [currentDate, selectedDate]);

  const serviceTypeMap = useMemo(
    () => Object.fromEntries(serviceTypes.map((st) => [st.id, st])),
    [serviceTypes]
  );

  const rawCalendarMap: Record<string, CalendarDay> = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(
          timeEntries.reduce<Record<string, TimeEntry[]>>((grouped, entry) => {
            const date = calendarDateKey(entry.start_time);
            (grouped[date] ??= []).push(entry);
            return grouped;
          }, {})
        ).map(([date, entries]) => {
          const sortedEntries = [...entries].sort((a, b) => a.start_time.localeCompare(b.start_time));
          const totalDurationSeconds = sortedEntries
            .filter((e) => !isUnitsEntry(e) && !isPlannedEntry(e))
            .reduce(
              (sum, entry) => sum + computeDurationSeconds(entry),
              0
            );
          const plannedDurationSeconds = sortedEntries
            .filter((e) => !isUnitsEntry(e) && isPlannedEntry(e))
            .reduce(
              (sum, entry) => sum + computeDurationSeconds(entry),
              0
            );
          const totalUnits = sortedEntries
            .filter((e) => isUnitsEntry(e) && !isPlannedEntry(e))
            .reduce(
              (sum, entry) => sum + (entry.units_quantity ?? 0),
              0
            );
          const plannedUnits = sortedEntries
            .filter((e) => isUnitsEntry(e) && isPlannedEntry(e))
            .reduce(
              (sum, entry) => sum + (entry.units_quantity ?? 0),
              0
            );

          return [
            date,
            {
              date,
              entries: sortedEntries,
              total_duration_seconds: totalDurationSeconds,
              total_duration_display: durationDisplay(totalDurationSeconds),
              total_units: totalUnits,
              planned_duration_seconds: plannedDurationSeconds,
              planned_duration_display: durationDisplay(plannedDurationSeconds),
              planned_units: plannedUnits,
            } satisfies CalendarDay,
          ];
        })
      ),
    [timeEntries]
  );

  const calendarMap: Record<string, CalendarDay> = useMemo(() => {
    if (planModeEnabled) {
      return rawCalendarMap;
    }

    return Object.fromEntries(
      Object.entries(rawCalendarMap).map(([date, day]) => [
        date,
        {
          ...day,
          entries: day.entries.filter((entry) => !isPlannedEntry(entry)),
          planned_duration_seconds: 0,
          planned_duration_display: "0m",
          planned_units: 0,
        } satisfies CalendarDay,
      ])
    );
  }, [planModeEnabled, rawCalendarMap]);

  const weekStartsOn = weekStartsOnSetting === "monday" ? 1 : 0;
  const firstWeekContainsDate = weekStartsOn === 1 ? 4 : 1;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

  const weekdayLabels = useMemo(
    () => getWeekdayLabels(language, weekStartsOnSetting === "monday"),
    [weekStartsOnSetting, language]
  );

  const calendarWeeks = useMemo(() => {
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return Array.from({ length: Math.ceil(calendarDays.length / 7) }, (_, index) => {
      const weekDays = calendarDays.slice(index * 7, index * 7 + 7);

      return {
        weekNumber: getWeek(weekDays[0], {
          weekStartsOn,
          firstWeekContainsDate,
        }),
        days: weekDays,
      };
    });
  }, [calendarEnd, calendarStart, firstWeekContainsDate, weekStartsOn]);

  // Compute weeks for ANY month (used for swipe carousel adjacent months)
  const computeWeeks = (monthDate: Date) => {
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const gStart = startOfWeek(mStart, { weekStartsOn });
    const gEnd = endOfWeek(mEnd, { weekStartsOn });
    const days = eachDayOfInterval({ start: gStart, end: gEnd });
    return Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => {
      const weekDays = days.slice(i * 7, i * 7 + 7);
      return {
        weekNumber: getWeek(weekDays[0], { weekStartsOn, firstWeekContainsDate }),
        days: weekDays,
      };
    });
  };

  // Render a full month grid for any month — used for current + swipe-adjacent months
  const renderMonthGrid = (monthDate: Date, weeks: { weekNumber: number; days: Date[] }[]) => (
    <div className="bg-surface shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden rounded-2xl shrink-0 w-full">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 md:grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]">
        <div className="hidden items-center justify-center border-r border-slate-100 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800 md:flex md:py-3 md:text-xs">
          {t("calendar.wk")}
        </div>
        {weekdayLabels.map((d) => (
          <div
            key={d}
            className="border-r border-slate-100 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 last:border-r-0 dark:border-slate-800 md:py-3 md:text-xs"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Cells */}
      <div>
        {weeks.map(({ weekNumber, days }) => (
          <div
            key={weekNumber + days[0].toISOString()}
            className="grid grid-cols-7 md:grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]"
          >
            <div className="hidden items-center justify-center border-r border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 md:flex md:text-xs">
              {weekNumber}
            </div>
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayData = calendarMap[key];
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDay = isToday(day);
              const isCurrentMonthDay = isSameMonth(day, monthDate);
              const entriesCount = dayData?.entries.length ?? 0;
              const plannedCount = dayData
                ? dayData.entries.filter((entry) => isPlannedEntry(entry)).length
                : 0;
              const regularCount = entriesCount - plannedCount;
              const planState: "empty" | "plan" | "mixed" | "none" =
                entriesCount === 0
                  ? "empty"
                  : plannedCount === 0
                    ? "none"
                    : regularCount === 0
                      ? "plan"
                      : "mixed";
              const showPlanState = planModeEnabled && planState !== "empty";
              const badgeState: "plan" | "mixed" | "none" =
                planState === "plan" ? "plan" : planState === "mixed" ? "mixed" : "none";
              const stateSurface = !showPlanState
                ? ""
                : planState === "plan"
                  ? "bg-amber-50/70 dark:bg-amber-950/20"
                  : planState === "mixed"
                    ? "bg-gradient-to-br from-amber-500/15 via-transparent to-primary/15"
                    : "";
              const hasEntries = entriesCount > 0;
              const countLabel = (count: number) =>
                `${count} ${count === 1 ? t("calendar.entryWord") : t("calendar.entriesWord")}`;
              const stateAria = !planModeEnabled
                ? countLabel(entriesCount)
                : planState === "empty"
                  ? countLabel(0)
                  : planState === "plan"
                    ? `${t("calendar.planOnly")} · ${countLabel(plannedCount)}`
                    : planState === "mixed"
                      ? `${t("calendar.planMixed")} · ${plannedCount} ${t("calendar.plannedShort")}, ${countLabel(regularCount)}`
                      : `${t("calendar.noPlan")} · ${countLabel(regularCount)}`;
              const dragSourceKey = dragView ? dragView.fromKey : keyboardDrag?.fromKey ?? null;
              const dragTargetKey = dragView ? dragView.overKey : keyboardDrag?.overKey ?? null;
              const isDragSource = dragSourceKey === key;
              const isDragOver = dragTargetKey === key;
              const isInvalidTarget = isDragOver && dragSourceKey === key;
              const cursorClass = isInvalidTarget
                ? "cursor-not-allowed"
                : isDragOver
                  ? "cursor-grabbing"
                  : hasEntries
                    ? "cursor-grab"
                    : "cursor-pointer";

              return (
                <div
                  key={key}
                  ref={(element) => {
                    if (element) cellRefs.current.set(key, element);
                    else cellRefs.current.delete(key);
                  }}
                  data-day-key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`${shortDate(day, language)} — ${stateAria}`}
                  title={hasEntries ? t("calendar.dragHint") : undefined}
                  onClick={() => {
                    if (suppressClickRef.current) return;
                    handleSelectDay(day);
                  }}
                  onPointerDown={(event) => startDayDrag(event, key, dayData)}
                  onKeyDown={(event) => handleDayKeyDown(event, key, dayData)}
                  className={cn(
                    "relative min-h-[4.5rem] border-r border-b border-slate-100 p-1.5 transition-colors motion-reduce:transition-none dark:border-slate-800 sm:min-h-[5.25rem] md:min-h-24 md:p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60",
                    cursorClass,
                    isInvalidTarget
                      ? ""
                      : isDragOver
                        ? "bg-amber-50/80 ring-2 ring-inset ring-amber-400 dark:bg-amber-950/30"
                        : isSelected
                          ? "bg-primary/10 ring-2 ring-inset ring-primary/40"
                          : cn(
                              stateSurface ||
                                (isCurrentMonthDay
                                  ? "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                  : "bg-slate-50/70 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"),
                              (planState === "plan" || planState === "mixed") &&
                                "hover:bg-amber-100/40 dark:hover:bg-amber-950/25",
                            ),
                    isDragSource && "opacity-40",
                    justMovedKey === key && !isDragOver && "bg-amber-100/60 dark:bg-amber-900/20"
                  )}
                >
                  {showPlanState && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 flex w-1 flex-col overflow-hidden"
                    >
                      {planState === "mixed" ? (
                        <>
                          <span className="h-1/2 w-full bg-amber-400" />
                          <span className="h-1/2 w-full bg-primary" />
                        </>
                      ) : (
                        <span
                          className={cn(
                            "h-full w-full",
                            planState === "plan"
                              ? "bg-amber-400"
                              : "bg-slate-300/80 dark:bg-slate-600/70",
                          )}
                        />
                      )}
                    </span>
                  )}
                  <div className="mb-1 flex items-center justify-between gap-0.5 md:mb-2 md:gap-1">
                    <span
                      data-day-grip
                      className={cn(
                        "inline-flex shrink-0 select-none items-center justify-center size-6 md:size-7 rounded-full text-xs md:text-sm font-bold",
                        hasEntries && "cursor-grab",
                        isTodayDay
                          ? "bg-primary text-white"
                          : isSelected
                            ? "text-primary font-extrabold"
                            : isCurrentMonthDay
                              ? "text-slate-700 dark:text-slate-200"
                              : "text-slate-400 dark:text-slate-500"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {showPlanState && (
                      <DayPlanBadge state={badgeState} regularCount={regularCount} />
                    )}
                  </div>

                  {/* Desktop: show entry chips (dragging from them moves the whole day) */}
                  <div className="hidden md:block">
                    {dayData?.entries.slice(0, 3).map((entry) => {
                      const st = serviceTypeMap[entry.service_type_id];
                      const isPlanned = isPlannedEntry(entry);
                      return (
                        <div
                          key={entry.id}
                          className="rounded-r p-1.5 mb-1 border-l-4"
                          style={{
                            borderColor: isPlanned ? "#f59e0b" : st?.color ?? "#2094f3",
                            backgroundColor: isPlanned ? "rgba(245, 158, 11, 0.14)" : (st?.color ?? "#2094f3") + "1a",
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <p
                              className="text-[10px] font-bold uppercase leading-none"
                              style={{ color: isPlanned ? "#b45309" : st?.color ?? "#2094f3" }}
                            >
                              {entry.title}
                            </p>
                            {isPlanned && (
                              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                                {t("calendar.plannedShort")}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {isUnitsEntry(entry)
                              ? `${entry.units_quantity} ${t("calendar.units")}`
                              : durationDisplay(computeDurationSeconds(entry))}
                          </p>
                        </div>
                      );
                    })}
                    {(dayData?.entries.length ?? 0) > 3 && (
                      <p className="text-[10px] text-slate-400 font-medium">
                        +{dayData!.entries.length - 3} {t("calendar.more")}
                      </p>
                    )}
                  </div>

                  {/* Mobile: show dot indicators */}
                  {dayData && dayData.entries.length > 0 && (
                    <div className="flex gap-0.5 md:hidden mt-0.5" data-no-day-drag>
                      {dayData.entries.slice(0, 4).map((entry) => {
                        const st = serviceTypeMap[entry.service_type_id];
                        return (
                          <div
                            key={entry.id}
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: isPlannedEntry(entry) ? "#f59e0b" : st?.color ?? "#2094f3" }}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Interested people mini cards — visual indicators only */}
                  {(() => {
                    const people = interestedPeopleByDate.get(key);
                    if (!people || people.length === 0) return null;
                    const maxShow = viewMode === "weekly" ? 5 : 2;
                    return (
                      <div className="mt-1 space-y-0.5" data-no-day-drag>
                        {people.slice(0, maxShow).map((p) => {
                          const st = statusMap.get(p.status) ?? { name: p.status, color: "#94a3b8", icon: "person" };
                          return (
                            <div
                              key={p.id}
                              className="text-[10px] px-1 py-0.5 rounded border-l-2 transition-colors"
                              style={{ borderColor: st.color, backgroundColor: st.color + "10" }}
                            >
                              <div className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]" style={{ color: st.color }}>{st.icon}</span>
                                <span className="truncate font-medium">{p.name} {p.last_name?.[0]}.</span>
                              </div>
                              {viewMode === "weekly" && p.next_visit_date && (
                                <span className="text-[9px] text-slate-400">
                                  {new Date(p.next_visit_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {people.length > maxShow && (
                          <p className="text-[9px] text-slate-400 px-1">+{people.length - maxShow} more</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  const selectedDayData = calendarMap[format(selectedDate, "yyyy-MM-dd")];
  const monthlyTotals = useMemo(() => {
    const monthKey = format(currentDate, "yyyy-MM");

    return Object.values(calendarMap).reduce(
      (totals, day) => {
        if (!day.date.startsWith(monthKey)) {
          return totals;
        }

        totals.totalDurationSeconds += day.total_duration_seconds;
        totals.totalUnits += day.total_units;
        totals.plannedDurationSeconds += day.planned_duration_seconds;
        totals.plannedUnits += day.planned_units;
        return totals;
      },
      {
        totalDurationSeconds: 0,
        totalUnits: 0,
        plannedDurationSeconds: 0,
        plannedUnits: 0,
      }
    );
  }, [calendarMap, currentDate]);
  const selectedWeekNumber = getWeek(selectedDate, {
    weekStartsOn,
    firstWeekContainsDate,
  });

  // ── Monthly cap ───────────────────────────────────────────────────────────
  const monthlyUsedHours = useMemo(() => {
    if (!monthlyCapEnabled) return { capped: 0, exempt: 0 };
    const monthKey = format(currentDate, "yyyy-MM");
    let capped = 0;
    let exempt = 0;
    for (const e of timeEntries) {
      if (isPlannedEntry(e) || isUnitsEntry(e)) continue;
      if (format(new Date(e.start_time), "yyyy-MM") !== monthKey) continue;
      const hours = computeDurationSeconds(e) / 3600;
      const st = serviceTypeMap[e.service_type_id];
      if (st?.cap_exempt) { exempt += hours; } else { capped += hours; }
    }
    return { capped, exempt };
  }, [timeEntries, monthlyCapEnabled, serviceTypeMap, currentDate]);

  // ── Weekly view ───────────────────────────────────────────────────────────
  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn }),
    [selectedDate, weekStartsOn]
  );
  const weekEnd = useMemo(
    () => endOfWeek(weekStart, { weekStartsOn }),
    [weekStart]
  );
  const weekDays = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  );

  const weeklyTotals = useMemo(() => {
    return weekDays.reduce(
      (totals, day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayData = calendarMap[key];
        if (!dayData) return totals;
        totals.totalDurationSeconds += dayData.total_duration_seconds;
        totals.totalUnits += dayData.total_units;
        totals.plannedDurationSeconds += dayData.planned_duration_seconds;
        totals.plannedUnits += dayData.planned_units;
        return totals;
      },
      { totalDurationSeconds: 0, totalUnits: 0, plannedDurationSeconds: 0, plannedUnits: 0 }
    );
  }, [weekDays, calendarMap]);

  const goToPreviousWeek = () => {
    const prev = subWeeks(selectedDate, 1);
    setSelectedDate(prev);
    setViewedMonth(prev);
  };
  const goToNextWeek = () => {
    const next = addWeeks(selectedDate, 1);
    setSelectedDate(next);
    setViewedMonth(next);
  };
  const goToCurrentWeek = () => {
    const now = new Date();
    setSelectedDate(now);
    goToToday();
  };

  // ── Interested people on calendar ────────────────────────────────────────
  const statusMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; icon: string }>();
    for (const s of interestedStatuses) {
      map.set(s.id, { name: s.name, color: s.color, icon: s.icon });
    }
    return map;
  }, [interestedStatuses]);

  const interestedPeopleByDate = useMemo(() => {
    const map = new Map<string, InterestedPerson[]>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Show interested people for the visible range (month or week)
    const rangeStart = viewMode === "weekly" ? weekStart : calendarStart;
    const rangeEnd = viewMode === "weekly" ? weekEnd : calendarEnd;

    for (const person of interestedPeople) {
      // Specific next visit date — one-time visits hide when completed
      if (person.next_visit_date) {
        const visitDate = new Date(person.next_visit_date);
        if (!isInterestedPersonCompleted(person, today) && visitDate >= today && visitDate >= rangeStart && visitDate <= rangeEnd) {
          const key = format(visitDate, "yyyy-MM-dd");
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(person);
        }
      }
      // Weekly recurring visits
      if (person.next_visit_weekly_day !== null) {
        // Generate occurrences for the visible range
        let cursor = new Date(Math.max(rangeStart.getTime(), today.getTime()));
        while (cursor.getDay() !== person.next_visit_weekly_day) {
          cursor.setDate(cursor.getDate() + 1);
        }
        const skipDate = person.next_visit_date
          ? format(new Date(person.next_visit_date), "yyyy-MM-dd")
          : null;
        while (cursor <= rangeEnd) {
          const key = format(cursor, "yyyy-MM-dd");
          // Skip if this date already appears as a specific visit
          if (key !== skipDate) {
            // Hide only the occurrence of the week this person was marked completed
            if (!(person.completed && person.completedWeekKey === isoWeekKey(cursor))) {
              if (!map.has(key)) map.set(key, []);
              map.get(key)!.push(person);
            }
          }
          cursor.setDate(cursor.getDate() + 7);
        }
      }
    }
    return map;
  }, [interestedPeople, weekStart, weekEnd, calendarStart, calendarEnd, viewMode]);

  const goToday = () => {
    const now = new Date();
    goToToday();
    setSelectedDate(now);
  };

  const handleDelete = (id: string) => {
    deleteTimeEntry(id);
    toast.success(t("calendar.entryDeleted"));
  };

  // ── Touch swipe: animated month switch on mobile ───────────────────────
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeCompleting, setSwipeCompleting] = useState(false);
  const [swipeResetting, setSwipeResetting] = useState(false);
  const touchStartX = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const SWIPE_THRESHOLD = 80;
  const SWIPE_DEAD_ZONE = 25; // minimum px before swipe activates (prevents twitchy micro-swipes)
  const SWIPE_ANIM_MS = 300;

  const onTouchStart = (e: React.TouchEvent) => {
    if (swipeCompleting) return;
    touchStartX.current = e.touches[0].clientX;
    setSwipeDelta(0);
    // Don't set isSwiping yet — only activate once the dead zone is exceeded
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (swipeCompleting) return;
    const rawDelta = touchStartX.current - e.touches[0].clientX;
    if (!isSwiping) {
      // Dead zone: don't start swiping until the finger moves enough horizontally
      if (Math.abs(rawDelta) < SWIPE_DEAD_ZONE) return;
      setIsSwiping(true);
    }
    // Subtract dead zone so the visual movement starts smoothly from zero
    const sign = rawDelta > 0 ? 1 : -1;
    setSwipeDelta(rawDelta - sign * SWIPE_DEAD_ZONE);
  };

  const onTouchEnd = () => {
    if (Math.abs(swipeDelta) >= SWIPE_THRESHOLD) {
      // Smooth completion: animate the slide to full width, then switch month
      const gridWidth = gridRef.current?.offsetWidth ?? window.innerWidth;
      setSwipeCompleting(true);
      setIsSwiping(false);
      setSwipeDelta(swipeDelta > 0 ? gridWidth : -gridWidth);
      // After animation completes, switch month with NO transition (instant)
      setTimeout(() => {
        setSwipeResetting(true); // disable transition
        if (swipeDelta > 0) goToNextViewedMonth();
        else goToPreviousViewedMonth();
        setSwipeDelta(0);
        setSwipeCompleting(false);
        // Re-enable transition on next frame
        requestAnimationFrame(() => setSwipeResetting(false));
      }, SWIPE_ANIM_MS);
    } else {
      // Not enough swipe — spring back
      setIsSwiping(false);
      setSwipeDelta(0);
    }
  };

  const handleOpenAddModal = () => {
    ensureDefaultServiceType();
    setShowAddModal(true);
  };

  const handleSelectDay = (day: Date) => {
    setSelectedDate(day);
    if (!isSameMonth(day, currentDate)) {
      setViewedMonth(startOfMonth(day));
    }
  };

  /* ─── Day drag & drop (desktop) ─────────────────────────────────────────── */

  const announce = (message: string) => {
    if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
    setLiveMessage("");
    liveTimerRef.current = window.setTimeout(() => setLiveMessage(message), 30);
  };

  const entriesSummary = (entries: TimeEntry[]) => {
    const seconds = entries
      .filter((entry) => !isUnitsEntry(entry))
      .reduce((sum, entry) => sum + computeDurationSeconds(entry), 0);
    const units = entries
      .filter((entry) => isUnitsEntry(entry))
      .reduce((sum, entry) => sum + (entry.units_quantity ?? 0), 0);
    const entryWord =
      entries.length === 1 ? t("calendar.entryWord") : t("calendar.entriesWord");
    const parts = [`${entries.length} ${entryWord}`];
    if (seconds > 0) parts.push(durationDisplay(seconds));
    else if (units > 0) parts.push(`${units} ${t("calendar.units")}`);
    return parts.join(" · ");
  };

  const modeFromModifiers = (event: {
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
  }): DayMoveMode => (event.shiftKey ? "swap" : event.altKey || event.ctrlKey ? "copy" : "move");

  const positionPreview = (x: number, y: number) => {
    const element = previewRef.current;
    if (element) element.style.transform = `translate3d(${x + 16}px, ${y + 16}px, 0)`;
  };

  const autoScroll = (clientY: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const edge = 60;
    if (clientY < rect.top + edge) container.scrollTop -= 14;
    else if (clientY > rect.bottom - edge) container.scrollTop += 14;
  };

  const endDayDrag = useCallback(() => {
    const session = dragRef.current;
    if (!session) return;
    window.removeEventListener("pointermove", session.moveHandler);
    window.removeEventListener("pointerup", session.upHandler);
    window.removeEventListener("pointercancel", session.cancelHandler);
    window.removeEventListener("keydown", session.keyHandler);
    window.removeEventListener("keydown", session.modifierHandler);
    window.removeEventListener("keyup", session.modifierHandler);
    if (session.scrollRaf != null) cancelAnimationFrame(session.scrollRaf);
    dragRef.current = null;
    setDragView(null);
    document.body.style.cursor = "";
  }, []);

  const updateDragHover = (session: DayDragSession, x: number, y: number) => {
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = element?.closest<HTMLElement>("[data-day-key]");
    const overKey = cell?.dataset.dayKey ?? null;
    if (overKey !== session.overKey) {
      session.overKey = overKey;
      setDragView((view) => (view ? { ...view, overKey } : view));
      document.body.style.cursor =
        overKey && overKey !== session.fromKey ? "grabbing" : "not-allowed";
    }
  };

  const activateDayDrag = (event?: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean }) => {
    const session = dragRef.current;
    if (!session || session.active) return;
    session.active = true;
    if (event) session.mode = modeFromModifiers(event);
    window.getSelection()?.removeAllRanges();
    document.body.style.cursor = "grabbing";
    const dateLabel = shortDate(parseDateKey(session.fromKey), language);
    setDragView({
      fromKey: session.fromKey,
      overKey: null,
      mode: session.mode,
      count: session.entries.length,
      summary: entriesSummary(session.entries),
      dateLabel,
      initialX: session.lastX,
      initialY: session.lastY,
    });
    announce(`${t("calendar.pickedUp")} ${dateLabel}. ${t("calendar.dragKeyboardHint")}`);
    const scrollLoop = () => {
      const current = dragRef.current;
      if (!current?.active) return;
      const container = scrollRef.current;
      const before = container?.scrollTop ?? 0;
      autoScroll(current.lastY);
      // The grid moved under a still pointer: re-evaluate the hovered cell.
      if (container && container.scrollTop !== before) {
        updateDragHover(current, current.lastX, current.lastY);
      }
      current.scrollRaf = requestAnimationFrame(scrollLoop);
    };
    session.scrollRaf = requestAnimationFrame(scrollLoop);
  };

  const startDayDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    dayKey: string,
    dayData?: CalendarDay,
  ) => {
    // Desktop only: touch keeps the existing swipe gesture.
    if (event.pointerType === "touch") return;
    if (event.button !== 0 || dragRef.current) return;
    if (!dayData || dayData.entries.length === 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-no-day-drag], button, a, input, select, textarea")) return;

    const session: DayDragSession = {
      pointerId: event.pointerId,
      fromKey: dayKey,
      entries: dayData.entries,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      active: false,
      overKey: null,
      mode: "move",
      scrollRaf: null,
      moveHandler: () => {},
      upHandler: () => {},
      cancelHandler: () => {},
      keyHandler: () => {},
      modifierHandler: () => {},
    };
    dragRef.current = session;

    const onMove = (moveEvent: PointerEvent) => {
      if (!session.active) {
        const distance = Math.hypot(
          moveEvent.clientX - session.startX,
          moveEvent.clientY - session.startY,
        );
        if (distance < 5) return;
        activateDayDrag(moveEvent);
      }
      moveEvent.preventDefault();
      session.lastX = moveEvent.clientX;
      session.lastY = moveEvent.clientY;
      positionPreview(session.lastX, session.lastY);
      const nextMode = modeFromModifiers(moveEvent);
      if (nextMode !== session.mode) {
        session.mode = nextMode;
        setDragView((view) => (view ? { ...view, mode: nextMode } : view));
      }
      updateDragHover(session, moveEvent.clientX, moveEvent.clientY);
    };

    const onUp = (upEvent: PointerEvent) => {
      const wasActive = session.active;
      const fromKey = session.fromKey;
      const overKey = session.overKey;
      const mode = modeFromModifiers(upEvent);
      endDayDrag();
      if (!wasActive) return;
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 150);
      if (!overKey) return;
      if (overKey === fromKey) {
        announce(t("calendar.sameDay"));
        return;
      }
      performDayMove(fromKey, overKey, mode);
    };

    const onCancel = () => endDayDrag();
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") {
        endDayDrag();
        announce(t("calendar.cancelled"));
      }
    };
    const onModifier = (keyEvent: KeyboardEvent) => {
      const nextMode = modeFromModifiers(keyEvent);
      if (nextMode !== session.mode) {
        session.mode = nextMode;
        setDragView((view) => (view ? { ...view, mode: nextMode } : view));
      }
    };

    session.moveHandler = onMove;
    session.upHandler = onUp;
    session.cancelHandler = onCancel;
    session.keyHandler = onKey;
    session.modifierHandler = onModifier;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onModifier);
    window.addEventListener("keyup", onModifier);
  };

  const undoLastMove = () => {
    const current = undoRef.current;
    if (!current) return;
    window.clearTimeout(current.timeout);
    toast.dismiss(current.toastId);
    undoDayMove(current.result);
    undoRef.current = null;
    setJustMovedKey(null);
    toast.success(t("calendar.undone"));
    announce(t("calendar.undone"));
  };
  undoLastMoveRef.current = undoLastMove;

  const showUndoToast = (result: DayMoveResult, message: string) => {
    const previous = undoRef.current;
    if (previous) {
      toast.dismiss(previous.toastId);
      window.clearTimeout(previous.timeout);
    }
    const toastId = toast(
      (item) => (
        <span className="flex items-center gap-3">
          <span className="text-sm font-semibold">{message}</span>
          <button
            type="button"
            onClick={() => {
              undoLastMove();
              toast.dismiss(item.id);
            }}
            className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-black text-black"
          >
            {t("calendar.undo")}
          </button>
        </span>
      ),
      { duration: 6000 },
    );
    const timeout = window.setTimeout(() => {
      if (undoRef.current?.toastId === toastId) undoRef.current = null;
    }, 6000);
    undoRef.current = { result, toastId, timeout };
  };

  const performDayMove = (fromKey: string, toKey: string, mode: DayMoveMode) => {
    if (fromKey === toKey) {
      announce(t("calendar.sameDay"));
      return;
    }
    const source = calendarMap[fromKey];
    if (!source || source.entries.length === 0) return;
    const target = calendarMap[toKey];
    const result = moveDay(
      fromKey,
      toKey,
      mode,
      source.entries.map((entry) => entry.id),
      mode === "swap" ? (target?.entries.map((entry) => entry.id) ?? []) : undefined,
    );
    if (!result) return;

    const label =
      mode === "copy"
        ? t("calendar.copiedTo")
        : mode === "swap"
          ? t("calendar.swappedWith")
          : t("calendar.movedTo");
    const movedWord =
      result.moved === 1 ? t("calendar.entryWord") : t("calendar.entriesWord");
    const message = `${label} ${result.moved} ${movedWord} → ${shortDate(parseDateKey(toKey), language)}`;
    announce(message);
    setJustMovedKey(toKey);
    window.setTimeout(() => setJustMovedKey(null), 700);
    showUndoToast(result, message);

    // Flush the pending sync; if the server rejects it, restore the previous
    // dates so the optimistic UI never diverges from the backend.
    if (isOnline) {
      void syncNow().catch(() => {
        undoDayMove(result);
        const current = undoRef.current;
        if (current) {
          toast.dismiss(current.toastId);
          window.clearTimeout(current.timeout);
          undoRef.current = null;
        }
        setJustMovedKey(null);
        toast.error(t("calendar.saveFailed"));
        announce(t("calendar.saveFailed"));
      });
    }
  };

  const handleDayKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    dayKey: string,
    dayData?: CalendarDay,
  ) => {
    if (event.key === "Escape") {
      if (keyboardDrag) {
        event.preventDefault();
        setKeyboardDrag(null);
        announce(t("calendar.cancelled"));
      }
      return;
    }

    if (keyboardDrag) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const { fromKey, overKey } = keyboardDrag;
        const mode = modeFromModifiers(event);
        setKeyboardDrag(null);
        if (overKey === fromKey) {
          announce(t("calendar.sameDay"));
          return;
        }
        performDayMove(fromKey, overKey, mode);
        return;
      }
      const delta =
        event.key === "ArrowLeft"
          ? -1
          : event.key === "ArrowRight"
            ? 1
            : event.key === "ArrowUp"
              ? -7
              : event.key === "ArrowDown"
                ? 7
                : 0;
      if (delta !== 0) {
        event.preventDefault();
        const current = parseDateKey(keyboardDrag.overKey);
        const next = addDays(current, delta);
        const min = viewMode === "weekly" ? weekStart : calendarStart;
        const max = viewMode === "weekly" ? weekEnd : calendarEnd;
        if (next < min || next > max) return;
        const nextKey = format(next, "yyyy-MM-dd");
        setKeyboardDrag((drag) => (drag ? { ...drag, overKey: nextKey } : drag));
        cellRefs.current.get(nextKey)?.focus();
        announce(`${shortDate(next, language)} — ${t("calendar.dropHere")}`);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (dayData && dayData.entries.length > 0) {
        setKeyboardDrag({ fromKey: dayKey, overKey: dayKey });
        announce(
          `${t("calendar.pickedUp")} ${shortDate(parseDateKey(dayKey), language)}. ${t("calendar.dragKeyboardHint")}`,
        );
      } else {
        handleSelectDay(parseDateKey(dayKey));
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!undoRef.current) return;
      event.preventDefault();
      undoLastMoveRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => endDayDrag(), [endDayDrag]);

  useEffect(
    () => () => {
      if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
      if (undoRef.current) window.clearTimeout(undoRef.current.timeout);
    },
    [],
  );

  return (
    <div className="flex flex-col h-full md:min-h-0">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-surface/80 px-4 py-3 backdrop-blur-md dark:border-slate-800 md:px-6 md:py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={viewMode === "monthly" ? goToPreviousViewedMonth : goToPreviousWeek}
                className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </motion.button>
              <h2 className="min-w-0 flex-1 text-center text-base font-bold sm:min-w-[10rem] md:text-xl">
                <span className="block truncate">
                  {viewMode === "monthly"
                    ? monthYear(currentDate, language)
                    : `${shortDate(weekStart, language)} – ${shortDate(weekEnd, language)}`}
                </span>
              </h2>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={viewMode === "monthly" ? goToNextViewedMonth : goToNextWeek}
                className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </motion.button>
            </div>
            {/* View mode toggle */}
            <SegmentedControl
              size="sm"
              className="shrink-0"
              value={viewMode}
              onChange={(v) => setViewMode(v)}
              options={[
                { value: "monthly", label: t("calendar.month") },
                { value: "weekly", label: t("calendar.week") },
              ]}
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={viewMode === "monthly" ? goToday : goToCurrentWeek}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
            >
              {t("calendar.today")}
            </motion.button>
          </div>

          {/* Totals — monthly or weekly */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <span className="text-slate-500 dark:text-slate-400">
                {viewMode === "monthly" ? t("calendar.monthTotal") : t("calendar.weekTotal")}
              </span>
              <span className="ml-2 font-bold text-primary">
                {durationDisplay(viewMode === "monthly" ? monthlyTotals.totalDurationSeconds : weeklyTotals.totalDurationSeconds)}
              </span>
              {(viewMode === "monthly" ? monthlyTotals.totalUnits > 0 : weeklyTotals.totalUnits > 0) && (
                <span className="ml-2 text-slate-500 dark:text-slate-400">
                  · {viewMode === "monthly" ? monthlyTotals.totalUnits : weeklyTotals.totalUnits} {t("calendar.units")}
                </span>
              )}
            </div>
            {((viewMode === "monthly" ? monthlyTotals.plannedDurationSeconds > 0 : weeklyTotals.plannedDurationSeconds > 0) ||
              (viewMode === "monthly" ? monthlyTotals.plannedUnits > 0 : weeklyTotals.plannedUnits > 0)) && (
              <div className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <span>{viewMode === "monthly" ? t("calendar.monthPlanned") : t("calendar.weekPlanned")}</span>
                {(viewMode === "monthly" ? monthlyTotals.plannedDurationSeconds > 0 : weeklyTotals.plannedDurationSeconds > 0) && (
                  <span className="ml-2 font-bold">
                    {durationDisplay(viewMode === "monthly" ? monthlyTotals.plannedDurationSeconds : weeklyTotals.plannedDurationSeconds)}
                  </span>
                )}
                {(viewMode === "monthly" ? monthlyTotals.plannedUnits > 0 : weeklyTotals.plannedUnits > 0) && (
                  <span className="ml-2">
                    {viewMode === "monthly" ? monthlyTotals.plannedUnits : weeklyTotals.plannedUnits} {t("calendar.units")}
                  </span>
                )}
              </div>
            )}
            {((viewMode === "monthly" ? monthlyTotals.plannedDurationSeconds > 0 : weeklyTotals.plannedDurationSeconds > 0) ||
              (viewMode === "monthly" ? monthlyTotals.plannedUnits > 0 : weeklyTotals.plannedUnits > 0)) && (
              <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-primary/20 dark:bg-primary/10/40 dark:text-slate-200">
                <span className="text-slate-500 dark:text-slate-400">{t("calendar.monthPlannedVsTotal")}</span>
                <span className="ml-2 font-bold text-primary">
                  {durationDisplay(
                    (viewMode === "monthly" ? monthlyTotals.plannedDurationSeconds : weeklyTotals.plannedDurationSeconds) +
                    (viewMode === "monthly" ? monthlyTotals.totalDurationSeconds : weeklyTotals.totalDurationSeconds)
                  )}
                </span>
                {((viewMode === "monthly" ? monthlyTotals.plannedUnits > 0 : weeklyTotals.plannedUnits > 0) ||
                  (viewMode === "monthly" ? monthlyTotals.totalUnits > 0 : weeklyTotals.totalUnits > 0)) && (
                  <span className="ml-2 text-slate-500 dark:text-slate-400">
                    · {(viewMode === "monthly" ? monthlyTotals.plannedUnits : weeklyTotals.plannedUnits) +
                       (viewMode === "monthly" ? monthlyTotals.totalUnits : weeklyTotals.totalUnits)} {t("calendar.units")}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Monthly cap progress bar */}
          {monthlyCapEnabled && monthlyCapHours > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  {(() => {
                    const { capped, exempt } = monthlyUsedHours;
                    if (exempt >= monthlyCapHours) return `${Math.round(exempt)} / ${monthlyCapHours}h`;
                    const total = capped + exempt;
                    if (total > monthlyCapHours) return `${monthlyCapHours}h (capped)`;
                    return `${Math.round(total)} / ${monthlyCapHours}h`;
                  })()}
                </span>
                <span
                  className="font-semibold"
                  style={{ color: capProgressColor(monthlyUsedHours.capped, monthlyUsedHours.exempt, monthlyCapHours) }}
                >
                  {(() => {
                    const { capped, exempt } = monthlyUsedHours;
                    const shown = exempt >= monthlyCapHours ? exempt : capped + exempt;
                    const pct = (shown / monthlyCapHours) * 100;
                    return exempt >= monthlyCapHours ? `${Math.round(pct)}%` : `${Math.min(100, Math.round(pct))}%`;
                  })()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  animate={{
                    width: `${Math.min(100, (((monthlyUsedHours.exempt >= monthlyCapHours ? monthlyUsedHours.exempt : monthlyUsedHours.capped + monthlyUsedHours.exempt) / monthlyCapHours) * 100))}%`,
                  }}
                  transition={SPRING_SOFT}
                  style={{
                    backgroundColor: capProgressColor(monthlyUsedHours.capped, monthlyUsedHours.exempt, monthlyCapHours),
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Calendar & Day View */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 md:p-6 pb-[calc(env(safe-area-inset-bottom,_0px)+6.75rem)] md:pb-6 bg-canvas"
      >
        {planModeEnabled && (
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-1 rounded-full bg-amber-400" />
              {t("calendar.planOnly")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="flex h-3 w-1 flex-col overflow-hidden rounded-full">
                <span className="h-1/2 w-full bg-amber-400" />
                <span className="h-1/2 w-full bg-primary" />
              </span>
              {t("calendar.planMixed")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              {t("calendar.noPlan")}
            </span>
          </div>
        )}

        {/* Calendar Grid — swipeable carousel on mobile */}
        <div
          ref={gridRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="relative overflow-hidden select-none md:overflow-visible"
        >
          {/* Current view — slides with the swipe (monthly only) */}
          <div
            style={{
              transform: (viewMode === "monthly" && (isSwiping || swipeCompleting)) ? `translateX(${-swipeDelta}px)` : "translateX(0)",
              transition: (viewMode === "monthly" && (isSwiping || swipeResetting)) ? "none" : `transform ${SWIPE_ANIM_MS}ms ease-out`,
            }}
          >
            {viewMode === "monthly"
              ? renderMonthGrid(currentDate, calendarWeeks)
              : renderMonthGrid(currentDate, calendarWeeks.filter((w) =>
                  w.days.some((d) => isSameDay(d, weekStart))
                ).slice(0, 1)
              )
            }
          </div>

          {/* Next month — slides in from the right when swiping left */}
          {(isSwiping || swipeCompleting) && swipeDelta > 0 && (
            <div
              className="absolute inset-0"
              style={{
                transform: `translateX(calc(100% - ${swipeDelta}px))`,
                transition: (isSwiping || swipeResetting) ? "none" : `transform ${SWIPE_ANIM_MS}ms ease-out`,
              }}
            >
              {renderMonthGrid(addMonths(currentDate, 1), computeWeeks(addMonths(currentDate, 1)))}
            </div>
          )}

          {/* Previous month — slides in from the left when swiping right */}
          {(isSwiping || swipeCompleting) && swipeDelta < 0 && (
            <div
              className="absolute inset-0"
              style={{
                transform: `translateX(calc(-100% - ${swipeDelta}px))`,
                transition: (isSwiping || swipeResetting) ? "none" : `transform ${SWIPE_ANIM_MS}ms ease-out`,
              }}
            >
              {renderMonthGrid(addMonths(currentDate, -1), computeWeeks(addMonths(currentDate, -1)))}
            </div>
          )}
        </div>

        {/* Daily Entries */}
        <div className="mt-6 md:mt-8">
          <div className="mb-3 flex flex-col gap-3 md:mb-4 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="text-base font-bold md:text-lg">
              {t("calendar.dailyEntries")} — {shortDate(selectedDate, language)}
            </h3>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
              <div className="rounded-2xl bg-slate-100/80 px-3 py-2 text-left dark:bg-slate-900/40 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                <p className="text-sm text-slate-500 font-medium">
                  {t("calendar.total")}: {selectedDayData?.total_duration_display ?? "0m"}
                  {(selectedDayData?.total_units ?? 0) > 0 && (
                    <span className="ml-1">· {selectedDayData!.total_units} {t("calendar.units")}</span>
                  )}
                </p>
                {((selectedDayData?.planned_duration_seconds ?? 0) > 0 || (selectedDayData?.planned_units ?? 0) > 0) && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-200">
                    {t("calendar.planned")}: {selectedDayData?.planned_duration_display ?? "0m"}
                    {(selectedDayData?.planned_units ?? 0) > 0 && (
                      <span className="ml-1">· {selectedDayData!.planned_units} {t("calendar.units")}</span>
                    )}
                  </p>
                )}
                <p className="text-xs text-slate-400 font-medium">{t("calendar.week")} {selectedWeekNumber}</p>
              </div>
              <button
                onClick={handleOpenAddModal}
                className="hidden md:inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.99]"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                <span className="whitespace-nowrap">{t("entry.add")}</span>
              </button>
            </div>
          </div>

          {(() => {
            const dayPeople = interestedPeople.filter((p) => {
              if (isInterestedPersonCompleted(p, selectedDate)) return false;
              if (p.next_visit_date) {
                const visitDate = new Date(p.next_visit_date);
                if (
                  visitDate.getFullYear() === selectedDate.getFullYear() &&
                  visitDate.getMonth() === selectedDate.getMonth() &&
                  visitDate.getDate() === selectedDate.getDate()
                ) {
                  return true;
                }
              }
              if (p.next_visit_weekly_day !== null && p.next_visit_weekly_day === selectedDate.getDay()) {
                return true;
              }
              return false;
            });
            const hasPeople = dayPeople.length > 0;
            const hasEntries = selectedDayData && selectedDayData.entries.length > 0;

            if (!hasEntries && !hasPeople) {
              return (
                <div className="text-center py-10 md:py-12 text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 block">event_busy</span>
                  <p className="font-medium">{t("calendar.noEntries")}</p>
                  <p className="text-sm">{t("calendar.addHint")}</p>
                </div>
              );
            }

            return (
              <StaggerGroup key={format(selectedDate, "yyyy-MM-dd")} className="space-y-3" step={0.03}>
                {selectedDayData?.entries.map((entry) => {
                  const st = serviceTypeMap[entry.service_type_id];
                  return (
                    <StaggerItem key={entry.id}>
                      <EntryCard
                        entry={entry}
                        serviceType={st}
                        onEdit={() => setEditingEntry(entry)}
                        onDelete={() => handleDelete(entry.id)}
                      />
                    </StaggerItem>
                  );
                })}
                {dayPeople.map((person) => {
                  const st = statusMap.get(person.status) ?? { name: person.status, color: "#94a3b8", icon: "person" };
                  return (
                    <InterestedPersonCard
                      key={person.id}
                      person={person}
                      statusConfig={st}
                      onEdit={() => setEditingInterestedPerson(person)}
                      onDelete={() => useStore.getState().deleteInterestedPerson(person.id)}
                    />
                  );
                })}
              </StaggerGroup>
            );
          })()}
        </div>
      </div>

      {/* FAB — offset above mobile nav */}
      <motion.button
        onClick={handleOpenAddModal}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom,_0px)+4.5rem)] size-14 bg-primary text-white rounded-2xl shadow-xl flex items-center justify-center z-20 md:hidden"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </motion.button>

      {showAddModal && (
        <AddEntryModal
          selectedDate={selectedDate}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => setShowAddModal(false)}
        />
      )}

      {editingEntry && (
        <AddEntryModal
          selectedDate={new Date(editingEntry.start_time)}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSuccess={() => setEditingEntry(null)}
        />
      )}

      {editingInterestedPerson && (
        <InterestedPersonModal
          person={editingInterestedPerson}
          onClose={() => setEditingInterestedPerson(null)}
        />
      )}

      {dragView &&
        createPortal(
          <div
            ref={previewRef}
            className="pointer-events-none fixed left-0 top-0 z-[100] flex max-w-[17rem] flex-col gap-0.5 rounded-xl border border-slate-200 bg-surface px-3 py-2 shadow-xl dark:border-slate-700"
            style={{
              transform: `translate3d(${dragView.initialX + 16}px, ${dragView.initialY + 16}px, 0)`,
            }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {dragView.dateLabel}
            </span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-100">
              {dragView.summary}
            </span>
            <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-black">
              {dragView.mode === "copy"
                ? t("calendar.dragCopy")
                : dragView.mode === "swap"
                  ? t("calendar.dragSwap")
                  : t("calendar.dragMove")}
            </span>
          </div>,
          document.body,
        )}
    </div>
  );
}

function EntryCard({
  entry,
  serviceType,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  serviceType?: ServiceType;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPlanned = isPlannedEntry(entry);

  return (
      <motion.div
        whileHover={{ y: -1 }}
        transition={SPRING_SOFT}
        className={cn(
      "bg-surface p-4 rounded-2xl border shadow-sm",
      isPlanned
        ? "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10"
        : "border-slate-200 dark:border-slate-800"
    )}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div
            className="size-10 md:size-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: isPlanned ? "rgba(245, 158, 11, 0.15)" : (serviceType?.color ?? "#2094f3") + "1a" }}
          >
            <span
              className="material-symbols-outlined text-lg md:text-2xl"
              style={{ color: isPlanned ? "#d97706" : serviceType?.color ?? "#2094f3" }}
            >
              {serviceType?.icon ?? "work"}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-sm md:text-base truncate">{entry.title}</h4>
              {isPlanned && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                  {t("calendar.plannedShort")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="ml-0 flex w-full flex-wrap items-center gap-2 sm:ml-2 sm:w-auto sm:justify-end shrink-0">
          <div className="text-right min-w-[4.5rem]">
            <p className="font-bold text-sm md:text-base" style={{ color: isPlanned ? "#d97706" : serviceType?.color ?? "#2094f3" }}>
              {isUnitsEntry(entry)
                ? `${entry.units_quantity} ${t("calendar.units")}`
                : durationDisplay(computeDurationSeconds(entry))}
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {isPlanned
                ? t("calendar.planned")
                : isUnitsEntry(entry)
                  ? t("calendar.counted")
                  : t("calendar.logged")}
            </p>
          </div>
          <button
            onClick={onEdit}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary dark:border-slate-700 dark:text-slate-300 dark:hover:border-primary/40 dark:hover:bg-primary/15 sm:flex-initial"
            title={t("entry.edit")}
          >
            <span className="material-symbols-outlined text-xl">edit</span>
            <span>{t("entry.editShort")}</span>
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-900/60 dark:hover:bg-red-900/20 sm:flex-initial"
              title={t("entry.delete")}
            >
              <span className="material-symbols-outlined text-xl">delete</span>
              <span>{t("entry.delete")}</span>
            </button>
          ) : (
            <button
              onClick={onDelete}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600 sm:flex-initial"
            >
              <span className="material-symbols-outlined text-lg">warning</span>
              <span>{t("entry.confirmDelete")}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InterestedPersonCard({
  person,
  statusConfig,
  onEdit,
  onDelete,
}: {
  person: InterestedPerson;
  statusConfig: { name: string; color: string; icon: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-surface p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div
            className="size-10 md:size-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: statusConfig.color + "1a" }}
          >
            <span
              className="material-symbols-outlined text-lg md:text-2xl"
              style={{ color: statusConfig.color }}
            >
              {statusConfig.icon}
            </span>
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm md:text-base truncate">
              {person.name} {person.last_name}
            </h4>
            <p className="text-xs text-slate-500 font-medium">{statusConfig.name}</p>
          </div>
        </div>
        <div className="ml-0 flex w-full flex-wrap items-center gap-2 sm:ml-2 sm:w-auto sm:justify-end shrink-0">
          {person.next_visit_date && (
            <div className="text-right min-w-[4.5rem]">
              <p className="font-bold text-sm md:text-base" style={{ color: statusConfig.color }}>
                {new Date(person.next_visit_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {t("calendar.logged")}
              </p>
            </div>
          )}
          <button
            onClick={onEdit}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary dark:border-slate-700 dark:text-slate-300 dark:hover:border-primary/40 dark:hover:bg-primary/15 sm:flex-initial"
            title={t("entry.edit")}
          >
            <span className="material-symbols-outlined text-xl">edit</span>
            <span>{t("entry.editShort")}</span>
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-900/60 dark:hover:bg-red-900/20 sm:flex-initial"
              title={t("entry.delete")}
            >
              <span className="material-symbols-outlined text-xl">delete</span>
              <span>{t("entry.delete")}</span>
            </button>
          ) : (
            <button
              onClick={onDelete}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600 sm:flex-initial"
            >
              <span className="material-symbols-outlined text-lg">warning</span>
              <span>{t("entry.confirmDelete")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

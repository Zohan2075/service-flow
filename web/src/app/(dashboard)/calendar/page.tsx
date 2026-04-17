"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
} from "date-fns";
import { useStore } from "@/lib/store";
import { calendarDateKey, computeDurationSeconds, durationDisplay } from "@/types/data";
import type { TimeEntry, ServiceType, CalendarDay } from "@/types/data";
import { cn } from "@/lib/utils";
import { useT, monthYear, shortDate, weekdayLabels as getWeekdayLabels } from "@/lib/i18n";
import AddEntryModal from "@/components/entries/AddEntryModal";
import toast from "react-hot-toast";

export default function CalendarPage() {
  const { t, language } = useT();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const timeEntries = useStore((s) => s.timeEntries);
  const serviceTypes = useStore((s) => s.serviceTypes);
  const ensureDefaultServiceType = useStore((s) => s.ensureDefaultServiceType);
  const weekStartsOnSetting = useStore((s) => s.settings.weekStartsOn);
  const deleteTimeEntry = useStore((s) => s.deleteTimeEntry);

  useEffect(() => {
    if (serviceTypes.length === 0) {
      ensureDefaultServiceType();
    }
  }, [ensureDefaultServiceType, serviceTypes.length]);

  const serviceTypeMap = useMemo(
    () => Object.fromEntries(serviceTypes.map((st) => [st.id, st])),
    [serviceTypes]
  );

  const calendarMap: Record<string, CalendarDay> = useMemo(
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
          const totalDurationSeconds = sortedEntries.reduce(
            (sum, entry) => sum + computeDurationSeconds(entry),
            0
          );

          return [
            date,
            {
              date,
              entries: sortedEntries,
              total_duration_seconds: totalDurationSeconds,
              total_duration_display: durationDisplay(totalDurationSeconds),
            } satisfies CalendarDay,
          ];
        })
      ),
    [timeEntries]
  );

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

  const selectedDayData = calendarMap[format(selectedDate, "yyyy-MM-dd")];
  const selectedWeekNumber = getWeek(selectedDate, {
    weekStartsOn,
    firstWeekContainsDate,
  });

  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 2, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month, 1));
  const goToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const handleDelete = (id: string) => {
    deleteTimeEntry(id);
    toast.success(t("calendar.entryDeleted"));
  };

  const handleOpenAddModal = () => {
    ensureDefaultServiceType();
    setShowAddModal(true);
  };

  const handleSelectDay = (day: Date) => {
    setSelectedDate(day);

    if (!isSameMonth(day, currentDate)) {
      setCurrentDate(startOfMonth(day));
    }
  };

  return (
    <>
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-surface/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <h2 className="text-lg md:text-xl font-bold min-w-[10rem] text-center">
            {monthYear(currentDate, language)}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
          <button
            onClick={goToday}
            className="ml-2 px-3 py-1.5 text-xs font-bold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
          >
            {t("calendar.today")}
          </button>
        </div>
      </header>

      {/* Calendar & Day View */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-24 md:pb-6 bg-canvas">
        {/* Calendar Grid */}
        <div className="bg-surface rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Weekday Header */}
          <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center border-r border-slate-100 dark:border-slate-800 py-2 md:py-3 text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
              {t("calendar.wk")}
            </div>
            {weekdayLabels.map((d) => (
              <div
                key={d}
                className="py-2 md:py-3 text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider border-r last:border-r-0 border-slate-100 dark:border-slate-800"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div>
            {calendarWeeks.map(({ weekNumber, days }) => (
              <div
                key={weekNumber + days[0].toISOString()}
                className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]"
              >
                <div className="flex items-center justify-center border-r border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[10px] md:text-xs font-bold text-slate-400">
                  {weekNumber}
                </div>
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayData = calendarMap[key];
                  const isSelected = isSameDay(day, selectedDate);
                  const isTodayDay = isToday(day);
                  const isCurrentMonthDay = isSameMonth(day, currentDate);

                  return (
                    <div
                      key={key}
                      onClick={() => handleSelectDay(day)}
                      className={cn(
                        "p-1.5 md:p-2 border-r border-b border-slate-100 dark:border-slate-800 min-h-14 md:min-h-24 cursor-pointer transition-colors",
                        isSelected
                          ? "bg-primary/10 ring-2 ring-inset ring-primary/40"
                          : isCurrentMonthDay
                            ? "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                            : "bg-slate-50/70 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center justify-center size-6 md:size-7 rounded-full text-xs md:text-sm font-bold mb-1 md:mb-2",
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

                      {/* Desktop: show entry chips */}
                      <div className="hidden md:block">
                        {dayData?.entries.slice(0, 3).map((entry) => {
                          const st = serviceTypeMap[entry.service_type_id];
                          return (
                            <div
                              key={entry.id}
                              className="rounded-r p-1.5 mb-1 border-l-4"
                              style={{
                                borderColor: st?.color ?? "#2094f3",
                                backgroundColor: (st?.color ?? "#2094f3") + "1a",
                              }}
                            >
                              <p
                                className="text-[10px] font-bold uppercase leading-none"
                                style={{ color: st?.color ?? "#2094f3" }}
                              >
                                {entry.title}
                              </p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {durationDisplay(computeDurationSeconds(entry))}
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
                        <div className="flex gap-0.5 md:hidden mt-0.5">
                          {dayData.entries.slice(0, 4).map((entry) => {
                            const st = serviceTypeMap[entry.service_type_id];
                            return (
                              <div
                                key={entry.id}
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: st?.color ?? "#2094f3" }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Daily Entries */}
        <div className="mt-6 md:mt-8">
          <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
            <h3 className="text-base md:text-lg font-bold">
              {t("calendar.dailyEntries")} — {shortDate(selectedDate, language)}
            </h3>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-sm text-slate-500 font-medium">
                  {t("calendar.total")}: {selectedDayData?.total_duration_display ?? "0m"}
                </p>
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

          {!selectedDayData || selectedDayData.entries.length === 0 ? (
            <div className="text-center py-10 md:py-12 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2 block">event_busy</span>
              <p className="font-medium">{t("calendar.noEntries")}</p>
              <p className="text-sm">{t("calendar.addHint")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayData.entries.map((entry) => {
                const st = serviceTypeMap[entry.service_type_id];
                return (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    serviceType={st}
                    onEdit={() => setEditingEntry(entry)}
                    onDelete={() => handleDelete(entry.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB — offset above mobile nav */}
      <button
        onClick={handleOpenAddModal}
        className="fixed bottom-20 right-4 size-14 bg-primary text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-20 md:hidden"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

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
    </>
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

  return (
    <div className="bg-surface p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div
            className="size-10 md:size-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: (serviceType?.color ?? "#2094f3") + "1a" }}
          >
            <span
              className="material-symbols-outlined text-lg md:text-2xl"
              style={{ color: serviceType?.color ?? "#2094f3" }}
            >
              {serviceType?.icon ?? "work"}
            </span>
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm md:text-base truncate">{entry.title}</h4>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 ml-2">
          <div className="text-right min-w-[4.5rem]">
            <p className="font-bold text-sm md:text-base" style={{ color: serviceType?.color ?? "#2094f3" }}>
              {durationDisplay(computeDurationSeconds(entry))}
            </p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {t("calendar.logged")}
            </p>
          </div>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary dark:border-slate-700 dark:text-slate-300 dark:hover:border-primary/40 dark:hover:bg-primary/15"
            title={t("entry.edit")}
          >
            <span className="material-symbols-outlined text-xl">edit</span>
            <span className="hidden md:inline">{t("entry.editShort")}</span>
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-900/60 dark:hover:bg-red-900/20"
              title={t("entry.delete")}
            >
              <span className="material-symbols-outlined text-xl">delete</span>
              <span className="hidden md:inline">{t("entry.delete")}</span>
            </button>
          ) : (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600"
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

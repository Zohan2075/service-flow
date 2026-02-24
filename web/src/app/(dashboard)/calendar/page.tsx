"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from "date-fns";
import { timeEntriesApi, serviceTypesApi, type CalendarDay, type TimeEntry, type ServiceType } from "@/lib/api";
import { cn, formatTime } from "@/lib/utils";
import AddEntryModal from "@/components/entries/AddEntryModal";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAddModal, setShowAddModal] = useState(false);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data: calendarData = [] } = useQuery<CalendarDay[]>({
    queryKey: ["calendar", month, year],
    queryFn: () => timeEntriesApi.calendar(month, year),
  });

  const { data: serviceTypes = [] } = useQuery<ServiceType[]>({
    queryKey: ["service-types"],
    queryFn: serviceTypesApi.list,
  });

  const serviceTypeMap = Object.fromEntries(serviceTypes.map((st) => [st.id, st]));

  const calendarMap: Record<string, CalendarDay> = Object.fromEntries(
    calendarData.map((d) => [d.date, d])
  );

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);
  const trailingBlanks = 6 - getDay(monthEnd);

  const selectedDayData = calendarMap[format(selectedDate, "yyyy-MM-dd")];

  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 2, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month, 1));
  const goToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  return (
    <>
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 ml-4">
              <button
                onClick={prevMonth}
                className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-all"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button
                onClick={goToday}
                className="px-3 text-xs font-semibold"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-all"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <span className="material-symbols-outlined">search</span>
          </button>
          <button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative">
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      {/* Calendar & Day View */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background-light dark:bg-background-dark">
        {/* Calendar Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
            {DAYS.map((d) => (
              <div
                key={d}
                className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-r last:border-r-0 border-slate-100 dark:border-slate-800"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7">
            {/* Leading blanks */}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div
                key={`lead-${i}`}
                className="p-2 bg-slate-50 dark:bg-slate-800/50 border-r border-b border-slate-100 dark:border-slate-800 min-h-24 opacity-40"
              />
            ))}

            {/* Month days */}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayData = calendarMap[key];
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDay = isToday(day);

              return (
                <div
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "p-2 border-r border-b border-slate-100 dark:border-slate-800 min-h-24 cursor-pointer transition-colors",
                    isSelected && isTodayDay
                      ? "bg-primary/5 hover:bg-primary/10"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center size-7 rounded-full text-sm font-bold mb-2",
                      isTodayDay
                        ? "bg-primary text-white"
                        : "text-slate-700 dark:text-slate-200"
                    )}
                  >
                    {format(day, "d")}
                  </span>

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
                          {entry.duration_display}
                        </p>
                      </div>
                    );
                  })}

                  {(dayData?.entries.length ?? 0) > 3 && (
                    <p className="text-[10px] text-slate-400 font-medium">
                      +{dayData!.entries.length - 3} more
                    </p>
                  )}
                </div>
              );
            })}

            {/* Trailing blanks */}
            {Array.from({ length: trailingBlanks }).map((_, i) => (
              <div
                key={`trail-${i}`}
                className="p-2 bg-slate-50 dark:bg-slate-800/50 border-r border-b border-slate-100 dark:border-slate-800 min-h-24 opacity-40"
              />
            ))}
          </div>
        </div>

        {/* Daily Entries */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">
              Daily Entries — {format(selectedDate, "MMM d")}
            </h3>
            <span className="text-sm text-slate-500 font-medium">
              Total: {selectedDayData?.total_duration_display ?? "0m"}
            </span>
          </div>

          {!selectedDayData || selectedDayData.entries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2 block">event_busy</span>
              <p className="font-medium">No entries for this day</p>
              <p className="text-sm">Click the + button to add one</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayData.entries.map((entry) => {
                const st = serviceTypeMap[entry.service_type_id];
                return (
                  <EntryCard key={entry.id} entry={entry} serviceType={st} />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="absolute bottom-6 right-6 md:bottom-10 md:right-10 size-16 bg-primary text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-20"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>

      {showAddModal && (
        <AddEntryModal
          selectedDate={selectedDate}
          serviceTypes={serviceTypes}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => setShowAddModal(false)}
          queryKeys={[["calendar", month, year]]}
        />
      )}
    </>
  );
}

function EntryCard({
  entry,
  serviceType,
}: {
  entry: TimeEntry;
  serviceType?: ServiceType;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-4">
        <div
          className="size-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: (serviceType?.color ?? "#2094f3") + "1a" }}
        >
          <span
            className="material-symbols-outlined"
            style={{ color: serviceType?.color ?? "#2094f3" }}
          >
            {serviceType?.icon ?? "work"}
          </span>
        </div>
        <div>
          <h4 className="font-bold">{entry.title}</h4>
          <p className="text-xs text-slate-500 font-medium">
            {entry.location ? `${entry.location} — ` : ""}
            {formatTime(entry.start_time)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold" style={{ color: serviceType?.color ?? "#2094f3" }}>
          {entry.duration_display}
        </p>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          Logged
        </p>
      </div>
    </div>
  );
}

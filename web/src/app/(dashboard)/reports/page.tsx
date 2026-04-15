"use client";

import { useState, useMemo } from "react";
import { format, subMonths } from "date-fns";
import { useStore } from "@/lib/store";
import { buildCalendarDays, computeDurationSeconds } from "@/types/data";
import { formatDuration } from "@/lib/utils";

export default function ReportsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const timeEntries = useStore((s) => s.timeEntries);
  const serviceTypes = useStore((s) => s.serviceTypes);

  const calendarData = useMemo(
    () => buildCalendarDays(timeEntries, year, month),
    [timeEntries, year, month]
  );

  const totalSeconds = calendarData.reduce(
    (sum, d) => sum + d.total_duration_seconds,
    0
  );

  const byType: Record<string, { name: string; color: string; icon: string; seconds: number; count: number }> = {};
  calendarData.forEach((day) => {
    day.entries.forEach((entry) => {
      const st = serviceTypes.find((s) => s.id === entry.service_type_id);
      if (!byType[entry.service_type_id]) {
        byType[entry.service_type_id] = {
          name: st?.name ?? "Unknown",
          color: st?.color ?? "#2094f3",
          icon: st?.icon ?? "work",
          seconds: 0,
          count: 0,
        };
      }
      byType[entry.service_type_id].seconds += computeDurationSeconds(entry);
      byType[entry.service_type_id].count += 1;
    });
  });

  const sortedTypes = Object.values(byType).sort((a, b) => b.seconds - a.seconds);

  return (
    <>
      <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-surface/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Reports</h2>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 ml-2">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <span className="px-3 text-sm font-semibold">
              {format(currentDate, "MMM yyyy")}
            </span>
            <button onClick={() => setCurrentDate(new Date(year, month, 1))} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6 bg-canvas">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Hours", value: formatDuration(totalSeconds), icon: "schedule" },
            { label: "Days Worked", value: calendarData.length.toString(), icon: "calendar_today" },
            { label: "Total Entries", value: calendarData.reduce((s, d) => s + d.entries.length, 0).toString(), icon: "list_alt" },
            { label: "Avg / Day", value: calendarData.length > 0 ? formatDuration(Math.round(totalSeconds / calendarData.length)) : "—", icon: "trending_up" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-surface rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <span className="material-symbols-outlined text-base">{icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-2xl font-bold text-primary">{value}</p>
            </div>
          ))}
        </div>

        {/* By service type */}
        <div className="bg-surface rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4">By Service Type</h3>
          {sortedTypes.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No data for this month</p>
          ) : (
            <div className="space-y-4">
              {sortedTypes.map((st) => {
                const pct = totalSeconds > 0 ? (st.seconds / totalSeconds) * 100 : 0;
                return (
                  <div key={st.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm" style={{ color: st.color }}>
                          {st.icon}
                        </span>
                        <span className="font-semibold text-sm">{st.name}</span>
                        <span className="text-xs text-slate-400">{st.count} entries</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: st.color }}>
                        {formatDuration(st.seconds)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: st.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { InterestedPerson, InterestedPersonStatus } from "@/types/data";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useT, dateTimeString } from "@/lib/i18n";

const InterestedPersonModal = dynamic(
  () => import("@/components/interested/InterestedPersonModal"),
  { ssr: false }
);

const GENDER_COLORS: Record<"male" | "female", string> = {
  male: "#3b82f6",
  female: "#ec4899",
};

type StatusFilter = "all" | InterestedPersonStatus;

export default function InterestedPeoplePage() {
  const { t } = useT();
  const settings = useStore((s) => s.settings);
  const interestedPeople = useStore((s) => s.interestedPeople);
  const interestedStatuses = useStore((s) => s.interestedStatuses);
  const updateInterestedPerson = useStore((s) => s.updateInterestedPerson);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<InterestedPerson | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Localized short weekday names (0=Sun…6=Sat)
  const WEEKDAYS = useMemo(
    () =>
      settings.language === "es"
        ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    [settings.language],
  );

  // Build lookup maps from customizable statuses (fall back to defaults if empty)
  const statusMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; icon: string }>();
    for (const s of interestedStatuses) {
      map.set(s.id, { name: s.name, color: s.color, icon: s.icon });
    }
    return map;
  }, [interestedStatuses]);

  const getStatusInfo = (id: InterestedPersonStatus) =>
    statusMap.get(id) ?? { name: id.replace(/_/g, " "), color: "#2094f3", icon: "person" };

  // Filter options: "All" + custom-ordered statuses
  const filterOptions: { id: StatusFilter; label: string; color?: string }[] = [
    { id: "all", label: t("interested.all") },
    ...interestedStatuses
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ id: s.id as StatusFilter, label: s.name, color: s.color })),
  ];

  const filteredPeople =
    statusFilter === "all"
      ? interestedPeople
      : interestedPeople.filter((p) => p.status === statusFilter);

  const handleOpenAddModal = () => {
    setShowAddModal(true);
  };

  const handleOpenEdit = (person: InterestedPerson) => {
    setEditingPerson(person);
  };

  return (
    <>
      {/* Header */}
      <header className="px-4 md:px-6 py-3 md:py-4 bg-surface/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg md:text-xl font-bold">{settings.interestedSettingsLabel || t("interested.title")}</h2>
          <button
            onClick={handleOpenAddModal}
            className="hidden md:inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.99]"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            <span className="whitespace-nowrap">{t("interested.addNew")}</span>
          </button>
        </div>

        {/* Filter tabs — horizontally scrollable on mobile */}
        <div className="mt-3 overflow-x-auto">
          <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800 min-w-max">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setStatusFilter(option.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all",
                  statusFilter === option.id
                    ? "text-slate-900 dark:text-white shadow-sm scale-[1.02]"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                )}
                style={
                  statusFilter === option.id && option.color
                    ? { backgroundColor: option.color + "25" }
                    : statusFilter === option.id
                      ? { backgroundColor: "var(--surface)" }
                      : {}
                }
              >
                {option.color && (
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ 
                      backgroundColor: option.color,
                      boxShadow: statusFilter === option.id ? `0 0 0 2px ${option.color}40` : "none"
                    }}
                    suppressHydrationWarning
                  />
                )}
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-[calc(env(safe-area-inset-bottom,_0px)+6.75rem)] md:pb-6 bg-canvas">
        {filteredPeople.length === 0 ? (
          <div className="text-center py-10 md:py-12 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">people</span>
            <p className="font-medium">{t("interested.empty")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPeople.map((person) => {
              const statusInfo = getStatusInfo(person.status);
              return (
                <button
                  key={person.id}
                  onClick={() => handleOpenEdit(person)}
                  className={cn(
                    "w-full text-left bg-surface rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors relative overflow-hidden",
                    person.completed && "opacity-60"
                  )}
                  style={{
                    borderLeft: `4px solid ${statusInfo.color}`,
                    background: person.gender === "female"
                      ? "linear-gradient(90deg, transparent 70%, rgba(236, 72, 153, 0.15) 100%)"
                      : "linear-gradient(90deg, transparent 85%, rgba(59, 130, 246, 0.08) 100%)",
                  }}
                >
                  <span
                    className="size-3 rounded-full shrink-0"
                    style={{ backgroundColor: statusInfo.color }}
                    suppressHydrationWarning
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-bold leading-none",
                          person.gender === "female" ? "text-lg" : "text-base"
                        )}
                        style={{ color: GENDER_COLORS[person.gender] }}
                      >
                        {person.gender === "male" ? "♂" : "♀"}
                      </span>
                      <p className={cn("font-semibold text-sm truncate", person.completed && "line-through")}>
                        {person.name} {person.last_name}
                      </p>
                    </div>
                    <p className="text-xs truncate flex items-center gap-1" style={{ color: statusInfo.color }}>
                      <span className="material-symbols-outlined text-xs" suppressHydrationWarning>
                        {statusInfo.icon}
                      </span>
                      {statusInfo.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Completed toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateInterestedPerson(person.id, { completed: !person.completed });
                      }}
                      className={cn(
                        "inline-flex items-center justify-center size-7 rounded-full transition-colors",
                        person.completed
                          ? "bg-green-500 text-white"
                          : "text-slate-300 dark:text-slate-600 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                      )}
                      title={person.completed ? t("interested.markActive") : t("interested.markCompleted")}
                    >
                      <span className="material-symbols-outlined text-base">{person.completed ? "check_circle" : "radio_button_unchecked"}</span>
                    </button>
                    {person.latitude != null && person.longitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${person.latitude},${person.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center size-8 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Ver ubicación"
                      >
                        <span className="material-symbols-outlined text-lg">location_on</span>
                      </a>
                    )}
                    <div className="text-right shrink-0">
                      {person.next_visit_weekly_day != null ? (
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-primary">
                            event_repeat
                          </span>
                          <p className="text-xs text-primary font-semibold leading-tight">
                            {WEEKDAYS[person.next_visit_weekly_day]}
                            {person.next_visit_date &&
                              ` ${new Date(person.next_visit_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                        </div>
                      ) : person.next_visit_date ? (
                        <div className="flex flex-col items-end">
                          <p className="text-xs text-slate-500 leading-tight">
                            {dateTimeString(new Date(person.next_visit_date), settings.language)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">{t("interested.noDate")}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB — offset above mobile nav */}
      <button
        onClick={handleOpenAddModal}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom,_0px)+4.5rem)] size-14 bg-primary text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-20 md:hidden"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {showAddModal && (
        <InterestedPersonModal onClose={() => setShowAddModal(false)} />
      )}

      {editingPerson && (
        <InterestedPersonModal
          person={editingPerson}
          onClose={() => setEditingPerson(null)}
        />
      )}
    </>
  );
}

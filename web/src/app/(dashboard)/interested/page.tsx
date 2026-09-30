"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import type { InterestedPerson, InterestedPersonStatus } from "@/types/data";
import { useStore } from "@/lib/store";
import { isInterestedPersonCompleted } from "@/lib/isoWeek";
import { cn } from "@/lib/utils";
import { useT, dateTimeString } from "@/lib/i18n";
import toast from "react-hot-toast";
import { motion } from "motion/react";
import SegmentedControl from "@/components/ui/SegmentedControl";
import OptionChip from "@/components/ui/OptionChip";
import { StaggerGroup, fadeUp, SPRING_SOFT, EASE_OUT } from "@/components/ui/motion";

const InterestedPersonModal = dynamic(
  () => import("@/components/interested/InterestedPersonModal"),
  { ssr: false }
);

const GENDER_COLORS: Record<"male" | "female" | "other", string> = {
  male: "#3b82f6",
  female: "#ec4899",
  other: "#94a3b8",
};

type StatusFilter = "all" | InterestedPersonStatus;

// A one-time person counts as finished forever once completed; weekly people
// stay in Active (their per-week completion is handled by the weekly reset).
function isFinished(person: InterestedPerson): boolean {
  return person.completed === true && person.next_visit_weekly_day == null;
}

export default function InterestedPeoplePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-sm text-slate-400">Loading...</div>
      }
    >
      <InterestedDashboard />
    </Suspense>
  );
}

function InterestedDashboard() {
  const { t } = useT();
  const settings = useStore((s) => s.settings);
  const interestedPeople = useStore((s) => s.interestedPeople);
  const interestedStatuses = useStore((s) => s.interestedStatuses);
  const toggleInterestedPersonCompleted = useStore((s) => s.toggleInterestedPersonCompleted);
  const deleteInterestedPerson = useStore((s) => s.deleteInterestedPerson);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<InterestedPerson | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Tab state, synced with the ?tab= URL search param so deep links work.
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "finished">(() =>
    searchParams.get("tab") === "finished" ? "finished" : "active",
  );

  useEffect(() => {
    setTab(searchParams.get("tab") === "finished" ? "finished" : "active");
  }, [searchParams]);

  const selectTab = useCallback(
    (next: "active" | "finished") => {
      setTab(next);
      router.replace(next === "finished" ? "/interested?tab=finished" : "/interested", { scroll: false });
    },
    [router],
  );

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

  const activePeople = interestedPeople.filter((person) => !isFinished(person));
  const finishedPeople = interestedPeople.filter(isFinished);
  const tabPeople = tab === "active" ? activePeople : finishedPeople;
  const filteredPeople =
    statusFilter === "all"
      ? tabPeople
      : tabPeople.filter((p) => p.status === statusFilter);

  const handleOpenAddModal = () => {
    setShowAddModal(true);
  };

  const handleOpenEdit = (person: InterestedPerson) => {
    setEditingPerson(person);
  };

  const handleDelete = (person: InterestedPerson) => {
    if (!window.confirm(t("interested.deleteConfirm"))) return;
    deleteInterestedPerson(person.id);
    toast.success(t("interested.deleted"));
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

        {/* Segmented tabs: Active / Finished */}
        <div className="mt-3">
          <SegmentedControl
            fullWidth
            size="lg"
            value={tab}
            onChange={(v) => selectTab(v)}
            options={[
              {
                value: "active",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base shrink-0">person_search</span>
                    <span className="truncate">{t("interested.tabActive")}</span>
                  </span>
                ),
              },
              {
                value: "finished",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base shrink-0">task_alt</span>
                    <span className="truncate">{t("interested.tabFinished")}</span>
                  </span>
                ),
              },
            ]}
          />
        </div>

        {/* Filter tabs — horizontally scrollable on mobile */}
        <div className="mt-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800 min-w-max">
            {filterOptions.map((option) => (
              <OptionChip
                key={option.id}
                variant="soft"
                selected={statusFilter === option.id}
                onClick={() => setStatusFilter(option.id)}
                className="py-2 px-3.5 text-xs rounded-lg whitespace-nowrap"
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
              </OptionChip>
            ))}
          </div>
        </div>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-[calc(env(safe-area-inset-bottom,_0px)+6.75rem)] md:pb-6 bg-canvas">
        {filteredPeople.length === 0 ? (
          <div className="text-center py-10 md:py-12 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">
              {tab === "active" ? "people" : "history"}
            </span>
            <p className="font-medium">
              {tab === "active" ? t("interested.empty") : t("interested.finishedEmpty")}
            </p>
          </div>
        ) : (
          <StaggerGroup className="space-y-2" step={0.03}>
            {filteredPeople.map((person) => {
              const statusInfo = getStatusInfo(person.status);
              const completed = isInterestedPersonCompleted(person);
              if (tab === "finished") {
                const lastVisitDate = person.next_visit_date ?? person.initial_conversation_date;
                return (
                  <motion.div
                    key={person.id}
                    role="button"
                    tabIndex={0}
                    variants={fadeUp}
                    whileHover={{ y: -2 }}
                    transition={SPRING_SOFT}
                    onClick={() => handleOpenEdit(person)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpenEdit(person); } }}
                    className="w-full text-left bg-surface rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3 relative overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
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
                            person.gender === "female" ? "text-lg" : person.gender === "other" ? "text-sm" : "text-base"
                          )}
                          style={{ color: GENDER_COLORS[person.gender] }}
                        >
                          {person.gender === "male" ? "♂" : person.gender === "female" ? "♀" : "⚬"}
                        </span>
                        <p className="font-semibold text-sm truncate">{person.name} {person.last_name}</p>
                      </div>
                      <p className="text-xs truncate flex items-center gap-1" style={{ color: statusInfo.color }}>
                        <span className="material-symbols-outlined text-xs" suppressHydrationWarning>
                          {statusInfo.icon}
                        </span>
                        {statusInfo.name}
                      </p>
                      {lastVisitDate && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {dateTimeString(new Date(lastVisitDate), settings.language)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(person); }}
                        title={t("interested.delete")}
                        className="inline-flex items-center justify-center size-8 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleInterestedPersonCompleted(person.id); }}
                        title={t("interested.reactivate")}
                        className="inline-flex items-center justify-center size-8 rounded-lg text-slate-500 hover:bg-green-50 hover:text-green-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">undo</span>
                      </button>
                    </div>
                  </motion.div>
                );
              }
              return (
                <motion.button
                  key={person.id}
                  variants={fadeUp}
                  whileHover={{ y: -2 }}
                  transition={SPRING_SOFT}
                  onClick={() => handleOpenEdit(person)}
                  className={cn(
                    "w-full text-left bg-surface rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors relative overflow-hidden",
                    completed && "opacity-60"
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
                          person.gender === "female" ? "text-lg" : person.gender === "other" ? "text-sm" : "text-base"
                        )}
                        style={{ color: GENDER_COLORS[person.gender] }}
                      >
                        {person.gender === "male" ? "♂" : person.gender === "female" ? "♀" : "⚬"}
                      </span>
                      <p className={cn("font-semibold text-sm truncate", completed && "line-through")}>
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
                    <span
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleInterestedPersonCompleted(person.id); } }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleInterestedPersonCompleted(person.id);
                      }}
                      className={cn(
                        "inline-flex items-center justify-center size-7 rounded-full transition-colors cursor-pointer",
                        completed
                          ? "bg-green-500 text-white"
                          : "text-slate-300 dark:text-slate-600 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                      )}
                      title={completed ? t("interested.markActive") : t("interested.markCompleted")}
                    >
                      <motion.span
                        className="material-symbols-outlined text-base"
                        animate={completed ? { scale: [0.8, 1.1, 1] } : { scale: 1 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                      >
                        {completed ? "check_circle" : "radio_button_unchecked"}
                      </motion.span>
                    </span>
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
                </motion.button>
              );
            })}
          </StaggerGroup>
        )}
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
"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { InterestedPerson, InterestedPersonStatus } from "@/types/data";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

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
  const interestedPeople = useStore((s) => s.interestedPeople);
  const interestedStatuses = useStore((s) => s.interestedStatuses);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<InterestedPerson | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
          <h2 className="text-lg md:text-xl font-bold">{t("interested.title")}</h2>
          <button
            onClick={handleOpenAddModal}
            className="hidden md:inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.99]"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            <span className="whitespace-nowrap">{t("interested.addNew")}</span>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStatusFilter(option.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors",
                statusFilter === option.id
                  ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500"
              )}
            >
              {option.color && (
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: option.color }}
                  suppressHydrationWarning
                />
              )}
              {option.label}
            </button>
          ))}
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
            {filteredPeople.map((person) => (
              <button
                key={person.id}
                onClick={() => handleOpenEdit(person)}
                className="w-full text-left bg-surface rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors"
                style={{ borderLeft: `4px solid ${GENDER_COLORS[person.gender]}` }}
              >
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: getStatusInfo(person.status).color }}
                  suppressHydrationWarning
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-xs"
                      style={{ color: GENDER_COLORS[person.gender] }}
                    >
                      {person.gender === "male" ? "♂" : "♀"}
                    </span>
                    <p className="font-semibold text-sm truncate">
                      {person.name} {person.last_name}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs" style={{ color: getStatusInfo(person.status).color }} suppressHydrationWarning>
                      {getStatusInfo(person.status).icon}
                    </span>
                    {getStatusInfo(person.status).name}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                    <p className="text-xs text-slate-400">
                      {person.next_visit_date
                        ? person.next_visit_date
                        : t("interested.noDate")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
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

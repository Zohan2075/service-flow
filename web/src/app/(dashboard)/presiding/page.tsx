"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import ProgramView from "@/components/presiding/ProgramView";
import CommentsView from "@/components/comments/CommentsView";

export default function PresidingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-sm text-slate-400">Loading...</div>
      }
    >
      <PresidingDashboard />
    </Suspense>
  );
}

function PresidingDashboard() {
  const lang = useStore((s) => s.settings.language);
  const config = useStore((s) => s.presidingConfig);
  const prefs = useStore((s) => s.presidingPrefs);
  const session = useStore((s) => s.presidingSession);
  const sessions = useStore((s) => s.presidingSessions);
  const sessionLog = useMemo(() => session?.log ?? [], [session]);
  const setConfig = useStore((s) => s.setPresidingConfig);
  const addLogEntry = useStore((s) => s.addPresidingLogEntry);
  const updateLogEntry = useStore((s) => s.updatePresidingLogEntry);
  const deleteLogEntry = useStore((s) => s.deletePresidingLogEntry);
  const startSession = useStore((s) => s.startPresidingSession);
  const ensureActiveProgramWeek = useStore((s) => s.ensureActiveProgramWeek);

  // Comments wiring (moved from the standalone /presiding/comments route)
  const commentsConfig = useStore((s) => s.commentsConfig);
  const setCommentsConfig = useStore((s) => s.setCommentsConfig);

  // Tab state, synced with the ?tab= URL search param so deep links work.
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<"program" | "comments">(() =>
    searchParams.get("tab") === "comments" ? "comments" : "program",
  );

  useEffect(() => {
    setTab(searchParams.get("tab") === "comments" ? "comments" : "program");
  }, [searchParams]);

  const selectTab = useCallback(
    (next: "program" | "comments") => {
      setTab(next);
      router.replace(next === "comments" ? "/presiding?tab=comments" : "/presiding", { scroll: false });
    },
    [router],
  );

  const { t } = useT();

  useEffect(() => {
    ensureActiveProgramWeek();
    const interval = window.setInterval(() => ensureActiveProgramWeek(), 60_000);
    return () => window.clearInterval(interval);
  }, [ensureActiveProgramWeek]);

  // Stable refs to avoid recreation of handleLogEntry
  const startSessionRef = useRef(startSession);
  startSessionRef.current = startSession;
  const addLogEntryRef = useRef(addLogEntry);
  addLogEntryRef.current = addLogEntry;

  // Auto-start session on first log entry
  const handleLogEntry = useCallback((entry: Parameters<typeof addLogEntry>[0]) => {
    if (!session) startSessionRef.current();
    addLogEntryRef.current(entry);
  }, [session]);

  // Safety: if config isn't ready yet during hydration
  const activeWeek = useMemo(() =>
    config?.weeks?.find((w) => w.weekId === config.activeWeekId) ?? config?.weeks?.[0],
    [config]
  );
  if (!activeWeek?.sections?.length) {
    return <div className="flex items-center justify-center h-full text-sm text-slate-400">Loading program...</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex w-full rounded-xl bg-slate-100 dark:bg-slate-800 p-1 overflow-x-auto">
          <button
            onClick={() => selectTab("program")}
            className={
              "flex-1 whitespace-nowrap min-w-0 flex items-center justify-center gap-1.5 rounded-lg py-2.5 sm:py-2 text-sm font-semibold transition-colors min-h-11 " +
              (tab === "program"
                ? "bg-surface dark:bg-slate-700 shadow-sm text-primary"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300")
            }
          >
            <span className="material-symbols-outlined text-base shrink-0">menu_book</span>
            <span className="truncate">{t("nav.program")}</span>
          </button>
          <button
            onClick={() => selectTab("comments")}
            className={
              "flex-1 whitespace-nowrap min-w-0 flex items-center justify-center gap-1.5 rounded-lg py-2.5 sm:py-2 text-sm font-semibold transition-colors min-h-11 " +
              (tab === "comments"
                ? "bg-surface dark:bg-slate-700 shadow-sm text-primary"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300")
            }
          >
            <span className="material-symbols-outlined text-base shrink-0">forum</span>
            <span className="truncate">{t("nav.comments")}</span>
          </button>
        </div>
      </div>

      {tab === "program" ? (
        <ProgramView
          lang={lang}
          config={config}
          prefs={prefs}
          sessionLog={sessionLog}
          sessionHistory={sessions}
          onConfigChange={setConfig}
          onLogEntry={handleLogEntry}
          onUpdateLog={updateLogEntry}
          onDeleteLog={deleteLogEntry}
        />
      ) : (
        <CommentsView
          lang={lang === "es" ? "es" : "en"}
          weekId={activeWeek?.weekId ?? "default"}
          config={commentsConfig}
          onConfigChange={setCommentsConfig}
        />
      )}
    </div>
  );
}

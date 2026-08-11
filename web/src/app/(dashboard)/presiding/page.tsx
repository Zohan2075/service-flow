"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "@/lib/store";
import ProgramView from "@/components/presiding/ProgramView";

export default function PresidingPage() {
  const lang = useStore((s) => s.settings.language);
  const config = useStore((s) => s.presidingConfig);
  const prefs = useStore((s) => s.presidingPrefs);
  const session = useStore((s) => s.presidingSession);
  const sessions = useStore((s) => s.presidingSessions);
  const sessionLog = useMemo(() => session?.log ?? [], [session]);
  const setConfig = useStore((s) => s.setPresidingConfig);
  const addLogEntry = useStore((s) => s.addPresidingLogEntry);
  const deleteLogEntry = useStore((s) => s.deletePresidingLogEntry);
  const startSession = useStore((s) => s.startPresidingSession);
  const ensureActiveProgramWeek = useStore((s) => s.ensureActiveProgramWeek);

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
      <ProgramView
        lang={lang}
        config={config}
        prefs={prefs}
        sessionLog={sessionLog}
        sessionHistory={sessions}
        onConfigChange={setConfig}
        onLogEntry={handleLogEntry}
        onDeleteLog={deleteLogEntry}
      />
    </div>
  );
}

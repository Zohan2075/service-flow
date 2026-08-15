"use client";

import { useCallback, useRef } from "react";
import { useStore } from "@/lib/store";
import CommentsView from "@/components/comments/CommentsView";

export default function CommentsPage() {
  const lang = useStore((s) => s.settings.language);
  const config = useStore((s) => s.commentsConfig);
  const session = useStore((s) => s.commentsSession);
  const setConfig = useStore((s) => s.setCommentsConfig);
  const addLogEntry = useStore((s) => s.addCommentTiming);
  const deleteLogEntry = useStore((s) => s.deleteCommentTiming);
  const startSession = useStore((s) => s.startCommentsSession);

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

  return (
    <div className="flex flex-col h-full min-h-0">
      <CommentsView
        lang={lang === "es" ? "es" : "en"}
        config={config}
        session={session}
        onConfigChange={setConfig}
        onLogEntry={handleLogEntry}
        onDeleteLog={deleteLogEntry}
      />
    </div>
  );
}
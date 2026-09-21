"use client";

import { useEffect } from "react";
import { useSync } from "@/lib/sync";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

/**
 * Global sync activity indicator.
 *
 * While a cloud save/sync is owed or in flight it shows a floating animated
 * pill and registers a `beforeunload` guard so the browser asks for
 * confirmation before the tab is closed or reloaded mid-sync.
 *
 * Note: the close/reload prompt is honored by desktop browsers; mobile
 * browsers (and installed PWAs) generally ignore custom close prompts, so on
 * phones the protection is the visible animation plus the fast debounced
 * autosync.
 */
export default function SyncGuard() {
  const { status, isOnline } = useSync();
  const hasPendingChanges = useStore((s) => s.syncMetadata.hasPendingChanges);
  const { t } = useT();

  // A save is owed (pending locally, not yet pushed) or a sync is in flight.
  const working = status === "syncing" || (hasPendingChanges && isOnline);

  // Block tab close / reload while a cloud save or sync is in progress.
  useEffect(() => {
    if (!working) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome/Edge/IE require returnValue for the prompt to trigger.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [working]);

  if (!working) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[70] -translate-x-1/2"
    >
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-surface/95 px-4 py-2 text-xs font-semibold text-slate-600 shadow-lg backdrop-blur dark:border-slate-700 dark:text-slate-200">
        <span className="material-symbols-outlined animate-spin text-base text-primary">sync</span>
        <span>{status === "syncing" ? t("sync.syncing") : t("sync.saving")}</span>
      </div>
    </div>
  );
}

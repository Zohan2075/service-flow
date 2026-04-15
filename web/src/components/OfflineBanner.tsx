"use client";

import { useSync } from "@/lib/sync";
import { useT } from "@/lib/i18n";

export default function OfflineBanner() {
  const { isOnline } = useSync();
  const { t } = useT();

  if (isOnline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 text-white text-xs font-medium py-1.5 px-4 shrink-0">
      <span className="material-symbols-outlined text-sm leading-none">cloud_off</span>
      {t("offline.banner")}
    </div>
  );
}

"use client";

import { useStore } from "@/lib/store";
import PresidingSettings from "@/components/presiding/PresidingSettings";

export default function PresidingSettingsPage() {
  const lang = useStore((s) => s.settings.language);

  return (
    <div className="p-4 overflow-y-auto h-full">
      <PresidingSettings lang={lang} />
    </div>
  );
}
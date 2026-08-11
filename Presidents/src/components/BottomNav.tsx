"use client";

import { useTranslation } from "react-i18next";

type Tab = "program" | "settings";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function BottomNav({ activeTab, onTabChange }: Props) {
  const { t } = useTranslation();

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "program", label: t("nav.program"), icon: "\uD83D\uDCCB" },
    { key: "settings", label: t("nav.settings"), icon: "\u2699\uFE0F" },
  ];

  return (
    <nav className="sticky bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 flex flex-col items-center justify-center py-2 touch-target gap-0.5 transition-colors ${
              activeTab === tab.key
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="text-xs font-medium leading-none">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
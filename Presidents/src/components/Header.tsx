"use client";

import { useTranslation } from "react-i18next";

export default function Header() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-center px-4 py-3 touch-target">
        <h1 className="text-sm font-bold tracking-wide uppercase text-center">{t("app.title")}</h1>
      </div>
    </header>
  );
}
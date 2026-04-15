"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const navItems = [
  { href: "/calendar", icon: "calendar_month", labelKey: "nav.calendar" as const },
  { href: "/reports", icon: "analytics", labelKey: "nav.reports" as const },
  { href: "/settings", icon: "settings", labelKey: "nav.settings" as const },
];

export default function MobileNavBar() {
  const pathname = usePathname() ?? "";
  const { t } = useT();

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-14">
        {navItems.map(({ href, icon, labelKey }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
                active
                  ? "text-primary"
                  : "text-slate-400 dark:text-slate-500"
              )}
            >
              <span className="material-symbols-outlined text-[22px] leading-none">{icon}</span>
              <span className={cn("text-[10px] font-medium leading-none", active && "font-bold")}>
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

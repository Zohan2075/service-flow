"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/calendar", icon: "calendar_month", label: "Calendar" },
  { href: "/reports", icon: "analytics", label: "Reports" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default function MobileNavBar() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-14">
        {navItems.map(({ href, icon, label }) => {
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
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

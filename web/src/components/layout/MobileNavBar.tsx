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
  const pathname = usePathname();

  return (
    <div className="md:hidden flex border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-3">
      {navItems.map(({ href, icon, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1",
              active ? "text-primary" : "text-slate-400"
            )}
          >
            <span className="material-symbols-outlined">{icon}</span>
            <p className={cn("text-[10px] font-medium", active && "font-bold")}>
              {label}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

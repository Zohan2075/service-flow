"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/calendar", icon: "calendar_month", label: "Calendar" },
  { href: "/reports", icon: "analytics", label: "Reports" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "SF";

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary rounded-xl p-2 flex items-center justify-center text-white">
          <span className="material-symbols-outlined">event_note</span>
        </div>
        <h1 className="font-bold text-xl tracking-tight">ServiceFlow</h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map(({ href, icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors",
                active
                  ? "text-primary bg-primary/10"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <span className="material-symbols-outlined">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + User */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2 justify-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors",
                theme === t
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 p-2 rounded-xl">
          <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={initials}
                className="size-10 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {session?.user?.name ?? "User"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {session?.user?.email ?? ""}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Sign out"
          >
            <span className="material-symbols-outlined text-base">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

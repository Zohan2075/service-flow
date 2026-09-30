"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useTheme } from "@/components/ThemeProvider";
import { useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { SPRING_SNAPPY, SPRING_SOFT } from "@/components/ui/motion";

const THEME_OPTIONS = (["light", "dark", "system"] as const).map((value) => ({
  value,
  label: <span className="capitalize">{value}</span>,
}));

export default function Sidebar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user, signOut } = useSupabaseAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useT();

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "SF";

  const interestedNavLabel = useStore((s) => s.settings.interestedNavLabel);
  const programEnabled = useStore((s) => s.settings.programEnabled);

  const navItems = useMemo(() => {
    const all = [
      { href: "/calendar", icon: "calendar_month", labelKey: "nav.calendar" as const },
      { href: "/reports", icon: "analytics", labelKey: "nav.reports" as const },
      ...(programEnabled ? [{ href: "/presiding", icon: "menu_book", labelKey: "nav.program" as const }] : []),
      { href: "/interested", icon: "people", labelKey: "nav.interested" as const },
      { href: "/settings", icon: "settings", labelKey: "nav.settings" as const },
    ];
    return all;
  }, [programEnabled]);

  const handleSignOut = () => {
    signOut();
    router.push("/login");
  };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-slate-200 dark:border-slate-800">
      {/* Logo */}
      <div className="p-6 flex flex-col items-start gap-1">
        <h1 className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">ServiceFlow</h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map(({ href, icon, labelKey }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors",
                active
                  ? "text-primary"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  transition={SPRING_SOFT}
                  className="absolute inset-0 rounded-xl bg-primary/10"
                />
              )}
              <motion.span
                whileHover={{ scale: 1.05 }}
                transition={SPRING_SNAPPY}
                className="material-symbols-outlined relative z-10"
              >
                {icon}
              </motion.span>
              <span className="relative z-10">
                {labelKey === "nav.interested" && interestedNavLabel ? interestedNavLabel : t(labelKey)}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle + User */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div suppressHydrationWarning>
          <SegmentedControl
            options={THEME_OPTIONS}
            value={theme}
            onChange={(value) => setTheme(value)}
            size="sm"
            fullWidth
            ariaLabel={t("settings.theme")}
          />
        </div>

        {user ? (
          <div className="flex items-center gap-3 p-2 rounded-xl">
            <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={initials}
                  className="size-10 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {user.name ?? "User"}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user.email ?? ""}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              transition={SPRING_SNAPPY}
              onClick={handleSignOut}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Sign out"
            >
              <span className="material-symbols-outlined text-base">logout</span>
            </motion.button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-base">login</span>
            {t("login.continueGoogle")}
          </Link>
        )}
      </div>
    </aside>
  );
}

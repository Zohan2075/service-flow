"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useStore } from "@/lib/store";

const navItems = [
  { href: "/calendar", icon: "calendar_month", labelKey: "nav.calendar" as const },
  { href: "/reports", icon: "analytics", labelKey: "nav.reports" as const },
  { href: "/interested", icon: "people", labelKey: "nav.interested" as const },
  { href: "/settings", icon: "settings", labelKey: "nav.settings" as const },
];

export default function MobileNavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const { user, isLoading, signOut } = useSupabaseAuth();
  const interestedNavLabel = useStore((s) => s.settings.interestedNavLabel);
  const hasLocalData = useStore(
    (s) =>
      s.timeEntries.length > 0 ||
      s.interestedPeople.length > 0 ||
      s.goals.length > 0 ||
      s.serviceTypes.length > 1, // >1 because there's always a default
  );

  const handleSignOut = () => {
    signOut();
    router.push("/login");
  };

  // Show nav items if: logged in, OR auth still loading (offline), OR has local data
  const showNav = !!user || isLoading || hasLocalData;

  if (!showNav) {
    return (
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch h-14">
          <Link
            href="/login"
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
              pathname === "/login"
                ? "text-primary"
                : "text-slate-400 dark:text-slate-500"
            )}
          >
            <span className="material-symbols-outlined text-[22px] leading-none">login</span>
            <span className={cn("text-[10px] font-medium leading-none", pathname === "/login" && "font-bold")}>
              {t("login.continueGoogle")}
            </span>
          </Link>
        </div>
      </nav>
    );
  }

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
                {labelKey === "nav.interested" && interestedNavLabel ? interestedNavLabel : t(labelKey)}
              </span>
            </Link>
          );
        })}
        {user ? (
          <button
            onClick={handleSignOut}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors text-slate-400 dark:text-slate-500 hover:text-red-500"
          >
            <span className="material-symbols-outlined text-[22px] leading-none">logout</span>
            <span className="text-[10px] font-medium leading-none">Sign Out</span>
          </button>
        ) : (
          <Link
            href="/login"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors text-slate-400 dark:text-slate-500"
          >
            <span className="material-symbols-outlined text-[22px] leading-none">login</span>
            <span className="text-[10px] font-medium leading-none">{t("login.continueGoogle")}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

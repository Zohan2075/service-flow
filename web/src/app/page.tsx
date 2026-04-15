"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/calendar");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">Redirecting to your dashboard...</p>
        <Link className="font-semibold text-primary" href="/calendar">
          Continue to calendar
        </Link>
      </div>
    </main>
  );
}

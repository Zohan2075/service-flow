"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>Something went wrong</p>
        <h1 style={{ margin: "0.5rem 0 0", fontSize: "2rem" }}>Unable to load this page</h1>
        <p style={{ margin: "0.75rem 0 0", color: "#475569" }}>
          Try reloading this view or returning to the calendar.
        </p>
        <div
          style={{
            marginTop: "1.25rem",
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => reset()}
            style={{
              border: 0,
              borderRadius: "999px",
              padding: "0.75rem 1rem",
              backgroundColor: "#0f172a",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/calendar"
            style={{
              borderRadius: "999px",
              padding: "0.75rem 1rem",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Return to calendar
          </Link>
        </div>
      </div>
    </main>
  );
}
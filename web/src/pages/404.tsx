import Link from "next/link";

export default function NotFoundPage() {
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
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>404</p>
        <h1 style={{ margin: "0.5rem 0 0", fontSize: "2rem" }}>Page not found</h1>
        <p style={{ margin: "0.75rem 0 0", color: "#475569" }}>
          The page you requested does not exist.
        </p>
        <p style={{ margin: "1.25rem 0 0" }}>
          <Link href="/calendar">Return to calendar</Link>
        </p>
      </div>
    </main>
  );
}
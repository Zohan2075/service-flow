export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="motion-safe:animate-slide-up flex-1 min-h-0 flex flex-col">
      {children}
    </div>
  );
}

import Sidebar from "@/components/layout/Sidebar";
import MobileNavBar from "@/components/layout/MobileNavBar";
import OfflineBanner from "@/components/OfflineBanner";
import TimeWidget from "@/components/TimeWidget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] min-h-[100dvh] overflow-hidden font-display bg-canvas">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <OfflineBanner />
        {children}
      </main>
      <MobileNavBar />
      <TimeWidget />
    </div>
  );
}

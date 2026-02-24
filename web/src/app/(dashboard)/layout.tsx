import Sidebar from "@/components/layout/Sidebar";
import MobileNavBar from "@/components/layout/MobileNavBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden font-display">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
        <MobileNavBar />
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import { AppProvider } from "@/components/AppProvider";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import I18nInitializer from "@/components/I18nInitializer";
import PresidingSheet from "@/components/PresidingSheet";
import Settings from "@/components/Settings";
import "@/i18n/config";

type Tab = "program" | "settings";

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("program");

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <I18nInitializer />
      <Header />
      <main className="flex-1 overflow-y-auto pb-16">
        {activeTab === "program" && <PresidingSheet />}
        {activeTab === "settings" && <Settings />}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { serviceTypesApi, type ServiceType } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import toast from "react-hot-toast";

const COLORS = [
  "#2094f3", "#f97316", "#10b981", "#8b5cf6",
  "#ef4444", "#ec4899", "#14b8a6", "#f59e0b",
];

const ICONS = [
  "build", "groups", "analytics", "computer",
  "phone_in_talk", "drive_eta", "home_repair_service", "medical_services",
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();

  const { data: serviceTypes = [] } = useQuery<ServiceType[]>({
    queryKey: ["service-types"],
    queryFn: serviceTypesApi.list,
  });

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newIcon, setNewIcon] = useState(ICONS[0]);

  const createMutation = useMutation({
    mutationFn: () =>
      serviceTypesApi.create({ name: newName, color: newColor, icon: newIcon }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-types"] });
      setNewName("");
      toast.success("Service type created!");
    },
    onError: () => toast.error("Failed to create service type"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => serviceTypesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-types"] }),
    onError: () => toast.error("Failed to delete"),
  });

  return (
    <>
      <header className="px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-xl font-bold">Settings</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-background-light dark:bg-background-dark">
        {/* Theme */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Appearance</h3>
          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-semibold capitalize border-2 transition-all",
                  theme === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                )}
              >
                {t === "light" ? "☀️ Light" : t === "dark" ? "🌙 Dark" : "💻 System"}
              </button>
            ))}
          </div>
        </div>

        {/* Service Types */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Service Types</h3>

          <div className="space-y-2 mb-6">
            {serviceTypes.map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="size-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: st.color + "1a" }}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ color: st.color }}>
                      {st.icon}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{st.name}</p>
                    {st.description && (
                      <p className="text-xs text-slate-500">{st.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(st.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">Add New</h4>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Service type name"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {/* Color picker */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Color</p>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn(
                      "size-8 rounded-full border-2 transition-all",
                      newColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Icon</p>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setNewIcon(ic)}
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center border-2 transition-all",
                      newIcon === ic
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 dark:border-slate-700 text-slate-500"
                    )}
                  >
                    <span className="material-symbols-outlined text-sm">{ic}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => newName.trim() && createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="w-full py-2.5 bg-primary text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {createMutation.isPending ? "Creating…" : "Create Service Type"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

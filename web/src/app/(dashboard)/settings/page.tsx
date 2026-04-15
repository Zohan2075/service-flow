"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStore, serializeBackup, deserializeBackup } from "@/lib/store";
import { useGoogleAuth } from "@/components/GoogleAuthProvider";
import { uploadBackup, downloadBackup } from "@/lib/drive";
import { useSync } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import type { ServiceType } from "@/types/data";
import toast from "react-hot-toast";

const COLORS = [
  "#2094f3", "#f97316", "#10b981", "#8b5cf6",
  "#ef4444", "#ec4899", "#14b8a6", "#f59e0b",
];

const ICONS = [
  "build", "groups", "analytics", "computer",
  "phone_in_talk", "drive_eta", "home_repair_service", "engineering", "medical_services", "Auto_Stories",
];

const ACCENT_PRESETS = [
  "#2094f3", "#f97316", "#10b981", "#8b5cf6",
  "#ef4444", "#ec4899", "#14b8a6", "#f59e0b",
  "#6366f1", "#0ea5e9", "#d946ef", "#84cc16",
];

const SURFACE_PRESETS_LIGHT = ["#ffffff", "#f8fafc", "#f1f5f9", "#fefce8", "#fdf2f8", "#f0fdfa"];
const SURFACE_PRESETS_DARK = ["#0f172a", "#1e293b", "#18181b", "#1a1a2e", "#1c1917", "#0c1524"];

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, accessToken, isConfigured, error: googleError, requestDriveAccess, signIn } = useGoogleAuth();
  const sync = useSync();

  const serviceTypes = useStore((s) => s.serviceTypes);
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const timeEntries = useStore((s) => s.timeEntries);
  const addServiceType = useStore((s) => s.addServiceType);
  const deleteServiceType = useStore((s) => s.deleteServiceType);
  const reorderServiceTypes = useStore((s) => s.reorderServiceTypes);
  const importData = useStore((s) => s.importData);
  const resetData = useStore((s) => s.resetData);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateProfile = useStore((s) => s.updateProfile);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newIcon, setNewIcon] = useState(ICONS[0]);

  const [driveLoading, setDriveLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(profile?.displayName ?? profile?.name ?? "");
  const [profileBio, setProfileBio] = useState(profile?.bio ?? "");

  // ── Service type create ───────────────────────────────────────────────────
  const handleCreateServiceType = () => {
    if (!newName.trim()) return;
    addServiceType({
      name: newName.trim(),
      description: null,
      color: newColor,
      icon: newIcon,
    });
    setNewName("");
    toast.success("Service type created!");
  };

  // ── Export JSON ────────────────────────────────────────────────────────────
  const handleExport = () => {
    const backup = serializeBackup({ profile, settings, serviceTypes, timeEntries });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `serviceflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully!");
  };

  // ── Import JSON ────────────────────────────────────────────────────────────
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const backup = deserializeBackup(parsed);
        importData(backup);
        toast.success("Data imported successfully!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Invalid backup file");
      }
    };
    input.click();
  };

  // ── Drive Backup ──────────────────────────────────────────────────────────
  const handleDriveBackup = async () => {
    setDriveLoading(true);
    try {
      const token = await requestDriveAccess();
      const backup = serializeBackup({ profile, settings, serviceTypes, timeEntries });
      await uploadBackup(token, JSON.stringify(backup, null, 2));
      updateSettings({ lastSyncedAt: new Date().toISOString() });
      toast.success("Backed up to Google Drive!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drive backup failed");
    } finally {
      setDriveLoading(false);
    }
  };

  const handleServiceTypeDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const oldIndex = serviceTypes.findIndex((serviceType) => serviceType.id === active.id);
    const newIndex = serviceTypes.findIndex((serviceType) => serviceType.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    reorderServiceTypes(arrayMove(serviceTypes, oldIndex, newIndex).map((serviceType) => serviceType.id));
  };

  // ── Drive Restore ─────────────────────────────────────────────────────────
  const handleDriveRestore = async () => {
    setDriveLoading(true);
    try {
      const token = await requestDriveAccess();
      const text = await downloadBackup(token);
      const parsed = JSON.parse(text);
      const backup = deserializeBackup(parsed);
      importData(backup);
      toast.success("Restored from Google Drive!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drive restore failed");
    } finally {
      setDriveLoading(false);
    }
  };

  const handleConnectDrive = async () => {
    setDriveLoading(true);
    try {
      await requestDriveAccess();
      toast.success("Google Drive connected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drive connection failed");
    } finally {
      setDriveLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setDriveLoading(true);
    try {
      await signIn();
      toast.success("Signed in with Google");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setDriveLoading(false);
    }
  };

  // ── Toggle Auto-Sync ─────────────────────────────────────────────────────
  const handleToggleAutoSync = async () => {
    if (!settings.autoSync) {
      // Enabling: request Drive access first
      try {
        await requestDriveAccess();
        updateSettings({ autoSync: true });
        toast.success("Auto-sync enabled");
      } catch {
        toast.error("Drive access required for auto-sync");
      }
    } else {
      updateSettings({ autoSync: false });
      toast.success("Auto-sync disabled");
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = () => {
    updateProfile({
      displayName: profileName.trim() || null,
      bio: profileBio.trim() || null,
    });
    setEditingProfile(false);
    toast.success("Profile updated");
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    resetData();
    setShowResetConfirm(false);
    toast.success("All data cleared");
  };

  const surfacePresets = resolvedTheme === "dark" ? SURFACE_PRESETS_DARK : SURFACE_PRESETS_LIGHT;

  return (
    <>
      <header className="px-4 md:px-6 py-3 md:py-4 bg-surface/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-lg md:text-xl font-bold">Settings</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-24 md:pb-6 space-y-4 md:space-y-6 bg-canvas">

        {/* ── Profile ──────────────────────────────────────────────────────── */}
        {profile && (
          <div className="bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-lg mb-4">Profile</h3>
            <div className="flex items-start gap-4">
              <div className="size-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0 overflow-hidden">
                {profile.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.image} alt="" className="size-14 rounded-full object-cover" />
                ) : (
                  profile.name?.slice(0, 2).toUpperCase()
                )}
              </div>
              {!editingProfile ? (
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate">{profile.displayName || profile.name}</p>
                  <p className="text-sm text-slate-500 truncate">{profile.email}</p>
                  {profile.bio && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{profile.bio}</p>}
                  <button
                    onClick={() => {
                      setProfileName(profile.displayName ?? profile.name ?? "");
                      setProfileBio(profile.bio ?? "");
                      setEditingProfile(true);
                    }}
                    className="text-sm text-primary font-semibold mt-2"
                  >
                    Edit profile
                  </button>
                </div>
              ) : (
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Display Name</label>
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder={profile.name}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Bio / Notes</label>
                    <textarea
                      value={profileBio}
                      onChange={(e) => setProfileBio(e.target.value)}
                      rows={2}
                      placeholder="A short note about yourself..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveProfile}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingProfile(false)}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Appearance</h3>

          {/* Theme preset */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Theme</p>
            <div className="flex gap-2 md:gap-3">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={cn(
                    "flex-1 py-2.5 md:py-3 rounded-xl text-sm font-semibold capitalize border-2 transition-all",
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

          {/* Accent color */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Accent Color</p>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateSettings({ accentColor: c })}
                  className={cn(
                    "size-8 md:size-9 rounded-full border-2 transition-all",
                    settings.accentColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label
                className="size-8 md:size-9 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                title="Custom color"
              >
                <span className="material-symbols-outlined text-sm text-slate-400">palette</span>
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => updateSettings({ accentColor: e.target.value })}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {/* Custom surface */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Custom Surface</p>
              {settings.customSurface && (
                <button
                  onClick={() => updateSettings({ customSurface: null })}
                  className="text-xs text-primary font-semibold"
                >
                  Reset to default
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {surfacePresets.map((c) => (
                <button
                  key={c}
                  onClick={() => updateSettings({ customSurface: c })}
                  className={cn(
                    "size-8 md:size-9 rounded-lg border-2 transition-all",
                    settings.customSurface === c ? "border-primary scale-110" : "border-slate-200 dark:border-slate-700"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label
                className="size-8 md:size-9 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                title="Custom color"
              >
                <span className="material-symbols-outlined text-sm text-slate-400">format_paint</span>
                <input
                  type="color"
                  value={settings.customSurface ?? (resolvedTheme === "dark" ? "#0f172a" : "#ffffff")}
                  onChange={(e) => updateSettings({ customSurface: e.target.value })}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {/* Custom background */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Custom Background</p>
              {settings.customBackground && (
                <button
                  onClick={() => updateSettings({ customBackground: null })}
                  className="text-xs text-primary font-semibold"
                >
                  Reset to default
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {surfacePresets.map((c) => (
                <button
                  key={c}
                  onClick={() => updateSettings({ customBackground: c })}
                  className={cn(
                    "size-8 md:size-9 rounded-lg border-2 transition-all",
                    settings.customBackground === c ? "border-primary scale-110" : "border-slate-200 dark:border-slate-700"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label
                className="size-8 md:size-9 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                title="Custom color"
              >
                <span className="material-symbols-outlined text-sm text-slate-400">format_paint</span>
                <input
                  type="color"
                  value={settings.customBackground ?? (resolvedTheme === "dark" ? "#101a22" : "#f5f7f8")}
                  onChange={(e) => updateSettings({ customBackground: e.target.value })}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        {/* ── Entry Defaults ───────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Entry Defaults</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Default Mode</p>
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                <button
                  onClick={() => updateSettings({ defaultEntryMode: "duration" })}
                  className={cn(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                    settings.defaultEntryMode === "duration"
                      ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  Manual Duration
                </button>
                <button
                  onClick={() => updateSettings({ defaultEntryMode: "range" })}
                  className={cn(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                    settings.defaultEntryMode === "range"
                      ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  Start / End
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Default Hours</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.defaultDurationHours}
                  onChange={(e) => updateSettings({ defaultDurationHours: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Default Minutes</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={settings.defaultDurationMinutes}
                  onChange={(e) => updateSettings({ defaultDurationMinutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Week Layout</p>
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                <button
                  onClick={() => updateSettings({ weekStartsOn: "sunday" })}
                  className={cn(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                    settings.weekStartsOn === "sunday"
                      ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  Sunday to Saturday
                </button>
                <button
                  onClick={() => updateSettings({ weekStartsOn: "monday" })}
                  className={cn(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                    settings.weekStartsOn === "monday"
                      ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  Monday to Sunday
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Week numbers in the calendar follow this layout.
              </p>
            </div>
          </div>
        </div>

        {/* ── Service Types ─────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Service Types</h3>

          <p className="mb-4 text-xs text-slate-400">
            Drag the handle to reorder your service types.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleServiceTypeDragEnd}>
            <SortableContext
              items={serviceTypes.map((serviceType) => serviceType.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 mb-6">
                {serviceTypes.map((serviceType) => (
                  <SortableServiceTypeItem
                    key={serviceType.id}
                    serviceType={serviceType}
                    onDelete={() => deleteServiceType(serviceType.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

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
              onClick={handleCreateServiceType}
              disabled={!newName.trim()}
              className="w-full py-2.5 bg-primary text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              Create Service Type
            </button>
          </div>
        </div>

        {/* ── Data Management ──────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Data Management</h3>
          <div className="space-y-3">
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary">download</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Export to JSON</p>
                <p className="text-xs text-slate-400 truncate">Download a backup file to your device</p>
              </div>
            </button>

            <button
              onClick={handleImport}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary">upload</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Import from JSON</p>
                <p className="text-xs text-slate-400 truncate">Restore data from a backup file</p>
              </div>
            </button>
          </div>
        </div>

        {/* ── Google Drive Sync ────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4">Google Drive Sync</h3>
          <div className="space-y-4">
            {!isConfigured && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to web/.env.local and restart the app to enable Google sign-in and Drive sync.
              </div>
            )}

            {googleError && isConfigured && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {googleError}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn(
                  "material-symbols-outlined shrink-0",
                  !user ? "text-slate-400" : accessToken ? "text-green-500" : "text-amber-500"
                )}>
                  {!user ? "account_circle" : accessToken ? "cloud_done" : "cloud_sync"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {!user ? "Google account not signed in" : accessToken ? "Google Drive connected" : "Google Drive not connected yet"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {!user
                      ? "Sign in first, then connect Drive sync."
                      : accessToken
                        ? "Drive sync is ready for auto-sync, backup, and restore."
                        : "Connect Drive once to enable sync, backup, and restore."}
                  </p>
                </div>
              </div>
              {!user ? (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={driveLoading || !isConfigured}
                  className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white hover:opacity-90 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sign in with Google
                </button>
              ) : (
                <button
                  onClick={handleConnectDrive}
                  disabled={driveLoading}
                  className="shrink-0 rounded-xl border-2 border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {accessToken ? "Reconnect Drive" : "Connect Drive"}
                </button>
              )}
            </div>

          {user ? (
            <div className="space-y-4">
              {/* Auto-sync toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "material-symbols-outlined",
                    settings.autoSync ? "text-green-500" : "text-slate-400"
                  )}>
                    sync
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Auto-sync</p>
                    <p className="text-xs text-slate-400">Sync changes to Drive while the app is open</p>
                  </div>
                </div>
                <button
                  onClick={handleToggleAutoSync}
                  disabled={driveLoading}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors disabled:opacity-50",
                    settings.autoSync ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 size-5 bg-white rounded-full shadow transition-transform",
                    settings.autoSync ? "translate-x-[1.375rem]" : "translate-x-0.5"
                  )} />
                </button>
              </div>

              {/* Sync status */}
              {settings.autoSync && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "material-symbols-outlined text-base",
                      sync.status === "syncing" ? "text-primary animate-spin" :
                      sync.status === "error" ? "text-red-500" :
                      sync.status === "idle" ? "text-green-500" : "text-slate-400"
                    )}>
                      {sync.status === "syncing" ? "sync" :
                       sync.status === "error" ? "error" :
                       sync.status === "idle" ? "cloud_done" : "cloud_off"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold capitalize">{sync.status === "idle" ? "Synced" : sync.status}</p>
                      {sync.error && <p className="text-xs text-red-500 truncate">{sync.error}</p>}
                      {settings.lastSyncedAt && sync.status !== "error" && (
                        <p className="text-xs text-slate-400">
                          Last: {new Date(settings.lastSyncedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => sync.syncNow()}
                    disabled={sync.status === "syncing"}
                    className="text-xs text-primary font-semibold disabled:opacity-50 shrink-0 ml-2"
                  >
                    Sync now
                  </button>
                </div>
              )}

              {/* Manual backup/restore */}
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Manual</p>
                <button
                  onClick={handleDriveBackup}
                  disabled={driveLoading}
                  className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-green-500">cloud_upload</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Backup to Drive</p>
                    <p className="text-xs text-slate-400 truncate">Upload current data to Google Drive</p>
                  </div>
                </button>

                <button
                  onClick={handleDriveRestore}
                  disabled={driveLoading}
                  className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-blue-500">cloud_download</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Restore from Drive</p>
                    <p className="text-xs text-slate-400 truncate">Download and restore backup from Google Drive</p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-500">
              Use the button above to sign in, then connect Google Drive sync.
            </div>
          )}
          </div>
        </div>

        {/* ── Danger Zone ──────────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl p-4 md:p-6 border border-red-200 dark:border-red-900/50 shadow-sm">
          <h3 className="font-bold text-lg mb-4 text-red-500">Danger Zone</h3>
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-red-200 dark:border-red-900/50 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left text-red-600 dark:text-red-400"
            >
              <span className="material-symbols-outlined">delete_forever</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Reset All Data</p>
                <p className="text-xs opacity-70 truncate">Permanently delete all service types, entries, and settings</p>
              </div>
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-500 font-medium">
                Are you sure? This will permanently delete all your data. Consider exporting a backup first.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
                >
                  Delete Everything
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SortableServiceTypeItem({
  serviceType,
  onDelete,
}: {
  serviceType: ServiceType;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: serviceType.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-surface",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 touch-none cursor-grab active:cursor-grabbing dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Drag to reorder"
          aria-label={`Drag ${serviceType.name} to reorder`}
          {...attributes}
          {...listeners}
        >
          <span className="material-symbols-outlined text-base">drag_indicator</span>
        </button>
        <div
          className="size-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: serviceType.color + "1a" }}
        >
          <span className="material-symbols-outlined text-sm" style={{ color: serviceType.color }}>
            {serviceType.icon}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{serviceType.name}</p>
          {serviceType.description && (
            <p className="text-xs text-slate-500 truncate">{serviceType.description}</p>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
        title="Delete"
      >
        <span className="material-symbols-outlined text-base">delete</span>
      </button>
    </div>
  );
}

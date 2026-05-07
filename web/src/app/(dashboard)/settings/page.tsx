"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { downloadBackup } from "@/lib/drive";
import { useSync } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { monthShortYear, useT } from "@/lib/i18n";
import type { GoalDefinition, ServiceType } from "@/types/data";
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

type GoalMetrics = Pick<GoalDefinition, "monthly_duration_seconds" | "monthly_units_quantity" | "yearly_duration_seconds" | "yearly_units_quantity" | "yearly_start_month">;

type ServiceGoalPayload = GoalMetrics & {
  name: string;
};

type CombinedGoalPayload = GoalMetrics & {
  name: string;
  service_type_ids: string[];
};

type CombinedGoalDraft = CombinedGoalPayload & {
  id: string;
};

type SettingsCategory = "account" | "appearance" | "language" | "entries" | "reports" | "data" | "danger";

const PROFILE_IMAGE_MAX_SIZE = 320;
const PROFILE_IMAGE_OUTPUT_QUALITY = 0.84;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read image"));
    };

    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image"));
    image.src = src;
  });
}

async function optimizeProfileImage(file: File) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImageElement(source);
  const longestSide = Math.max(image.width, image.height);
  const scale = longestSide > PROFILE_IMAGE_MAX_SIZE
    ? PROFILE_IMAGE_MAX_SIZE / longestSide
    : 1;
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare image");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL("image/jpeg", PROFILE_IMAGE_OUTPUT_QUALITY);
}

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t, language, setLanguage } = useT();
  const { user, accessToken, isLoading: googleLoading, isConfigured, error: googleError, requestDriveAccess, signIn } = useGoogleAuth();
  const sync = useSync();

  const serviceTypes = useStore((s) => s.serviceTypes);
  const profile = useStore((s) => s.profile);
  const settings = useStore((s) => s.settings);
  const timeEntries = useStore((s) => s.timeEntries);
  const goals = useStore((s) => s.goals);
  const viewedMonth = useStore((s) => s.uiState.viewedMonth);
  const addServiceType = useStore((s) => s.addServiceType);
  const addGoal = useStore((s) => s.addGoal);
  const deleteServiceType = useStore((s) => s.deleteServiceType);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const updateServiceType = useStore((s) => s.updateServiceType);
  const updateGoal = useStore((s) => s.updateGoal);
  const reorderServiceTypes = useStore((s) => s.reorderServiceTypes);
  const importData = useStore((s) => s.importData);
  const completeSync = useStore((s) => s.completeSync);
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
  const [newEntryType, setNewEntryType] = useState<ServiceType["entry_type"]>("time");
  const [combinedGoalDrafts, setCombinedGoalDrafts] = useState<CombinedGoalDraft[]>([]);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("account");

  const [driveLoading, setDriveLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(profile?.displayName ?? profile?.name ?? "");
  const [profileBio, setProfileBio] = useState(profile?.bio ?? "");
  const [profileCustomImage, setProfileCustomImage] = useState<string | null>(profile?.customImage ?? null);
  const [processingProfileImage, setProcessingProfileImage] = useState(false);
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);

  // ── Service type create ───────────────────────────────────────────────────
  const handleCreateServiceType = () => {
    if (!newName.trim()) return;
    addServiceType({
      name: newName.trim(),
      description: null,
      entry_type: newEntryType,
      color: newColor,
      icon: newIcon,
    });
    setNewName("");
    setNewEntryType("time");
    toast.success(t("settings.stCreated"));
  };

  const serviceTypeMap = useMemo(
    () => new Map(serviceTypes.map((serviceType) => [serviceType.id, serviceType])),
    [serviceTypes]
  );

  const serviceGoalMap = useMemo(
    () => new Map(
      goals
        .filter((goal) => goal.scope === "service" && goal.service_type_id)
        .map((goal) => [goal.service_type_id as string, goal])
    ),
    [goals]
  );

  const combinedGoals = useMemo(
    () => goals.filter((goal) => goal.scope === "combined"),
    [goals]
  );

  const handleCreateCombinedGoalDraft = () => {
    if (serviceTypes.length === 0) return;

    setCombinedGoalDrafts((currentDrafts) => [
      ...currentDrafts,
      {
        id: crypto.randomUUID(),
        name: `${t("settings.goalDefaultName")} ${combinedGoals.length + currentDrafts.length + 1}`,
        service_type_ids: [serviceTypes[0].id],
        monthly_duration_seconds: null,
        monthly_units_quantity: null,
        yearly_duration_seconds: null,
        yearly_units_quantity: null,
        yearly_start_month: 9,
      },
    ]);
  };

  const handleSaveServiceGoal = (serviceTypeId: string, goalDraft: ServiceGoalPayload) => {
    const existingGoal = serviceGoalMap.get(serviceTypeId);
    const serviceType = serviceTypeMap.get(serviceTypeId);

    if (!hasAnyGoalMetrics(goalDraft)) {
      if (existingGoal) {
        deleteGoal(existingGoal.id);
        toast.success(t("settings.goalCleared"));
      }
      return;
    }

    const payload = {
      ...goalDraft,
      name: goalDraft.name.trim() || serviceType?.name || t("settings.goalDefaultName"),
      scope: "service" as const,
      service_type_id: serviceTypeId,
      service_type_ids: [],
    };

    if (existingGoal) {
      updateGoal(existingGoal.id, payload);
    } else {
      addGoal(payload);
    }

    toast.success(t("settings.goalSaved"));
  };

  const handleClearServiceGoal = (serviceTypeId: string) => {
    const existingGoal = serviceGoalMap.get(serviceTypeId);
    if (!existingGoal) return;

    deleteGoal(existingGoal.id);
    toast.success(t("settings.goalCleared"));
  };

  const handleSaveCombinedGoal = (goalId: string, payload: CombinedGoalPayload, options?: { draftId?: string }) => {
    if (payload.service_type_ids.length === 0) {
      toast.error(t("settings.goalServicesRequired"));
      return;
    }

    if (!hasAnyGoalMetrics(payload)) {
      if (options?.draftId) {
        toast.error(t("settings.goalTargetRequired"));
        return;
      }

      deleteGoal(goalId);
      toast.success(t("settings.goalDeleted"));
      return;
    }

    const goalPatch = {
      service_type_id: null,
      ...payload,
      name: payload.name.trim() || t("settings.goalDefaultName"),
    };

    if (options?.draftId) {
      addGoal({
        scope: "combined",
        ...goalPatch,
      });
      setCombinedGoalDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== options.draftId));
      toast.success(t("settings.goalCreated"));
      return;
    }

    updateGoal(goalId, goalPatch);
    toast.success(t("settings.goalSaved"));
  };

  const handleDeleteCombinedGoal = (goalId: string) => {
    deleteGoal(goalId);
    toast.success(t("settings.goalDeleted"));
  };

  const handleCancelCombinedGoalDraft = (draftId: string) => {
    setCombinedGoalDrafts((currentDrafts) => currentDrafts.filter((draft) => draft.id !== draftId));
  };

  // ── Export JSON ────────────────────────────────────────────────────────────
  const handleExport = () => {
    const backup = serializeBackup({ profile, settings, serviceTypes, timeEntries, goals });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `serviceflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("settings.exported"));
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
        toast.success(t("settings.imported"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("settings.invalidBackup"));
      }
    };
    input.click();
  };

  // ── Drive Backup ──────────────────────────────────────────────────────────
  const ensureDriveAccess = async () => {
    if (!isConfigured) {
      throw new Error(t("settings.driveConfigHint"));
    }

    if (!user) {
      await signIn();
    }

    return requestDriveAccess({ interactive: true });
  };

  const handleDriveBackup = async () => {
    setDriveLoading(true);
    try {
      const token = await ensureDriveAccess();
      await sync.syncNow(token);
      toast.success(t("settings.backedUp"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.driveBackupFailed"));
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

  const restoreBackupFromDrive = async (token: string) => {
    const text = await downloadBackup(token);
    const parsed = JSON.parse(text);
    const backup = deserializeBackup(parsed);
    importData(backup, { source: "remote" });
  };

  // ── Drive Restore ─────────────────────────────────────────────────────────
  const handleDriveRestore = async () => {
    setDriveLoading(true);
    try {
      const token = await ensureDriveAccess();
      await restoreBackupFromDrive(token);
      completeSync(new Date().toISOString());
      toast.success(t("settings.restored"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.driveRestoreFailed"));
    } finally {
      setDriveLoading(false);
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = () => {
    updateProfile({
      displayName: profileName.trim() || null,
      bio: profileBio.trim() || null,
      customImage: profileCustomImage,
    });
    setEditingProfile(false);
    toast.success(t("settings.profileUpdated"));
  };

  const handleStartProfileEdit = () => {
    setProfileName(profile?.displayName ?? profile?.name ?? "");
    setProfileBio(profile?.bio ?? "");
    setProfileCustomImage(profile?.customImage ?? null);
    setEditingProfile(true);
  };

  const handleProfileImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.profilePhotoFailed"));
      return;
    }

    setProcessingProfileImage(true);

    try {
      const nextImage = await optimizeProfileImage(file);
      setProfileCustomImage(nextImage);
    } catch {
      toast.error(t("settings.profilePhotoFailed"));
    } finally {
      setProcessingProfileImage(false);
    }
  };

  const handleResetProfileImage = () => {
    setProfileCustomImage(null);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    resetData();
    setShowResetConfirm(false);
    toast.success(t("settings.allCleared"));
  };

  const activeThemeLabel = resolvedTheme === "dark" ? t("settings.dark") : t("settings.light");
  const activeSurface = resolvedTheme === "dark" ? settings.customSurfaceDark : settings.customSurfaceLight;
  const activeBackground = resolvedTheme === "dark" ? settings.customBackgroundDark : settings.customBackgroundLight;
  const isDriveBusy = driveLoading || googleLoading || sync.status === "syncing";
  const hasPendingChanges = useStore((s) => s.syncMetadata.hasPendingChanges);
  const updateActiveSurface = (value: string | null) => {
    updateSettings(resolvedTheme === "dark" ? { customSurfaceDark: value } : { customSurfaceLight: value });
  };
  const updateActiveBackground = (value: string | null) => {
    updateSettings(resolvedTheme === "dark" ? { customBackgroundDark: value } : { customBackgroundLight: value });
  };
  const surfacePresets = resolvedTheme === "dark" ? SURFACE_PRESETS_DARK : SURFACE_PRESETS_LIGHT;
  const previewProfileAvatar = profileCustomImage ?? profile?.image ?? null;
  const settingsCategories: Array<{ id: SettingsCategory; label: string; icon: string }> = [
    { id: "account", label: t("settings.profile"), icon: "person" },
    { id: "appearance", label: t("settings.appearance"), icon: "palette" },
    { id: "language", label: t("settings.language"), icon: "translate" },
    { id: "entries", label: t("settings.entriesServices"), icon: "construction" },
    { id: "reports", label: t("settings.reportsGoals"), icon: "flag" },
    { id: "data", label: t("settings.dataBackup"), icon: "cloud_upload" },
    { id: "danger", label: t("settings.dangerZone"), icon: "warning" },
  ];

  useEffect(() => {
    if (editingProfile) {
      return;
    }

    setProfileName(profile?.displayName ?? profile?.name ?? "");
    setProfileBio(profile?.bio ?? "");
    setProfileCustomImage(profile?.customImage ?? null);
  }, [editingProfile, profile]);

  return (
    <>
      <header className="px-4 md:px-6 py-3 md:py-4 bg-surface/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-lg md:text-xl font-bold">{t("settings.title")}</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-24 md:pb-6 space-y-4 md:space-y-6 bg-canvas">
        <div className="bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("settings.title")}</p>
            <h3 className="text-lg font-bold">{t("settings.organizedSettingsTitle")}</h3>
            <p className="text-sm text-slate-500">{t("settings.organizedSettingsDesc")}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {settingsCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                  activeCategory === category.id
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-slate-200 text-slate-600 hover:border-primary/30 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-primary/30 dark:hover:bg-slate-900/40"
                )}
              >
                <span className="material-symbols-outlined text-xl">{category.icon}</span>
                <span className="text-sm font-semibold">{category.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Profile ──────────────────────────────────────────────────────── */}
        {profile && (
          <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm", activeCategory !== "account" && "hidden")}>
            <h3 className="font-bold text-lg mb-4">Profile</h3>
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <div className="space-y-3">
                <div className="size-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                  {previewProfileAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewProfileAvatar} alt="" className="size-20 rounded-full object-cover" />
                  ) : (
                    profile.name?.slice(0, 2).toUpperCase()
                  )}
                </div>

                {editingProfile && (
                  <div className="space-y-2">
                    <input
                      ref={profileImageInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleProfileImageSelected}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => profileImageInputRef.current?.click()}
                        disabled={processingProfileImage}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {processingProfileImage
                          ? t("settings.profilePhotoProcessing")
                          : profileCustomImage
                            ? t("settings.replacePhoto")
                            : t("settings.uploadPhoto")}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetProfileImage}
                        disabled={!profileCustomImage}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {t("settings.resetPhoto")}
                      </button>
                    </div>
                    <p className="max-w-xs text-xs text-slate-400">{t("settings.profilePhotoHint")}</p>
                  </div>
                )}
              </div>
              {!editingProfile ? (
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base break-words">{profile.displayName || profile.name}</p>
                  <p className="text-sm text-slate-500 break-all">{profile.email}</p>
                  {profile.bio && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 break-words">{profile.bio}</p>}
                  <p className="mt-2 text-xs text-slate-400">
                    {profile.customImage ? t("settings.customPhotoActive") : t("settings.googlePhotoActive")}
                  </p>
                  <button
                    onClick={handleStartProfileEdit}
                    className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-sm text-primary font-semibold"
                  >
                    {t("settings.editProfile")}
                  </button>
                </div>
              ) : (
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.displayName")}</label>
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder={profile.name}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.bioNotes")}</label>
                    <textarea
                      value={profileBio}
                      onChange={(e) => setProfileBio(e.target.value)}
                      rows={2}
                      placeholder={t("settings.bioPlaceholder")}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={handleSaveProfile}
                      className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all"
                    >
                      {t("settings.save")}
                    </button>
                    <button
                      onClick={() => setEditingProfile(false)}
                      className="w-full sm:w-auto px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {t("settings.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-surface to-rose-50/80 p-4 md:p-6 shadow-sm dark:border-amber-900/40 dark:from-amber-950/20 dark:via-surface dark:to-rose-950/20",
            activeCategory !== "account" && "hidden"
          )}
        >
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-amber-200/50 blur-2xl dark:bg-amber-500/10" />
          <div className="absolute -left-6 bottom-0 size-20 rounded-full bg-rose-200/50 blur-2xl dark:bg-rose-500/10" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 shadow-sm dark:bg-slate-900/50 dark:text-amber-300">
                <span className="material-symbols-outlined text-sm">favorite</span>
                {t("settings.supportBadge")}
              </span>
              <div className="space-y-1">
                <h3 className="text-lg font-bold">{t("settings.supportTitle")}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{t("settings.supportDesc")}</p>
              </div>
            </div>

            <a
              href="https://ko-fi.com/U7U81WJ6BY"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-lg">local_cafe</span>
              <span>{t("settings.supportButton")}</span>
              <span className="material-symbols-outlined text-lg">open_in_new</span>
            </a>
          </div>
        </div>

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm", activeCategory !== "appearance" && "hidden")}>
          <h3 className="font-bold text-lg mb-4">{t("settings.appearance")}</h3>

          {/* Theme preset */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("settings.theme")}</p>
            <div className="flex gap-2 md:gap-3">
              {(["light", "dark", "system"] as const).map((th) => (
                <button
                  key={th}
                  onClick={() => setTheme(th)}
                  className={cn(
                    "flex-1 py-2.5 md:py-3 rounded-xl text-sm font-semibold capitalize border-2 transition-all",
                    theme === th
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                >
                  {th === "light" ? t("settings.light") : th === "dark" ? t("settings.dark") : t("settings.system")}
                </button>
              ))}
            </div>
          </div>

          {/* Accent color */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("settings.accentColor")}</p>
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
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t("settings.customSurface")}
                <span className="ml-2 text-[10px] text-slate-400">{activeThemeLabel}</span>
              </p>
              {activeSurface && (
                <button
                  onClick={() => updateActiveSurface(null)}
                  className="text-xs text-primary font-semibold"
                >
                  {t("settings.resetDefault")}
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {surfacePresets.map((c) => (
                <button
                  key={c}
                  onClick={() => updateActiveSurface(c)}
                  className={cn(
                    "size-8 md:size-9 rounded-lg border-2 transition-all",
                    activeSurface === c ? "border-primary scale-110" : "border-slate-200 dark:border-slate-700"
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
                  value={activeSurface ?? (resolvedTheme === "dark" ? "#0f172a" : "#ffffff")}
                  onChange={(e) => updateActiveSurface(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {/* Custom background */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {t("settings.customBackground")}
                <span className="ml-2 text-[10px] text-slate-400">{activeThemeLabel}</span>
              </p>
              {activeBackground && (
                <button
                  onClick={() => updateActiveBackground(null)}
                  className="text-xs text-primary font-semibold"
                >
                  {t("settings.resetDefault")}
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {surfacePresets.map((c) => (
                <button
                  key={c}
                  onClick={() => updateActiveBackground(c)}
                  className={cn(
                    "size-8 md:size-9 rounded-lg border-2 transition-all",
                    activeBackground === c ? "border-primary scale-110" : "border-slate-200 dark:border-slate-700"
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
                  value={activeBackground ?? (resolvedTheme === "dark" ? "#101a22" : "#f5f7f8")}
                  onChange={(e) => updateActiveBackground(e.target.value)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        {/* ── Language ─────────────────────────────────────────────────────── */}
        <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm", activeCategory !== "language" && "hidden")}>
          <h3 className="font-bold text-lg mb-4">{t("settings.language")}</h3>
          <p className="mb-4 text-sm text-slate-500">{t("settings.languageDesc")}</p>
          <div className="flex gap-2 md:gap-3">
            {(["en", "es"] as const).map((lng) => (
              <button
                key={lng}
                onClick={() => setLanguage(lng)}
                className={cn(
                  "flex-1 py-2.5 md:py-3 rounded-xl text-sm font-semibold border-2 transition-all",
                  language === lng
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                )}
              >
                {lng === "en" ? t("settings.langEnglish") : t("settings.langSpanish")}
              </button>
            ))}
          </div>
        </div>

        {/* ── Entry Defaults ───────────────────────────────────────────────── */}
        <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm", activeCategory !== "entries" && "hidden")}>
          <h3 className="font-bold text-lg mb-4">{t("settings.entryDefaults")}</h3>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40">
              <div>
                <p className="text-sm font-semibold">{t("settings.planMode")}</p>
                <p className="text-xs text-slate-400">{t("settings.planModeDesc")}</p>
              </div>
              <button
                onClick={() => updateSettings({ planModeEnabled: !settings.planModeEnabled })}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  settings.planModeEnabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                    settings.planModeEnabled ? "translate-x-[1.375rem]" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("settings.defaultMode")}</p>
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
                  {t("entry.manualDuration")}
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
                  {t("entry.startEnd")}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.defaultHours")}</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.defaultDurationHours === 0 ? "" : settings.defaultDurationHours}
                  onChange={(e) => updateSettings({ defaultDurationHours: e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0) })}
                  onBlur={(e) => { if (e.target.value === "") updateSettings({ defaultDurationHours: 0 }); }}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.defaultMinutes")}</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={settings.defaultDurationMinutes === 0 ? "" : settings.defaultDurationMinutes}
                  onChange={(e) => updateSettings({ defaultDurationMinutes: e.target.value === "" ? 0 : Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                  onBlur={(e) => { if (e.target.value === "") updateSettings({ defaultDurationMinutes: 0 }); }}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("settings.weekLayout")}</p>
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
                  {t("settings.sunSat")}
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
                  {t("settings.monSun")}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {t("settings.weekNote")}
              </p>
            </div>
          </div>
        </div>

        {/* ── Reports Display ──────────────────────────────────────────────── */}
        <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm", activeCategory !== "reports" && "hidden")}>
          <h3 className="font-bold text-lg mb-4">{t("settings.reportsDisplay")}</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{t("settings.showYearTotals")}</p>
              <p className="text-xs text-slate-400">{t("settings.showYearTotalsDesc")}</p>
            </div>
            <button
              onClick={() => updateSettings({ showYearTotals: !settings.showYearTotals })}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors shrink-0",
                settings.showYearTotals ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
              )}
            >
              <div className={cn(
                "absolute top-0.5 size-5 bg-white rounded-full shadow transition-transform",
                settings.showYearTotals ? "translate-x-[1.375rem]" : "translate-x-0.5"
              )} />
            </button>
          </div>
        </div>

        {/* ── Goals ───────────────────────────────────────────────────────── */}
        <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm", activeCategory !== "reports" && "hidden")}>
          <div className="mb-5 space-y-2">
            <h3 className="font-bold text-lg">{t("settings.goals")}</h3>
            <p className="text-sm text-slate-500">{t("settings.goalsHint")}</p>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-xs text-slate-500">
              {t("settings.goalsTotalsNote")}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">{t("settings.serviceGoals")}</h4>
              </div>
              <div className="space-y-3">
                {serviceTypes.map((serviceType) => (
                  <ServiceGoalCard
                    key={serviceType.id}
                    serviceType={serviceType}
                    goal={serviceGoalMap.get(serviceType.id)}
                    previewDate={viewedMonth}
                    onSave={(goalDraft) => handleSaveServiceGoal(serviceType.id, goalDraft)}
                    onClear={() => handleClearServiceGoal(serviceType.id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">{t("settings.combinedGoals")}</h4>
                </div>
                <button
                  onClick={handleCreateCombinedGoalDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary dark:text-slate-300 dark:hover:border-primary/40 dark:hover:bg-primary/15"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  <span>{t("settings.addCombinedGoal")}</span>
                </button>
              </div>

              {combinedGoals.length === 0 && combinedGoalDrafts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
                  {t("settings.noCombinedGoals")}
                </div>
              ) : (
                <div className="space-y-3">
                  {combinedGoalDrafts.map((draft) => (
                    <CombinedGoalCard
                      key={draft.id}
                      serviceTypes={serviceTypes}
                      initialName={draft.name}
                      initialServiceTypeIds={draft.service_type_ids}
                      initialMetrics={draft}
                      previewDate={viewedMonth}
                      isDraft
                      onSave={(payload) => handleSaveCombinedGoal(draft.id, payload, { draftId: draft.id })}
                      onDelete={() => handleCancelCombinedGoalDraft(draft.id)}
                    />
                  ))}

                  {combinedGoals.map((goal) => (
                    <CombinedGoalCard
                      key={goal.id}
                      serviceTypes={serviceTypes}
                      initialName={goal.name}
                      initialServiceTypeIds={goal.service_type_ids}
                      initialMetrics={goal}
                      previewDate={viewedMonth}
                      onSave={(payload) => handleSaveCombinedGoal(goal.id, payload)}
                      onDelete={() => handleDeleteCombinedGoal(goal.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Service Types ─────────────────────────────────────────────────── */}
        <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm", activeCategory !== "entries" && "hidden")}>
          <h3 className="font-bold text-lg mb-4">{t("settings.serviceTypes")}</h3>

          <p className="mb-4 text-xs text-slate-400">
            {t("settings.dragHint")}
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
                    canDelete={serviceTypes.length > 1}
                    onDelete={() => deleteServiceType(serviceType.id)}
                    onUpdate={(patch) => {
                      updateServiceType(serviceType.id, patch);
                      toast.success(t("settings.stUpdated"));
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add new */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">{t("settings.addNew")}</h4>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("settings.stName")}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">{t("settings.serviceEntryType")}</p>
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setNewEntryType("time")}
                  className={cn(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                    newEntryType === "time"
                      ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  {t("settings.entryTypeTime")}
                </button>
                <button
                  type="button"
                  onClick={() => setNewEntryType("units")}
                  className={cn(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                    newEntryType === "units"
                      ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  {t("settings.entryTypeUnits")}
                </button>
              </div>
            </div>

            {/* Color picker */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">{t("settings.color")}</p>
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
                <label
                  className={cn(
                    "size-8 rounded-full border-2 flex items-center justify-center cursor-pointer hover:border-primary transition-colors",
                    !COLORS.includes(newColor) ? "border-slate-900 dark:border-white scale-110" : "border-dashed border-slate-300 dark:border-slate-600"
                  )}
                  style={!COLORS.includes(newColor) ? { backgroundColor: newColor } : undefined}
                  title="Custom color"
                >
                  <span className="material-symbols-outlined text-sm" style={!COLORS.includes(newColor) ? { color: "#fff", mixBlendMode: "difference" } : { color: undefined }}>
                    palette
                  </span>
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Icon picker */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">{t("settings.icon")}</p>
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
              {t("settings.createST")}
            </button>
          </div>
        </div>

        {/* ── Data Management ──────────────────────────────────────────────── */}
        <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm", activeCategory !== "data" && "hidden")}>
          <h3 className="font-bold text-lg mb-4">{t("settings.dataManagement")}</h3>
          <div className="space-y-3">
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary">download</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t("settings.exportJson")}</p>
                <p className="text-xs text-slate-400 truncate">{t("settings.exportDesc")}</p>
              </div>
            </button>

            <button
              onClick={handleImport}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-primary">upload</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t("settings.importJson")}</p>
                <p className="text-xs text-slate-400 truncate">{t("settings.importDesc")}</p>
              </div>
            </button>
          </div>
        </div>

        {/* ── Google Drive Sync ────────────────────────────────────────────── */}
        <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm", activeCategory !== "data" && "hidden")}>
          <h3 className="font-bold text-lg mb-4">{t("settings.driveSync")}</h3>
          <div className="space-y-4">
            {!isConfigured && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                {t("settings.driveConfigHint")}
              </div>
            )}

            {googleError && isConfigured && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {googleError}
              </div>
            )}

            <div className="flex gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/30">
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn(
                  "material-symbols-outlined shrink-0",
                  !user ? "text-slate-400" : accessToken ? "text-green-500" : "text-amber-500"
                )}>
                  {!user ? "account_circle" : accessToken ? "cloud_done" : "cloud_sync"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {!user ? t("settings.notSignedIn") : accessToken ? t("settings.driveConnected") : t("settings.driveNotConnected")}
                  </p>
                  <p className="text-xs text-slate-400">
                    {!user
                      ? t("settings.signInFirst")
                      : accessToken
                        ? t("settings.driveReady")
                        : t("settings.connectDriveOnce")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Backup status */}
              <div className="flex gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "material-symbols-outlined text-base",
                    sync.status === "syncing" ? "text-primary animate-spin" :
                    sync.status === "error" ? "text-red-500" :
                    hasPendingChanges ? "text-amber-500" : "text-green-500"
                  )}>
                    {sync.status === "syncing" ? "sync" :
                     sync.status === "error" ? "error" :
                     hasPendingChanges ? "cloud_upload" : "cloud_done"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">
                      {sync.status === "syncing" ? t("settings.syncing") :
                       sync.status === "error" ? t("settings.syncError") :
                       hasPendingChanges ? t("settings.pendingBackup") :
                       t("settings.noPendingChanges")}
                    </p>
                    {sync.error && (
                      <p className="text-xs text-red-500">{sync.error}</p>
                    )}
                    {settings.lastSyncedAt && sync.status !== "error" && (
                      <p className="text-xs text-slate-400">
                        {t("settings.last")}: {new Date(settings.lastSyncedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Manual backup/restore */}
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("settings.manual")}</p>
                <button
                  onClick={handleDriveBackup}
                  disabled={isDriveBusy || !isConfigured}
                  className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-green-500">cloud_upload</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t("settings.backupDrive")}</p>
                    <p className="text-xs text-slate-400 truncate">{t("settings.backupDriveDesc")}</p>
                  </div>
                </button>

                <button
                  onClick={handleDriveRestore}
                  disabled={isDriveBusy || !isConfigured}
                  className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-blue-500">cloud_download</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t("settings.restoreDrive")}</p>
                    <p className="text-xs text-slate-400 truncate">{t("settings.restoreDriveDesc")}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Danger Zone ──────────────────────────────────────────────────── */}
        <div className={cn("bg-surface rounded-2xl p-4 md:p-6 border border-red-200 dark:border-red-900/50 shadow-sm", activeCategory !== "danger" && "hidden")}>
          <h3 className="font-bold text-lg mb-4 text-red-500">{t("settings.dangerZone")}</h3>
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-red-200 dark:border-red-900/50 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left text-red-600 dark:text-red-400"
            >
              <span className="material-symbols-outlined">delete_forever</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t("settings.resetAll")}</p>
                <p className="text-xs opacity-70 truncate">{t("settings.resetAllDesc")}</p>
              </div>
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-500 font-medium">
                {t("settings.resetConfirm")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t("settings.cancel")}
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
                >
                  {t("settings.deleteEverything")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function formatGoalHoursInput(seconds: number | null) {
  if (!seconds) return "";

  const hours = Math.round((seconds / 3600) * 100) / 100;
  return Number.isInteger(hours) ? String(hours) : String(hours);
}

function parseGoalHoursInput(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const parsed = Number(trimmedValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 3600);
}

function parseGoalUnitsInput(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const parsed = Number(trimmedValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function buildGoalMetrics(values: {
  monthlyHours: string;
  monthlyUnits: string;
  yearlyHours: string;
  yearlyUnits: string;
  yearlyStartMonth: number;
}): GoalMetrics {
  return {
    monthly_duration_seconds: parseGoalHoursInput(values.monthlyHours),
    monthly_units_quantity: parseGoalUnitsInput(values.monthlyUnits),
    yearly_duration_seconds: parseGoalHoursInput(values.yearlyHours),
    yearly_units_quantity: parseGoalUnitsInput(values.yearlyUnits),
    yearly_start_month: values.yearlyStartMonth,
  };
}

function hasAnyGoalMetrics(metrics: GoalMetrics) {
  return Boolean(
    metrics.monthly_duration_seconds ||
    metrics.monthly_units_quantity ||
    metrics.yearly_duration_seconds ||
    metrics.yearly_units_quantity
  );
}

function formatGoalCyclePreview(startMonth: number, previewDate: Date, language: "en" | "es") {
  const referenceMonth = previewDate.getMonth() + 1;
  const referenceYear = previewDate.getFullYear();
  const cycleStartYear = referenceMonth < startMonth ? referenceYear - 1 : referenceYear;
  const cycleStart = new Date(cycleStartYear, startMonth - 1, 1);
  const cycleEnd = new Date(cycleStartYear + 1, startMonth - 1, 0);

  return `${monthShortYear(cycleStart, language)} - ${monthShortYear(cycleEnd, language)}`;
}

function GoalMetricFields({
  monthlyHours,
  monthlyUnits,
  yearlyHours,
  yearlyUnits,
  yearlyStartMonth,
  cyclePreview,
  setMonthlyHours,
  setMonthlyUnits,
  setYearlyHours,
  setYearlyUnits,
  setYearlyStartMonth,
}: {
  monthlyHours: string;
  monthlyUnits: string;
  yearlyHours: string;
  yearlyUnits: string;
  yearlyStartMonth: number;
  cyclePreview: string;
  setMonthlyHours: (value: string) => void;
  setMonthlyUnits: (value: string) => void;
  setYearlyHours: (value: string) => void;
  setYearlyUnits: (value: string) => void;
  setYearlyStartMonth: (value: number) => void;
}) {
  const { t, language } = useT();
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: monthShortYear(new Date(2026, index, 1), language).split(" ")[0],
    })),
    [language]
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("settings.monthlyGoal")}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.goalHours")}</label>
            <input
              value={monthlyHours}
              onChange={(e) => setMonthlyHours(e.target.value)}
              type="number"
              min="0"
              step="0.25"
              inputMode="decimal"
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.goalUnits")}</label>
            <input
              value={monthlyUnits}
              onChange={(e) => setMonthlyUnits(e.target.value)}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("settings.yearlyGoal")}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="sm:w-44">
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.goalCycleStart")}</label>
            <select
              value={yearlyStartMonth}
              onChange={(e) => setYearlyStartMonth(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              {monthOptions.map((monthOption) => (
                <option key={monthOption.value} value={monthOption.value}>{monthOption.label}</option>
              ))}
            </select>
          </div>
          <div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
            {cyclePreview}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.goalHours")}</label>
            <input
              value={yearlyHours}
              onChange={(e) => setYearlyHours(e.target.value)}
              type="number"
              min="0"
              step="0.25"
              inputMode="decimal"
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.goalUnits")}</label>
            <input
              value={yearlyUnits}
              onChange={(e) => setYearlyUnits(e.target.value)}
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceGoalCard({
  serviceType,
  goal,
  previewDate,
  onSave,
  onClear,
}: {
  serviceType: ServiceType;
  goal: GoalDefinition | undefined;
  previewDate: Date;
  onSave: (payload: ServiceGoalPayload) => void;
  onClear: () => void;
}) {
  const { t, language } = useT();
  const defaultGoalName = `${serviceType.name} ${t("settings.goalDefaultName")}`;
  const [name, setName] = useState(goal?.name ?? defaultGoalName);
  const [monthlyHours, setMonthlyHours] = useState(formatGoalHoursInput(goal?.monthly_duration_seconds ?? null));
  const [monthlyUnits, setMonthlyUnits] = useState(goal?.monthly_units_quantity?.toString() ?? "");
  const [yearlyHours, setYearlyHours] = useState(formatGoalHoursInput(goal?.yearly_duration_seconds ?? null));
  const [yearlyUnits, setYearlyUnits] = useState(goal?.yearly_units_quantity?.toString() ?? "");
  const [yearlyStartMonth, setYearlyStartMonth] = useState(goal?.yearly_start_month ?? 9);

  useEffect(() => {
    setName(goal?.name ?? defaultGoalName);
    setMonthlyHours(formatGoalHoursInput(goal?.monthly_duration_seconds ?? null));
    setMonthlyUnits(goal?.monthly_units_quantity?.toString() ?? "");
    setYearlyHours(formatGoalHoursInput(goal?.yearly_duration_seconds ?? null));
    setYearlyUnits(goal?.yearly_units_quantity?.toString() ?? "");
    setYearlyStartMonth(goal?.yearly_start_month ?? 9);
  }, [defaultGoalName, goal]);

  const cyclePreview = formatGoalCyclePreview(yearlyStartMonth, previewDate, language);

  const handleSave = () => {
    onSave({
      name,
      ...buildGoalMetrics({ monthlyHours, monthlyUnits, yearlyHours, yearlyUnits, yearlyStartMonth }),
    });
  };

  const handleClear = () => {
    setName(defaultGoalName);
    setMonthlyHours("");
    setMonthlyUnits("");
    setYearlyHours("");
    setYearlyUnits("");
    setYearlyStartMonth(9);
    onClear();
  };

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-surface p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="size-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: serviceType.color + "1a" }}
          >
            <span className="material-symbols-outlined text-lg" style={{ color: serviceType.color }}>
              {serviceType.icon}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{serviceType.name}</p>
            <p className="text-xs text-slate-400">{t("settings.serviceGoals")}</p>
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <button
            onClick={handleSave}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-all"
          >
            {t("settings.save")}
          </button>
          <button
            onClick={handleClear}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t("settings.clearGoal")}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.goalName")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={defaultGoalName}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        />
      </div>

      <GoalMetricFields
        monthlyHours={monthlyHours}
        monthlyUnits={monthlyUnits}
        yearlyHours={yearlyHours}
        yearlyUnits={yearlyUnits}
        yearlyStartMonth={yearlyStartMonth}
        cyclePreview={cyclePreview}
        setMonthlyHours={setMonthlyHours}
        setMonthlyUnits={setMonthlyUnits}
        setYearlyHours={setYearlyHours}
        setYearlyUnits={setYearlyUnits}
        setYearlyStartMonth={setYearlyStartMonth}
      />
    </div>
  );
}

function CombinedGoalCard({
  serviceTypes,
  initialName,
  initialServiceTypeIds,
  initialMetrics,
  previewDate,
  isDraft,
  onSave,
  onDelete,
}: {
  serviceTypes: ServiceType[];
  initialName: string;
  initialServiceTypeIds: string[];
  initialMetrics: GoalMetrics;
  previewDate: Date;
  isDraft?: boolean;
  onSave: (payload: CombinedGoalPayload) => void;
  onDelete: () => void;
}) {
  const { t, language } = useT();
  const [name, setName] = useState(initialName);
  const [serviceTypeIds, setServiceTypeIds] = useState(initialServiceTypeIds);
  const [monthlyHours, setMonthlyHours] = useState(formatGoalHoursInput(initialMetrics.monthly_duration_seconds));
  const [monthlyUnits, setMonthlyUnits] = useState(initialMetrics.monthly_units_quantity?.toString() ?? "");
  const [yearlyHours, setYearlyHours] = useState(formatGoalHoursInput(initialMetrics.yearly_duration_seconds));
  const [yearlyUnits, setYearlyUnits] = useState(initialMetrics.yearly_units_quantity?.toString() ?? "");
  const [yearlyStartMonth, setYearlyStartMonth] = useState(initialMetrics.yearly_start_month ?? 9);

  useEffect(() => {
    setName(initialName);
    setServiceTypeIds(initialServiceTypeIds);
    setMonthlyHours(formatGoalHoursInput(initialMetrics.monthly_duration_seconds));
    setMonthlyUnits(initialMetrics.monthly_units_quantity?.toString() ?? "");
    setYearlyHours(formatGoalHoursInput(initialMetrics.yearly_duration_seconds));
    setYearlyUnits(initialMetrics.yearly_units_quantity?.toString() ?? "");
    setYearlyStartMonth(initialMetrics.yearly_start_month ?? 9);
  }, [initialMetrics, initialName, initialServiceTypeIds]);

  const cyclePreview = formatGoalCyclePreview(yearlyStartMonth, previewDate, language);

  const toggleServiceType = (serviceTypeId: string) => {
    setServiceTypeIds((currentServiceTypeIds) =>
      currentServiceTypeIds.includes(serviceTypeId)
        ? currentServiceTypeIds.filter((id) => id !== serviceTypeId)
        : [...currentServiceTypeIds, serviceTypeId]
    );
  };

  const handleSave = () => {
    onSave({
      name,
      service_type_ids: serviceTypeIds,
      ...buildGoalMetrics({ monthlyHours, monthlyUnits, yearlyHours, yearlyUnits, yearlyStartMonth }),
    });
  };

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-surface p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t("settings.goalName")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.goalNamePlaceholder")}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <button
            onClick={handleSave}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-all"
          >
            {t("settings.save")}
          </button>
          <button
            onClick={onDelete}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {isDraft ? t("settings.cancel") : t("settings.deleteGoal")}
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("settings.goalServices")}</p>
        <div className="flex flex-wrap gap-2">
          {serviceTypes.map((serviceType) => {
            const selected = serviceTypeIds.includes(serviceType.id);
            return (
              <button
                key={serviceType.id}
                type="button"
                onClick={() => toggleServiceType(serviceType.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all",
                  selected
                    ? "border-transparent text-white shadow-sm"
                    : "border-slate-200 dark:border-slate-700 text-slate-500"
                )}
                style={selected ? { backgroundColor: serviceType.color } : undefined}
              >
                <span className="material-symbols-outlined text-base">{serviceType.icon}</span>
                <span>{serviceType.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <GoalMetricFields
        monthlyHours={monthlyHours}
        monthlyUnits={monthlyUnits}
        yearlyHours={yearlyHours}
        yearlyUnits={yearlyUnits}
        yearlyStartMonth={yearlyStartMonth}
        cyclePreview={cyclePreview}
        setMonthlyHours={setMonthlyHours}
        setMonthlyUnits={setMonthlyUnits}
        setYearlyHours={setYearlyHours}
        setYearlyUnits={setYearlyUnits}
        setYearlyStartMonth={setYearlyStartMonth}
      />
    </div>
  );
}

function SortableServiceTypeItem({
  serviceType,
  canDelete,
  onDelete,
  onUpdate,
}: {
  serviceType: ServiceType;
  canDelete: boolean;
  onDelete: () => void;
  onUpdate: (patch: Partial<ServiceType>) => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(serviceType.name);
  const [editColor, setEditColor] = useState(serviceType.color);
  const [editIcon, setEditIcon] = useState(serviceType.icon);
  const [editEntryType, setEditEntryType] = useState<ServiceType["entry_type"]>(serviceType.entry_type);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: serviceType.id,
  });

  const handleSave = () => {
    if (!editName.trim()) return;
    onUpdate({ name: editName.trim(), color: editColor, icon: editIcon, entry_type: editEntryType });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditName(serviceType.name);
    setEditColor(serviceType.color);
    setEditIcon(serviceType.icon);
    setEditEntryType(serviceType.entry_type);
    setEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-surface",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-center justify-between">
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
            style={{ backgroundColor: (editing ? editColor : serviceType.color) + "1a" }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: editing ? editColor : serviceType.color }}>
              {editing ? editIcon : serviceType.icon}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{serviceType.name}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {serviceType.entry_type === "time" ? t("settings.entryTypeTime") : t("settings.entryTypeUnits")}
              </span>
              {serviceType.description && (
                <p className="text-xs text-slate-500 truncate">{serviceType.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
              title={t("settings.editST")}
            >
              <span className="material-symbols-outlined text-base">edit</span>
            </button>
          )}
          {canDelete && !editing && (
            <button
              onClick={onDelete}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
              title="Delete"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">{t("settings.serviceEntryType")}</p>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setEditEntryType("time")}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                  editEntryType === "time"
                    ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500"
                )}
              >
                {t("settings.entryTypeTime")}
              </button>
              <button
                type="button"
                onClick={() => setEditEntryType("units")}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                  editEntryType === "units"
                    ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500"
                )}
              >
                {t("settings.entryTypeUnits")}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">{t("settings.color")}</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditColor(c)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-all",
                    editColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="size-7 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                <span className="material-symbols-outlined text-xs text-slate-400">palette</span>
                <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="sr-only" />
              </label>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">{t("settings.icon")}</p>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setEditIcon(ic)}
                  className={cn(
                    "size-9 rounded-xl flex items-center justify-center border-2 transition-all",
                    editIcon === ic
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 dark:border-slate-700 text-slate-500"
                  )}
                >
                  <span className="material-symbols-outlined text-sm">{ic}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!editName.trim()}
              className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {t("settings.save")}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t("settings.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

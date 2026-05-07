"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useStore } from "@/lib/store";
import type { TimeEntry } from "@/types/data";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import toast from "react-hot-toast";

type EntryType = "time" | "units";
type TimeMode = "range" | "duration";

interface Props {
  selectedDate: Date;
  onClose: () => void;
  onSuccess: () => void;
  /** If provided, modal opens in edit mode with pre-filled fields */
  entry?: TimeEntry;
}

function extractTimeStr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AddEntryModal({
  selectedDate,
  onClose,
  onSuccess,
  entry,
}: Props) {
  const addTimeEntry = useStore((s) => s.addTimeEntry);
  const serviceTypes = useStore((s) => s.serviceTypes);
  const ensureDefaultServiceType = useStore((s) => s.ensureDefaultServiceType);
  const updateTimeEntry = useStore((s) => s.updateTimeEntry);
  const settings = useStore((s) => s.settings);
  const { t } = useT();

  const isEditing = !!entry;
  const storedEntryType: EntryType = entry && entry.units_quantity != null && entry.units_quantity > 0
    ? "units"
    : "time";

  const initialTimeMode: TimeMode = entry
    ? entry.end_time ? "range" : "duration"
    : (settings.defaultEntryMode ?? "duration");

  const [title, setTitle] = useState(entry?.title ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(entry?.service_type_id ?? serviceTypes[0]?.id ?? "");
  const [mode, setMode] = useState<TimeMode>(initialTimeMode);
  const [isPlanned, setIsPlanned] = useState(entry?.is_planned ?? false);

  // Range mode fields
  const [startTimeStr, setStartTimeStr] = useState(
    entry?.start_time && entry.end_time ? extractTimeStr(entry.start_time) : "09:00"
  );
  const [endTimeStr, setEndTimeStr] = useState(
    entry?.end_time ? extractTimeStr(entry.end_time) : "10:00"
  );

  // Manual duration mode fields
  const initHours = entry?.duration_seconds != null
    ? Math.floor(entry.duration_seconds / 3600)
    : (settings.defaultDurationHours ?? 1);
  const initMinutes = entry?.duration_seconds != null
    ? Math.floor((entry.duration_seconds % 3600) / 60)
    : (settings.defaultDurationMinutes ?? 0);

  const [durationHours, setDurationHours] = useState(initHours);
  const [durationMinutes, setDurationMinutes] = useState(initMinutes);

  // Units mode fields
  const [unitsQuantity, setUnitsQuantity] = useState(entry?.units_quantity ?? 1);

  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [location, setLocation] = useState(entry?.location ?? "");
  const [saving, setSaving] = useState(false);

  // Seed a default type if the store has none (e.g. first launch)
  useEffect(() => {
    if (serviceTypes.length === 0) {
      ensureDefaultServiceType();
    }
  }, [ensureDefaultServiceType, serviceTypes.length]);

  // Keep serviceTypeId in sync: adopt first type when current id is
  // empty **or** no longer matches any existing service type.
  useEffect(() => {
    if (serviceTypes.length > 0) {
      const valid = serviceTypes.some((st) => st.id === serviceTypeId);
      if (!valid) {
        setServiceTypeId(serviceTypes[0].id);
      }
    }
  }, [serviceTypeId, serviceTypes]);

  const compatibleServiceTypes = serviceTypes.filter(
    (serviceType) => !isEditing || serviceType.entry_type === storedEntryType || serviceType.id === entry?.service_type_id
  );

  useEffect(() => {
    if (compatibleServiceTypes.length === 0) return;

    const valid = compatibleServiceTypes.some((serviceType) => serviceType.id === serviceTypeId);
    if (!valid) {
      setServiceTypeId(compatibleServiceTypes[0].id);
    }
  }, [compatibleServiceTypes, serviceTypeId]);

  const selectedServiceType = compatibleServiceTypes.find((serviceType) => serviceType.id === serviceTypeId)
    ?? serviceTypes.find((serviceType) => serviceType.id === serviceTypeId)
    ?? serviceTypes[0];
  const effectiveEntryType: EntryType = isEditing
    ? storedEntryType
    : selectedServiceType?.entry_type ?? "time";
  const showsMismatchNotice = Boolean(
    isEditing &&
    selectedServiceType &&
    selectedServiceType.id === entry?.service_type_id &&
    selectedServiceType.entry_type !== storedEntryType
  );
  const showPlanToggle = settings.planModeEnabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Read the LIVE store state so we never use a stale ID
    const liveTypes = useStore.getState().serviceTypes;
    let resolvedServiceTypeId = serviceTypeId;
    const idStillExists = liveTypes.some((st) => st.id === resolvedServiceTypeId);
    if (!resolvedServiceTypeId || !idStillExists) {
      resolvedServiceTypeId = ensureDefaultServiceType();
    }
    const resolvedTitle =
      title.trim() ||
      liveTypes.find((serviceType) => serviceType.id === resolvedServiceTypeId)?.name ||
      selectedServiceType?.name ||
      "Entry";
    setSaving(true);

    try {
      if (effectiveEntryType === "units") {
        // Units mode
        if (unitsQuantity <= 0) {
          toast.error(t("entry.zeroQuantity"));
          setSaving(false);
          return;
        }

        const data = {
          title: resolvedTitle,
          service_type_id: resolvedServiceTypeId,
          start_time: new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            0, 0, 0
          ).toISOString(),
          end_time: null,
          duration_seconds: null,
          units_quantity: unitsQuantity,
          units_label: null,
          is_planned: isPlanned,
          notes: notes || null,
          location: location || null,
        };

        if (isEditing) {
          updateTimeEntry(entry.id, data);
        } else {
          addTimeEntry(data);
        }
      } else if (mode === "range") {
        // Build full ISO timestamps from selectedDate + time strings
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const startISO = new Date(`${dateStr}T${startTimeStr}:00`).toISOString();
        const endISO = new Date(`${dateStr}T${endTimeStr}:00`).toISOString();

        const data = {
          title: resolvedTitle,
          service_type_id: resolvedServiceTypeId,
          start_time: startISO,
          end_time: endISO,
          duration_seconds: null,
          units_quantity: null,
          units_label: null,
          is_planned: isPlanned,
          notes: notes || null,
          location: location || null,
        };

        if (isEditing) {
          updateTimeEntry(entry.id, data);
        } else {
          addTimeEntry(data);
        }
      } else {
        // Manual duration: store seconds, set start_time to beginning of selected day
        const totalSeconds = durationHours * 3600 + durationMinutes * 60;
        if (totalSeconds <= 0) {
          toast.error(t("entry.zeroDuration"));
          setSaving(false);
          return;
        }

        const data = {
          title: resolvedTitle,
          service_type_id: resolvedServiceTypeId,
          start_time: new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            0, 0, 0
          ).toISOString(),
          end_time: null,
          duration_seconds: totalSeconds,
          units_quantity: null,
          units_label: null,
          is_planned: isPlanned,
          notes: notes || null,
          location: location || null,
        };

        if (isEditing) {
          updateTimeEntry(entry.id, data);
        } else {
          addTimeEntry(data);
        }
      }

      toast.success(isEditing ? t("entry.updated") : t("entry.added"));
      onSuccess();
    } catch {
      toast.error(isEditing ? t("entry.updateFailed") : t("entry.addFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[60]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface rounded-t-2xl md:rounded-2xl w-full max-w-lg md:mx-4 shadow-2xl max-h-[85dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-surface z-10">
          <div>
            <h3 className="text-lg font-bold">{isEditing ? t("entry.edit") : t("entry.new")}</h3>
            <p className="text-xs text-slate-500">{format(selectedDate, "EEEE, MMM d, yyyy")}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 pb-8 md:pb-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("entry.title")}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("entry.titlePlaceholder")}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-slate-400">{t("entry.titleOptionalHint")}</p>
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("entry.serviceType")} *</label>
            <div className="flex flex-wrap gap-2">
              {compatibleServiceTypes.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setServiceTypeId(st.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all",
                    serviceTypeId === st.id
                      ? "border-transparent text-white"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                  style={
                    serviceTypeId === st.id
                      ? { backgroundColor: st.color, borderColor: st.color }
                      : {}
                  }
                >
                  <span className="material-symbols-outlined text-sm">{st.icon}</span>
                  {st.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 px-4 py-3">
            <div className="flex items-start justify-between gap-3 sm:items-center">
              <div>
                <p className="text-sm font-semibold">{t("entry.entryType")}</p>
                <p className="text-xs text-slate-400">{effectiveEntryType === "time" ? t("entry.timeMode") : t("entry.unitsMode")}</p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  effectiveEntryType === "time"
                    ? "bg-primary/10 text-primary"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                )}
              >
                {effectiveEntryType === "time" ? t("entry.timeMode") : t("entry.unitsMode")}
              </span>
            </div>
          </div>

          {showsMismatchNotice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
              {t("entry.serviceTypeMismatch")}
            </div>
          )}

          {showPlanToggle && (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
              <div className="flex items-start justify-between gap-3 sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{t("entry.planMode")}</p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-200/70">{t("entry.planModeDesc")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlanned((currentValue) => !currentValue)}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    isPlanned ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                      isPlanned ? "translate-x-[1.375rem]" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Time sub-mode toggle (only in time mode) */}
          {effectiveEntryType === "time" && (
          <div>
            <label className="block text-sm font-semibold mb-1">{t("entry.timeSubMode")}</label>
            <div className="grid grid-cols-1 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("duration")}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                  mode === "duration"
                    ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500"
                )}
              >
                {t("entry.manualDuration")}
              </button>
              <button
                type="button"
                onClick={() => setMode("range")}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                  mode === "range"
                    ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500"
                )}
              >
                {t("entry.startEnd")}
              </button>
            </div>
          </div>
          )}

          {/* Manual Duration (default) */}
          {effectiveEntryType === "time" && mode === "duration" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold mb-1">{t("entry.hours")}</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={durationHours === 0 ? "" : durationHours}
                  onChange={(e) => setDurationHours(e.target.value === "" ? 0 : Math.max(0, parseInt(e.target.value) || 0))}
                  onBlur={(e) => { if (e.target.value === "") setDurationHours(0); }}
                  placeholder="0"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t("entry.minutes")}</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={durationMinutes === 0 ? "" : durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value === "" ? 0 : Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  onBlur={(e) => { if (e.target.value === "") setDurationMinutes(0); }}
                  placeholder="0"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>
          )}

          {/* Time Range (time-only inputs) */}
          {effectiveEntryType === "time" && mode === "range" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold mb-1">{t("entry.startTime")}</label>
                <input
                  type="time"
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">{t("entry.endTime")}</label>
                <input
                  type="time"
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>
          )}

          {/* Units Mode fields */}
          {effectiveEntryType === "units" && (
            <div>
              <label className="block text-sm font-semibold mb-1">{t("entry.quantity")}</label>
              <input
                type="number"
                min={1}
                step={1}
                value={unitsQuantity === 0 ? "" : unitsQuantity}
                onChange={(e) => setUnitsQuantity(e.target.value === "" ? 0 : Math.max(0, Math.floor(parseInt(e.target.value) || 0)))}
                onBlur={(e) => { if (e.target.value === "" || parseInt(e.target.value) < 1) setUnitsQuantity(1); }}
                placeholder="1"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("entry.location")}</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("entry.locationPlaceholder")}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("entry.notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("entry.notesPlaceholder")}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {saving ? t("entry.saving") : isEditing ? t("entry.update") : t("entry.add")}
          </button>
        </form>
      </div>
    </div>
  );
}

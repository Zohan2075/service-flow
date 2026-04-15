"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useStore } from "@/lib/store";
import type { ServiceType, TimeEntry } from "@/types/data";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type EntryMode = "range" | "duration";

interface Props {
  selectedDate: Date;
  serviceTypes: ServiceType[];
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
  serviceTypes,
  onClose,
  onSuccess,
  entry,
}: Props) {
  const addTimeEntry = useStore((s) => s.addTimeEntry);
  const updateTimeEntry = useStore((s) => s.updateTimeEntry);
  const settings = useStore((s) => s.settings);

  const isEditing = !!entry;

  // Determine initial mode for editing
  const initialMode: EntryMode = entry
    ? entry.end_time ? "range" : "duration"
    : (settings.defaultEntryMode ?? "duration");

  const [title, setTitle] = useState(entry?.title ?? "");
  const [serviceTypeId, setServiceTypeId] = useState(entry?.service_type_id ?? serviceTypes[0]?.id ?? "");
  const [mode, setMode] = useState<EntryMode>(initialMode);

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

  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [location, setLocation] = useState(entry?.location ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !serviceTypeId) return;
    setSaving(true);

    try {
      if (mode === "range") {
        // Build full ISO timestamps from selectedDate + time strings
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const startISO = new Date(`${dateStr}T${startTimeStr}:00`).toISOString();
        const endISO = new Date(`${dateStr}T${endTimeStr}:00`).toISOString();

        const data = {
          title: title.trim(),
          service_type_id: serviceTypeId,
          start_time: startISO,
          end_time: endISO,
          duration_seconds: null,
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
          toast.error("Duration must be greater than 0");
          setSaving(false);
          return;
        }

        const data = {
          title: title.trim(),
          service_type_id: serviceTypeId,
          start_time: new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            0, 0, 0
          ).toISOString(),
          end_time: null,
          duration_seconds: totalSeconds,
          notes: notes || null,
          location: location || null,
        };

        if (isEditing) {
          updateTimeEntry(entry.id, data);
        } else {
          addTimeEntry(data);
        }
      }

      toast.success(isEditing ? "Entry updated!" : "Entry added!");
      onSuccess();
    } catch {
      toast.error(isEditing ? "Failed to update entry" : "Failed to add entry");
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
            <h3 className="text-lg font-bold">{isEditing ? "Edit Entry" : "New Entry"}</h3>
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
            <label className="block text-sm font-semibold mb-1">Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. System Maintenance"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-sm font-semibold mb-1">Service Type *</label>
            <div className="flex flex-wrap gap-2">
              {serviceTypes.map((st) => (
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

          {/* Entry Mode Toggle */}
          <div>
            <label className="block text-sm font-semibold mb-1">Time Mode</label>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
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
                Manual Duration
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
                Start / End
              </button>
            </div>
          </div>

          {/* Manual Duration (default) */}
          {mode === "duration" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Hours</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={durationHours}
                  onChange={(e) => setDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Minutes</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>
          )}

          {/* Time Range (time-only inputs) */}
          {mode === "range" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">End Time</label>
                <input
                  type="time"
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold mb-1">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Server Room A"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {saving ? "Saving..." : isEditing ? "Update Entry" : "Add Entry"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { timeEntriesApi, type ServiceType } from "@/lib/api";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props {
  selectedDate: Date;
  serviceTypes: ServiceType[];
  onClose: () => void;
  onSuccess: () => void;
  queryKeys: unknown[][];
}

export default function AddEntryModal({
  selectedDate,
  serviceTypes,
  onClose,
  onSuccess,
  queryKeys,
}: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [serviceTypeId, setServiceTypeId] = useState(serviceTypes[0]?.id ?? "");
  const [startTime, setStartTime] = useState(
    format(selectedDate, "yyyy-MM-dd") + "T09:00"
  );
  const [endTime, setEndTime] = useState(
    format(selectedDate, "yyyy-MM-dd") + "T10:00"
  );
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      timeEntriesApi.create({
        title,
        service_type_id: serviceTypeId,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        notes: notes || undefined,
        location: location || undefined,
      }),
    onSuccess: () => {
      queryKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success("Entry added!");
      onSuccess();
    },
    onError: () => toast.error("Failed to add entry"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !serviceTypeId) return;
    createMutation.mutate();
  };

  const selectedSt = serviceTypes.find((st) => st.id === serviceTypeId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold">New Entry</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Start</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">End</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>
          </div>

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
            disabled={createMutation.isPending}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {createMutation.isPending ? "Saving…" : "Add Entry"}
          </button>
        </form>
      </div>
    </div>
  );
}

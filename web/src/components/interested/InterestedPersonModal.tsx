"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents, CircleMarker } from "react-leaflet";
import { useEffect, useRef, useState, useMemo } from "react";
import type { InterestedPerson, InterestedPersonStatus } from "@/types/data";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import toast from "react-hot-toast";

// Fix Leaflet default marker icon for Next.js/webpack
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

interface Props {
  person?: InterestedPerson | null;
  onClose: () => void;
}

function MapClickHandler({
  onLocationChange,
}: {
  onLocationChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapController({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map, onMapReady]);
  return null;
}

export default function InterestedPersonModal({ person, onClose }: Props) {
  const addInterestedPerson = useStore((s) => s.addInterestedPerson);
  const updateInterestedPerson = useStore((s) => s.updateInterestedPerson);
  const deleteInterestedPerson = useStore((s) => s.deleteInterestedPerson);
  const interestedStatuses = useStore((s) => s.interestedStatuses);
  const language = useStore((s) => s.settings.language);
  const { t } = useT();

  // Build status lookup from customizable config
  const statusOptions = useMemo(() => {
    return interestedStatuses
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({ id: s.id, name: s.name, color: s.color, icon: s.icon }));
  }, [interestedStatuses]);

  const getStatusColor = (id: InterestedPersonStatus) =>
    interestedStatuses.find((s) => s.id === id)?.color ?? "#2094f3";

  const isEditing = !!person;

  const [name, setName] = useState(person?.name ?? "");
  const [lastName, setLastName] = useState(person?.last_name ?? "");
  const [gender, setGender] = useState<"male" | "female" | "other">(person?.gender ?? "other");
  const [age, setAge] = useState<string>(
    person?.age != null ? String(person.age) : ""
  );
  const [status, setStatus] = useState<InterestedPersonStatus>(
    person?.status ?? "interested_person"
  );
  const [address, setAddress] = useState(person?.address ?? "");
  const [initialConversationDate, setInitialConversationDate] = useState(
    person?.initial_conversation_date ?? ""
  );
  const [nextVisitDate, setNextVisitDate] = useState(() => {
    const iso = person?.next_visit_date ?? "";
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [nextVisitTime, setNextVisitTime] = useState(() => {
    const iso = person?.next_visit_date ?? "";
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [nextVisitWeeklyDay, setNextVisitWeeklyDay] = useState<number | null>(
    person?.next_visit_weekly_day ?? null
  );
  const [comments, setComments] = useState(person?.comments ?? "");
  const [completed, setCompleted] = useState(person?.completed ?? false);
  const [lat, setLat] = useState<number | null>(person?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(person?.longitude ?? null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Localized short weekday names (0=Sun…6=Sat)
  const WEEKDAYS_SHORT = useMemo(
    () =>
      language === "es"
        ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    [language],
  );

  const mapRef = useRef<L.Map | null>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const commentsRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textareas as content grows
  useEffect(() => {
    const el = addressRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [address]);
  useEffect(() => {
    const el = commentsRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [comments]);

  const hasPersonLocation = lat != null && lng != null;
  const hasUserLocation = userLat != null && userLng != null;
  const center: [number, number] = hasUserLocation
    ? [userLat as number, userLng as number]
    : hasPersonLocation
    ? [lat as number, lng as number]
    : [20, -100];
  const zoom = (hasUserLocation || hasPersonLocation) ? 15 : 4;

  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;
  };

  const handleLocationChange = (nextLat: number, nextLng: number) => {
    setLat(nextLat);
    setLng(nextLng);
  };

  const handleMarkerDragEnd = (e: { target: L.Marker }) => {
    const marker = e.target as L.Marker;
    const pos = marker.getLatLng();
    setLat(pos.lat);
    setLng(pos.lng);
  };

  const handleMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("interested.myLocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        setUserLat(nextLat);
        setUserLng(nextLng);
        mapRef.current?.setView([nextLat, nextLng], 15);
      },
      (err) => {
        toast.error(err.message);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedLastName = lastName.trim();
    if (!trimmedName) {
      toast.error(t("interested.name"));
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: trimmedName,
        last_name: trimmedLastName || "",
        gender,
        age: age.trim() ? Number(age) : null,
        address: address.trim() || null,
        comments: comments.trim() || null,
        latitude: lat,
        longitude: lng,
        initial_conversation_date: initialConversationDate || null,
        next_visit_date: nextVisitDate
          ? new Date(`${nextVisitDate}T${nextVisitTime || "00:00"}:00`).toISOString()
          : null,
        next_visit_weekly_day: nextVisitWeeklyDay,
        status,
        completed,
      };

      if (isEditing && person) {
        updateInterestedPerson(person.id, data);
      } else {
        addInterestedPerson(data);
      }
      toast.success(t("interested.saved"));
      onClose();
    } catch {
      toast.error(t("interested.saved"));
      setSaving(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!person) return;
    deleteInterestedPerson(person.id);
    toast.success(t("interested.deleted"));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[60]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface rounded-t-2xl md:rounded-2xl w-full max-w-lg md:mx-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-surface z-10">
          <h3 className="text-lg font-bold">
            {isEditing ? t("interested.edit") : t("interested.addNew")}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 pb-8 md:pb-6 space-y-4">
          {/* Name + Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">
                {t("interested.name")} *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                {t("interested.lastName")}
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("interested.gender")}</label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(["male", "female", "other"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={cn(
                    "py-2 text-sm font-semibold rounded-lg transition-colors",
                    gender === g
                      ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  {g === "male" ? t("interested.male") : g === "female" ? t("interested.female") : t("interested.unspecified")}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("interested.age")}</label>
            <input
              type="number"
              min={0}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("interested.status")}</label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatus(opt.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all",
                    status === opt.id
                      ? "border-transparent text-white"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                  style={
                    status === opt.id
                      ? { backgroundColor: opt.color, borderColor: opt.color }
                      : {}
                  }
                  suppressHydrationWarning
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: status === opt.id ? "#fff" : opt.color }}
                    suppressHydrationWarning
                  />
                  {opt.name}
                </button>
              ))}
            </div>
          </div>

          {/* Address + Location (collapsible) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMap(!showMap)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-slate-400">location_on</span>
                <span className="text-sm font-semibold truncate">
                  {address ? address : t("interested.address")}
                </span>
              </div>
              <span
                className="material-symbols-outlined text-slate-400 shrink-0 transition-transform duration-200"
                style={{ transform: showMap ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                expand_more
              </span>
            </button>

            {showMap && (
              <div className="px-4 pb-4 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                {/* Address input */}
                <div>
                  <label className="block text-sm font-semibold mb-1">{t("interested.address")}</label>
                  <textarea
                    ref={addressRef}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={1}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none overflow-hidden"
                  />
                </div>

                {/* Location / Map */}
                <div>
                  <label className="block text-sm font-semibold mb-1">{t("interested.location")}</label>
                  {typeof navigator !== "undefined" && !navigator.onLine ? (
                    <div className="flex items-center justify-center h-[300px] rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-center">
                        <span className="material-symbols-outlined text-3xl text-slate-400 mb-2 block">wifi_off</span>
                        <p className="text-sm text-slate-500 font-medium">Map unavailable offline</p>
                        <p className="text-xs text-slate-400 mt-1">Location fields are still editable</p>
                      </div>
                    </div>
                  ) : (
                    <MapContainer
                      center={center}
                      zoom={zoom}
                      style={{ height: "300px", width: "100%" }}
                      className="rounded-xl"
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                      />
                      {hasPersonLocation && (
                        <Marker
                          position={[lat as number, lng as number]}
                          draggable
                          eventHandlers={{ dragend: handleMarkerDragEnd }}
                        />
                      )}
                      {hasUserLocation && (
                        <CircleMarker
                          center={[userLat as number, userLng as number]}
                          radius={8}
                          pathOptions={{
                            color: "#3b82f6",
                            fillColor: "#3b82f6",
                            fillOpacity: 0.5,
                            weight: 3,
                          }}
                        />
                      )}
                      <MapClickHandler onLocationChange={handleLocationChange} />
                      <MapController onMapReady={handleMapReady} />
                    </MapContainer>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      {hasPersonLocation && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <span className="size-2 rounded-full bg-red-500 inline-block shrink-0" />
                          {t("interested.personPin")}: {(lat as number).toFixed(4)}, {(lng as number).toFixed(4)}
                        </p>
                      )}
                      {hasUserLocation && (
                        <p className="text-xs text-blue-500 flex items-center gap-1">
                          <span className="size-2 rounded-full bg-blue-500 inline-block shrink-0" />
                          {t("interested.myLocation")}: {(userLat as number).toFixed(4)}, {(userLng as number).toFixed(4)}
                        </p>
                      )}
                      {!hasPersonLocation && !hasUserLocation && (
                        <p className="text-xs text-slate-400">{t("interested.selectLocation")}</p>
                      )}
                    </div>
                    {typeof navigator !== "undefined" && navigator.onLine && (
                      <button
                        type="button"
                        onClick={handleMyLocation}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-base">my_location</span>
                        {t("interested.myLocation")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Initial Conversation Date */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              {t("interested.initialConversation")}
            </label>
            <input
              type="date"
              value={initialConversationDate}
              onChange={(e) => setInitialConversationDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Next Visit Date & Time */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              {t("interested.nextVisit")}
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="date"
                value={nextVisitDate}
                onChange={(e) => setNextVisitDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="time"
                value={nextVisitTime}
                onChange={(e) => setNextVisitTime(e.target.value)}
                className="w-[7.5rem] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Weekly toggle */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setNextVisitWeeklyDay(nextVisitWeeklyDay !== null ? null : 0)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors",
                  nextVisitWeeklyDay !== null
                    ? "bg-primary text-white border-primary"
                    : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/50",
                )}
              >
                <span className="material-symbols-outlined text-base">
                  {nextVisitWeeklyDay !== null ? "event_repeat" : "repeat"}
                </span>
                {t("interested.weekly")}
              </button>

              {nextVisitWeeklyDay !== null && (
                <div className="mt-2 flex gap-1">
                  {WEEKDAYS_SHORT.map((label, day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setNextVisitWeeklyDay(day)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                        nextVisitWeeklyDay === day
                          ? "bg-primary text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-primary/10",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("interested.comments")}</label>
            <textarea
              ref={commentsRef}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={1}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none overflow-hidden"
            />
          </div>

          {/* Completed toggle */}
          {isEditing && (
            <div className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-semibold">{t("interested.completed")}</p>
                <p className="text-xs text-slate-400">{t("interested.markCompleted")}</p>
              </div>
              <button
                type="button"
                onClick={() => setCompleted(!completed)}
                className={cn(
                  "relative w-12 h-7 rounded-full transition-all duration-200 shrink-0 border-2",
                  completed
                    ? "bg-green-500 border-green-500"
                    : "bg-slate-200 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-5 bg-white rounded-full shadow-md transition-transform duration-200",
                    completed ? "translate-x-[1.375rem]" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {t("interested.save")}
          </button>

          {isEditing && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 px-3 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  {t("interested.delete")}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-red-500 font-medium text-center">
                    {t("interested.deleteConfirm")}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {t("interested.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
                    >
                      {t("interested.delete")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

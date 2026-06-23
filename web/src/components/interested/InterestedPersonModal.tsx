"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
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

const STATUS_COLORS: Record<InterestedPersonStatus, string> = {
  bible_student: "#10b981",
  return_visit: "#f59e0b",
  interested_person: "#2094f3",
};

const STATUS_ORDER: InterestedPersonStatus[] = [
  "bible_student",
  "return_visit",
  "interested_person",
];

const STATUS_LABEL_KEYS: Record<InterestedPersonStatus, string> = {
  bible_student: "interested.bibleStudent",
  return_visit: "interested.returnVisit",
  interested_person: "interested.interestedPerson",
};

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
  const { t } = useT();

  const isEditing = !!person;

  const [name, setName] = useState(person?.name ?? "");
  const [lastName, setLastName] = useState(person?.last_name ?? "");
  const [gender, setGender] = useState<"male" | "female">(person?.gender ?? "male");
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
  const [nextVisitDate, setNextVisitDate] = useState(
    person?.next_visit_date ?? ""
  );
  const [comments, setComments] = useState(person?.comments ?? "");
  const [lat, setLat] = useState<number | null>(person?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(person?.longitude ?? null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mapRef = useRef<L.Map | null>(null);

  const hasLocation = lat != null && lng != null;
  const center: [number, number] = hasLocation ? [lat as number, lng as number] : [20, -100];
  const zoom = hasLocation ? 15 : 4;

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
        setLat(nextLat);
        setLng(nextLng);
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
    if (!trimmedName || !trimmedLastName) {
      toast.error(t("interested.name"));
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: trimmedName,
        last_name: trimmedLastName,
        gender,
        age: age.trim() ? Number(age) : null,
        address: address.trim() || null,
        comments: comments.trim() || null,
        latitude: lat,
        longitude: lng,
        initial_conversation_date: initialConversationDate || null,
        next_visit_date: nextVisitDate || null,
        status,
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
                {t("interested.lastName")} *
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
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={cn(
                    "flex-1 py-2 text-sm font-semibold rounded-lg transition-colors",
                    gender === g
                      ? "bg-surface text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  {g === "male" ? t("interested.male") : t("interested.female")}
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
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all",
                    status === s
                      ? "border-transparent text-white"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  )}
                  style={
                    status === s
                      ? { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] }
                      : {}
                  }
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: status === s ? "#fff" : STATUS_COLORS[s] }}
                  />
                  {t(STATUS_LABEL_KEYS[s] as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("interested.address")}</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
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

          {/* Next Visit Date */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              {t("interested.nextVisit")}
            </label>
            <input
              type="date"
              value={nextVisitDate}
              onChange={(e) => setNextVisitDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("interested.comments")}</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold mb-1">{t("interested.location")}</label>
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
              {hasLocation && (
                <Marker
                  position={[lat as number, lng as number]}
                  draggable
                  eventHandlers={{ dragend: handleMarkerDragEnd }}
                />
              )}
              <MapClickHandler onLocationChange={handleLocationChange} />
              <MapController onMapReady={handleMapReady} />
            </MapContainer>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {hasLocation
                  ? `${(lat as number).toFixed(4)}, ${(lng as number).toFixed(4)}`
                  : t("interested.selectLocation")}
              </p>
              <button
                type="button"
                onClick={handleMyLocation}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <span className="material-symbols-outlined text-base">my_location</span>
                {t("interested.myLocation")}
              </button>
            </div>
          </div>

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

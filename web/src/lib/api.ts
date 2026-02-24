import axios from "axios";
import { getSession } from "next-auth/react";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token automatically
api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if ((session as any)?.accessToken) {
    config.headers.Authorization = `Bearer ${(session as any).accessToken}`;
  }
  return config;
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  duration_display: string;
  service_type_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarDay {
  date: string;
  entries: TimeEntry[];
  total_duration_seconds: number;
  total_duration_display: string;
}

// ─── Service Types API ────────────────────────────────────────────────────────

export const serviceTypesApi = {
  list: () => api.get<ServiceType[]>("/service-types").then((r) => r.data),
  create: (data: Partial<ServiceType>) =>
    api.post<ServiceType>("/service-types", data).then((r) => r.data),
  update: (id: string, data: Partial<ServiceType>) =>
    api.patch<ServiceType>(`/service-types/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/service-types/${id}`),
};

// ─── Time Entries API ─────────────────────────────────────────────────────────

export const timeEntriesApi = {
  list: (params?: { month?: number; year?: number; service_type_id?: string }) =>
    api.get<TimeEntry[]>("/time-entries", { params }).then((r) => r.data),

  calendar: (month: number, year: number) =>
    api
      .get<CalendarDay[]>("/time-entries/calendar", { params: { month, year } })
      .then((r) => r.data),

  create: (data: {
    title: string;
    service_type_id: string;
    start_time: string;
    end_time?: string;
    duration_seconds?: number;
    notes?: string;
    location?: string;
  }) => api.post<TimeEntry>("/time-entries", data).then((r) => r.data),

  update: (id: string, data: Partial<TimeEntry>) =>
    api.patch<TimeEntry>(`/time-entries/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/time-entries/${id}`),
};

export default api;

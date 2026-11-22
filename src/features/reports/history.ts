import { useSyncExternalStore } from "react";

/** Reports this user generated on this device (the backend keeps no report history). Newest first, at most 30. */
export type ReportRun = {
  id: string; reportId: string; title: string; summary: string; at: string; by: string; rows: number; total: number; truncated: boolean;
  params: { from?: string | undefined; to?: string | undefined; status?: string | undefined; extra?: string | undefined; groupBy: string };
};

const KEY = "cis.reports.history";
const MAX = 30;
const EMPTY: ReportRun[] = [];
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache: ReportRun[] = EMPTY;

function read(): ReportRun[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(KEY);
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try { const v: unknown = raw ? JSON.parse(raw) : []; cache = Array.isArray(v) ? (v as ReportRun[]) : EMPTY; } catch { cache = EMPTY; }
  return cache;
}
function write(list: ReportRun[]) {
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) l(); };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
};

export const useReportHistory = () => useSyncExternalStore(subscribe, read, () => EMPTY);
export const reportHistory = {
  add: (r: Omit<ReportRun, "id">) => write([{ ...r, id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}` }, ...read()]),
  remove: (id: string) => write(read().filter((r) => r.id !== id)),
  clear: () => write([]),
};

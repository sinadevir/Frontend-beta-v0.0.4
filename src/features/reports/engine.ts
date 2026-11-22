import { apiRequest, type QueryValue } from "@/lib/api/client";
import type { ApiService } from "@/lib/api/config";
import { toList, toPage, type Rec } from "@/lib/api/list";
import { addDays, gToJ, jMonthTitle, persianWeekday, startOfDay, toDateOnly, toJalali, daysBetween, faNum } from "@/lib/jalali";

/**
 * Report engine: reads every page of a list endpoint (the backend has no report or export endpoints),
 * then groups and measures the rows in the browser. Pure helpers below are covered by reports-engine.test.ts.
 */
export const REPORT_ROW_CAP = 5000;
export const REPORT_PAGE_SIZE = 100;

export type Fetched<T> = { rows: T[]; total: number; truncated: boolean };
export type Progress = (loaded: number, total: number) => void;
export type FetchCtx = { signal?: AbortSignal | undefined; onProgress?: Progress | undefined };

/** Calls `load(page, size)` until the server says there is nothing more, or the row cap is reached. */
export async function collectPages<T>(load: (page: number, size: number) => Promise<unknown>, map: (r: Rec) => T, opts: { pageSize?: number; cap?: number; onProgress?: Progress | undefined } = {}): Promise<Fetched<T>> {
  const size = opts.pageSize ?? REPORT_PAGE_SIZE;
  const cap = opts.cap ?? REPORT_ROW_CAP;
  const rows: T[] = [];
  let total = 0;
  for (let page = 1; page <= 1000; page++) {
    const pg = toPage<Rec>(await load(page, size), page, size);
    rows.push(...pg.items.map(map));
    total = Math.max(pg.total, rows.length);
    opts.onProgress?.(Math.min(rows.length, cap), total);
    if (pg.items.length === 0 || rows.length >= total || rows.length >= cap) break;
  }
  return { rows: rows.slice(0, cap), total, truncated: total > Math.min(rows.length, cap) };
}

export const fetchAllPages = <T,>(service: ApiService, path: string, query: Record<string, QueryValue>, map: (r: Rec) => T, ctx: FetchCtx = {}) =>
  collectPages((page, pageSize) => apiRequest(service, path, { query: { ...query, page, pageSize }, signal: ctx.signal }), map, { onProgress: ctx.onProgress });

/** Endpoints that return a plain list (no paging). */
export async function fetchList<T>(service: ApiService, path: string, query: Record<string, QueryValue> | undefined, map: (r: Rec) => T, ctx: FetchCtx = {}): Promise<Fetched<T>> {
  const rows = toList<Rec>(await apiRequest(service, path, { query, signal: ctx.signal })).map(map);
  ctx.onProgress?.(rows.length, rows.length);
  return { rows, total: rows.length, truncated: false };
}

/* ───────── dates ───────── */
const valid = (v: string | Date | undefined | null) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

/** True when `value` falls on or between the chosen days (either end optional). Rows without a date are kept only when no range is set. */
export function inRange(value: string | undefined | null, from?: Date, to?: Date) {
  if (!from && !to) return true;
  const d = valid(value);
  if (!d) return false;
  const day = startOfDay(d).getTime();
  if (from && day < startOfDay(from).getTime()) return false;
  if (to && day > startOfDay(to).getTime()) return false;
  return true;
}

/** Saturday that starts the (Iranian) week holding `d`. */
export const weekStart = (d: Date) => addDays(startOfDay(d), -persianWeekday(d));

export type TimeUnit = "week" | "month";
/** Sortable bucket key for a date: yyyy-mm-dd of the week's Saturday, or Jalali year-month. */
export function timeKey(value: string | Date | undefined | null, unit: TimeUnit): string {
  const d = valid(value);
  if (!d) return "";
  if (unit === "week") return toDateOnly(weekStart(d));
  const j = gToJ(d);
  return `${j.jy}-${String(j.jm).padStart(2, "0")}`;
}
export function timeLabel(key: string, unit: TimeUnit): string {
  if (!key) return "بدون تاریخ";
  if (unit === "week") { const [y, m, d] = key.split("-").map(Number); return `هفته ${toJalali(new Date(y!, m! - 1, d!))}`; }
  const [jy, jm] = key.split("-").map(Number);
  return jMonthTitle(jy!, jm!);
}
const nextKey = (key: string, unit: TimeUnit) => {
  const [a, b, c] = key.split("-").map(Number);
  if (unit === "week") return toDateOnly(addDays(new Date(a!, b! - 1, c!), 7));
  const t = a! * 12 + (b! - 1) + 1;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

export type Bucket = { key: string; label: string; count: number };

/** Counts rows per time bucket, filling empty weeks/months between the first and last so trends are not misleading. Keeps the latest `max` buckets. */
export function timeline<T>(rows: T[], dateOf: (r: T) => string, unit: TimeUnit, max = 52): Bucket[] {
  const counts = new Map<string, number>();
  let undated = 0;
  for (const r of rows) { const k = timeKey(dateOf(r), unit); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); else undated++; }
  const keys = [...counts.keys()].sort();
  const out: Bucket[] = [];
  if (keys.length) {
    for (let k = keys[0]!, n = 0; k <= keys[keys.length - 1]! && n < 2000; k = nextKey(k, unit), n++) out.push({ key: k, label: timeLabel(k, unit), count: counts.get(k) ?? 0 });
  }
  const tail = out.slice(-max);
  if (undated) tail.push({ key: "", label: "بدون تاریخ", count: undated });
  return tail;
}

/** Counts rows per group, largest first (or in `order` when given); empty values are counted as «نامشخص». */
export function groupCount<T>(rows: T[], of: (r: T) => string, label: (k: string) => string = (k) => k, order?: string[]): Bucket[] {
  const counts = new Map<string, number>();
  for (const r of rows) { const k = (of(r) ?? "").trim(); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const list = [...counts].map(([key, count]) => ({ key, label: key ? label(key) : "نامشخص", count }));
  if (order) return list.sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999));
  return list.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fa"));
}

/* ───────── waiting time ───────── */
export const AGE_BUCKETS = ["تا ۳ روز", "۴ تا ۷ روز", "۸ تا ۳۰ روز", "بیش از ۳۰ روز"] as const;
export function ageBucket(days: number): (typeof AGE_BUCKETS)[number] {
  if (days <= 3) return AGE_BUCKETS[0];
  if (days <= 7) return AGE_BUCKETS[1];
  if (days <= 30) return AGE_BUCKETS[2];
  return AGE_BUCKETS[3];
}
/** Whole days from `from` to `to` (default now); undefined when the start date is missing. */
export function ageDays(from: string | undefined | null, to: string | Date | undefined | null = new Date()) {
  const a = valid(from); const b = valid(to ?? undefined);
  return a && b ? Math.max(0, daysBetween(a, b)) : undefined;
}
/** Mean of the defined numbers, or undefined when there are none. */
export function mean(values: (number | undefined)[]) {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined;
}
/** «۴٫۲ روز» / «—» */
export const daysText = (n: number | undefined) => (n === undefined ? "—" : `${faNum(Math.round(n * 10) / 10)} روز`);

import { useEffect, useRef, useState } from "react";
import { CalendarRange, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JalaliCalendar, JalaliDatePicker, type JRange } from "./jalali-date-picker";
import { addDays, daysBetween, faDigits, gToJ, jMonthLength, jToDate, sameDay, shiftJMonth, startOfDay, toDateOnly, toJalali } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/status";

export type FilterOption = string | { value: string; label: string };

/**
 * Per-column filter drawn in the table's first header row.
 * `param` is the filter key sent to the server (or used locally); it defaults to the column key.
 * `raw` (select only): compare against the raw record field named by `param` instead of the cell value.
 */
export type ColumnFilter =
  | { type: "text"; param?: string; placeholder?: string }
  | { type: "select"; param?: string; options: FilterOption[]; raw?: boolean }
  | { type: "boolean"; param?: string }
  | { type: "date"; param?: string }
  | { type: "dateRange"; from: string; to: string };

const ov = (o: FilterOption) => (typeof o === "string" ? o : o.value);
const ol = (o: FilterOption) => (typeof o === "string" ? o : o.label);
const ALL = "__all__";

/** Persian/Arabic digits to Latin, Arabic ي/ك to Persian, case-insensitive — so «۱۲» finds "12". */
export function normalizeSearch(s: string) {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/ي/g, "ی").replace(/ك/g, "ک")
    .trim().toLowerCase();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
/** Calendar day (YYYY-MM-DD, local time) of a date-like value, or undefined. */
export function dayOf(v: unknown): string | undefined {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : toDateOnly(v);
  if (typeof v !== "string" || !ISO_DATE.test(v)) return undefined;
  if (!v.includes("T")) return v.slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : toDateOnly(d);
}
const fromDay = (s: string | undefined) => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};

export const filterParams = (f: ColumnFilter, key: string) => (f.type === "dateRange" ? [f.from, f.to] : [f.param ?? key]);

/** Picks a filter that fits the column's values (local tables): yes/no, date, or text. */
export function inferFilter(values: unknown[]): ColumnFilter | undefined {
  const vals = values.filter((v) => v !== undefined && v !== null && v !== "");
  if (vals.length === 0) return undefined;
  if (vals.some((v) => typeof v === "object" && !(v instanceof Date))) return undefined;
  if (vals.every((v) => typeof v === "boolean" || v === "true" || v === "false")) return { type: "boolean" };
  if (vals.every((v) => dayOf(v) !== undefined)) return { type: "date" };
  // Known server codes (statuses, party kinds…) are shown as Persian labels: offer them as a pick list.
  const distinct = [...new Set(vals.map(String))];
  if (distinct.length <= 12 && distinct.every((v) => statusLabel(v) !== v)) return { type: "select", options: distinct.map((v) => ({ value: v, label: statusLabel(v) })) };
  return { type: "text" };
}

/** Text a free-text column filter searches: the raw value, its Persian label and the displayed value. */
export const filterText = (raw: unknown, display?: unknown) =>
  [raw, raw === undefined || raw === null || raw === "" ? "" : statusLabel(raw), display].filter((x) => x !== undefined && x !== null && x !== "").map(String).join(" ");

/** Local (client-side) match of one value against the column filter's current value(s). */
export function matchesFilter(f: ColumnFilter, key: string, values: Record<string, string>, raw: unknown): boolean {
  if (f.type === "dateRange") {
    const from = values[f.from], to = values[f.to];
    if (!from && !to) return true;
    const d = dayOf(raw);
    if (!d) return false;
    return (!from || d >= from) && (!to || d <= to);
  }
  const v = values[f.param ?? key];
  if (!v || v === "all") return true;
  if (f.type === "text") return normalizeSearch(String(raw ?? "")).includes(normalizeSearch(v));
  if (f.type === "date") return dayOf(raw) === v;
  return String(raw) === v;
}

type CellProps = { filter: ColumnFilter; columnKey: string; label: string; values: Record<string, string>; debounce: boolean; onChange: (key: string, value: string) => void };

export function ColumnFilterCell({ filter, columnKey, label, values, debounce, onChange }: CellProps) {
  const aria = `فیلتر ${label}`;
  if (filter.type === "dateRange") return <DateRangeFilter filter={filter} label={aria} values={values} onChange={onChange} />;
  const key = filter.param ?? columnKey;
  const value = values[key] ?? "";
  if (filter.type === "text") return <TextFilter label={aria} placeholder={filter.placeholder} value={value} debounce={debounce} onChange={(v) => onChange(key, v)} />;
  if (filter.type === "date") return <DayFilter label={aria} value={value} onChange={(v) => onChange(key, v)} />;
  const options: FilterOption[] = filter.type === "boolean" ? [{ value: "true", label: "بله" }, { value: "false", label: "خیر" }] : filter.options;
  return (
    <Select value={value && value !== "all" ? value : ALL} onValueChange={(v) => onChange(key, v === ALL ? "" : v)}>
      <SelectTrigger className="h-8 w-full min-w-24 text-xs font-normal" aria-label={aria}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>همه</SelectItem>
        {options.map((o) => <SelectItem key={ov(o)} value={ov(o)}>{ol(o)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function TextFilter({ label, placeholder, value, debounce, onChange }: { label: string; placeholder?: string | undefined; value: string; debounce: boolean; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  const sent = useRef(value);
  useEffect(() => { if (value !== sent.current) { sent.current = value; setText(value); } }, [value]);
  useEffect(() => {
    if (text === sent.current) return;
    const send = () => { sent.current = text; onChange(text); };
    if (!debounce) { send(); return; }
    const t = setTimeout(send, 400);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative min-w-24">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder ?? "فیلتر…"} aria-label={label} className={cn("h-8 text-xs font-normal", text && "pe-7")} />
      {text && <button type="button" onClick={() => setText("")} className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={`پاک کردن ${label}`}><X className="size-3.5" /></button>}
    </div>
  );
}

function DayFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <JalaliDatePicker size="sm" className="w-full" value={fromDay(value)} onChange={(d) => onChange(toDateOnly(d))} onClear={() => onChange("")} placeholder="همه تاریخ‌ها" aria-describedby={undefined} />;
}

type Preset = { label: string; range: () => JRange };
const PRESETS: Preset[] = [
  { label: "امروز", range: () => { const t = startOfDay(new Date()); return { from: t, to: t }; } },
  { label: "دیروز", range: () => { const t = addDays(startOfDay(new Date()), -1); return { from: t, to: t }; } },
  { label: "۷ روز اخیر", range: () => { const t = startOfDay(new Date()); return { from: addDays(t, -6), to: t }; } },
  { label: "۳۰ روز اخیر", range: () => { const t = startOfDay(new Date()); return { from: addDays(t, -29), to: t }; } },
  { label: "این ماه", range: () => { const t = startOfDay(new Date()); const j = gToJ(t); return { from: jToDate(j.jy, j.jm, 1), to: t }; } },
  { label: "ماه گذشته", range: () => { const j = gToJ(new Date()); const p = shiftJMonth(j.jy, j.jm, -1); return { from: jToDate(p.y, p.m, 1), to: jToDate(p.y, p.m, jMonthLength(p.y, p.m)) }; } },
  { label: "امسال", range: () => { const t = startOfDay(new Date()); return { from: jToDate(gToJ(t).jy, 1, 1), to: t }; } },
];

/** One calendar for a date range: two clicks (any order) or a quick preset; the summary and the day count sit at the foot. */
function DateRangeFilter({ filter, label, values, onChange }: { filter: { from: string; to: string }; label: string; values: Record<string, string>; onChange: (key: string, value: string) => void }) {
  const from = values[filter.from] ?? "", to = values[filter.to] ?? "";
  const f = fromDay(from), t = fromDay(to);
  const invalid = !!from && !!to && from > to;
  const set = (r: JRange) => { onChange(filter.from, r.from ? toDateOnly(r.from) : ""); onChange(filter.to, r.to ? toDateOnly(r.to) : ""); };
  const summary = from || to ? `${f ? toJalali(f) : "…"} تا ${t ? toJalali(t) : "…"}` : "همه تاریخ‌ها";
  const activePreset = f && t ? PRESETS.find((p) => { const r = p.range(); return sameDay(r.from, f) && sameDay(r.to, t); })?.label : undefined;
  const span = f && t && !invalid ? daysBetween(f, t) + 1 : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${label}: ${summary}`} aria-invalid={invalid || undefined}
          className={cn("field-control flex h-8 min-h-8 w-full min-w-36 items-center gap-1.5 rounded-md ps-1.5 pe-2 text-start text-xs font-normal")}>
          <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-md", from || to ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}><CalendarRange className="size-3" /></span>
          <span className={cn("truncate", from || to ? "font-bold text-foreground" : "text-muted-foreground")}>{summary}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden rounded-2xl p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex gap-1 overflow-x-auto border-b border-border/80 bg-muted/50 p-2 sm:w-32 sm:flex-col sm:border-b-0 sm:border-e" role="group" aria-label="بازه‌های آماده">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => set(p.range())} aria-pressed={activePreset === p.label}
                className={cn("h-8 shrink-0 whitespace-nowrap rounded-md px-2.5 text-start text-xs font-semibold transition-colors",
                  activePreset === p.label ? "bg-card text-primary shadow-card ring-1 ring-primary/20" : "text-foreground/75 hover:bg-card hover:text-primary")}>{p.label}</button>
            ))}
          </div>
          <div className="p-3"><JalaliCalendar range={{ from: f, to: t }} onRangeChange={set} /></div>
        </div>
        <div className="flex items-center gap-2 border-t border-border/80 bg-muted/50 px-3 py-2 text-xs">
          <span className={cn("min-w-0 flex-1 truncate", invalid ? "text-destructive" : "text-muted-foreground")} role={invalid ? "alert" : undefined}>
            {invalid ? "تاریخ پایان نباید پیش از تاریخ شروع باشد." : f && !t ? "روز پایان را انتخاب کنید" : f && t ? <>از <b className="text-foreground">{toJalali(f)}</b> تا <b className="text-foreground">{toJalali(t)}</b>{span && <> · {faDigits(span)} روز</>}</> : "روز شروع را انتخاب کنید"}
          </span>
          {(from || to) && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:bg-destructive-soft hover:text-destructive" onClick={() => set({})}><X />پاک کردن</Button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useState } from "react";
import { faNum } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import type { Bucket } from "./engine";

const BAR = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
const STROKE = ["stroke-chart-1", "stroke-chart-2", "stroke-chart-3", "stroke-chart-4", "stroke-chart-5"];
const pct = (n: number, t: number) => (t ? Math.round((n / t) * 1000) / 10 : 0);

/** Horizontal bars: one row per group with its count and share of the total. */
export function BarList({ data, total }: { data: Bucket[]; total: number }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-3.5">
      {data.map((d, i) => (
        <li key={d.key || "none"} className="group">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-semibold"><span className={cn("size-2.5 shrink-0 rounded-sm", BAR[i % 5])} /><span className="truncate">{d.label}</span></span>
            <span className="shrink-0 text-xs text-muted-foreground"><b className="text-sm font-black text-foreground">{faNum(d.count)}</b> · {faNum(pct(d.count, total))}٪</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("report-bar h-full rounded-full", BAR[i % 5])} style={{ width: `${(d.count / max) * 100}%`, animationDelay: `${i * 50}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Ring of shares (top five + «سایر») with the total in the middle. */
export function Donut({ data, total, caption = "رکورد" }: { data: Bucket[]; total: number; caption?: string }) {
  const top = data.slice(0, 5);
  const rest = data.slice(5).reduce((n, d) => n + d.count, 0);
  const parts = rest ? [...top, { key: "__rest", label: "سایر", count: rest }] : top;
  const r = 42, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative size-44">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" className="stroke-muted" strokeWidth="11" />
          {parts.map((p, i) => {
            const len = total ? (p.count / total) * c : 0;
            const el = <circle key={p.key || "none"} cx="50" cy="50" r={r} fill="none" strokeWidth="11" strokeLinecap="butt" className={cn("report-ring", p.key === "__rest" ? "stroke-muted-foreground/40" : STROKE[i % 5])} strokeDasharray={`${Math.max(0, len - 0.6)} ${c}`} strokeDashoffset={-off} />;
            off += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center"><div><div className="text-2xl font-black leading-none">{faNum(total)}</div><div className="mt-1 text-xs text-muted-foreground">{caption}</div></div></div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {parts.map((p, i) => (
          <li key={p.key || "none"} className="flex min-w-0 items-center gap-1.5"><span className={cn("size-2.5 shrink-0 rounded-sm", p.key === "__rest" ? "bg-muted-foreground/40" : BAR[i % 5])} /><span className="truncate text-muted-foreground">{p.label}</span><b className="ms-auto font-bold">{faNum(pct(p.count, total))}٪</b></li>
        ))}
      </ul>
    </div>
  );
}

/** Columns over time (oldest on the right), a dashed line at the average, the hovered bucket's value above. */
export function TrendChart({ data, unitLabel }: { data: Bucket[]; unitLabel: string }) {
  const dated = data.filter((d) => d.key);
  const max = Math.max(1, ...dated.map((d) => d.count));
  const avg = dated.length ? dated.reduce((n, d) => n + d.count, 0) / dated.length : 0;
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover !== null ? dated[hover] : dated[dated.length - 1];
  const every = Math.max(1, Math.ceil(dated.length / 8));
  if (!dated.length) return <p className="py-10 text-center text-sm text-muted-foreground">تاریخی برای رسم روند در رکوردها نیست.</p>;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted-foreground">{shown?.label}{hover === null && " (آخرین)"}</div>
          <div className="text-2xl font-black leading-tight">{faNum(shown?.count ?? 0)} <span className="text-sm font-semibold text-muted-foreground">رکورد</span></div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-5 border-t-2 border-dashed border-warning" />میانگین هر {unitLabel}: <b className="text-foreground">{faNum(Math.round(avg * 10) / 10)}</b></div>
      </div>
      <div className="relative h-56">
        {[0.25, 0.5, 0.75, 1].map((f) => <div key={f} aria-hidden className="absolute inset-x-0 border-t border-border/70" style={{ bottom: `${f * 100}%` }} />)}
        <div aria-hidden className="absolute inset-x-0 z-10 border-t-2 border-dashed border-warning" style={{ bottom: `${(avg / max) * 100}%` }} />
        <div className="relative flex h-full items-end gap-[3px]" role="list" aria-label="روند">
          {dated.map((d, i) => (
            <div key={d.key} role="listitem" aria-label={`${d.label}: ${faNum(d.count)}`} className="group flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className={cn("report-col w-full rounded-t-md transition-[filter,opacity]", d.count ? "bg-brand" : "bg-muted", hover !== null && hover !== i && "opacity-45")} style={{ height: `${Math.max(d.count ? 3 : 1.5, (d.count / max) * 100)}%`, animationDelay: `${i * 18}ms` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-[3px] border-t border-border pt-2 text-[0.6875rem] text-muted-foreground">
        {dated.map((d, i) => <div key={d.key} className="min-w-0 flex-1 truncate text-center">{i % every === 0 ? d.label.replace(/^هفته /, "") : ""}</div>)}
      </div>
    </div>
  );
}

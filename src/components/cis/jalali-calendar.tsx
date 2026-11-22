import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addDays, faDigits, gToJ, jMonthLength, jMonthMatrix, jMonthTitle, jMonths, jToDate, jWeekdayNames, jWeekdays,
  persianWeekday, sameDay, shiftJMonth, startOfDay, toDateOnly, toJalaliLong,
} from "@/lib/jalali";

export type JRange = { from?: Date | undefined; to?: Date | undefined };
export type JMonth = { y: number; m: number };
type View = "days" | "months" | "years";

type Props = {
  /** Single mode: the picked day. */
  selected?: Date | undefined;
  onSelect?: (d: Date) => void;
  /** Range mode (when onRangeChange is given): two clicks pick «از» and «تا», in any order. */
  range?: JRange | undefined;
  onRangeChange?: (r: JRange) => void;
  /** Holiday / note for a day; marked days read red with a dot and show the note on hover. */
  marked?: (d: Date) => string | undefined;
  min?: Date | undefined;
  max?: Date | undefined;
  /** Controlled visible month (the calendar page loads holidays per month). */
  month?: JMonth;
  onMonthChange?: (m: JMonth) => void;
  /** "lg" = full-width month board with the holiday name inside each day. */
  size?: "md" | "lg";
  autoFocus?: boolean;
  className?: string;
};

const ofDate = (d: Date): JMonth => { const j = gToJ(d); return { y: j.jy, m: j.jm }; };
const YEARS = 12;

/**
 * Solar Hijri month calendar shared by every date control: Saturday-first weeks, Fridays and holidays in red,
 * today ringed, the picked day filled in logo blue, a continuous band for ranges, month/year quick views and
 * keyboard moves that follow right-to-left (→ previous day, ← next day, ↑↓ week, PageUp/PageDown month, Home/End week edges).
 */
export function JalaliCalendar({ selected, onSelect, range, onRangeChange, marked, min, max, month, onMonthChange, size = "md", autoFocus, className }: Props) {
  const isRange = Boolean(onRangeChange);
  const anchor = selected ?? range?.from ?? new Date();
  const [innerMonth, setInnerMonth] = useState<JMonth>(() => ofDate(anchor));
  const cur = month ?? innerMonth;
  const setMonth = (m: JMonth) => { if (!month) setInnerMonth(m); onMonthChange?.(m); };
  const [view, setView] = useState<View>("days");
  const [focus, setFocus] = useState<Date>(() => startOfDay(anchor));
  const [hover, setHover] = useState<Date>();
  const [yearBase, setYearBase] = useState(() => cur.y - 4);
  const kbd = useRef(Boolean(autoFocus));
  const root = useRef<HTMLDivElement>(null);
  const today = startOfDay(new Date());
  const lo = min ? startOfDay(min) : undefined, hi = max ? startOfDay(max) : undefined;
  const off = (d: Date) => (lo !== undefined && d < lo) || (hi !== undefined && d > hi);

  const days = jMonthMatrix(cur.y, cur.m);
  const tabDay = days.some((d) => sameDay(d, focus)) && gToJ(focus).jm === cur.m ? focus : jToDate(cur.y, cur.m, 1);

  useEffect(() => {
    if (!kbd.current || view !== "days") return;
    kbd.current = false;
    root.current?.querySelector<HTMLButtonElement>(`[data-day="${toDateOnly(tabDay)}"]`)?.focus();
  });

  const go = (delta: number) => {
    if (view === "days") { const m = shiftJMonth(cur.y, cur.m, delta); setMonth(m); setFocus(jToDate(m.y, m.m, 1)); }
    else if (view === "months") setMonth({ y: cur.y + delta, m: cur.m });
    else setYearBase((b) => b + delta * YEARS);
  };
  const moveFocus = (d: Date) => { setFocus(d); kbd.current = true; const j = ofDate(d); if (j.y !== cur.y || j.m !== cur.m) setMonth(j); };
  const byMonths = (d: Date, n: number) => { const j = gToJ(d); const t = shiftJMonth(j.jy, j.jm, n); return jToDate(t.y, t.m, Math.min(j.jd, jMonthLength(t.y, t.m))); };

  const pick = (d: Date) => {
    if (off(d)) return;
    setFocus(d);
    const j = ofDate(d); if (j.y !== cur.y || j.m !== cur.m) setMonth(j);
    if (isRange) {
      const { from, to } = range ?? {};
      if (!from || to) onRangeChange?.({ from: d, to: undefined });
      else if (d < startOfDay(from)) onRangeChange?.({ from: d, to: startOfDay(from) });
      else onRangeChange?.({ from: startOfDay(from), to: d });
      setHover(undefined);
    } else onSelect?.(d);
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, d: Date) => {
    const col = persianWeekday(d);
    const map: Record<string, () => Date> = {
      ArrowRight: () => addDays(d, -1), ArrowLeft: () => addDays(d, 1), ArrowUp: () => addDays(d, -7), ArrowDown: () => addDays(d, 7),
      Home: () => addDays(d, -col), End: () => addDays(d, 6 - col),
      PageUp: () => byMonths(d, e.shiftKey ? -12 : -1), PageDown: () => byMonths(d, e.shiftKey ? 12 : 1),
    };
    const f = map[e.key];
    if (!f) return;
    e.preventDefault();
    moveFocus(f());
  };

  // Range band: from the start day to the end day (or to the hovered day while choosing the end).
  const rFrom = range?.from ? startOfDay(range.from) : undefined;
  const rEnd = range?.to ? startOfDay(range.to) : rFrom && hover ? hover : undefined;
  const [bandLo, bandHi] = rFrom && rEnd ? (rEnd < rFrom ? [rEnd, rFrom] : [rFrom, rEnd]) : [undefined, undefined];
  const previewing = Boolean(rFrom && !range?.to && hover);

  const title = view === "days" ? jMonthTitle(cur.y, cur.m) : view === "months" ? faDigits(cur.y) : `${faDigits(yearBase)} – ${faDigits(yearBase + YEARS - 1)}`;
  const lg = size === "lg";

  return (
    <div ref={root} className={cn("select-none", lg ? "w-full" : "w-[17.5rem]", className)} onMouseLeave={() => setHover(undefined)}>
      <div className="mb-2 flex items-center gap-1">
        <NavButton label={view === "days" ? "ماه قبل" : view === "months" ? "سال قبل" : "سال‌های قبل"} onClick={() => go(-1)}><ChevronRight /></NavButton>
        <button type="button" onClick={() => { if (view === "years") setView("days"); else { setYearBase(cur.y - 4); setView(view === "days" ? "months" : "years"); } }}
          aria-label="انتخاب ماه و سال" aria-live="polite"
          className={cn("group/title flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg font-extrabold text-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50", lg ? "text-base" : "text-sm")}>
          {title}<ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform duration-200 group-hover/title:text-primary", view !== "days" && "rotate-180")} />
        </button>
        <NavButton label={view === "days" ? "ماه بعد" : view === "months" ? "سال بعد" : "سال‌های بعد"} onClick={() => go(1)}><ChevronLeft /></NavButton>
      </div>

      {view === "months" && (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {jMonths.map((name, i) => {
            const m = i + 1;
            const isCur = cur.m === m, isSel = selected && ofDate(selected).y === cur.y && ofDate(selected).m === m;
            const isNow = ofDate(today).y === cur.y && ofDate(today).m === m;
            return (
              <button key={name} type="button" onClick={() => { setMonth({ y: cur.y, m }); setFocus(jToDate(cur.y, m, 1)); setView("days"); }}
                className={cn("h-11 rounded-lg text-sm font-semibold transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  isSel ? "bg-primary text-primary-foreground shadow-brand hover:bg-primary-hover hover:text-primary-foreground" : isCur ? "bg-primary-soft text-primary" : "text-foreground/85",
                  isNow && !isSel && "ring-1 ring-inset ring-primary/40")}>{name}</button>
            );
          })}
        </div>
      )}

      {view === "years" && (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {Array.from({ length: YEARS }, (_, i) => yearBase + i).map((y) => (
            <button key={y} type="button" onClick={() => { setMonth({ y, m: cur.m }); setView("months"); }}
              className={cn("h-11 rounded-lg text-sm font-semibold transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                y === cur.y ? "bg-primary text-primary-foreground shadow-brand hover:bg-primary-hover hover:text-primary-foreground" : "text-foreground/85",
                y === ofDate(today).y && y !== cur.y && "ring-1 ring-inset ring-primary/40")}>{faDigits(y)}</button>
          ))}
        </div>
      )}

      {view === "days" && (
        <>
          <div className="grid grid-cols-7 border-b border-border/70 pb-1.5" aria-hidden>
            {jWeekdays.map((w, i) => <div key={w} title={jWeekdayNames[i]} className={cn("text-center font-bold", lg ? "text-xs" : "text-[0.6875rem]", i === 6 ? "text-destructive/80" : "text-muted-foreground")}>{lg ? jWeekdayNames[i] : w}</div>)}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-y-1" role="group" aria-label={jMonthTitle(cur.y, cur.m)}>
            {days.map((d) => {
              const j = gToJ(d);
              const col = persianWeekday(d);
              const inMonth = j.jm === cur.m;
              const isToday = sameDay(d, today);
              const mark = marked?.(d);
              const disabled = off(d);
              const single = !isRange && sameDay(d, selected);
              const edgeLo = !!bandLo && sameDay(d, bandLo), edgeHi = !!bandHi && sameDay(d, bandHi);
              const inBand = !!bandLo && !!bandHi && d > bandLo && d < bandHi;
              const isEdge = isRange && (sameDay(d, rFrom) || sameDay(d, range?.to));
              const filled = single || isEdge;
              const band = isRange && bandLo && bandHi && !sameDay(bandLo, bandHi) && (inBand || edgeLo || edgeHi);
              const label = `${toJalaliLong(d)}${mark ? ` — ${mark}` : ""}${isToday ? " (امروز)" : ""}`;
              return (
                <div key={toDateOnly(d)} className={cn("relative flex justify-center",
                  band && (previewing ? "bg-primary-soft/60" : "bg-primary-soft"),
                  band && (edgeLo || col === 0) && "rounded-s-full", band && (edgeHi || col === 6) && "rounded-e-full",
                  lg && "px-0.5")}>
                  <button type="button" data-day={toDateOnly(d)} tabIndex={sameDay(d, tabDay) ? 0 : -1} disabled={disabled}
                    aria-label={label} aria-pressed={filled} aria-current={isToday ? "date" : undefined} title={mark}
                    onClick={() => pick(d)} onKeyDown={(e) => onKey(e, d)} onMouseEnter={() => isRange && setHover(d)} onFocus={() => setFocus(d)}
                    className={cn("relative font-semibold outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-30",
                      lg ? "flex h-[4.5rem] w-full flex-col items-start justify-between rounded-xl border border-transparent p-2 text-start text-sm" : "grid size-9 place-items-center rounded-full text-[0.8125rem]",
                      !inMonth && !filled && "text-muted-foreground/45",
                      inMonth && !filled && (col === 6 || mark) && "text-destructive",
                      inMonth && !filled && col !== 6 && !mark && "text-foreground",
                      !filled && "hover:bg-muted",
                      lg && inMonth && !filled && "border-border/60 bg-card hover:border-primary/30 hover:bg-primary-soft/50",
                      lg && inMonth && !filled && mark && "border-destructive/20 bg-destructive-soft/60",
                      isToday && !filled && "font-extrabold text-primary ring-[1.5px] ring-inset ring-primary/55",
                      filled && "bg-primary text-primary-foreground shadow-brand hover:bg-primary-hover",
                      band && !filled && "hover:bg-card")}>
                    <span>{faDigits(j.jd)}</span>
                    {lg ? (
                      <DayNote mark={mark} today={isToday} filled={filled} />
                    ) : (
                      (mark || isToday) && <span aria-hidden className={cn("absolute bottom-1 size-1 rounded-full", filled ? "bg-primary-foreground" : mark ? "bg-destructive" : "bg-primary")} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DayNote({ mark, today, filled }: { mark?: string | undefined; today: boolean; filled: boolean }) {
  if (!mark && !today) return null;
  return (
    <span className={cn("w-full truncate text-[0.625rem] font-semibold leading-4", filled ? "text-primary-foreground/90" : mark ? "text-destructive" : "text-primary")}>
      {mark ?? "امروز"}
    </span>
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4">
      {children}
    </button>
  );
}

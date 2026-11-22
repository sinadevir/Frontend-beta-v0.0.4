import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, CalendarDays } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { gToJ, jMonthTitle, sameDay, shiftJMonth, startOfDay, toJalali, toJalaliLong } from "@/lib/jalali";
import { caretAfterDigits, countDigits, maskJalaliInput } from "@/lib/jalali-input";
import { JalaliCalendar } from "./jalali-calendar";

export { JalaliCalendar, type JRange, type JMonth } from "./jalali-calendar";

/** Visible Jalali month with prev/next moves (calendar page). */
export function useJalaliCursor(initial?: Date) {
  const j = gToJ(initial ?? new Date());
  const [c, setC] = useState({ y: j.jy, m: j.jm });
  const move = (d: number) => setC(({ y, m }) => shiftJMonth(y, m, d));
  return { ...c, set: setC, move, title: jMonthTitle(c.y, c.m) };
}

type PickerProps = {
  value?: Date | undefined;
  onChange?: (d: Date) => void;
  /** When given, an × clears the date (optional fields and filters). */
  onClear?: () => void;
  placeholder?: string;
  /** Applied to the outer box (width / flex). */
  className?: string;
  id?: string;
  /** "sm" = compact control for table filters and toolbars. */
  size?: "md" | "sm";
  min?: Date | undefined;
  max?: Date | undefined;
  invalid?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string | undefined;
};

const asDate = (v: unknown) => { if (!v) return undefined; const d = v instanceof Date ? v : new Date(v as string); return Number.isNaN(d.getTime()) ? undefined : d; };

/**
 * Solar Hijri date field: type the date (year/month/day, slashes added automatically, impossible months/days refused)
 * or pick it from the calendar popover with «امروز» and «پاک کردن».
 */
export function JalaliDatePicker({ value: rawValue, onChange, onClear, placeholder = "انتخاب تاریخ", className, id, size = "md", min, max, invalid, disabled, ...aria }: PickerProps) {
  const value = asDate(rawValue);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => (value ? toJalali(value) : ""));
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const sm = size === "sm";
  const msgId = useId();

  // Keep the text in step with a date chosen elsewhere (calendar, «امروز», clearing, form reset).
  const vt = value?.getTime();
  useEffect(() => {
    const typed = maskJalaliInput(text).date;
    if (value && !sameDay(typed, value)) setText(toJalali(value));
    else if (!value && typed) setText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vt]);
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && caret.current !== null && document.activeElement === el) el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text]);

  const outOfRange = (d: Date) =>
    min && startOfDay(d) < startOfDay(min) ? `تاریخ باید ${toJalali(min)} یا بعد از آن باشد`
    : max && startOfDay(d) > startOfDay(max) ? `تاریخ باید ${toJalali(max)} یا پیش از آن باشد` : null;
  const commit = (d: Date) => { const bad = outOfRange(d); if (bad) { setMsg(bad); return false; } if (!sameDay(d, value)) onChange?.(d); setMsg(null); return true; };
  const pick = (d: Date) => { setText(toJalali(d)); setMsg(null); onChange?.(d); setOpen(false); };

  const onType = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const pos = e.target.selectionStart ?? raw.length;
    const deleting = (e.nativeEvent as InputEvent).inputType?.startsWith("delete") ?? false;
    const r = maskJalaliInput(raw, { deleting });
    caret.current = pos >= raw.length ? r.text.length : caretAfterDigits(r.text, countDigits(raw.slice(0, pos)));
    setText(r.text);
    if (r.error) { setMsg(r.error); return; }
    if (!r.text) { setMsg(null); if (value) onClear?.(); return; }
    if (r.ready && r.date) commit(r.date); else setMsg(null);
  };
  const onBlur = () => {
    if (!text) { if (value && !onClear) setText(toJalali(value)); setMsg(null); return; }
    const r = maskJalaliInput(text);
    if (r.valid && r.date && commit(r.date)) { setText(toJalali(r.date)); return; }
    if (!r.valid) setMsg(value ? "تاریخ کامل نبود؛ تاریخ قبلی برگردانده شد" : "تاریخ کامل نیست؛ سال/ماه/روز را بنویسید، مثل ۱۴۰۵/۱/۱۵");
    setText(value ? toJalali(value) : "");
  };

  const today = startOfDay(new Date());
  const todayOff = (min && today < startOfDay(min)) || (max && today > startOfDay(max));
  const describedBy = [aria["aria-describedby"], msg ? msgId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("relative", sm ? "min-w-28" : "w-full", className)}>
          <div className={cn("field-control flex w-full items-center font-normal", sm ? "h-8 min-h-8 gap-1 rounded-md ps-1 pe-1.5 text-xs" : "h-11 gap-2 ps-1.5 pe-3 text-sm", disabled && "pointer-events-none opacity-60")}
            aria-invalid={invalid || Boolean(msg) || undefined}>
            <PopoverTrigger asChild>
              <button type="button" disabled={disabled} aria-label="باز کردن تقویم" title="انتخاب از تقویم"
                className={cn("grid shrink-0 cursor-pointer place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  sm ? "size-6" : "size-8", value ? "bg-primary-soft text-primary hover:bg-primary/15" : "bg-muted text-muted-foreground hover:bg-primary-soft hover:text-primary")}>
                <CalendarDays className={sm ? "size-3" : "size-3.5"} />
              </button>
            </PopoverTrigger>
            <input ref={inputRef} id={id} type="text" inputMode="numeric" autoComplete="off" spellCheck={false} disabled={disabled}
              value={text} onChange={onType} onBlur={onBlur} placeholder={placeholder} maxLength={10}
              onKeyDown={(e) => {
                if (e.key === "Enter") { const r = maskJalaliInput(text); if (r.valid && r.date) { e.preventDefault(); commit(r.date); } }
                if (e.key === "ArrowDown" && e.altKey) { e.preventDefault(); setOpen(true); }
                if (e.key === "Escape" && msg) setMsg(null);
              }}
              aria-invalid={invalid || Boolean(msg) || undefined} aria-describedby={describedBy}
              aria-label={value ? `${placeholder}: ${toJalaliLong(value)}` : `${placeholder} (سال/ماه/روز)`}
              className={cn("date-typing min-w-0 flex-1 bg-transparent text-start font-bold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground disabled:cursor-not-allowed",
                value && onClear && sm && "pe-4")} />
          </div>
          {msg && (
            <p id={msgId} role="alert" className={cn("flex items-start gap-1 text-xs font-semibold text-destructive",
              sm ? "absolute inset-x-0 top-full z-30 mt-1 rounded-md border border-destructive/30 bg-card px-2 py-1.5 shadow-raised" : "mt-1.5")}>
              <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />{msg}
            </p>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-auto overflow-hidden rounded-2xl p-0" onCloseAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
        <div className="p-3"><JalaliCalendar selected={value} onSelect={pick} min={min} max={max} autoFocus /></div>
        <div className="flex items-center gap-1.5 border-t border-border/80 bg-muted/50 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{value ? toJalaliLong(value) : "تاریخی انتخاب نشده"}</span>
          {value && onClear && <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:bg-destructive-soft hover:text-destructive" onClick={() => { setText(""); setMsg(null); onClear(); setOpen(false); }}>پاک کردن</Button>}
          <Button type="button" size="sm" variant="soft" className="h-7 px-2.5 text-xs" disabled={Boolean(todayOff)} onClick={() => pick(today)}>امروز</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** «مشاهده در تاریخ» – for temporal (as-of) queries */
export function AsOfPicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card py-1 pe-1 ps-2.5 text-sm shadow-card">
      <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">نمایش در تاریخ</span>
      <JalaliDatePicker value={value} onChange={onChange} size="sm" className="w-36" placeholder="تاریخ" />
    </div>
  );
}


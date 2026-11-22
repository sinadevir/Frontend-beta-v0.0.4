import { CalendarDays, Clock3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { hasTime, toJalali, toJalaliLong, toRelative, toTime } from "@/lib/jalali";

type Value = Date | string | null | undefined;
const parse = (v: Value) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

/**
 * One way to show a date anywhere in the system: short Solar Hijri «۱۴۰۵/۸/۲۹» (plus «۱۰:۳۰» when `time`),
 * and on hover the full date, the clock time and how far it is from today.
 * `relative` adds «۳ روز پیش» next to the date; empty or invalid values show a muted «—».
 */
export function DateText({ value, time, relative, className }: { value: Value; time?: boolean; relative?: boolean; className?: string }) {
  const d = parse(value);
  if (!d) return <span className={cn("text-muted-foreground/70", className)}>—</span>;
  const withTime = time && hasTime(value);
  const rel = toRelative(d);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={d.toISOString()} className={cn("inline-flex cursor-default items-baseline gap-1.5 whitespace-nowrap", className)}>
          <span>{toJalali(d)}</span>
          {withTime && <span className="text-[0.92em] text-muted-foreground">{toTime(d)}</span>}
          {relative && <span className="text-[0.85em] text-muted-foreground">· {rel}</span>}
        </time>
      </TooltipTrigger>
      <TooltipContent side="top" className="px-3 py-2">
        <div className="flex items-center gap-1.5 font-bold"><CalendarDays className="size-3.5 opacity-80" />{toJalaliLong(d)}</div>
        <div className="mt-1 flex items-center gap-1.5 opacity-85">
          {hasTime(value) && <><Clock3 className="size-3.5 opacity-80" /><span>ساعت {toTime(d)}</span><span aria-hidden>·</span></>}
          <span>{rel}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

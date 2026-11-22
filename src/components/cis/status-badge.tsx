import { Check, Minus } from "lucide-react";
import { Badge, BadgeDot, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/status";

export type StatusTone = "success" | "warning" | "destructive" | "neutral" | "info";

/**
 * Order matters: the first matching group wins.
 * neutral = finished/archived without a problem, success = in force / done, warning = still moving or needs attention,
 * destructive = stopped, refused or failed, info (fallback) = anything else.
 * Negated words («غیرفعال»، «تأییدنشده»، «نامعتبر»، «ناموفق») are excluded from the positive group by look-arounds.
 */
const tones: [RegExp, StatusTone][] = [
  [/بسته‌شده|جایگزین‌شده|بازنشسته|منسوخ|ادغام‌شده|پایان‌یافته|رفع‌شده|^closed$|superseded|retired|deprecated|merged|^ended$|lifted|released/i, "neutral"],
  [/(?<!نا)سازگار|جاری|(?<!غیر)فعال|تأیید(?!نشده)|اجراشده|منتشرشده|(?<!نا)موفق|(?<!نا)معتبر|حل‌شده|قابل استفاده|پردازش‌شده|^(active|approved|completed|executed|published|verified|resolved|healthy|processed)$/i, "success"],
  [/معلق|بررسی|انتظار|ارسال|تعارض|ناسازگار|محدود|اصلاح‌شده|پیش‌نویس|در حال|ناقص|تأییدنشده|^باز$|^draft$|submitted|review|pending|awaiting|executing|partially|unverified|suspended|^open(ed)?$/i, "warning"],
  [/قطع|رد|لغو|غیرفعال|ناموفق|خطا|ابطال|منقضی|برگشت|خاتمه|مسدود|نامعتبر|inactive|rejected|cancel|failed|revoked|expired|terminated|disconnected|dead|blocked/i, "destructive"],
];
/** Work that is still moving gets a softly pulsing light. */
const moving = /در حال|اجرا|executing|processing|running/i;

/** Picks the colour for a server status: green in force, amber in progress, red stopped, grey archived, blue anything else. */
export function statusTone(status: string | undefined | null): StatusTone {
  const label = statusLabel(status);
  const raw = String(status ?? "");
  return tones.find(([r]) => r.test(label) || r.test(raw))?.[1] ?? "info";
}

/** Shows a server status in Persian with a consistent colour. */
export function StatusBadge({ status, className, size }: { status: string | undefined | null; className?: string; size?: BadgeProps["size"] }) {
  const label = statusLabel(status);
  const raw = String(status ?? "");
  if (label === "—") return <span className="text-muted-foreground/70">—</span>;
  const tone = statusTone(status);
  const text = `${label} ${raw}`;
  return (
    <Badge variant={tone} size={size} className={cn(className)} title={raw && raw !== label ? raw : undefined}>
      <BadgeDot pulse={tone === "warning" && moving.test(text) && !/انتظار|awaiting/i.test(text)} />{label}
    </Badge>
  );
}

/** Yes/no values in tables and detail lists: a small green «بله» with a tick, a quiet grey «خیر». */
export function YesNo({ value, yes = "بله", no = "خیر", size = "sm" }: { value: boolean; yes?: string; no?: string; size?: BadgeProps["size"] }) {
  return value
    ? <Badge variant="success" size={size}><Check strokeWidth={3} />{yes}</Badge>
    : <Badge variant="neutral" size={size}><Minus strokeWidth={3} />{no}</Badge>;
}

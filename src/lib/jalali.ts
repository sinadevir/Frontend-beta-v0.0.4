import { toJalaali, toGregorian, jalaaliMonthLength } from "jalaali-js";
const valid = (d: Date | string | undefined | null) => { if (!d) return null; const x = new Date(d); return Number.isNaN(x.getTime()) ? null : x; };
const pad = (n: number) => String(n).padStart(2, "0");
const fa = (s: string | number) => String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
const weekdayNames = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const monthNames = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
/** Legacy right-to-left mark. Dates no longer contain it (it made «۱۴۰۳\u200F/۱۲\u200F/۰۹» look broken); kept only so old stored text can still be cleaned with replaceAll. */
export const RLM = "\u200F";
/**
 * Solar Hijri date «۱۴۰۵/۱/۱۳»: Persian digits, year/month/day, no padding, no hidden marks.
 * Persian digits are weak-LTR in bidi, so a plain run keeps this exact order inside right-to-left text.
 * Returns "—" for empty or invalid values so tables never show "Invalid Date".
 */
export const toJalali = (d: Date | string | undefined | null) => { const x = valid(d); if (!x) return "—"; const j = toJalaali(x); return fa(`${j.jy}/${j.jm}/${j.jd}`); };
/** Long Persian date «چهارشنبه ۲۷ آبان ۱۴۰۵» (day, month, year in Persian order). */
export const toJalaliLong = (d: Date | string) => { const x = valid(d); if (!x) return "—"; const j = toJalaali(x); return `${weekdayNames[x.getDay()]} ${fa(j.jd)} ${monthNames[j.jm - 1]} ${fa(j.jy)}`; };
/** Solar Hijri date with time «۱۴۰۴/۰۲/۲۵، ساعت ۱۰:۳۰». */
export const toJalaliDateTime = (d: Date | string | undefined | null) => { const x = valid(d); if (!x) return "—"; return `${toJalali(x)}، ساعت ${fa(`${pad(x.getHours())}:${pad(x.getMinutes())}`)}`; };
export const faNum = (n: number | string | undefined | null) => (n === undefined || n === null || n === "" ? "—" : Number.isNaN(Number(n)) ? String(n) : Number(n).toLocaleString("fa-IR"));
export const faDigits = (s: string | number) => String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
export const faToEnDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
export const jMonths = monthNames;
export const jWeekdays = ["ش","ی","د","س","چ","پ","ج"];
export const gToJ = (d: Date) => toJalaali(d);
export const jToDate = (jy: number, jm: number, jd: number) => { const g = toGregorian(jy, jm, jd); return new Date(g.gy, g.gm - 1, g.gd); };
export const jMonthLength = (jy: number, jm: number) => jalaaliMonthLength(jy, jm);
/** index of weekday where Saturday = 0 */
export const persianWeekday = (d: Date) => (d.getDay() + 1) % 7;
/** yyyy-mm-dd for DateOnly API fields, using the local calendar day the user picked. */
export const toDateOnly = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ───────── Calendar helpers (local calendar days, Saturday-first weeks) ───────── */
export const jWeekdayNames = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
/** Full weekday name «جمعه» for a date. */
export const weekdayName = (d: Date) => jWeekdayNames[persianWeekday(d)]!;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const sameDay = (a?: Date | null, b?: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/** Whole calendar days from `a` to `b` (positive when b is later); daylight-saving safe. */
export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
/** Moves a Jalali year/month by `delta` months. */
export const shiftJMonth = (y: number, m: number, delta: number) => { const t = y * 12 + (m - 1) + delta; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };
/** «آبان ۱۴۰۵» */
export const jMonthTitle = (y: number, m: number) => `${monthNames[m - 1]} ${fa(y)}`;
/** The 42 days (six Saturday-first weeks) shown for a Jalali month, including the tail of the previous month and the head of the next. */
export const jMonthMatrix = (jy: number, jm: number) => { const first = jToDate(jy, jm, 1); const start = addDays(first, -persianWeekday(first)); return Array.from({ length: 42 }, (_, i) => addDays(start, i)); };
/** Persian relative day: «امروز»، «دیروز»، «فردا»، «۳ روز پیش»، «۲ هفته دیگر»، «۵ ماه پیش»، «۲ سال پیش». */
export const toRelative = (d: Date | string | undefined | null, now: Date = new Date()) => {
  const x = valid(d); if (!x) return "—";
  const diff = daysBetween(x, now);
  if (diff === 0) return "امروز";
  if (diff === 1) return "دیروز";
  if (diff === -1) return "فردا";
  const a = Math.abs(diff);
  const [n, unit] = a < 7 ? [a, "روز"] : a < 30 ? [Math.floor(a / 7), "هفته"] : a < 365 ? [Math.floor(a / 30), "ماه"] : [Math.floor(a / 365), "سال"];
  return `${fa(n)} ${unit} ${diff > 0 ? "پیش" : "دیگر"}`;
};
/** True when the value carries a clock time other than midnight (so a time is worth showing). */
export const hasTime = (d: Date | string | undefined | null) => { if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return false; const x = valid(d); return !!x && (x.getHours() !== 0 || x.getMinutes() !== 0); };
/** «۱۰:۳۰» */
export const toTime = (d: Date | string | undefined | null) => { const x = valid(d); return x ? fa(`${pad(x.getHours())}:${pad(x.getMinutes())}`) : "—"; };

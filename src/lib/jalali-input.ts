import { faDigits, faToEnDigits, jMonthLength, jMonths, jToDate } from "./jalali";

/** Result of reading what the user typed into a Solar Hijri date field. */
export type JDateDraft = {
  /** Text to show in the field (Persian digits, slashes added automatically). */
  text: string;
  /** Why the last typed character was refused (month 13, day 32, year 2405 …). */
  error?: string;
  /** Year, month and day are all typed and the day cannot get another digit – commit right away. */
  ready: boolean;
  /** Year, month and day are present (a one-digit day counts) – acceptable when the field loses focus. */
  valid: boolean;
  date?: Date;
};

const SEP = /[/\\\-.\s،٫]/;

/**
 * Masks typed text as year/month/day:
 * - after four year digits a «/» is added automatically;
 * - a month that cannot take a second digit (2-9) closes itself, «10-12» are the only two-digit months, 13+ is refused;
 * - a day above the length of that month (31/30/29, Esfand of leap years 30) is refused;
 * - Persian, Arabic and Latin digits are all accepted; «/ - .» and space move to the next part.
 * `deleting` keeps an automatic trailing slash from coming back while the user presses Backspace.
 */
export function maskJalaliInput(raw: string, opts: { deleting?: boolean } = {}): JDateDraft {
  const s = faToEnDigits(raw);
  let y = "", m = "", d = "", part = 0, dayDone = false;
  let error: string | undefined;
  const refuse = (msg: string) => { error ??= msg; };
  for (const c of s) {
    if (SEP.test(c)) {
      if (part === 0 && y.length === 4) part = 1;
      else if (part === 1 && m && m !== "0") part = 2;
      continue;
    }
    if (!/\d/.test(c)) continue;
    if (part === 0) {
      if (y.length === 0 && c !== "1") { refuse("سال را چهاررقمی بنویسید؛ مثل ۱۴۰۵"); continue; }
      if (y.length === 1 && c !== "3" && c !== "4") { refuse("سال باید بین ۱۳۰۰ تا ۱۴۹۹ باشد"); continue; }
      y += c;
      if (y.length === 4) part = 1;
      continue;
    }
    if (part === 1) {
      if (!m) { m = c; if (c !== "0" && c !== "1") part = 2; continue; }
      const v = Number(m + c);
      if (v < 1 || v > 12) { refuse("ماه باید بین ۱ تا ۱۲ باشد"); continue; }
      m += c; part = 2;
      continue;
    }
    if (d.length >= 2) continue;
    const max = jMonthLength(Number(y), Number(m));
    const tooLong = `${jMonths[Number(m) - 1]} ${faDigits(y)} ${faDigits(max)} روز دارد`;
    if (dayDone) { refuse(tooLong); continue; }
    if (!d) {
      d = c;
      if (c !== "0" && Number(c) * 10 > max) dayDone = true;
      continue;
    }
    const v = Number(d + c);
    if (v < 1) { refuse("روز باید از ۱ شروع شود"); continue; }
    if (v > max) { refuse(tooLong); continue; }
    d += c;
  }
  let text = y;
  if (part >= 1) text += `/${m}`;
  if (part >= 2) text += `/${d}`;
  if (opts.deleting && text.endsWith("/") && !SEP.test(s.slice(-1))) text = text.slice(0, -1);
  const valid = y.length === 4 && Number(m) >= 1 && Number(d) >= 1;
  const ready = valid && (d.length === 2 || dayDone);
  return { text: faDigits(text), error, ready, valid, date: valid ? jToDate(Number(y), Number(m), Number(d)) : undefined };
}

/** Position in `text` just after its `n`-th digit (used to keep the caret in place after re-masking). */
export function caretAfterDigits(text: string, n: number) {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) if (/[0-9۰-۹٠-٩]/.test(text[i]!) && ++seen === n) return i + 1;
  return text.length;
}
export const countDigits = (text: string) => (text.match(/[0-9۰-۹٠-٩]/g) ?? []).length;

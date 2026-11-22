import { describe, expect, it } from "vitest";
import { maskJalaliInput } from "@/lib/jalali-input";
import { gToJ } from "@/lib/jalali";

describe("typed Solar Hijri date field", () => {
  it("adds «/» after the four year digits", () => {
    expect(maskJalaliInput("1405").text).toBe("۱۴۰۵/");
  });
  it("adds «/» after a two-digit month", () => {
    expect(maskJalaliInput("140511").text).toBe("۱۴۰۵/۱۱/");
  });
  it("closes a month that cannot take a second digit (e.g. 7) and adds «/»", () => {
    expect(maskJalaliInput("14057").text).toBe("۱۴۰۵/۷/");
  });
  it("refuses month 13 with the month message", () => {
    const r = maskJalaliInput("1405/13");
    expect(r.error).toBe("ماه باید بین ۱ تا ۱۲ باشد");
    expect(r.text).toBe("۱۴۰۵/۱");
    expect(r.valid).toBe(false);
  });
  it("refuses day 31 in Mehr (30 days)", () => {
    const r = maskJalaliInput("1405/7/31");
    expect(r.error).toBe("مهر ۱۴۰۵ ۳۰ روز دارد");
    expect(r.text).toBe("۱۴۰۵/۷/۳");
  });
  it("accepts day 31 in Farvardin", () => {
    const r = maskJalaliInput("1405/1/31");
    expect(r.error).toBeUndefined();
    expect(r.ready).toBe(true);
  });
  it("refuses 30 Esfand in a non-leap year (1404)", () => {
    const r = maskJalaliInput("1404/12/30");
    expect(r.error).toBe("اسفند ۱۴۰۴ ۲۹ روز دارد");
    expect(r.valid).toBe(true); // «۱۴۰۴/۱۲/۳» remains — the refused digit is dropped
    expect(r.text).toBe("۱۴۰۴/۱۲/۳");
  });
  it("accepts 30 Esfand in a leap year (1403)", () => {
    const r = maskJalaliInput("1403/12/30");
    expect(r.error).toBeUndefined();
    expect(r.ready).toBe(true);
  });
  it("accepts Persian and Latin digits alike", () => {
    const fa = maskJalaliInput("۱۴۰۵/۸/۲۷");
    const en = maskJalaliInput("1405/8/27");
    expect(fa.text).toBe("۱۴۰۵/۸/۲۷");
    expect(fa.text).toBe(en.text);
    expect(gToJ(fa.date!)).toMatchObject({ jy: 1405, jm: 8, jd: 27 });
  });
  it("a half-typed date is not valid", () => {
    expect(maskJalaliInput("1405/8").valid).toBe(false);
    expect(maskJalaliInput("140").valid).toBe(false);
  });
});

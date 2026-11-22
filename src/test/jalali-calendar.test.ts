import { describe, expect, it } from "vitest";
import { gToJ, jMonthMatrix, jToDate, persianWeekday, toRelative } from "@/lib/jalali";

describe("Solar Hijri month grid", () => {
  it("weeks start on Saturday and the grid holds six full weeks", () => {
    const days = jMonthMatrix(1405, 8);
    expect(days).toHaveLength(42);
    expect(persianWeekday(days[0]!)).toBe(0); // شنبه
    expect(persianWeekday(days[6]!)).toBe(6); // جمعه
  });
  it("1 Aban 1405 falls on a Friday, so it sits in the last column of the first week", () => {
    const days = jMonthMatrix(1405, 8);
    const first = days.findIndex((d) => { const j = gToJ(d); return j.jm === 8 && j.jd === 1; });
    expect(first).toBe(6);
    expect(jToDate(1405, 8, 29).getDay()).toBe(5); // 20 Nov 2026 is a Friday
  });
});

describe("relative days in Persian", () => {
  const now = new Date(2026, 10, 20, 12, 0);
  it("same day, yesterday and tomorrow", () => {
    expect(toRelative(new Date(2026, 10, 20, 8), now)).toBe("امروز");
    expect(toRelative(new Date(2026, 10, 19, 23), now)).toBe("دیروز");
    expect(toRelative(new Date(2026, 10, 21, 1), now)).toBe("فردا");
  });
  it("days, weeks, months and years", () => {
    expect(toRelative(new Date(2026, 10, 17), now)).toBe("۳ روز پیش");
    expect(toRelative(new Date(2026, 10, 6), now)).toBe("۲ هفته پیش");
    expect(toRelative(new Date(2026, 5, 20), now)).toBe("۵ ماه پیش");
    expect(toRelative(new Date(2024, 10, 20), now)).toBe("۲ سال پیش");
    expect(toRelative(new Date(2026, 10, 30), now)).toBe("۱ هفته دیگر");
  });
});

import { describe, expect, it } from "vitest";
import { ageBucket, ageDays, collectPages, groupCount, inRange, mean, timeKey, timeline, weekStart } from "@/features/reports/engine";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("report date range", () => {
  it("includes both the first and the last chosen day", () => {
    expect(inRange("2026-11-01T08:00:00", day(2026, 11, 1), day(2026, 11, 10))).toBe(true);
    expect(inRange("2026-11-10T23:30:00", day(2026, 11, 1), day(2026, 11, 10))).toBe(true);
  });
  it("drops rows just outside the range", () => {
    expect(inRange("2026-10-31T23:59:00", day(2026, 11, 1), day(2026, 11, 10))).toBe(false);
    expect(inRange("2026-11-11T00:00:00", day(2026, 11, 1), day(2026, 11, 10))).toBe(false);
  });
  it("keeps undated rows only when no range is set", () => {
    expect(inRange("", undefined, undefined)).toBe(true);
    expect(inRange("", day(2026, 11, 1), undefined)).toBe(false);
  });
});

describe("weekly and monthly buckets", () => {
  it("starts the week on Saturday", () => {
    // 2026-11-18 is a Wednesday; its Saturday is 2026-11-14
    expect(weekStart(day(2026, 11, 18)).getDate()).toBe(14);
    expect(timeKey("2026-11-18T10:00:00", "week")).toBe("2026-11-14");
    expect(timeKey("2026-11-14T10:00:00", "week")).toBe("2026-11-14");
  });
  it("uses the Jalali month for monthly buckets", () => {
    // 2026-11-22 = 1 Azar 1405
    expect(timeKey("2026-11-22T10:00:00", "month")).toBe("1405-09");
  });
  it("fills empty weeks between the first and last record with zero", () => {
    const rows = ["2026-11-01T09:00:00", "2026-11-02T09:00:00", "2026-11-20T09:00:00"];
    const b = timeline(rows, (r) => r, "week");
    expect(b.map((x) => x.count)).toEqual([2, 0, 1]);
  });
  it("counts records without a date in a separate bucket", () => {
    const b = timeline(["2026-11-01T09:00:00", ""], (r) => r, "month");
    expect(b.at(-1)).toMatchObject({ key: "", label: "بدون تاریخ", count: 1 });
  });
});

describe("grouping", () => {
  it("sorts groups largest first and names empty values «نامشخص»", () => {
    const b = groupCount(["a", "b", "a", "", "a", "b"], (r) => r);
    expect(b.map((x) => [x.key, x.count])).toEqual([["a", 3], ["b", 2], ["", 1]]);
    expect(b[2]?.label).toBe("نامشخص");
  });
  it("follows a fixed order when one is given", () => {
    const b = groupCount(["late", "early", "late"], (r) => r, (k) => k, ["early", "late"]);
    expect(b.map((x) => x.key)).toEqual(["early", "late"]);
  });
});

describe("waiting time", () => {
  it("puts days into the four waiting bands", () => {
    expect(ageBucket(3)).toBe("تا ۳ روز");
    expect(ageBucket(4)).toBe("۴ تا ۷ روز");
    expect(ageBucket(7)).toBe("۴ تا ۷ روز");
    expect(ageBucket(30)).toBe("۸ تا ۳۰ روز");
    expect(ageBucket(31)).toBe("بیش از ۳۰ روز");
  });
  it("counts whole calendar days from request to completion", () => {
    expect(ageDays("2026-11-01T23:00:00", "2026-11-05T01:00:00")).toBe(4);
    expect(ageDays(undefined, "2026-11-05")).toBeUndefined();
  });
  it("averages only known durations", () => {
    expect(mean([2, undefined, 4])).toBe(3);
    expect(mean([undefined])).toBeUndefined();
  });
});

describe("reading every page", () => {
  const server = (total: number) => async (page: number, size: number) => {
    const start = (page - 1) * size;
    return { items: Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => ({ id: start + i })), totalCount: total, page, pageSize: size };
  };
  it("reads all pages until the server total is reached", async () => {
    const res = await collectPages(server(250), (r) => r["id"], { pageSize: 100 });
    expect(res.rows).toHaveLength(250);
    expect(res.truncated).toBe(false);
  });
  it("stops at the row cap and marks the report as partial", async () => {
    const res = await collectPages(server(250), (r) => r["id"], { pageSize: 100, cap: 150 });
    expect(res.rows).toHaveLength(150);
    expect(res.total).toBe(250);
    expect(res.truncated).toBe(true);
  });
});

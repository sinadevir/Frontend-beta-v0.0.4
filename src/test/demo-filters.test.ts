import { describe, expect, it } from "vitest";
import { demoResponse } from "@/lib/api/demo";

type Resp = { items: Record<string, unknown>[]; totalCount: number };

describe("demo mode honours list filters", () => {
  it("status filter returns only rows with that status", () => {
    const all = demoResponse("/api/v1/customers", { page: 1, pageSize: 8 }) as Resp;
    const r = demoResponse("/api/v1/customers", { page: 1, pageSize: 8, Status: "Suspended" }) as Resp;
    expect(r.totalCount).toBeGreaterThan(0);
    expect(r.totalCount).toBeLessThan(all.totalCount);
    expect(r.items.every((x) => x["customerStatus"] === "Suspended" || x["status"] === "Suspended")).toBe(true);
  });
  it("empty filter value changes nothing", () => {
    const a = demoResponse("/api/v1/customers", { page: 1, pageSize: 8 }) as Resp;
    const b = demoResponse("/api/v1/customers", { page: 1, pageSize: 8, Status: "" }) as Resp;
    expect(b.totalCount).toBe(a.totalCount);
  });
});

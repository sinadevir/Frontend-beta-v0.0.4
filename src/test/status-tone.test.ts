import { describe, expect, it } from "vitest";
import { statusTone } from "@/components/cis/status-badge";

describe("status badge colours", () => {
  it("active and approved records are green", () => {
    expect(statusTone("Active")).toBe("success");
    expect(statusTone("Approved")).toBe("success");
    expect(statusTone("Completed")).toBe("success");
  });
  it("inactive is red, not green (the word contains «فعال»)", () => {
    expect(statusTone("Inactive")).toBe("destructive");
    expect(statusTone("غیرفعال")).toBe("destructive");
  });
  it("unverified waits for attention, it is not green", () => {
    expect(statusTone("Unverified")).toBe("warning");
  });
  it("work in progress is amber", () => {
    expect(statusTone("Executing")).toBe("warning");
    expect(statusTone("UnderReview")).toBe("warning");
    expect(statusTone("PartiallyCompleted")).toBe("warning");
  });
  it("failed, rejected and disconnected are red", () => {
    expect(statusTone("Failed")).toBe("destructive");
    expect(statusTone("Rejected")).toBe("destructive");
    expect(statusTone("Disconnected")).toBe("destructive");
  });
  it("closed, superseded and lifted records are grey", () => {
    expect(statusTone("Closed")).toBe("neutral");
    expect(statusTone("Superseded")).toBe("neutral");
    expect(statusTone("Lifted")).toBe("neutral");
  });
});

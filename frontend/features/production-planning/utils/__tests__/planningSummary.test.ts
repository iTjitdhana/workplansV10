import { calculateDailySummary, formatDurationLabel, formatLogTime, getDisplayJobName } from "../planningSummary";
import type { ProductionItem, User } from "@/types/production";

const baseItem = (overrides: Partial<ProductionItem>): ProductionItem => ({
  id: "1",
  production_date: "2026-05-07",
  job_code: "100",
  job_name: "งานทดสอบ",
  operators: "เอ",
  start_time: "08:00",
  end_time: "09:00",
  status: "draft",
  created_at: "2026-05-07T08:00:00.000Z",
  updated_at: "2026-05-07T08:00:00.000Z",
  ...overrides,
});

describe("planningSummary", () => {
  it("formats duration label with Thai units", () => {
    expect(formatDurationLabel(90)).toContain("วินาที");
  });

  it("formats log time for Thai locale", () => {
    const value = formatLogTime("2026-05-07T08:30:00.000Z");
    expect(value).toMatch(/:/);
  });

  it("calculates daily summary and available workers", () => {
    const jobs: ProductionItem[] = [baseItem({ operators: ["เอ", "บี"] })];
    const users: User[] = [
      { id: 1, id_code: "U1", name: "เอ" },
      { id: 2, id_code: "U2", name: "บี" },
      { id: 3, id_code: "U3", name: "ซี" },
    ];
    const summary = calculateDailySummary(jobs, users);
    expect(summary.totalWorkers).toBe(2);
    expect(summary.availableWorkers).toContain("ซี");
  });

  it("returns display name for default job codes", () => {
    const item = baseItem({ job_code: "A" });
    expect(getDisplayJobName(item, [item])).toBe("A");
  });
});

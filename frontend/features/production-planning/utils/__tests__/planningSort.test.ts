import { buildDailyProductionDisplayOrder, sortByStartTimeAndFirstOperator } from "../planningSort";
import type { ProductionItem } from "@/types/production";

const baseItem = (overrides: Partial<ProductionItem>): ProductionItem => ({
  id: "1",
  production_date: "2026-05-07",
  job_code: "100",
  job_name: "งานทดสอบ",
  operators: "เอ",
  status: "draft",
  created_at: "2026-05-07T08:00:00.000Z",
  updated_at: "2026-05-07T08:00:00.000Z",
  ...overrides,
});

describe("planningSort", () => {
  it("sorts by start time then first operator", () => {
    const jobs = [
      baseItem({ id: "2", start_time: "09:00", operators: "บี" }),
      baseItem({ id: "1", start_time: "08:00", operators: "ซี" }),
    ];

    const result = sortByStartTimeAndFirstOperator(jobs);
    expect(result.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("keeps default jobs first in daily display order", () => {
    const jobs = [
      baseItem({ id: "2", job_code: "100", isDraft: false, start_time: "09:00" }),
      baseItem({ id: "3", job_code: "A", isDraft: true }),
      baseItem({ id: "4", job_code: "B", isDraft: true }),
    ];

    const result = buildDailyProductionDisplayOrder(jobs);
    expect(result.slice(0, 2).map((item) => item.job_code)).toEqual(["A", "B"]);
  });
});

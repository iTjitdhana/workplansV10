import { getOperatorsArray } from "@/lib/utils";
import type { ProductionItem } from "@/types/production";

type NameResolver = (value: string | undefined) => string;

export const splitProductionJobs = (
  productionData: ProductionItem[],
  selectedDate: string,
  defaultCodes: string[],
) => {
  const normalJobs = productionData.filter(
    (item) =>
      item.production_date === selectedDate &&
      !(item.isDraft && defaultCodes.includes(item.job_code)) &&
      item.is_special !== 1 &&
      item.workflow_status_id !== 10,
  );

  const specialJobs = productionData.filter(
    (item) =>
      item.production_date === selectedDate &&
      !(item.isDraft && defaultCodes.includes(item.job_code)) &&
      (item.is_special === 1 || item.workflow_status_id === 10),
  );

  return { normalJobs, specialJobs };
};

export const buildSummaryRows = (
  jobs: ProductionItem[],
  getMachineNameById: NameResolver,
  getRoomNameByCodeOrId: NameResolver,
) => {
  return jobs.map((item, idx) => {
    const operators = getOperatorsArray(item.operators);
    while (operators.length < 4) operators.push("");

    return [
      idx + 1,
      item.job_code || "",
      item.job_name || "",
      operators[0],
      operators[1],
      operators[2],
      operators[3],
      item.start_time || "",
      item.end_time || "",
      getMachineNameById(item.machine_id?.toString() || ""),
      getRoomNameByCodeOrId(item.production_room || ""),
    ];
  });
};

const buildRowsPerOperator = (
  items: ProductionItem[],
  dateString: string,
  dateValue: string,
  getRoomNameByCodeOrId: NameResolver,
) => {
  const rows: string[][] = [];

  items.forEach((item) => {
    const operators = (typeof item.operators === "string" ? item.operators : "")
      .split(", ")
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (operators.length === 0) {
      rows.push([
        dateString,
        dateValue,
        item.job_code || "",
        item.job_name || "",
        "",
        item.start_time || "",
        item.end_time || "",
        getRoomNameByCodeOrId(item.production_room),
      ]);
      return;
    }

    operators.forEach((operator: string) => {
      rows.push([
        dateString,
        dateValue,
        item.job_code || "",
        item.job_name || "",
        operator,
        item.start_time || "",
        item.end_time || "",
        getRoomNameByCodeOrId(item.production_room),
      ]);
    });
  });

  return rows;
};

export const buildLogRows = ({
  productionData,
  selectedDate,
  dateString,
  dateValue,
  defaultCodes,
  filteredJobs,
  getRoomNameByCodeOrId,
}: {
  productionData: ProductionItem[];
  selectedDate: string;
  dateString: string;
  dateValue: string;
  defaultCodes: string[];
  filteredJobs: ProductionItem[];
  getRoomNameByCodeOrId: NameResolver;
}) => {
  const logRows: string[][] = [];

  const defaultJobsData = productionData.filter(
    (item) => item.production_date === selectedDate && defaultCodes.includes(item.job_code),
  );

  if (defaultJobsData.length === 0) {
    const defaultJobs = [
      { job_code: "A", job_name: "เบิกของส่งสาขา  - ผัก" },
      { job_code: "B", job_name: "เบิกของส่งสาขา  - สด" },
      { job_code: "C", job_name: "เบิกของส่งสาขา  - แห้ง" },
      { job_code: "D", job_name: "ตวงสูตร" },
    ];

    defaultJobs.forEach((job) => {
      logRows.push([dateString, dateValue, job.job_code, job.job_name, "", "", "", ""]);
    });
  } else {
    logRows.push(...buildRowsPerOperator(defaultJobsData, dateString, dateValue, getRoomNameByCodeOrId));
  }

  logRows.push(...buildRowsPerOperator(filteredJobs, dateString, dateValue, getRoomNameByCodeOrId));

  return { logRows, defaultJobsData };
};

export const buildReportDatePayload = (dateString: string, dateValue: string) => ({
  sheetName: "รายงาน-เวลาผู้ปฏิบัติงาน",
  "Date Value": dateValue,
  วันที่: dateString,
});


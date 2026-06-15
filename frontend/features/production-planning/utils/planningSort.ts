import type { ProductionItem } from "@/types/production";

const DEFAULT_JOB_CODES = ["A", "B", "C", "D"] as const;

type SortableById = {
  id?: string | number;
};

type SortableByDraftTimestamp = {
  created_at?: string;
  updated_at?: string;
};

type SortableByTimeAndOperator = {
  start_time?: string;
  operators?: string | string[];
};

const getFirstOperator = (operators: string | string[] | undefined): string => {
  if (Array.isArray(operators)) {
    return operators[0] ?? "";
  }

  if (typeof operators === "string") {
    return operators.split(", ")[0] ?? "";
  }

  return "";
};

export const sortByNumericId = <T extends SortableById>(jobs: T[]): T[] => {
  return [...jobs].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
};

export const compareByStartTimeAndFirstOperator = <T extends SortableByTimeAndOperator>(a: T, b: T): number => {
  const timeA = a.start_time || "00:00";
  const timeB = b.start_time || "00:00";
  const timeComparison = timeA.localeCompare(timeB);
  if (timeComparison !== 0) return timeComparison;

  // Keep legacy rule: operators that start with "อ" appear first.
  const opA = getFirstOperator(a.operators);
  const opB = getFirstOperator(b.operators);
  const indexA = opA.indexOf("อ");
  const indexB = opB.indexOf("อ");
  if (indexA === 0 && indexB !== 0) return -1;
  if (indexB === 0 && indexA !== 0) return 1;

  return opA.localeCompare(opB);
};

export const sortByStartTimeAndFirstOperator = <T extends SortableByTimeAndOperator>(jobs: T[]): T[] => {
  return [...jobs].sort(compareByStartTimeAndFirstOperator);
};

export const sortByDraftCreatedAt = <T extends SortableByDraftTimestamp>(jobs: T[]): T[] => {
  return [...jobs].sort((a, b) => {
    const createdAtA = new Date(a.created_at || a.updated_at || 0);
    const createdAtB = new Date(b.created_at || b.updated_at || 0);
    return createdAtA.getTime() - createdAtB.getTime();
  });
};

export const sortDefaultJobsByCode = <T extends Pick<ProductionItem, "job_code">>(
  jobs: T[],
  defaultCodes: readonly string[] = DEFAULT_JOB_CODES,
): T[] => {
  return [...jobs].sort((a, b) => defaultCodes.indexOf(a.job_code) - defaultCodes.indexOf(b.job_code));
};

export const buildSelectedDayProductionOrder = (
  jobs: ProductionItem[],
  isSpecial: (item: ProductionItem) => boolean,
  defaultCodes: readonly string[] = DEFAULT_JOB_CODES,
): ProductionItem[] => {
  const defaultDrafts = sortDefaultJobsByCode(
    jobs.filter((item) => defaultCodes.includes(item.job_code)),
    defaultCodes,
  );
  const normalJobs = sortByNumericId(
    jobs.filter((item) => !defaultCodes.includes(item.job_code) && !isSpecial(item)),
  );
  const specialJobs = sortByNumericId(
    jobs.filter((item) => !defaultCodes.includes(item.job_code) && isSpecial(item)),
  );

  return [...defaultDrafts, ...normalJobs, ...specialJobs];
};

export const buildDailyProductionDisplayOrder = (
  jobs: ProductionItem[],
  defaultCodes: readonly string[] = DEFAULT_JOB_CODES,
): ProductionItem[] => {
  const defaultDrafts = sortDefaultJobsByCode(
    jobs.filter((job) => defaultCodes.includes(job.job_code)),
    defaultCodes,
  );

  const normalJobs = jobs.filter((job) => !defaultCodes.includes(job.job_code) && job.is_special !== 1);
  const specialJobs = jobs.filter((job) => job.is_special === 1 && !defaultCodes.includes(job.job_code));

  const normalDrafts = sortByDraftCreatedAt(normalJobs.filter((job) => job.isDraft));
  const normalCompleted = sortByStartTimeAndFirstOperator(normalJobs.filter((job) => !job.isDraft));
  const specialDrafts = sortByDraftCreatedAt(specialJobs.filter((job) => job.isDraft));
  const specialCompleted = sortByStartTimeAndFirstOperator(specialJobs.filter((job) => !job.isDraft));

  return [...defaultDrafts, ...normalCompleted, ...normalDrafts, ...specialCompleted, ...specialDrafts];
};

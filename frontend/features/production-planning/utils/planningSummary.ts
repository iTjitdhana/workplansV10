import { TIMETABLE_CONSTANTS } from "@/components/timetable/constants";
import { getOperatorsArray } from "@/lib/utils";
import type { ProductionItem, User } from "@/types/production";
import { buildDailyProductionDisplayOrder } from "./planningSort";

type Interval = {
  start: Date;
  end: Date;
};

export type WorkerDetail = {
  name: string;
  hours: number;
  quota: number;
  remaining: number;
  status: "full" | "limited" | "available";
  displayHours: number;
  displayText: string;
};

export type DailySummaryResult = {
  totalWorkers: number;
  totalWorkHours: number;
  totalUsedTime: number;
  capacityPercentage: number;
  validJobsCount: number;
  uniqueWorkers: string[];
  lunchBreakDeduction: number;
  availableWorkers: string[];
  availableSupportStaff: string[];
  workerDetails: WorkerDetail[];
};

const DEFAULT_JOB_CODES = ["A", "B", "C", "D"] as const;
const SUPPORT_STAFF = ["RD", "พี่สัญญา"] as const;
const EXCLUDED_MAIN_AVAILABLE_WORKERS = ["Admin User", "จรัญ", "พี่สร", "พี่จริน"] as const;
const EPSILON = 0.001;

const mergeIntervals = (intervals: Interval[]): Interval[] => {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start.getTime() <= last.end.getTime()) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push(current);
    }
  }

  return merged;
};

const calculateActualHours = (intervals: Interval[]): number => {
  const lunchStart = new Date(`2000-01-01 ${TIMETABLE_CONSTANTS.LUNCH_BREAK.START}`);
  const lunchEnd = new Date(`2000-01-01 ${TIMETABLE_CONSTANTS.LUNCH_BREAK.END}`);
  let totalHours = 0;

  intervals.forEach((interval) => {
    let durationHours = (interval.end.getTime() - interval.start.getTime()) / (1000 * 60 * 60);

    if (interval.start < lunchEnd && interval.end > lunchStart) {
      const overlapStart = interval.start > lunchStart ? interval.start : lunchStart;
      const overlapEnd = interval.end < lunchEnd ? interval.end : lunchEnd;
      const overlapHours = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
      durationHours -= overlapHours;
    }

    totalHours += durationHours;
  });

  return totalHours;
};

const formatRemainingTime = (hours: number): string => {
  const roundedHours = Math.round(hours * 60) / 60;
  if (roundedHours <= EPSILON) return "0 ชั่วโมง";

  const totalMinutes = Math.round(roundedHours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours === 0) {
    return `ว่าง ${minutes} นาที`;
  }
  if (minutes === 0) {
    return `ว่าง ${wholeHours} ชั่วโมง`;
  }
  return `ว่าง ${wholeHours} ชั่วโมง ${minutes} นาที`;
};

export const getDisplayJobName = (item: ProductionItem, jobsOfDay: ProductionItem[]): string => {
  if (DEFAULT_JOB_CODES.includes(item.job_code as (typeof DEFAULT_JOB_CODES)[number])) {
    return item.job_code;
  }

  const sameDayJobs = jobsOfDay.filter(
    (job) => job.production_date === item.production_date && !DEFAULT_JOB_CODES.includes(job.job_code as (typeof DEFAULT_JOB_CODES)[number]),
  );
  const sortedJobs = buildDailyProductionDisplayOrder(sameDayJobs);
  const jobIndex = sortedJobs.findIndex((job) => job.id === item.id);

  return jobIndex >= 0 ? `งานที่ ${jobIndex + 1}` : `งานที่ ${item.id}`;
};

export const calculateDailySummary = (jobs: ProductionItem[], users: User[]): DailySummaryResult => {
  const validJobs = jobs.filter(
    (job) => Boolean(job.operators) && getOperatorsArray(job.operators).length > 0 && Boolean(job.start_time) && Boolean(job.end_time),
  );

  const allWorkers = new Set<string>();
  const workerTimeIntervals = new Map<string, Interval[]>();
  let totalUsedTime = 0;

  validJobs.forEach((job) => {
    const workers = getOperatorsArray(job.operators).filter(
      (worker) =>
        !EXCLUDED_MAIN_AVAILABLE_WORKERS.includes(
          worker as (typeof EXCLUDED_MAIN_AVAILABLE_WORKERS)[number],
        ),
    );
    workers.forEach((worker) => {
      allWorkers.add(worker);
      const startTime = new Date(`2000-01-01 ${job.start_time}`);
      const endTime = new Date(`2000-01-01 ${job.end_time}`);
      if (!workerTimeIntervals.has(worker)) {
        workerTimeIntervals.set(worker, []);
      }
      workerTimeIntervals.get(worker)?.push({ start: startTime, end: endTime });
    });
  });

  const workerHours = new Map<string, number>();
  workerTimeIntervals.forEach((intervals, worker) => {
    const actualHours = calculateActualHours(mergeIntervals(intervals));
    workerHours.set(worker, actualHours);
    totalUsedTime += actualHours;
  });

  const lunchStartTime = new Date(`2000-01-01 ${TIMETABLE_CONSTANTS.LUNCH_BREAK.START}`);
  const lunchEndTime = new Date(`2000-01-01 ${TIMETABLE_CONSTANTS.LUNCH_BREAK.END}`);
  const lunchBreakHours = (lunchEndTime.getTime() - lunchStartTime.getTime()) / (1000 * 60 * 60);
  const workHoursPerDay = 8 - lunchBreakHours;
  const totalWorkers = allWorkers.size;
  const totalWorkHours = totalWorkers * workHoursPerDay;
  const capacityPercentage = totalWorkHours > 0 ? (totalUsedTime / totalWorkHours) * 100 : 0;
  const maxQuota = 7.5;

  const workerDetails: WorkerDetail[] = Array.from(allWorkers)
    .map((worker) => {
      const hours = workerHours.get(worker) || 0;
      const quota = workHoursPerDay;
      const remaining = Math.max(0, quota - hours);
      let status: WorkerDetail["status"] = "available";
      let displayHours = hours;
      let displayText = formatRemainingTime(remaining);

      if (hours >= maxQuota || remaining <= EPSILON) {
        status = "full";
        displayHours = quota;
        displayText = "ได้รับงานเต็มเวลา";
      } else if (remaining <= 2) {
        status = "limited";
      }

      return { name: worker, hours, quota, remaining, status, displayHours, displayText };
    })
    .sort((a, b) => b.remaining - a.remaining);

  return {
    totalWorkers,
    totalWorkHours,
    totalUsedTime,
    capacityPercentage,
    validJobsCount: validJobs.length,
    uniqueWorkers: Array.from(allWorkers),
    lunchBreakDeduction: lunchBreakHours,
    availableWorkers: users
      .filter((user) => !allWorkers.has(user.name))
      .filter((user) => !SUPPORT_STAFF.includes(user.name as (typeof SUPPORT_STAFF)[number]))
      .filter(
        (user) =>
          !EXCLUDED_MAIN_AVAILABLE_WORKERS.includes(
            user.name as (typeof EXCLUDED_MAIN_AVAILABLE_WORKERS)[number],
          ),
      )
      .map((user) => user.name),
    availableSupportStaff: users
      .filter((user) => !allWorkers.has(user.name))
      .filter((user) => SUPPORT_STAFF.includes(user.name as (typeof SUPPORT_STAFF)[number]))
      .map((user) => user.name),
    workerDetails,
  };
};

export const formatDurationLabel = (seconds: number): string => {
  if (!seconds) return "ไม่ระบุ";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours} ชม. ${minutes} นาที`;
  }
  if (minutes > 0) {
    return `${minutes} นาที ${remainingSeconds} วินาที`;
  }
  return `${remainingSeconds} วินาที`;
};

export const formatLogTime = (timestamp: string): string => {
  if (!timestamp) return "ไม่ระบุ";
  return new Date(timestamp).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

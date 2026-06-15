import { createSafeDate } from "@/lib/dateUtils";

export const generateTimeOptions = (start = "08:00", end = "18:00", step = 15): string[] => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const result: string[] = [];
  let [h, m] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  while (h < endH || (h === endH && m <= endM)) {
    result.push(`${pad(h)}:${pad(m)}`);
    m += step;
    if (m >= 60) {
      h++;
      m -= 60;
    }
  }

  return result;
};

export const formatDateForGoogleSheet = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? createSafeDate(date) : date;
  if (!dateObj) {
    return "Invalid Date";
  }

  return dateObj.toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatDateForValue = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? createSafeDate(date) : date;
  if (!dateObj) {
    return "Invalid Date";
  }

  return dateObj.toLocaleDateString("th-TH");
};

export const normalizeJobName = (str: string): string => {
  return str.trim().toLowerCase().replace(/\s+/g, "");
};

export const isEndTimeAfterStartTime = (start: string, end: string): boolean => {
  if (!start || !end) return true;
  return end > start;
};

export const normalizeTimeForForm = (timeValue: string): string => {
  if (!timeValue) return "";
  const [h, m] = timeValue.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
};

export const generateTimeSlots = (start = "08:00", end = "17:00", step = 30): string[] => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const result: string[] = [];
  let [h, m] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  while (h < endH || (h === endH && m <= endM)) {
    const timeSlot = `${pad(h)}:${pad(m)}`;

    // Keep the same lunch-break behavior as current planning table.
    if (timeSlot === "12:30") {
      result.push("12:30-13:15");
      h = 13;
      m = 15;
      continue;
    }

    result.push(timeSlot);
    m += step;
    if (m >= 60) {
      h++;
      m -= 60;
    }
  }

  return result;
};

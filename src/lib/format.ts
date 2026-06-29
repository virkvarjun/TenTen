import type { WorkType } from "@/domain/types";

/** Format a fractional hour-of-day (e.g. 16.5) as "4:30pm". */
export function formatHour(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const minutes = Math.round((hour - Math.floor(hour)) * 60);
  const period = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return minutes === 0
    ? `${display}${period}`
    : `${display}:${minutes.toString().padStart(2, "0")}${period}`;
}

/** A compact range like "10–11am" or "1–2:30pm". */
export function formatHourRange(start: number, end: number): string {
  return `${formatHour(start)}–${formatHour(end)}`;
}

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  deep: "Deep work",
  shallow: "Shallow",
  admin: "Admin",
  health: "Health",
  social: "Social",
};

/** Human label for a goal/block type. */
export function workTypeLabel(type: WorkType): string {
  return WORK_TYPE_LABEL[type];
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

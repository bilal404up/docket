import { BAKERY } from "@/lib/seed/catalog";
import { addDays, cutoffFor, fmtDay, parseDateStr, toDateStr, weekday } from "@/lib/pipeline/dates";

/*
  The bakery clock. Every sandbox tells the same story: it is Wednesday evening,
  orders for Thursday closed at 8 pm, and the owner is checking them before the
  night bake. The clock starts at 9:15 pm on the story day and runs in real time
  from the moment the sandbox opens. All times are UTC, so there is no time zone
  to convert.
*/
export const STORY_START = "21:15";

export type ClockWorkspace = { story_date: string; created_at: string };

/** The most recent Wednesday on or before today, so the demo's dates always look current. */
export function latestWednesday(today = new Date()): string {
  let d = toDateStr(today);
  while (weekday(d) !== 3) d = addDays(d, -1);
  return d;
}

/** A time on the story day (or a day offset from it), e.g. storyAt("2026-10-14", "16:02"). */
export function storyAt(storyDate: string, hhmm: string, dayOffset = 0): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(parseDateStr(addDays(storyDate, dayOffset)).getTime() + (h * 60 + m) * 60_000);
}

export function storyNow(ws: ClockWorkspace, real: Date = new Date()): Date {
  const start = storyAt(ws.story_date, STORY_START).getTime();
  return new Date(start + Math.max(0, real.getTime() - Date.parse(ws.created_at)));
}

/** Converts a real timestamp, such as an event's created_at, to bakery time. */
export function toStory(ws: ClockWorkspace, realIso: string): Date {
  return storyNow(ws, new Date(realIso));
}

/** The delivery day being reviewed: tomorrow on the bakery clock, skipping Sunday. */
export function reviewDate(ws: ClockWorkspace): string {
  let d = addDays(toDateStr(storyNow(ws)), 1);
  while (weekday(d) === 0) d = addDays(d, 1);
  return d;
}

export function contextLine(ws: ClockWorkspace): string {
  const date = reviewDate(ws);
  const now = storyNow(ws);
  const cutoff = cutoffFor(date, BAKERY.cutoffHour);
  if (now.getTime() < cutoff.getTime()) {
    const mins = Math.round((cutoff.getTime() - now.getTime()) / 60_000);
    const h = Math.floor(mins / 60);
    return `Orders for ${fmtDay(date)} close at 8:00 pm, in ${h ? `${h}h ` : ""}${mins % 60}m.`;
  }
  return `Reviewing orders for ${fmtDay(date)}. Orders closed at 8:00 pm.`;
}

export function hoursLeft(expiresAt: string, real = new Date()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - real.getTime()) / 3_600_000));
}

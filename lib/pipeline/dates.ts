import { norm } from "./normalize";

/*
  Dates are plain YYYY-MM-DD strings. Times are UTC: the demo runs on its own "bakery clock",
  so there is no time zone to convert.
*/
const DAY_MS = 86_400_000;
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_WORDS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
export const parseDateStr = (s: string) => new Date(`${s}T00:00:00Z`);
export const addDays = (s: string, n: number) => toDateStr(new Date(parseDateStr(s).getTime() + n * DAY_MS));
export const weekday = (s: string) => parseDateStr(s).getUTCDay();
export const weekdayName = (s: string) => LONG[weekday(s)];
export const isDateStr = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Orders for a delivery day must arrive by 8 pm the evening before. */
export function cutoffFor(date: string, hour = 20): Date {
  return new Date(parseDateStr(addDays(date, -1)).getTime() + hour * 3_600_000);
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const longFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

/** "Fri 16 Oct" */
export const fmtDay = (s: string) => dayFormat.format(parseDateStr(s)).replace(",", "");
/** "13 Oct 2026" */
export const fmtLongDate = (s: string) => longFormat.format(parseDateStr(s.slice(0, 10)));
/** "6:45 pm" */
export const fmtTime = (d: Date) => timeFormat.format(d).replace(/[\u202f\u00a0]/g, " ").toLowerCase();

/** "Monday to Saturday" or "Tue, Thu and Sat" */
export function daysList(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join() === "1,2,3,4,5,6") return "Monday to Saturday";
  const names = sorted.map((d) => SHORT[d]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function shortWeekday(d: number) {
  return SHORT[d];
}

/** Reads a delivery phrase relative to when the order arrived. */
export function parseDelivery(text: string | null, receivedAt: Date): { date: string | null; how: string } {
  if (!text || !text.trim()) return { date: null, how: "" };
  const t = norm(text);
  const received = toDateStr(receivedAt);
  let date: string | null = null;

  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  } else if (/\btoday\b/.test(t)) {
    date = received;
  } else if (/\btomorrow\b/.test(t)) {
    date = addDays(received, 1);
  } else {
    const day = t.split(" ").map((w) => WEEKDAY_WORDS[w]).find((v) => v !== undefined);
    if (day !== undefined) {
      let d = addDays(received, 1);
      while (weekday(d) !== day) d = addDays(d, 1);
      date = d;
    } else {
      const m = t.match(/\b(\d{1,2}) ([a-z]{3})[a-z]*\b/);
      if (m && MONTHS[m[2]] !== undefined) {
        const year = receivedAt.getUTCFullYear();
        let d = toDateStr(new Date(Date.UTC(year, MONTHS[m[2]], Number(m[1]))));
        if (parseDateStr(d).getTime() < receivedAt.getTime() - 180 * DAY_MS) {
          d = toDateStr(new Date(Date.UTC(year + 1, MONTHS[m[2]], Number(m[1]))));
        }
        date = d;
      }
    }
  }
  return { date, how: date ? `"${text.trim()}" → ${fmtDay(date)}` : "" };
}

/** The earliest delivery day this café is served on whose cutoff hasn't passed. */
export function nextServed(days: number[], from: Date, hour = 20): string | null {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(toDateStr(from), i);
    if (days.includes(weekday(d)) && from.getTime() < cutoffFor(d, hour).getTime()) return d;
  }
  return null;
}

/** The first served day after a given date. */
export function nextServedAfter(days: number[], date: string): string | null {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(date, i);
    if (days.includes(weekday(d))) return d;
  }
  return null;
}

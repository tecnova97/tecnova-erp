import { format, parse, isValid } from "date-fns";
import { de } from "date-fns/locale";

/**
 * Single source of truth for all date/time formatting in TecNova ERP.
 *
 * Locale is ALWAYS German (de-DE), dates are ALWAYS dd.MM.yyyy and times are
 * ALWAYS 24-hour HH:mm. Never rely on the browser/OS locale (native
 * <input type="date/time"> controls do — which is why they showed Arabic
 * month/weekday names and AM/PM). Use these helpers and the shared
 * <DatePicker> / <DateTimePicker> components instead.
 */

export const DATE_LOCALE = de;
export const LOCALE_TAG = "de-DE";

/** Machine value formats used across the app (match the old native inputs). */
export const DATE_VALUE_FMT = "yyyy-MM-dd";
export const DATETIME_VALUE_FMT = "yyyy-MM-dd'T'HH:mm";

/** Human-facing display formats. */
export const DATE_DISPLAY_FMT = "dd.MM.yyyy";
export const TIME_DISPLAY_FMT = "HH:mm";
export const DATETIME_DISPLAY_FMT = "dd.MM.yyyy HH:mm";

const opts = { locale: DATE_LOCALE } as const;

/** German month labels (index 0 = Januar). */
export const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** German weekday short labels, Monday first. */
export const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Parse any Date-like input into a valid Date or null. */
export function toDate(value?: Date | string | number | null): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? d : null;
}

/** Format a date as dd.MM.yyyy (German). */
export function formatDate(value?: Date | string | number | null): string {
  const d = toDate(value);
  return d ? format(d, DATE_DISPLAY_FMT, opts) : "";
}

/** Format a time as HH:mm (24-hour). */
export function formatTime(value?: Date | string | number | null): string {
  const d = toDate(value);
  return d ? format(d, TIME_DISPLAY_FMT, opts) : "";
}

/** Format a date + time as dd.MM.yyyy HH:mm (German, 24-hour). */
export function formatDateTime(value?: Date | string | number | null): string {
  const d = toDate(value);
  return d ? format(d, DATETIME_DISPLAY_FMT, opts) : "";
}

/** Generic German formatter with a custom date-fns pattern. */
export function formatDe(value: Date | string | number | null | undefined, pattern: string): string {
  const d = toDate(value);
  return d ? format(d, pattern, opts) : "";
}

/** Convert a Date to the machine date value (yyyy-MM-dd). */
export function toDateValue(d?: Date | null): string {
  return d ? format(d, DATE_VALUE_FMT) : "";
}

/** Convert a Date to the machine datetime value (yyyy-MM-ddTHH:mm). */
export function toDateTimeValue(d?: Date | null): string {
  return d ? format(d, DATETIME_VALUE_FMT) : "";
}

/** Parse a machine date value (yyyy-MM-dd) into a Date or null. */
export function fromDateValue(value?: string | null): Date | null {
  if (!value) return null;
  const d = parse(value, DATE_VALUE_FMT, new Date());
  return isValid(d) ? d : toDate(value);
}

/** Parse a machine datetime value (yyyy-MM-ddTHH:mm[:ss]) into a Date or null. */
export function fromDateTimeValue(value?: string | null): Date | null {
  if (!value) return null;
  const short = parse(value.slice(0, 16), DATETIME_VALUE_FMT, new Date());
  return isValid(short) ? short : toDate(value);
}

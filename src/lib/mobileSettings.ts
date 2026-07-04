import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { appSettingsQuery } from "@/lib/settings";

// ---------------------------------------------------------------------------
// Mobile Worker settings (owner managed, global). Stored in app_settings under
// the "mobile_worker" key so new options can be added without a migration.
// ---------------------------------------------------------------------------
export interface MobileWorkerSettings {
  /** How many future days (beyond today) workers may browse. 0 = only today. */
  future_days: number;
  /** Convenience switch: when off, workers only see "Heute". */
  allow_tomorrow: boolean;
  /** Show a tab/section for completed jobs. */
  allow_completed: boolean;
  allow_upload_photos: boolean;
  allow_upload_documents: boolean;
  require_photos: boolean;
  require_documents: boolean;
  require_note: boolean;
  /** Landing route for workers after login. */
  default_landing: string;
  show_worker_count: boolean;
  show_status_badges: boolean;
}

export const MOBILE_WORKER_DEFAULT: MobileWorkerSettings = {
  future_days: 2,
  allow_tomorrow: true,
  allow_completed: false,
  allow_upload_photos: true,
  allow_upload_documents: true,
  require_photos: false,
  require_documents: false,
  require_note: false,
  default_landing: "/meine-arbeit",
  show_worker_count: true,
  show_status_badges: true,
};

export const mobileWorkerSettingsQuery = () =>
  appSettingsQuery<MobileWorkerSettings>("mobile_worker", MOBILE_WORKER_DEFAULT);

/** Merged settings (persisted values on top of defaults so new keys are safe). */
export function useMobileWorkerSettings(): MobileWorkerSettings {
  const { data } = useQuery(mobileWorkerSettingsQuery());
  return { ...MOBILE_WORKER_DEFAULT, ...(data ?? {}) };
}

export interface DayOption {
  key: string;
  label: string;
  date: Date;
}

/** Human labels for the first days; further days fall back to a weekday date. */
function dayLabel(offset: number, date: Date): string {
  if (offset === 0) return "Heute";
  if (offset === 1) return "Morgen";
  if (offset === 2) return "Übermorgen";
  return format(date, "EEE, dd.MM.", { locale: de });
}

/** Build the selectable day tabs based on the owner's configuration. */
export function buildDayOptions(settings: MobileWorkerSettings): DayOption[] {
  const maxFuture = settings.allow_tomorrow ? Math.max(0, settings.future_days) : 0;
  const today = startOfDay(new Date());
  const days: DayOption[] = [];
  for (let i = 0; i <= maxFuture; i++) {
    const date = addDays(today, i);
    days.push({ key: `d${i}`, label: dayLabel(i, date), date });
  }
  return days;
}

/** True when the order's appointment falls on the given day. */
export function isOnDay(terminStart: string | null | undefined, day: Date): boolean {
  if (!terminStart) return false;
  try {
    return isSameDay(parseISO(terminStart), day);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Online status — foundation for a future offline queue. For now it only drives
// the "Keine Internetverbindung" banner and disables saving while offline.
// ---------------------------------------------------------------------------
export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export const OFFLINE_MESSAGE =
  "Keine Internetverbindung. Änderungen können derzeit nicht gespeichert werden.";

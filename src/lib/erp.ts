import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from "date-fns";
import { de } from "date-fns/locale";

export type AuftragStatus =
  | "neu"
  | "geplant"
  | "zugewiesen"
  | "in_arbeit"
  | "warten"
  | "abgeschlossen"
  | "storniert";

export type ProjektStatus = "aktiv" | "pausiert" | "abgeschlossen" | "archiviert";

export const STATUS_CONFIG: Record<AuftragStatus, { label: string; cls: string }> = {
  neu: { label: "Neu", cls: "st-neu" },
  geplant: { label: "Geplant", cls: "st-geplant" },
  zugewiesen: { label: "Zugewiesen", cls: "st-zugewiesen" },
  in_arbeit: { label: "In Arbeit", cls: "st-in_arbeit" },
  warten: { label: "Warten", cls: "st-warten" },
  abgeschlossen: { label: "Abgeschlossen", cls: "st-abgeschlossen" },
  storniert: { label: "Storniert", cls: "st-storniert" },
};

export const STATUS_ORDER: AuftragStatus[] = [
  "neu",
  "geplant",
  "zugewiesen",
  "in_arbeit",
  "warten",
  "abgeschlossen",
  "storniert",
];

export interface AddressLike {
  strasse?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
}

/** "Straße Hausnummer" (single line). */
export function fmtStrasse(a: AddressLike): string {
  return [a.strasse, a.hausnummer].filter(Boolean).join(" ").trim();
}

/** "PLZ Ort" (single line). */
export function fmtOrt(a: AddressLike): string {
  return [a.plz, a.ort].filter(Boolean).join(" ").trim();
}

/** One-line address "Straße Hausnummer, PLZ Ort". */
export function fmtAdresse(a: AddressLike): string {
  return [fmtStrasse(a), fmtOrt(a)].filter(Boolean).join(", ");
}

export const PROJEKT_STATUS_CONFIG: Record<ProjektStatus, { label: string; cls: string }> = {
  aktiv: { label: "Aktiv", cls: "st-abgeschlossen" },
  pausiert: { label: "Pausiert", cls: "st-warten" },
  abgeschlossen: { label: "Abgeschlossen", cls: "st-geplant" },
  archiviert: { label: "Archiviert", cls: "st-neu" },
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return typeof value === "string" ? parseISO(value) : value;
}

export function fmtDate(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? format(d, "dd.MM.yyyy", { locale: de }) : "–";
}

export function fmtDateTime(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? format(d, "dd.MM.yyyy, HH:mm", { locale: de }) : "–";
}

export function fmtTime(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? format(d, "HH:mm", { locale: de }) : "–";
}

export function fmtDay(value: string | Date | null | undefined) {
  const d = toDate(value);
  if (!d) return "–";
  if (isToday(d)) return "Heute";
  if (isTomorrow(d)) return "Morgen";
  return format(d, "EEE, dd. MMM", { locale: de });
}

export function fmtRelative(value: string | Date | null | undefined) {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true, locale: de }) : "–";
}

export function initials(vorname?: string | null, nachname?: string | null) {
  return `${(vorname ?? "").charAt(0)}${(nachname ?? "").charAt(0)}`.toUpperCase() || "?";
}

const EURO = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export function fmtEuro(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "–";
  return EURO.format(value);
}

const NUM = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
export function fmtNum(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "–";
  return NUM.format(value);
}

export function fmtBytes(bytes?: number | null) {
  if (!bytes) return "–";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

import { useQuery } from "@tanstack/react-query";
import { statusDefinitionenQuery, type StatusDef } from "@/lib/queries";

/** Fallback used while statuses load or for unknown keys. */
export const FALLBACK_STATUS: StatusDef = {
  id: "fallback",
  key: "unbekannt",
  label: "Unbekannt",
  farbe: "#64748b",
  reihenfolge: 999,
  aktiv: true,
  ist_abschluss: false,
  ist_bezahlt: false,
  sichtbar_dashboard: true,
  sichtbar_worker: true,
  worker_waehlbar: true,
  sperrt_bearbeitung: false,
  ausschluss_kontakte_ohne_termin: false,
};

export function useStatuses() {
  const { data = [], isLoading } = useQuery(statusDefinitionenQuery());
  const map = new Map<string, StatusDef>();
  for (const s of data) map.set(s.key, s);
  const get = (key: string): StatusDef =>
    map.get(key) ?? { ...FALLBACK_STATUS, key, label: key };
  const active = [...data].filter((s) => s.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge);
  return { list: data, active, map, get, isLoading };
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "64748b", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Inline style for a status pill given its hex color. */
export function statusStyle(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return {
    color: hex,
    backgroundColor: `rgba(${r},${g},${b},0.13)`,
  } as const;
}

/** Solid background style (used for calendar chips / dots). */
export function statusSolid(hex: string) {
  return { backgroundColor: hex, color: "#fff" } as const;
}

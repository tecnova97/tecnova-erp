import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BERECHNUNGSARTEN } from "@/lib/settings";

export interface AuftragLeistung {
  id: string;
  auftrag_id: string;
  leistung_id: string | null;
  code: string;
  name: string;
  berechnungsart: string;
  einheit: string;
  menge: number;
  mitarbeiter_anzahl: number;
  sort_order: number;
  notiz?: string | null;
}

export const auftragLeistungenQuery = (auftragId: string) =>
  queryOptions({
    queryKey: ["auftrag_leistungen", auftragId],
    queryFn: async (): Promise<AuftragLeistung[]> => {
      const { data, error } = await supabase
        .from("auftrag_leistungen")
        .select("*")
        .eq("auftrag_id", auftragId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AuftragLeistung[];
    },
  });

/** Prices per Auftrag-Leistung. Only readable by finance-permitted users (RLS). */
export const auftragLeistungPreiseQuery = (auftragId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["auftrag_leistung_preise", auftragId],
    enabled,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("auftrag_leistung_preise")
        .select("auftrag_leistung_id,preis");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { auftrag_leistung_id: string; preis: number }[]) {
        map[r.auftrag_leistung_id] = Number(r.preis);
      }
      return map;
    },
  });

/** Number of "Einheiten" that get multiplied by the price. */
export function lineFactor(l: Pick<AuftragLeistung, "berechnungsart" | "menge" | "mitarbeiter_anzahl">) {
  if (l.berechnungsart === "stunde_mitarbeiter") return l.menge * (l.mitarbeiter_anzahl || 1);
  return l.menge;
}

/** Line total = factor × price. */
export function lineTotal(l: AuftragLeistung, preis: number | undefined) {
  if (preis == null) return null;
  return lineFactor(l) * preis;
}

export function berechnungLabel(key: string) {
  return BERECHNUNGSARTEN.find((b) => b.key === key)?.label ?? key;
}

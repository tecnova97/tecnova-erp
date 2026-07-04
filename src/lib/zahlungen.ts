import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Zahlungsereignisse – permanent paid billing events.
// A single Auftrag can accumulate unlimited paid events over its lifetime.
// Each event is created automatically by the database whenever a status
// flagged "Erzeugt Zahlungsereignis" (status_definitionen.ist_bezahlt) is
// assigned. Events are never overwritten or deleted (Owner delete aside).
// ---------------------------------------------------------------------------

/** A price-free service position snapshot stored on the event. */
export interface ZahlungPositionFrei {
  code: string;
  name: string;
  berechnungsart: string;
  einheit: string;
  menge: number;
  mitarbeiter_anzahl: number;
}

/** A priced service position snapshot (finance-gated). */
export interface ZahlungPosition {
  code: string;
  name: string;
  einheit: string;
  menge: number;
  faktor: number;
  preis: number;
  total: number;
}

export interface Zahlungsereignis {
  id: string;
  auftrag_id: string;
  status_key: string;
  status_label: string;
  status_farbe: string;
  datum: string;
  created_by: string | null;
  leistungen: ZahlungPositionFrei[];
  notiz: string | null;
  storniert: boolean;
  storniert_am: string | null;
  created_at: string;
  nummer: number | null;
}

export interface ZahlungUmsatz {
  ereignis_id: string;
  umsatz: number;
  positionen: ZahlungPosition[];
}

/** Active (non-voided) paid events across all orders (for "Bezahlte Aufträge"). */
export const zahlungsereignisseQuery = () =>
  queryOptions({
    queryKey: ["zahlungsereignisse"],
    queryFn: async (): Promise<Zahlungsereignis[]> => {
      const { data, error } = await supabase
        .from("auftrag_zahlungsereignisse")
        .select("id,nummer,auftrag_id,status_key,status_label,status_farbe,datum,created_by,leistungen,notiz,storniert,storniert_am,created_at")
        .eq("storniert", false)
        .order("datum", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Zahlungsereignis[];
    },
  });

/** All events for a single Auftrag (incl. voided – shown in history). */
export const zahlungsereignisseForAuftragQuery = (auftragId: string) =>
  queryOptions({
    queryKey: ["zahlungsereignisse", auftragId],
    queryFn: async (): Promise<Zahlungsereignis[]> => {
      const { data, error } = await supabase
        .from("auftrag_zahlungsereignisse")
        .select("id,nummer,auftrag_id,status_key,status_label,status_farbe,datum,created_by,leistungen,notiz,storniert,storniert_am,created_at")
        .eq("auftrag_id", auftragId)
        .order("datum", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Zahlungsereignis[];
    },
  });

/**
 * Per-event revenue map keyed by ereignis_id. The RPC returns rows only when
 * the caller has a finance permission, so an empty map = no access.
 */
export const zahlungUmsatzMapQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["zahlung_umsatz_map"],
    enabled,
    queryFn: async (): Promise<Record<string, ZahlungUmsatz>> => {
      const { data, error } = await supabase.rpc("zahlungsereignis_umsatz_map" as never);
      if (error) throw error;
      const map: Record<string, ZahlungUmsatz> = {};
      for (const r of (data ?? []) as unknown as ZahlungUmsatz[]) {
        map[r.ereignis_id] = {
          ereignis_id: r.ereignis_id,
          umsatz: Number(r.umsatz),
          positionen: (r.positionen ?? []) as ZahlungPosition[],
        };
      }
      return map;
    },
  });

/** Update a single event's note (Owner / finanzen.manage). */
export async function updateZahlungNotiz(id: string, notiz: string) {
  const { error } = await supabase
    .from("auftrag_zahlungsereignisse")
    .update({ notiz } as never)
    .eq("id", id);
  if (error) throw error;
}

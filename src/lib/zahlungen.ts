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

/** Payment type of a Zahlungsereignis – independent of the workflow status. */
export type PaymentType =
  | "abbruch_bezahlt"
  | "teilweise_bezahlt"
  | "erledigt_bezahlt"
  | "sonstige_zahlung";

export const PAYMENT_TYPES: { value: PaymentType; label: string; farbe: string }[] = [
  { value: "abbruch_bezahlt", label: "Abbruch bezahlt", farbe: "#f59e0b" },
  { value: "teilweise_bezahlt", label: "Teilweise bezahlt", farbe: "#3b82f6" },
  { value: "erledigt_bezahlt", label: "Erledigt bezahlt", farbe: "#16a34a" },
  { value: "sonstige_zahlung", label: "Sonstige Zahlung", farbe: "#64748b" },
];

export const paymentTypeLabel = (v: string | null | undefined) =>
  PAYMENT_TYPES.find((t) => t.value === v)?.label ?? "Zahlung";

export const paymentTypeFarbe = (v: string | null | undefined) =>
  PAYMENT_TYPES.find((t) => t.value === v)?.farbe ?? "#64748b";

export interface Zahlungsereignis {
  id: string;
  auftrag_id: string;
  status_key: string;
  status_label: string;
  status_farbe: string;
  payment_type: PaymentType;
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
        .select("id,nummer,auftrag_id,status_key,status_label,status_farbe,payment_type,datum,created_by,leistungen,notiz,storniert,storniert_am,created_at")
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
        .select("id,nummer,auftrag_id,status_key,status_label,status_farbe,payment_type,datum,created_by,leistungen,notiz,storniert,storniert_am,created_at")
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

/** Optional service position referenced by a manual payment event. */
export interface ZahlungLeistungRef {
  code: string;
  name: string;
  berechnungsart: string;
  einheit: string;
  menge: number;
  mitarbeiter_anzahl: number;
}

export interface CreateZahlungInput {
  auftragId: string;
  paymentType: PaymentType;
  betrag: number;
  datum: string; // ISO timestamp
  notiz?: string | null;
  /** Priced snapshot (finance) – stored in the finance-gated umsatz table. */
  positionen?: ZahlungPosition[];
  /** Price-free snapshot stored on the event itself. */
  leistungen?: ZahlungLeistungRef[];
}

/**
 * Record a single, independent payment event with a MANUALLY entered amount.
 * The workflow status is never touched. Only finance users / owners may call
 * this (enforced by the SECURITY DEFINER RPC).
 */
export async function createZahlung(input: CreateZahlungInput) {
  const { error } = await supabase.rpc("create_zahlung" as never, {
    _auftrag_id: input.auftragId,
    _payment_type: input.paymentType,
    _betrag: input.betrag,
    _datum: input.datum,
    _notiz: input.notiz ?? null,
    _positionen: (input.positionen ?? []) as never,
    _leistungen: (input.leistungen ?? []) as never,
  } as never);
  if (error) throw error;
}

/** Cancel (storno) a single payment event without affecting any other event. */
export async function stornoZahlung(ereignisId: string) {
  const { error } = await supabase.rpc("storno_zahlung" as never, {
    _ereignis_id: ereignisId,
  } as never);
  if (error) throw error;
}

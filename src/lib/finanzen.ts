import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Finanzen – Betriebsausgaben & Gewinn. Der Gewinn wird ausschließlich aus
// aktiven (nicht stornierten) Zahlungsereignissen abzüglich Ausgaben gebildet.
// ---------------------------------------------------------------------------

export const AUSGABEN_KATEGORIEN = [
  { value: "diesel", label: "Diesel" },
  { value: "werkzeug", label: "Werkzeug" },
  { value: "material", label: "Material" },
  { value: "fahrzeug", label: "Fahrzeug" },
  { value: "handy", label: "Handy" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export const ausgabeKategorieLabel = (v: string | null) =>
  AUSGABEN_KATEGORIEN.find((k) => k.value === v)?.label ?? (v || "–");

export interface Betriebsausgabe {
  id: string;
  bezeichnung: string;
  kategorie: string | null;
  betrag: number;
  mwst_satz: number;
  datum: string;
  notiz: string | null;
  beleg_url: string | null;
  auftrag_id: string | null;
  projekt_id: string | null;
  mitarbeiter_id: string | null;
  auftraggeber_id: string | null;
  created_by: string | null;
  created_at: string;
}

export const betriebsausgabenQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["betriebsausgaben"],
    enabled,
    queryFn: async (): Promise<Betriebsausgabe[]> => {
      const { data, error } = await supabase
        .from("betriebsausgaben")
        .select(
          "id,bezeichnung,kategorie,betrag,mwst_satz,datum,notiz,beleg_url,auftrag_id,projekt_id,mitarbeiter_id,auftraggeber_id,created_by,created_at",
        )
        .order("datum", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Betriebsausgabe[];
    },
  });

export type AusgabeInput = Partial<
  Omit<Betriebsausgabe, "id" | "created_at" | "created_by">
>;

export async function createAusgabe(input: AusgabeInput) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("betriebsausgaben")
    .insert({ ...input, created_by: u.user?.id } as never);
  if (error) throw error;
}

export async function updateAusgabe(id: string, input: AusgabeInput) {
  const { error } = await supabase
    .from("betriebsausgaben")
    .update(input as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAusgabe(id: string) {
  const { error } = await supabase.from("betriebsausgaben").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadBeleg(file: File): Promise<string> {
  const path = `belege/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("dokumente").upload(path, file);
  if (error) throw error;
  return path;
}

export interface GewinnRow {
  auftrag_id: string;
  umsatz: number;
  ausgaben: number;
  gewinn: number;
}

/** Per-Auftrag profit map (RPC returns rows only with finance permission). */
export const gewinnMapQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["auftrag_gewinn_map"],
    enabled,
    queryFn: async (): Promise<Record<string, GewinnRow>> => {
      const { data, error } = await supabase.rpc("auftrag_gewinn_map" as never);
      if (error) throw error;
      const map: Record<string, GewinnRow> = {};
      for (const r of (data ?? []) as unknown as GewinnRow[]) {
        map[r.auftrag_id] = {
          auftrag_id: r.auftrag_id,
          umsatz: Number(r.umsatz),
          ausgaben: Number(r.ausgaben),
          gewinn: Number(r.gewinn),
        };
      }
      return map;
    },
  });

/**
 * Estimated open revenue per Auftrag: priced service positions of orders that
 * are NOT yet paid (no active payment event). Prices are RLS-gated, so without
 * finance permission this returns zeros.
 */
export const offeneWerteQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["offene_auftragswerte"],
    enabled,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("auftrag_leistungen")
        .select(
          "auftrag_id,berechnungsart,menge,mitarbeiter_anzahl, preise:auftrag_leistung_preise(preis), auftrag:auftraege(bezahlt)",
        );
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as unknown as {
        auftrag_id: string;
        berechnungsart: string;
        menge: number;
        mitarbeiter_anzahl: number;
        preise: { preis: number } | { preis: number }[] | null;
        auftrag: { bezahlt: boolean } | null;
      }[]) {
        if (r.auftrag?.bezahlt) continue;
        const preisRow = Array.isArray(r.preise) ? r.preise[0] : r.preise;
        const preis = Number(preisRow?.preis ?? 0);
        const faktor =
          r.berechnungsart === "stunde_mitarbeiter"
            ? Number(r.menge) * Number(r.mitarbeiter_anzahl ?? 1)
            : Number(r.menge);
        map[r.auftrag_id] = (map[r.auftrag_id] ?? 0) + faktor * preis;
      }
      return map;
    },
  });

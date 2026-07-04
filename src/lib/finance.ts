import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Expenses (Ausgaben) foundation – categories, order expenses, overhead.
// ---------------------------------------------------------------------------
export interface AusgabenKategorie {
  id: string;
  name: string;
  farbe: string;
  aktiv: boolean;
  sort_order: number;
}

export interface AuftragAusgabe {
  id: string;
  auftrag_id: string;
  kategorie_id: string | null;
  bezeichnung: string;
  betrag: number;
  datum: string;
  notiz: string | null;
  created_at: string;
}

export interface Betriebsausgabe {
  id: string;
  kategorie_id: string | null;
  bezeichnung: string;
  betrag: number;
  datum: string;
  wiederkehrend: boolean;
  notiz: string | null;
  created_at: string;
}

export const ausgabenKategorienQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["ausgaben_kategorien"],
    enabled,
    queryFn: async (): Promise<AusgabenKategorie[]> => {
      const { data, error } = await supabase
        .from("ausgaben_kategorien")
        .select("id,name,farbe,aktiv,sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AusgabenKategorie[];
    },
  });

export const auftragAusgabenQuery = (auftragId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["auftrag_ausgaben", auftragId],
    enabled,
    queryFn: async (): Promise<AuftragAusgabe[]> => {
      const { data, error } = await supabase
        .from("auftrag_ausgaben")
        .select("id,auftrag_id,kategorie_id,bezeichnung,betrag,datum,notiz,created_at")
        .eq("auftrag_id", auftragId)
        .order("datum", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, betrag: Number(r.betrag) })) as AuftragAusgabe[];
    },
  });

export const betriebsausgabenQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["betriebsausgaben"],
    enabled,
    queryFn: async (): Promise<Betriebsausgabe[]> => {
      const { data, error } = await supabase
        .from("betriebsausgaben")
        .select("id,kategorie_id,bezeichnung,betrag,datum,wiederkehrend,notiz,created_at")
        .order("datum", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, betrag: Number(r.betrag) })) as Betriebsausgabe[];
    },
  });

/** Profit map (revenue − expenses) per Auftrag. Empty when the viewer lacks finance rights. */
export const auftragGewinnMapQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["auftrag_gewinn_map"],
    enabled,
    queryFn: async (): Promise<Record<string, { umsatz: number; ausgaben: number; gewinn: number }>> => {
      const { data, error } = await supabase.rpc("auftrag_gewinn_map" as never);
      if (error) throw error;
      const map: Record<string, { umsatz: number; ausgaben: number; gewinn: number }> = {};
      for (const r of (data ?? []) as unknown as {
        auftrag_id: string;
        umsatz: number;
        ausgaben: number;
        gewinn: number;
      }[]) {
        map[r.auftrag_id] = {
          umsatz: Number(r.umsatz),
          ausgaben: Number(r.ausgaben),
          gewinn: Number(r.gewinn),
        };
      }
      return map;
    },
  });

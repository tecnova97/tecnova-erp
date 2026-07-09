import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AUFTRAG_SELECT =
  "*, kunde:kunden(id,name,telefon), projekt:projekte(id,name), zuweisungen:auftrag_mitarbeiter(mitarbeiter:mitarbeiter(id,vorname,nachname,farbe,telefon)), status_zuweisungen:auftrag_status_zuweisungen(id,status_key,sichtbar,sort_order,is_primary)";

export interface MitarbeiterRef {
  id: string;
  vorname: string;
  nachname: string;
  farbe: string;
  telefon: string | null;
}

export interface StatusDef {
  id: string;
  key: string;
  label: string;
  farbe: string;
  reihenfolge: number;
  aktiv: boolean;
  ist_abschluss: boolean;
  ist_bezahlt: boolean;
  sichtbar_dashboard: boolean;
  sichtbar_worker: boolean;
  worker_waehlbar: boolean;
  sperrt_bearbeitung: boolean;
  ausschluss_kontakte_ohne_termin: boolean;
}

export interface AuftragRow {
  id: string;
  auftragsnummer: string;
  externe_auftragsnummer?: string | null;
  titel: string;
  beschreibung: string | null;
  status: string;
  kunde_id: string | null;
  projekt_id: string | null;
  kunde_name: string | null;
  ansprechpartner?: string | null;
  kunde_telefon: string | null;
  kunde_festnetz: string | null;
  kunde_email: string | null;
  wichtiginfo: string | null;
  esass_nr?: string | null;
  ag_bestell_nr?: string | null;
  ag_leb_nr?: string | null;
  sm_nr?: string | null;
  kostenstelle?: string | null;
  projektleiter?: string | null;
  projektnummer?: string | null;
  leistungsort?: string | null;
  nvt?: string | null;
  onkz?: string | null;
  asb?: string | null;
  kls_id?: string | null;
  team?: string | null;
  disponent?: string | null;
  custom_felder?: Record<string, string> | null;
  import_batch_id?: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  termin_start: string | null;
  termin_ende: string | null;
  interne_notizen: string | null;
  abschluss_notizen: string | null;
  abgeschlossen_am: string | null;
  bezahlt: boolean;
  bezahlt_am: string | null;
  created_at: string;
  kunde: { id: string; name: string; telefon: string | null } | null;
  projekt: { id: string; name: string } | null;
  zuweisungen: { mitarbeiter: MitarbeiterRef | null }[];
  status_zuweisungen?: {
    id: string;
    status_key: string;
    sichtbar: boolean;
    sort_order: number;
    is_primary: boolean;
  }[];
}

export interface HistorieRow {
  id: string;
  auftrag_id: string;
  aktion: string;
  details: string | null;
  typ: string;
  sichtbar: boolean;
  user_id: string | null;
  created_at: string;
}

export const statusDefinitionenQuery = () =>
  queryOptions({
    queryKey: ["status_definitionen"],
    queryFn: async (): Promise<StatusDef[]> => {
      const { data, error } = await supabase
        .from("status_definitionen")
        .select("*")
        .order("reihenfolge", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StatusDef[];
    },
    staleTime: 1000 * 60 * 5,
  });

export const auftraegeQuery = () =>
  queryOptions({
    queryKey: ["auftraege"],
    queryFn: async (): Promise<AuftragRow[]> => {
      const { data, error } = await supabase
        .from("auftraege")
        .select(AUFTRAG_SELECT)
        .order("termin_start", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as AuftragRow[];
    },
  });

/**
 * Revenue (Umsatz) per Auftrag keyed by auftrag_id. The RPC returns rows only
 * when the caller has a finance permission, so an empty map = no access.
 */
export const auftragUmsatzMapQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["auftrag_umsatz_map"],
    enabled,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc("auftrag_umsatz_map" as never);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of ((data ?? []) as unknown as { auftrag_id: string; umsatz: number }[])) {
        map[r.auftrag_id] = Number(r.umsatz);
      }
      return map;
    },
  });

export const auftragQuery = (id: string) =>
  queryOptions({
    queryKey: ["auftrag", id],
    queryFn: async (): Promise<AuftragRow> => {
      const { data, error } = await supabase
        .from("auftraege")
        .select(AUFTRAG_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as AuftragRow;
    },
  });

export const kundenQuery = () =>
  queryOptions({
    queryKey: ["kunden"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kunden").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const projekteQuery = () =>
  queryOptions({
    queryKey: ["projekte"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projekte")
        .select("*, kunde:kunden(id,name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const mitarbeiterQuery = () =>
  queryOptions({
    queryKey: ["mitarbeiter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mitarbeiter")
        .select("*")
        .order("nachname");
      if (error) throw error;
      return data ?? [];
    },
  });

export const dokumenteQuery = () =>
  queryOptions({
    queryKey: ["dokumente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dokumente")
        .select("*, auftrag:auftraege(id,auftragsnummer,titel)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const fotosQuery = () =>
  queryOptions({
    queryKey: ["fotos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fotos")
        .select("*, auftrag:auftraege(id,auftragsnummer,titel)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const fotosForAuftragQuery = (auftragId: string) =>
  queryOptions({
    queryKey: ["fotos", auftragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fotos")
        .select("*")
        .eq("auftrag_id", auftragId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const dokumenteForAuftragQuery = (auftragId: string) =>
  queryOptions({
    queryKey: ["dokumente", auftragId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dokumente")
        .select("*")
        .eq("auftrag_id", auftragId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const historieQuery = (auftragId: string) =>
  queryOptions({
    queryKey: ["historie", auftragId],
    queryFn: async (): Promise<HistorieRow[]> => {
      const { data, error } = await supabase
        .from("auftrag_historie")
        .select("*")
        .eq("auftrag_id", auftragId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistorieRow[];
    },
  });

export const historieRecentQuery = () =>
  queryOptions({
    queryKey: ["historie-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auftrag_historie")
        .select("*, auftrag:auftraege(id,auftragsnummer,titel)")
        .eq("sichtbar", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        aktion: string;
        details: string | null;
        typ: string;
        user_id: string | null;
        created_at: string;
        auftrag: { id: string; auftragsnummer: string; titel: string } | null;
      }[];
    },
  });

export async function createSignedUrl(bucket: string, path: string) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Profile name lookup for history "who did it" rendering. */
export const profilesQuery = () =>
  queryOptions({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,vorname,nachname,email");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        vorname: string | null;
        nachname: string | null;
        email: string | null;
      }[];
    },
    staleTime: 1000 * 60 * 5,
  });

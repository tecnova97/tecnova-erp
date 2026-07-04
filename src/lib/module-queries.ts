import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProjektRow = Database["public"]["Tables"]["projekte"]["Row"] & {
  kunde?: { id: string; name: string } | null;
};
export type KundeRow = Database["public"]["Tables"]["kunden"]["Row"];
export type MitarbeiterRow = Database["public"]["Tables"]["mitarbeiter"]["Row"];
export type AusstattungRow = Database["public"]["Tables"]["mitarbeiter_ausstattung"]["Row"];
export type UrlaubRow = Database["public"]["Tables"]["urlaub"]["Row"];

export type ZahlungsereignisRow = Database["public"]["Tables"]["auftrag_zahlungsereignisse"]["Row"];
export type AusgabeRow = Database["public"]["Tables"]["auftrag_ausgaben"]["Row"];

export interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  before_value: unknown;
  after_value: unknown;
  user_id: string | null;
  created_at: string;
}

/** Activity log entries for one entity (Verlauf tab). */
export const activityForEntityQuery = (entityType: string, entityId: string) =>
  queryOptions({
    queryKey: ["activity", entityType, entityId],
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id,action,entity_type,entity_id,entity_name,before_value,after_value,user_id,created_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("hidden_from_ui", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

/** All payment events — RLS + finance permission gate visibility. */
export const zahlungsereignisseAllQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["zahlungsereignisse-all"],
    enabled,
    queryFn: async (): Promise<ZahlungsereignisRow[]> => {
      const { data, error } = await supabase
        .from("auftrag_zahlungsereignisse")
        .select("*")
        .order("datum", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ZahlungsereignisRow[];
    },
  });

/** All expenses — RLS + finance permission gate visibility. */
export const ausgabenAllQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["ausgaben-all"],
    enabled,
    queryFn: async (): Promise<AusgabeRow[]> => {
      const { data, error } = await supabase
        .from("auftrag_ausgaben")
        .select("*")
        .order("datum", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AusgabeRow[];
    },
  });


// ---------------------------------------------------------------------------
// Detail queries
// ---------------------------------------------------------------------------

export const projektDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["projekt", id],
    queryFn: async (): Promise<ProjektRow> => {
      const { data, error } = await supabase
        .from("projekte")
        .select("*, kunde:kunden(id,name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as ProjektRow;
    },
  });

export const kundeDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["kunde", id],
    queryFn: async (): Promise<KundeRow> => {
      const { data, error } = await supabase.from("kunden").select("*").eq("id", id).single();
      if (error) throw error;
      return data as KundeRow;
    },
  });

export const mitarbeiterDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ["mitarbeiter", id],
    queryFn: async (): Promise<MitarbeiterRow> => {
      const { data, error } = await supabase.from("mitarbeiter").select("*").eq("id", id).single();
      if (error) throw error;
      return data as MitarbeiterRow;
    },
  });

export const ausstattungQuery = (mitarbeiterId: string) =>
  queryOptions({
    queryKey: ["ausstattung", mitarbeiterId],
    queryFn: async (): Promise<AusstattungRow[]> => {
      const { data, error } = await supabase
        .from("mitarbeiter_ausstattung")
        .select("*")
        .eq("mitarbeiter_id", mitarbeiterId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AusstattungRow[];
    },
  });

export const urlaubForMitarbeiterQuery = (mitarbeiterId: string) =>
  queryOptions({
    queryKey: ["urlaub", mitarbeiterId],
    queryFn: async (): Promise<UrlaubRow[]> => {
      const { data, error } = await supabase
        .from("urlaub")
        .select("*")
        .eq("mitarbeiter_id", mitarbeiterId)
        .order("start_datum", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UrlaubRow[];
    },
  });

/** All approved/blocking vacation entries (for calendar blocker overlay). */
export const urlaubAllQuery = () =>
  queryOptions({
    queryKey: ["urlaub-all"],
    queryFn: async (): Promise<UrlaubRow[]> => {
      const { data, error } = await supabase
        .from("urlaub")
        .select("*")
        .order("start_datum", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UrlaubRow[];
    },
  });

// ---------------------------------------------------------------------------
// Labels & helpers
// ---------------------------------------------------------------------------

export const AUSSTATTUNG_TYPEN: { value: string; label: string }[] = [
  { value: "fahrzeug", label: "Fahrzeug" },
  { value: "telefon", label: "Telefon" },
  { value: "geraet", label: "Gerät" },
  { value: "werkzeug", label: "Werkzeug" },
  { value: "sonstiges", label: "Sonstiges" },
];

export function ausstattungTypLabel(v: string): string {
  return AUSSTATTUNG_TYPEN.find((t) => t.value === v)?.label ?? v;
}

export const URLAUB_TYPEN: { value: string; label: string }[] = [
  { value: "urlaub", label: "Urlaub" },
  { value: "krank", label: "Krank" },
  { value: "sonstiges", label: "Sonstiges" },
];

export function urlaubTypLabel(v: string): string {
  return URLAUB_TYPEN.find((t) => t.value === v)?.label ?? v;
}

export const URLAUB_STATUS: Record<string, { label: string; cls: string }> = {
  beantragt: { label: "Beantragt", cls: "bg-warning/15 text-warning" },
  genehmigt: { label: "Genehmigt", cls: "bg-success/15 text-success" },
  abgelehnt: { label: "Abgelehnt", cls: "bg-destructive/15 text-destructive" },
};

/** Log an activity entry from the client (used for order↔project links). */
export async function logActivity(
  action: string,
  entityType: string,
  entityId: string,
  entityName: string,
  before: Record<string, unknown> | null = null,
  after: Record<string, unknown> | null = null,
) {
  await supabase.rpc("log_activity", {
    _action: action,
    _entity_type: entityType,
    _entity_id: entityId,
    _entity_name: entityName,
    _before: before as never,
    _after: after as never,
  });
}

/** Profiles incl. account status fields (for Mitarbeiter linking & last login). */
export const profilesExtendedQuery = () =>
  queryOptions({
    queryKey: ["profiles-extended"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,vorname,nachname,email,disabled,last_login_at");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        vorname: string | null;
        nachname: string | null;
        email: string | null;
        disabled: boolean;
        last_login_at: string | null;
      }[];
    },
    staleTime: 1000 * 60 * 5,
  });

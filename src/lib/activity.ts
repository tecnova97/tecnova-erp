import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  hidden_from_ui: boolean;
  admin_note: string | null;
  created_at: string;
}

/** Human-readable German labels for every logged action. */
export const ACTION_LABEL: Record<string, string> = {
  "auftrag.created": "Auftrag erstellt",
  "auftrag.edited": "Auftrag bearbeitet",
  "auftrag.status": "Status geändert",
  "auftrag.termin": "Termin geändert",
  "auftrag.bezahlt": "Zahlung geändert",
  "auftraggeber.created": "Auftraggeber erstellt",
  "auftraggeber.edited": "Auftraggeber bearbeitet",
  "projekt.created": "Projekt erstellt",
  "projekt.edited": "Projekt bearbeitet",
  "mitarbeiter.assigned": "Mitarbeiter zugewiesen",
  "mitarbeiter.unassigned": "Zuweisung entfernt",
  "foto.uploaded": "Foto hochgeladen",
  "foto.deleted": "Foto gelöscht",
  "dokument.uploaded": "Dokument hochgeladen",
  "dokument.deleted": "Dokument gelöscht",
  "leistung.created": "Leistung erstellt",
  "leistung.edited": "Leistung bearbeitet",
  "leistung.deleted": "Leistung gelöscht",
  "auth.login": "Anmeldung",
  "auth.login_failed": "Fehlgeschlagene Anmeldung",
  "auth.logout": "Abmeldung",
};

export function actionLabel(action: string) {
  return ACTION_LABEL[action] ?? action;
}

export const ENTITY_LABEL: Record<string, string> = {
  auftrag: "Auftrag",
  auftraggeber: "Auftraggeber",
  projekt: "Projekt",
  mitarbeiter: "Mitarbeiter",
  foto: "Foto",
  dokument: "Dokument",
  leistung: "Leistung",
  auth: "Anmeldung",
  system: "System",
};

export function entityLabel(type: string) {
  return ENTITY_LABEL[type] ?? type;
}

/** Route (as string) that a given activity entity should link to, if any. */
export function entityLink(row: ActivityRow): string | null {
  if (!row.entity_id) return null;
  switch (row.entity_type) {
    case "auftrag":
      return `/auftraege/${row.entity_id}`;
    case "projekt":
      return "/projekte";
    case "auftraggeber":
      return "/kunden";
    case "mitarbeiter":
      return "/mitarbeiter";
    default:
      return null;
  }
}

export const activityLogQuery = (includeHidden = false) =>
  queryOptions({
    queryKey: ["activity_log", includeHidden],
    queryFn: async (): Promise<ActivityRow[]> => {
      let q = supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!includeHidden) q = q.eq("hidden_from_ui", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

/** Map of user_id -> primary role (app_role) for display of "who did it". */
export const userRolesMapQuery = () =>
  queryOptions({
    queryKey: ["user_roles_map"],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      const map: Record<string, string> = {};
      const rank: Record<string, number> = { owner: 3, disponent: 2, worker: 1 };
      for (const r of (data ?? []) as { user_id: string; role: string }[]) {
        if (!map[r.user_id] || (rank[r.role] ?? 0) > (rank[map[r.user_id]] ?? 0)) {
          map[r.user_id] = r.role;
        }
      }
      return map;
    },
    staleTime: 1000 * 60 * 5,
  });

export const ROLE_LABEL: Record<string, string> = {
  owner: "Inhaber",
  disponent: "Disponent",
  worker: "Monteur",
};

export function roleLabel(role: string | undefined) {
  return role ? ROLE_LABEL[role] ?? role : "System";
}

export async function setActivityHidden(id: string, hidden: boolean) {
  const { error } = await supabase
    .from("activity_log")
    .update({ hidden_from_ui: hidden } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function setActivityNote(id: string, note: string) {
  const { error } = await supabase
    .from("activity_log")
    .update({ admin_note: note } as never)
    .eq("id", id);
  if (error) throw error;
}

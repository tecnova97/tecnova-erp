import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { userMembershipsQuery } from "@/lib/settings";

// ---------------------------------------------------------------------------
// Multi-status assignments per Auftrag
// ---------------------------------------------------------------------------
export interface StatusZuweisung {
  id: string;
  auftrag_id: string;
  status_key: string;
  sichtbar: boolean;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export const statusZuweisungenQuery = (auftragId: string) =>
  queryOptions({
    queryKey: ["auftrag_status_zuweisungen", auftragId],
    queryFn: async (): Promise<StatusZuweisung[]> => {
      const { data, error } = await supabase
        .from("auftrag_status_zuweisungen")
        .select("id,auftrag_id,status_key,sichtbar,sort_order,is_primary,created_at")
        .eq("auftrag_id", auftragId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StatusZuweisung[];
    },
  });

// ---------------------------------------------------------------------------
// Per-status access grants (roles + individual users)
// ---------------------------------------------------------------------------
export interface StatusZugriffRow {
  id: string;
  status_key: string;
  role_id: string | null;
  user_id: string | null;
  can_view: boolean;
  can_assign: boolean;
  can_remove: boolean;
}

export const statusZugriffQuery = () =>
  queryOptions({
    queryKey: ["status_zugriff"],
    queryFn: async (): Promise<StatusZugriffRow[]> => {
      const { data, error } = await supabase
        .from("status_zugriff")
        .select("id,status_key,role_id,user_id,can_view,can_assign,can_remove");
      if (error) throw error;
      return (data ?? []) as StatusZugriffRow[];
    },
  });

type StatusAction = "view" | "assign" | "remove";

/**
 * Client-side mirror of the DB function `status_action_allowed`. Used purely to
 * shape the UI; the database RLS remains the source of truth.
 */
export function useStatusAccess() {
  const { user, role, can } = useAuth();
  const isOwner = role === "owner";
  const { data: zugriff = [] } = useQuery(statusZugriffQuery());
  const { data: memberships = [] } = useQuery(userMembershipsQuery());

  const myRoleIds = new Set(
    memberships.filter((m) => m.user_id === user?.id).map((m) => m.role_id),
  );

  const allowed = (statusKey: string, action: StatusAction): boolean => {
    if (isOwner) return true;
    const rows = zugriff.filter((z) => z.status_key === statusKey);
    if (rows.length === 0) {
      if (action === "view") return can(PERM.auftraegeView);
      return can(PERM.auftraegeStatus);
    }
    return rows.some((z) => {
      const matches = (z.user_id && z.user_id === user?.id) || (z.role_id && myRoleIds.has(z.role_id));
      if (!matches) return false;
      return action === "view" ? z.can_view : action === "assign" ? z.can_assign : z.can_remove;
    });
  };

  return {
    canView: (k: string) => allowed(k, "view"),
    canAssign: (k: string) => allowed(k, "assign"),
    canRemove: (k: string) => allowed(k, "remove"),
  };
}

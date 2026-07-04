import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser } from "@/lib/admin-users.functions";

// ---------------------------------------------------------------------------
// Invitations — official Supabase invitation workflow.
// The Owner (or a user with users.manage) creates an invitation with name,
// e-mail and role. A server function calls
// supabase.auth.admin.inviteUserByEmail(), so Supabase sends the official
// invitation e-mail through the configured SMTP. The link opens the password
// creation page (/reset-password). No temporary or one-time passwords are
// generated or stored anywhere.
// ---------------------------------------------------------------------------

export interface Invitation {
  id: string;
  email: string;
  vorname: string | null;
  nachname: string | null;
  telefon: string | null;
  role_id: string | null;
  status: "pending" | "accepted" | "revoked";
  expires_at: string;
  accepted_user_id: string | null;
  created_at: string;
}

export interface CreateInvitationInput {
  email: string;
  vorname: string;
  nachname: string;
  telefon?: string;
  role_id: string;
}

export async function createInvitation(input: CreateInvitationInput): Promise<void> {
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : "/reset-password";
  await inviteUser({
    data: {
      email: input.email.trim().toLowerCase(),
      vorname: input.vorname.trim() || undefined,
      nachname: input.nachname.trim() || undefined,
      telefon: input.telefon?.trim() || undefined,
      role_id: input.role_id,
      redirectTo,
    },
  });
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteInvitation(id: string): Promise<void> {
  const { error } = await supabase.from("invitations").delete().eq("id", id);
  if (error) throw error;
}

export const invitationsQuery = () =>
  queryOptions({
    queryKey: ["invitations"],
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase
        .from("invitations")
        .select(
          "id,email,vorname,nachname,telefon,role_id,status,expires_at,accepted_user_id,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });

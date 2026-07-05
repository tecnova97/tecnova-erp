import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Invitations — self-registration workflow (no Admin API, no service role).
//
// The Owner (or a user with users.manage) creates an invitation row with name,
// e-mail, phone and role. No auth user and no temporary password are created.
// The invited person opens /register?email=<email>, sets their own password via
// the normal Supabase Auth signUp flow, and claims the invitation. Roles are
// then assigned by the accept_self_invitation() database function.
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

/** The base URL used to build the registration link. */
export function appBaseUrl(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://erp.tec-nova.de";
}

export function registrationLink(email: string): string {
  return `${appBaseUrl()}/register?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

/** Canonical production registration link used in invitation e-mails. */
export const PRODUCTION_APP_URL = "https://erp.tec-nova.de";

export function productionRegistrationLink(email: string): string {
  return `${PRODUCTION_APP_URL}/register?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

/**
 * Create a pending invitation row directly (owner/users.manage RLS applies).
 * Returns the registration link the owner can share as a fallback.
 */
export async function createInvitation(input: CreateInvitationInput): Promise<string> {
  const email = input.email.trim().toLowerCase();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    throw new Error("Es existiert bereits ein Konto mit dieser E-Mail-Adresse.");
  }

  const { data: pending } = await supabase
    .from("invitations")
    .select("id")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    throw new Error("Für diese E-Mail-Adresse gibt es bereits eine offene Einladung.");
  }

  const { error } = await supabase.from("invitations").insert({
    email,
    vorname: input.vorname.trim() || null,
    nachname: input.nachname.trim() || null,
    telefon: input.telefon?.trim() || null,
    role_id: input.role_id,
    status: "pending",
  } as never);
  if (error) throw error;

  return registrationLink(email);
}

export interface PendingInvitation {
  email: string;
  vorname: string | null;
  nachname: string | null;
  telefon: string | null;
  role_id: string | null;
  valid: boolean;
}

/** Look up a pending, non-expired invitation by e-mail (works before login). */
export async function getPendingInvitation(email: string): Promise<PendingInvitation | null> {
  const { data, error } = await supabase.rpc("get_pending_invitation" as never, {
    _email: email.trim().toLowerCase(),
  } as never);
  if (error) throw error;
  const rows = (data ?? []) as PendingInvitation[];
  return rows.length > 0 ? rows[0] : null;
}

/** Claim the pending invitation as the just-registered authenticated user. */
export async function acceptSelfInvitation(): Promise<{ ok: boolean; base_role: string }> {
  const { data, error } = await supabase.rpc("accept_self_invitation" as never);
  if (error) throw error;
  const res = (data ?? {}) as { ok?: boolean; base_role?: string };
  return { ok: Boolean(res.ok), base_role: res.base_role ?? "worker" };
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

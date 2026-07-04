import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Invitations — invitation-first, fully static user onboarding.
// The Owner creates an invitation (name, e-mail, role). The system generates a
// single-use invite token. Only a SHA-256 HASH of that token is stored in the
// database (never the plaintext token or a temporary password). The plaintext
// token travels only inside the one-time invitation link. The invited person
// opens the link, the account is activated client-side using a password
// deterministically derived from the token, and the user is forced to set a
// personal password on first login. No service-role needed — GitHub-Pages safe.
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

function generateToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

/** SHA-256 hex digest — must match Postgres encode(digest(token,'sha256'),'hex'). */
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Deterministic, policy-compliant one-time password derived from the invite
 * token. Never stored anywhere — recomputed from the token in the link during
 * activation. The prefix guarantees upper/lower/digit/special characters.
 */
export function derivePassword(token: string): string {
  return `Tn7!${token}`;
}

/** Builds the absolute invitation link for manual sending. */
export function invitationLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/einladung?token=${token}`;
}

export interface CreateInvitationInput {
  email: string;
  vorname: string;
  nachname: string;
  telefon?: string;
  role_id: string;
}

export interface CreatedInvitation {
  link: string;
}

export async function createInvitation(input: CreateInvitationInput): Promise<CreatedInvitation> {
  const token = generateToken();
  const token_hash = await sha256Hex(token);
  const { error } = await supabase.from("invitations").insert({
    email: input.email.trim().toLowerCase(),
    vorname: input.vorname.trim() || null,
    nachname: input.nachname.trim() || null,
    telefon: input.telefon?.trim() || null,
    role_id: input.role_id,
    token_hash,
    status: "pending",
  } as never);
  if (error) throw error;
  return { link: invitationLink(token) };
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

// ---------------------------------------------------------------------------
// Acceptance side (used by the /einladung route, possibly anonymous)
// ---------------------------------------------------------------------------
export interface InvitationLookup {
  email: string;
  vorname: string | null;
  nachname: string | null;
  valid: boolean;
}

export async function lookupInvitation(token: string): Promise<InvitationLookup | null> {
  const { data, error } = await supabase.rpc("get_invitation", { _token: token });
  if (error) throw error;
  const row = (data as InvitationLookup[] | null)?.[0];
  return row ?? null;
}

export async function acceptInvitation(token: string): Promise<void> {
  const { error } = await supabase.rpc("accept_invitation", { _token: token });
  if (error) throw error;
}

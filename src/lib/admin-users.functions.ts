import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Admin user management — official Supabase invitation + user deletion.
//
// Invitations use supabase.auth.admin.inviteUserByEmail(): Supabase sends the
// official invitation e-mail through the configured SMTP. The link opens the
// password-creation page (/reset-password). No temporary or one-time passwords
// are ever generated or stored.
//
// These run with the service role (bypasses RLS), so every handler first
// verifies the caller is an owner or has the users.manage permission.
// ---------------------------------------------------------------------------

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
};

async function assertCanManageUsers(supabase: RpcClient, userId: string): Promise<void> {
  const [{ data: isOwner }, { data: canManage }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    supabase.rpc("has_permission", { _user_id: userId, _permission: "users.manage" }),
  ]);
  if (!isOwner && !canManage) {
    throw new Error("Keine Berechtigung zur Benutzerverwaltung.");
  }
}



const inviteSchema = z.object({
  email: z.string().email(),
  vorname: z.string().optional(),
  nachname: z.string().optional(),
  telefon: z.string().optional(),
  role_id: z.string().uuid(),
  redirectTo: z.string().url(),
});

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManageUsers(context.supabase as unknown as RpcClient, context.userId);

    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prevent duplicate accounts and duplicate pending invitations.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingProfile) {
      throw new Error("Es existiert bereits ein Konto mit dieser E-Mail-Adresse.");
    }
    const { data: pending } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) {
      throw new Error("Für diese E-Mail-Adresse gibt es bereits eine offene Einladung.");
    }

    // Official Supabase invitation — sends the invite e-mail via SMTP.
    const { data: invited, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: data.redirectTo,
        data: {
          vorname: data.vorname ?? "",
          nachname: data.nachname ?? "",
        },
      });
    if (inviteError || !invited?.user) {
      throw new Error(inviteError?.message ?? "Einladung konnte nicht gesendet werden.");
    }
    const uid = invited.user.id;

    // Ensure profile fields are populated (handle_new_user created the row).
    await supabaseAdmin
      .from("profiles")
      .update({
        vorname: data.vorname ?? null,
        nachname: data.nachname ?? null,
        telefon: data.telefon ?? null,
        email,
      })
      .eq("id", uid);

    // Assign the selected role (custom role membership + legacy base role).
    const { data: roleRow } = await supabaseAdmin
      .from("roles")
      .select("base_role")
      .eq("id", data.role_id)
      .maybeSingle();

    await supabaseAdmin.from("user_role_memberships").delete().eq("user_id", uid);
    await supabaseAdmin
      .from("user_role_memberships")
      .insert({ user_id: uid, role_id: data.role_id });

    const base = (roleRow as { base_role?: string } | null)?.base_role;
    if (base) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
      await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: base } as never);
    }

    // Track the pending invitation for the "Offene Einladungen" list.
    await supabaseAdmin.from("invitations").insert({
      email,
      vorname: data.vorname ?? null,
      nachname: data.nachname ?? null,
      telefon: data.telefon ?? null,
      role_id: data.role_id,
      status: "pending",
      accepted_user_id: uid,
      created_by: context.userId,
    });

    return { ok: true };
  });

const deleteSchema = z.object({ userId: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertCanManageUsers(context.supabase as unknown as RpcClient, context.userId);

    if (data.userId === context.userId) {
      throw new Error("Das eigene Konto kann nicht gelöscht werden.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();
    const email = (target as { email?: string } | null)?.email ?? null;

    // Remove invitation tracking rows (no FK cascade for these).
    await supabaseAdmin.from("invitations").delete().eq("accepted_user_id", data.userId);
    if (email) {
      await supabaseAdmin.from("invitations").delete().eq("email", email);
    }

    // Deleting the auth user cascades profile, user_roles, memberships,
    // dashboard settings, status access and trusted devices (ON DELETE CASCADE),
    // keeping referential integrity intact.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Server function: send the self-registration invitation e-mail via Gmail SMTP.
//
// - Authenticated + authorized (owner or `users.manage`) callers only.
// - SMTP logic runs server-side only; the password never reaches the client.
// - The caller keeps the copyable registration link as a fallback if this fails.
// ---------------------------------------------------------------------------

const inviteEmailSchema = z.object({
  email: z.string().email(),
  vorname: z.string().default(""),
  nachname: z.string().default(""),
  registerUrl: z.string().url(),
});

export const sendInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteEmailSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize: owner OR a role that grants `users.manage`.
    const [{ data: isOwner }, { data: perms }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
      supabase.rpc("current_permissions"),
    ]);
    const canManageUsers =
      Boolean(isOwner) ||
      ((perms as { permission_key: string }[] | null) ?? []).some(
        (p) => p.permission_key === "users.manage",
      );
    if (!canManageUsers) {
      throw new Error("Forbidden");
    }

    const { sendInvitationEmailSmtp } = await import("./invitation-email.server");
    await sendInvitationEmailSmtp({
      email: data.email.trim().toLowerCase(),
      vorname: data.vorname,
      nachname: data.nachname,
      registerUrl: data.registerUrl,
    });

    return { ok: true };
  });

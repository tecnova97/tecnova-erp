import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// First-install wizard support.
// When no Owner exists yet, the app shows a setup wizard that creates the
// company profile and the first Owner account entirely client-side.
// ---------------------------------------------------------------------------

export async function systemNeedsSetup(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("system_needs_setup");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

export interface InitialSetupInput {
  firmenname: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon?: string;
  password: string;
}

/**
 * Creates the first Owner + company profile.
 * The very first sign-up is promoted to Owner by the `handle_new_user` trigger.
 */
export async function runInitialSetup(input: InitialSetupInput): Promise<void> {
  // 1) Create the first user – becomes Owner automatically (trigger).
  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: { vorname: input.vorname.trim(), nachname: input.nachname.trim() },
      emailRedirectTo: `${window.location.origin}/auth`,
    },
  });
  if (signUpError) throw signUpError;

  // 2) Ensure an active session (auto-confirm is enabled).
  if (!signUp.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });
    if (signInError) throw signInError;
  }

  const uid = signUp.user?.id ?? (await supabase.auth.getUser()).data.user?.id;

  // 3) Store phone on the profile.
  if (uid && input.telefon) {
    await supabase.from("profiles").update({ telefon: input.telefon.trim() } as never).eq("id", uid);
  }

  // 4) Grant the Owner role every permission and confirm membership.
  await supabase.rpc("setup_grant_owner_permissions");

  // 5) Create the company profile (skip if one already exists).
  const { data: existing } = await supabase.from("firmenprofil").select("id").limit(1).maybeSingle();
  if (!existing) {
    await supabase.from("firmenprofil").insert({ firmenname: input.firmenname.trim() } as never);
  }
}

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CustomTheme, ThemeMode } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Firmenprofil (company profile)
// ---------------------------------------------------------------------------
export interface Firmenprofil {
  id: string;
  firmenname: string;
  logo_full_url: string | null;
  logo_round_url: string | null;
  logo_white_url: string | null;
  favicon_url: string | null;
  // per-location logo slots
  login_logo_light: string | null;
  login_logo_dark: string | null;
  round_logo_light: string | null;
  round_logo_dark: string | null;
  full_logo_light: string | null;
  full_logo_dark: string | null;
  favicon_light: string | null;
  favicon_dark: string | null;
  mobile_logo_light: string | null;
  mobile_logo_dark: string | null;
  pdf_logo: string | null;
  email_logo: string | null;
  invoice_logo: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  telefon: string | null;
  email: string | null;
  website: string | null;
  steuernummer: string | null;
  ust_idnr: string | null;
  iban: string | null;
  bic: string | null;
  bank: string | null;
  farbe_primary: string;
  farbe_secondary: string;
  default_theme_mode: ThemeMode;
  default_theme: CustomTheme | null;
}

export const firmenprofilQuery = () =>
  queryOptions({
    queryKey: ["firmenprofil"],
    queryFn: async (): Promise<Firmenprofil | null> => {
      // Read via a security-definer RPC that hides banking/tax fields
      // (Steuernummer, USt-IdNr, IBAN, BIC) from non-finance users while still
      // returning logos, colors and contact data for branding management.
      const { data, error } = await supabase.rpc("get_firmenprofil_admin");
      if (error) throw error;
      return (data as Firmenprofil) ?? null;
    },
  });


// ---------------------------------------------------------------------------
// Leistungspositionen (service positions) + prices (separate, permission gated)
// ---------------------------------------------------------------------------
export const BERECHNUNGSARTEN = [
  { key: "pauschale", label: "Pauschale", einheit: "Pauschale" },
  { key: "stueck", label: "Stück", einheit: "Stück" },
  { key: "meter", label: "Meter", einheit: "Meter" },
  { key: "stunde", label: "Stunde", einheit: "Stunde" },
  { key: "stunde_mitarbeiter", label: "Stunde × Mitarbeiter", einheit: "Stunde × Mitarbeiter" },
] as const;

export function berechnungsartLabel(key: string): string {
  return BERECHNUNGSARTEN.find((b) => b.key === key)?.label ?? key;
}

export interface Leistungsposition {
  id: string;
  code: string;
  name: string;
  berechnungsart: string;
  einheit: string;
  aktiv: boolean;
  sort_order: number;
  worker_ohne_preis: boolean;
}

export interface LeistungPreis {
  leistung_id: string;
  preis: number;
}

export const leistungenQuery = () =>
  queryOptions({
    queryKey: ["leistungspositionen"],
    queryFn: async (): Promise<Leistungsposition[]> => {
      const { data, error } = await supabase
        .from("leistungspositionen")
        .select("id,code,name,berechnungsart,einheit,aktiv,sort_order,worker_ohne_preis")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Leistungsposition[];
    },
  });

/** Prices are only readable by users with a finance/service permission (RLS). */
export const leistungPreiseQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["leistung_preise"],
    enabled,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("leistung_preise").select("leistung_id,preis");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as LeistungPreis[]) map[r.leistung_id] = Number(r.preis);
      return map;
    },
  });

// ---------------------------------------------------------------------------
// App settings (global, owner managed) — generic key/value JSON store
// ---------------------------------------------------------------------------
export const appSettingsQuery = <T = Record<string, unknown>>(key: string, fallback: T) =>
  queryOptions({
    queryKey: ["app_settings", key],
    queryFn: async (): Promise<T> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return ((data?.value as T) ?? fallback) as T;
    },
  });

export async function saveAppSetting(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value: value as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Users (Benutzer) — profiles + role memberships
// ---------------------------------------------------------------------------
export interface UserRow {
  id: string;
  vorname: string | null;
  nachname: string | null;
  email: string | null;
  telefon: string | null;
  disabled: boolean;
  force_password_change: boolean;
  last_login_at: string | null;
  created_at: string;
}

/**
 * Safely remove a user at the app level without the Admin API.
 *
 * The Auth login itself can only be deleted with the service role / Admin API,
 * which this app intentionally does not use. Instead we deactivate the account
 * and strip all access: the profile is disabled, role memberships and legacy
 * roles are removed, and any invitations tied to the user are cleaned up.
 */
export async function deactivateUserAccount(
  userId: string,
  email: string | null,
): Promise<void> {
  const { error: disableErr } = await supabase
    .from("profiles")
    .update({ disabled: true, force_password_change: true } as never)
    .eq("id", userId);
  if (disableErr) throw disableErr;

  await supabase.from("user_role_memberships").delete().eq("user_id", userId);
  await supabase.from("user_roles").delete().eq("user_id", userId);

  await supabase.from("invitations").delete().eq("accepted_user_id", userId);
  if (email) {
    await supabase.from("invitations").delete().eq("email", email.toLowerCase());
  }
}

export const usersQuery = () =>
  queryOptions({
    queryKey: ["benutzer"],
    queryFn: async (): Promise<UserRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,vorname,nachname,email,telefon,disabled,force_password_change,last_login_at,created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

export const userMembershipsQuery = () =>
  queryOptions({
    queryKey: ["user_role_memberships"],
    queryFn: async (): Promise<{ user_id: string; role_id: string }[]> => {
      const { data, error } = await supabase
        .from("user_role_memberships")
        .select("user_id,role_id");
      if (error) throw error;
      return (data ?? []) as { user_id: string; role_id: string }[];
    },
  });

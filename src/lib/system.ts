import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Pilotbetrieb (pilot mode) — stored in the generic app_settings key/value store
// ---------------------------------------------------------------------------
export interface PilotConfig {
  enabled: boolean;
}

export const PILOT_DEFAULT: PilotConfig = { enabled: false };

export const pilotConfigQuery = () =>
  queryOptions({
    queryKey: ["app_settings", "pilot"],
    queryFn: async (): Promise<PilotConfig> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "pilot")
        .maybeSingle();
      if (error) throw error;
      return ((data?.value as unknown as PilotConfig) ?? PILOT_DEFAULT) as PilotConfig;
    },
    staleTime: 60_000,
  });

// ---------------------------------------------------------------------------
// Feedback (pilot mode)
// ---------------------------------------------------------------------------
export async function submitFeedback(message: string, page: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Nicht angemeldet.");
  const { error } = await supabase.from("feedback").insert({
    user_id: userId,
    page,
    message,
  });
  if (error) throw error;
}

export interface FeedbackRow {
  id: string;
  user_id: string | null;
  page: string | null;
  message: string;
  created_at: string;
}

export const feedbackQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["feedback"],
    enabled,
    queryFn: async (): Promise<FeedbackRow[]> => {
      const { data, error } = await supabase
        .from("feedback")
        .select("id,user_id,page,message,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });

// ---------------------------------------------------------------------------
// Testdaten-Bereinigung (owner-only cleanup RPC)
// ---------------------------------------------------------------------------
export interface CleanupResult {
  ok: boolean;
  counts: Record<string, number>;
}

export const CLEANUP_CONFIRM_PHRASE = "DELETE TEST DATA";

export async function cleanupTestData(): Promise<CleanupResult> {
  const { data, error } = await supabase.rpc("cleanup_test_data");
  if (error) throw error;
  return data as unknown as CleanupResult;
}

export const CLEANUP_LABELS: Record<string, string> = {
  auftraege: "Aufträge",
  projekte: "Projekte",
  kunden: "Auftraggeber",
  mitarbeiter: "Test-Mitarbeiter (ohne Login)",
  zahlungsereignisse: "Zahlungsereignisse",
  rechnungsgruppen: "Rechnungsgruppen",
  documents: "Dokumente (DMS)",
  dokumente: "Dokumente",
  fotos: "Fotos",
  import_batches: "Import-Vorgänge",
  blocker: "Kalender-Blocker",
  urlaub: "Abwesenheiten",
  betriebsausgaben: "Betriebsausgaben",
  feedback: "Feedback-Einträge",
};

// ---------------------------------------------------------------------------
// Deployment configuration (read-only, from build-time env)
// ---------------------------------------------------------------------------
export const PRODUCTION_DOMAIN = "erp.tec-nova.de";

export interface DeploymentEnv {
  supabaseUrl: string;
  hasSupabaseUrl: boolean;
  hasAnonKey: boolean;
  origin: string;
}

export function readDeploymentEnv(): DeploymentEnv {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";
  return {
    supabaseUrl: url,
    hasSupabaseUrl: url.length > 0,
    hasAnonKey: key.length > 0,
    origin: typeof window !== "undefined" ? window.location.origin : "",
  };
}

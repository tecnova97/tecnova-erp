// Central Supabase environment resolver.
//
// Production must always use TecNova's external Supabase project.
// Lovable Cloud may inject its own .env values during preview/build; those values
// must not leak into the production app because they create tokens for a
// different Supabase project and then server functions reject them as invalid.

export const PRODUCTION_SUPABASE_PROJECT_ID = "dvxfxatqgtalexjyclie";
export const PRODUCTION_SUPABASE_URL = "https://dvxfxatqgtalexjyclie.supabase.co";
export const PRODUCTION_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gthuUGHWe3-GRHahIF5JTQ_u5fW-Ko3";

const LOVABLE_CLOUD_PROJECT_ID = "wvuzwzvhohhflsjvzkuo";

function readImportMetaEnv(name: string): string | undefined {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name];
  } catch {
    return undefined;
  }
}

function readProcessEnv(name: string): string | undefined {
  try {
    return (typeof process !== "undefined" ? process.env?.[name] : undefined) as string | undefined;
  } catch {
    return undefined;
  }
}

function isProductionHost(): boolean {
  if (typeof window === "undefined") return false;
  return ["erp.tec-nova.de", "tecnova-erp.pages.dev"].includes(window.location.hostname);
}

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveSupabaseConfig() {
  const viteUrl = normalize(readImportMetaEnv("VITE_SUPABASE_URL"));
  const viteKey = normalize(readImportMetaEnv("VITE_SUPABASE_PUBLISHABLE_KEY"));
  const serverUrl = normalize(readProcessEnv("SUPABASE_URL"));
  const serverKey = normalize(readProcessEnv("SUPABASE_PUBLISHABLE_KEY"));

  // In production/browser, force the real TecNova Supabase project. This prevents
  // a Lovable-managed .env from baking the wrong project into the client bundle.
  if (isProductionHost()) {
    return {
      url: PRODUCTION_SUPABASE_URL,
      publishableKey: PRODUCTION_SUPABASE_PUBLISHABLE_KEY,
      source: "production-forced" as const,
    };
  }

  // In server functions, prefer explicit runtime env, but fall back to the real
  // project so functions keep using the same project as the production client.
  if (typeof window === "undefined") {
    return {
      url: serverUrl ?? viteUrl ?? PRODUCTION_SUPABASE_URL,
      publishableKey: serverKey ?? viteKey ?? PRODUCTION_SUPABASE_PUBLISHABLE_KEY,
      source: serverUrl && serverKey ? ("server-env" as const) : ("server-fallback" as const),
    };
  }

  const url = viteUrl ?? PRODUCTION_SUPABASE_URL;
  const publishableKey = viteKey ?? PRODUCTION_SUPABASE_PUBLISHABLE_KEY;

  // If Lovable's managed project is injected into a preview, keep it there. It is
  // only dangerous in production. This keeps Lovable preview usable.
  return {
    url,
    publishableKey,
    source: url.includes(LOVABLE_CLOUD_PROJECT_ID) ? ("lovable-preview-env" as const) : ("client-env" as const),
  };
}

export function assertValidSupabaseConfig(url: string, publishableKey: string): void {
  if (!url || !publishableKey) {
    throw new Error("Missing Supabase configuration.");
  }

  if (typeof window !== "undefined" && isProductionHost() && url.includes(LOVABLE_CLOUD_PROJECT_ID)) {
    throw new Error("Wrong Supabase project configured for production.");
  }
}

import { useEffect } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CustomTheme, ThemeMode } from "@/lib/theme";

/** All logo slot keys stored in firmenprofil (each an object path or absolute URL). */
export const LOGO_SLOTS = [
  "login_logo_light", "login_logo_dark",
  "round_logo_light", "round_logo_dark",
  "full_logo_light", "full_logo_dark",
  "favicon_light", "favicon_dark",
  "mobile_logo_light", "mobile_logo_dark",
  "pdf_logo", "email_logo", "invoice_logo",
  // legacy slots (kept for backward compatibility / fallback)
  "logo_full_url", "logo_round_url", "logo_white_url", "favicon_url",
] as const;

export type LogoSlot = (typeof LOGO_SLOTS)[number];

export interface Branding {
  firmenname: string;
  farbe_primary: string;
  farbe_secondary: string;
  default_theme_mode: ThemeMode;
  default_theme: CustomTheme | null;
  logos: Record<LogoSlot, string | null>;
}

/** Resolve a stored branding value into a usable URL. Stored values are either
 * absolute URLs or storage object paths inside the private `branding` bucket. */
async function resolvePath(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await supabase.storage.from("branding").createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}

export const brandingQuery = () =>
  queryOptions({
    queryKey: ["branding"],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Branding | null> => {
      const { data, error } = await supabase.rpc("get_branding");
      if (error) throw error;
      const row = (data as Record<string, unknown>[] | null)?.[0];
      if (!row) return null;

      const resolvedEntries = await Promise.all(
        LOGO_SLOTS.map(async (slot) => [slot, await resolvePath(row[slot] as string | null)] as const),
      );
      const logos = Object.fromEntries(resolvedEntries) as Record<LogoSlot, string | null>;

      return {
        firmenname: (row.firmenname as string) || "TecNova",
        farbe_primary: (row.farbe_primary as string) || "#3b82f6",
        farbe_secondary: (row.farbe_secondary as string) || "#0f172a",
        default_theme_mode: ((row.default_theme_mode as ThemeMode) || "system"),
        default_theme: (row.default_theme as CustomTheme | null) ?? null,
        logos,
      };
    },
  });

export function useBranding(): Branding | null {
  const { data } = useQuery(brandingQuery());
  return data ?? null;
}

/** Applies the configured favicon (if any) to the document head. Rendered once
 * near the app root, inside the query provider. */
export function BrandingEffects() {
  const branding = useBranding();
  const favicon =
    branding?.logos.favicon_light || branding?.logos.favicon_url || branding?.logos.full_logo_light || null;

  useEffect(() => {
    if (!favicon || typeof document === "undefined") return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = favicon;
  }, [favicon]);

  return null;
}

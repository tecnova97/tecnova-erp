import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";

// ---------------------------------------------------------------------------
// Theme model
// ---------------------------------------------------------------------------
export type ThemeMode = "hell" | "dunkel" | "system" | "benutzerdefiniert";

export const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  hell: "Hell",
  dunkel: "Dunkel",
  system: "System",
  benutzerdefiniert: "Benutzerdefiniert",
};

/** Configurable colors for a custom theme. All values are CSS colors (hex). */
export type CustomTheme = Partial<Record<CustomThemeKey, string>>;

export type CustomThemeKey =
  | "primary" | "secondary" | "accent"
  | "sidebar" | "header" | "background"
  | "card" | "widget" | "border"
  | "button" | "hover" | "text" | "link";

export const CUSTOM_THEME_FIELDS: { key: CustomThemeKey; label: string; hint: string }[] = [
  { key: "primary", label: "Primärfarbe", hint: "Akzente, aktive Elemente, Ringe" },
  { key: "secondary", label: "Sekundärfarbe", hint: "Sekundäre Flächen" },
  { key: "accent", label: "Akzentfarbe", hint: "Hervorhebungen" },
  { key: "sidebar", label: "Seitenleiste", hint: "Hintergrund der Navigation" },
  { key: "header", label: "Kopfleiste", hint: "Obere Leiste" },
  { key: "background", label: "Haupt-Hintergrund", hint: "Seitenhintergrund" },
  { key: "card", label: "Karten-Hintergrund", hint: "Karten & Dialoge" },
  { key: "widget", label: "Widget-Hintergrund", hint: "Kacheln & Widgets" },
  { key: "border", label: "Rahmenfarbe", hint: "Linien & Umrandungen" },
  { key: "button", label: "Button-Farbe", hint: "Primäre Schaltflächen" },
  { key: "hover", label: "Hover-Farbe", hint: "Hover-Zustand" },
  { key: "text", label: "Textfarbe", hint: "Standard-Schrift" },
  { key: "link", label: "Linkfarbe", hint: "Verlinkungen" },
];

/** Sensible starting palette for a fresh custom theme (matches light default). */
export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  primary: "#2f6fb3",
  secondary: "#eef2f7",
  accent: "#38bec9",
  sidebar: "#1f2733",
  header: "#ffffff",
  background: "#f6f8fb",
  card: "#ffffff",
  widget: "#ffffff",
  border: "#e3e8ef",
  button: "#2f6fb3",
  hover: "#255a92",
  text: "#1e2430",
  link: "#2f6fb3",
};

// ---------------------------------------------------------------------------
// Applying a theme to the document
// ---------------------------------------------------------------------------
const CUSTOM_VARS = [
  "--primary", "--ring", "--sidebar-primary", "--sidebar-ring",
  "--secondary", "--accent", "--sidebar", "--sidebar-border",
  "--header", "--background", "--card", "--popover", "--widget",
  "--border", "--input", "--foreground", "--card-foreground",
  "--link", "--btn", "--btn-hover",
];

function applyCustom(theme: CustomTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = (v: string, val?: string) => { if (val) root.style.setProperty(v, val); };
  // primary drives accents; button drives actual buttons
  set("--primary", theme.button || theme.primary);
  set("--btn", theme.button || theme.primary);
  set("--btn-hover", theme.hover || theme.button || theme.primary);
  set("--ring", theme.primary);
  set("--sidebar-primary", theme.primary);
  set("--sidebar-ring", theme.primary);
  set("--secondary", theme.secondary);
  set("--accent", theme.accent);
  set("--sidebar", theme.sidebar);
  set("--sidebar-border", theme.border);
  set("--header", theme.header);
  set("--background", theme.background);
  set("--card", theme.card);
  set("--popover", theme.card);
  set("--widget", theme.widget || theme.card);
  set("--border", theme.border);
  set("--input", theme.border);
  set("--foreground", theme.text);
  set("--card-foreground", theme.text);
  set("--link", theme.link || theme.primary);
}

function clearCustom() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const v of CUSTOM_VARS) root.style.removeProperty(v);
}

function setDark(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", on);
}

/** Applies a resolved theme (mode + optional custom palette) to the document. */
export function applyTheme(mode: ThemeMode, custom: CustomTheme | null | undefined) {
  if (typeof document === "undefined") return;
  clearCustom();
  if (mode === "benutzerdefiniert") {
    setDark(false);
    applyCustom({ ...DEFAULT_CUSTOM_THEME, ...(custom ?? {}) });
    return;
  }
  if (mode === "dunkel") return setDark(true);
  if (mode === "hell") return setDark(false);
  // system
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  setDark(prefersDark);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
/** Save the current user's personal theme preference. */
export async function saveUserTheme(
  userId: string,
  mode: ThemeMode,
  custom: CustomTheme | null,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ theme_mode: mode, theme_custom: (custom as never) ?? null })
    .eq("id", userId);
  if (error) throw error;
}

/** Save the company default theme (owner / branding permission). */
export async function saveCompanyTheme(
  firmenprofilId: string,
  mode: ThemeMode,
  custom: CustomTheme | null,
): Promise<void> {
  const { error } = await supabase
    .from("firmenprofil")
    .update({ default_theme_mode: mode, default_theme: (custom as never) ?? null })
    .eq("id", firmenprofilId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Runtime provider — applies the effective theme
// ---------------------------------------------------------------------------
interface ProfileTheme {
  theme_mode?: ThemeMode | null;
  theme_custom?: CustomTheme | null;
}

/**
 * Resolves and applies the active theme:
 *  - logged-in user with a preference wins
 *  - otherwise the company default theme
 *  - otherwise "system"
 * Also keeps "system" mode in sync with OS changes.
 */
export function ThemeEffects() {
  const { user } = useAuth();
  const branding = useBranding();
  const [profileTheme, setProfileTheme] = useState<ProfileTheme | null>(null);

  // Load the current user's stored theme (kept lightweight & separate from auth).
  useEffect(() => {
    let active = true;
    if (!user) { setProfileTheme(null); return; }
    supabase
      .from("profiles")
      .select("theme_mode, theme_custom")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfileTheme((data as ProfileTheme) ?? null);
      });
    return () => { active = false; };
  }, [user]);

  const userMode = profileTheme?.theme_mode ?? null;
  const companyMode = branding?.default_theme_mode ?? "system";
  const mode: ThemeMode = user && userMode ? userMode : companyMode;
  const custom =
    mode === "benutzerdefiniert"
      ? (user && userMode === "benutzerdefiniert"
          ? profileTheme?.theme_custom
          : branding?.default_theme) ?? branding?.default_theme ?? null
      : null;

  useEffect(() => {
    applyTheme(mode, custom);
  }, [mode, custom]);

  // React to OS theme changes while in "system" mode.
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system", null);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return null;
}

/** Reactive dark-mode flag (observes the documentElement class). */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

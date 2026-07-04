import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type WidgetSize = "sm" | "md" | "lg";
export type WidgetHeight = "auto" | "compact" | "tall";

export interface WidgetInstance {
  id: string; // unique instance id
  type: string; // widget type key
  size: WidgetSize; // width
  height?: WidgetHeight;
  hidden?: boolean;
}

export interface DashboardConfig {
  widgets: WidgetInstance[];
}

export interface WidgetDef {
  type: string;
  title: string;
  description: string;
  defaultSize: WidgetSize;
  defaultHeight?: WidgetHeight;
  /** Optional permission required for a user to see this widget. */
  permission?: string;
}

/**
 * Registry of all available dashboard widgets.
 * Add new widgets here — the dashboard picks them up automatically,
 * no changes to the dashboard rendering / settings code required.
 */
export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    type: "status-uebersicht",
    title: "Status Übersicht",
    description: "Aufträge gruppiert nach Status, inkl. Details.",
    defaultSize: "lg",
    defaultHeight: "auto",
  },
  {
    type: "kontakte-ohne-termin",
    title: "Kontakte ohne Termin",
    description: "Aufträge mit Kontaktdaten aber ohne Termin.",
    defaultSize: "md",
    defaultHeight: "auto",
  },
  {
    type: "heutige-auftraege",
    title: "Heutige Aufträge",
    description: "Alle für heute geplanten Aufträge.",
    defaultSize: "md",
    defaultHeight: "auto",
  },
];

export function widgetDef(type: string) {
  return WIDGET_REGISTRY.find((w) => w.type === type);
}

/** Widgets a given user may see based on their permissions. */
export function canSeeWidget(type: string, can: (p: string) => boolean): boolean {
  const def = widgetDef(type);
  if (!def) return false;
  if (!def.permission) return true;
  return can(def.permission);
}

export const DASHBOARD_DEFAULT: DashboardConfig = {
  widgets: [
    { id: "w-status", type: "status-uebersicht", size: "lg", height: "auto" },
    { id: "w-heute", type: "heutige-auftraege", size: "md", height: "auto" },
    { id: "w-kontakte", type: "kontakte-ohne-termin", size: "md", height: "auto" },
  ],
};

/* ------------------------------------------------------------------ */
/* Role default layouts (Owner-managed)                                */
/* ------------------------------------------------------------------ */

export interface RoleLayout {
  config: DashboardConfig;
  allow_customize: boolean;
}

function normalizeConfig(raw: unknown): DashboardConfig | null {
  const cfg = raw as DashboardConfig | undefined;
  if (!cfg || !Array.isArray(cfg.widgets) || cfg.widgets.length === 0) return null;
  return {
    widgets: cfg.widgets.map((w) => ({
      id: w.id,
      type: w.type,
      size: w.size ?? "md",
      height: w.height ?? "auto",
      hidden: w.hidden,
    })),
  };
}

export const roleLayoutQuery = (role: AppRole | undefined) =>
  queryOptions({
    queryKey: ["dashboard_role_layout", role],
    enabled: !!role,
    queryFn: async (): Promise<RoleLayout> => {
      const { data, error } = await supabase
        .from("dashboard_role_layouts")
        .select("config, allow_customize")
        .eq("base_role", role!)
        .maybeSingle();
      if (error) throw error;
      return {
        config: normalizeConfig(data?.config) ?? DASHBOARD_DEFAULT,
        allow_customize: data?.allow_customize ?? true,
      };
    },
  });

export async function saveRoleLayout(
  role: AppRole,
  config: DashboardConfig,
  allowCustomize: boolean,
  updatedBy: string | null,
) {
  const { error } = await supabase.from("dashboard_role_layouts").upsert(
    {
      base_role: role,
      config: config as never,
      allow_customize: allowCustomize,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "base_role" },
  );
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Per-user layout                                                     */
/* ------------------------------------------------------------------ */

export const dashboardConfigQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["dashboard_config", userId],
    enabled: !!userId,
    queryFn: async (): Promise<DashboardConfig | null> => {
      const { data, error } = await supabase
        .from("user_dashboard_settings")
        .select("config")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return normalizeConfig(data?.config);
    },
  });

export async function saveDashboardConfig(userId: string, cfg: DashboardConfig) {
  const { error } = await supabase
    .from("user_dashboard_settings")
    .upsert(
      { user_id: userId, config: cfg as never, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

export const SIZE_CLASS: Record<WidgetSize, string> = {
  sm: "md:col-span-1",
  md: "md:col-span-2 xl:col-span-2",
  lg: "md:col-span-2 xl:col-span-3",
};

export const SIZE_LABEL: Record<WidgetSize, string> = {
  sm: "Klein",
  md: "Mittel",
  lg: "Groß",
};

export const HEIGHT_CLASS: Record<WidgetHeight, string> = {
  auto: "",
  compact: "max-h-[420px] overflow-y-auto",
  tall: "max-h-[720px] overflow-y-auto",
};

export const HEIGHT_LABEL: Record<WidgetHeight, string> = {
  auto: "Automatisch",
  compact: "Kompakt",
  tall: "Hoch",
};

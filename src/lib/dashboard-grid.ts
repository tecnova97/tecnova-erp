import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Layout, LayoutItem, ResponsiveLayouts } from "react-grid-layout/legacy";

/* ------------------------------------------------------------------ */
/* Widget catalog                                                      */
/* ------------------------------------------------------------------ */

export type WidgetKey =
  | "schnellaktionen"
  | "heute"
  | "wetter"
  | "heute-status"
  | "naechste-termine"
  | "offene"
  | "kontakte-ohne-termin"
  | "kuerzlich"
  | "finanz";

export interface WidgetMeta {
  key: WidgetKey;
  title: string;
  /** Only visible to users with finance permission. */
  finance?: boolean;
}

/** Registry of customizable dashboard widgets (order = default add order). */
export const WIDGET_META: WidgetMeta[] = [
  { key: "schnellaktionen", title: "Schnellaktionen" },
  { key: "heute", title: "Heute" },
  { key: "wetter", title: "Wetter · Hameln" },
  { key: "heute-status", title: "Heutige Aufträge – Status" },
  { key: "naechste-termine", title: "Nächste Termine" },
  { key: "offene", title: "Offene Aufträge" },
  { key: "kontakte-ohne-termin", title: "Kontakte ohne Termin" },
  { key: "kuerzlich", title: "Kürzlich geändert" },
  { key: "finanz", title: "Finanzübersicht", finance: true },
];

export const widgetTitle = (key: WidgetKey) =>
  WIDGET_META.find((w) => w.key === key)?.title ?? key;

/* ------------------------------------------------------------------ */
/* Grid geometry                                                       */
/* ------------------------------------------------------------------ */

export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
export const GRID_COLS = { lg: 12, md: 12, sm: 6, xs: 1, xxs: 1 };
export const GRID_ROW_HEIGHT = 32;
export const GRID_MARGIN: [number, number] = [16, 16];

/** Default desktop (lg) layout. Other breakpoints are auto-generated. */
export const DEFAULT_LG_LAYOUT: Layout = [
  { i: "schnellaktionen", x: 0, y: 0, w: 12, h: 4, minW: 4, minH: 3 },
  { i: "heute", x: 0, y: 4, w: 6, h: 10, minW: 3, minH: 4 },
  { i: "heute-status", x: 6, y: 4, w: 6, h: 10, minW: 3, minH: 4 },
  { i: "naechste-termine", x: 0, y: 14, w: 6, h: 10, minW: 3, minH: 4 },
  { i: "offene", x: 6, y: 14, w: 6, h: 12, minW: 3, minH: 4 },
  { i: "kontakte-ohne-termin", x: 0, y: 26, w: 4, h: 9, minW: 2, minH: 4 },
  { i: "kuerzlich", x: 4, y: 26, w: 4, h: 9, minW: 2, minH: 4 },
  { i: "wetter", x: 8, y: 26, w: 4, h: 5, minW: 2, minH: 3 },
  { i: "finanz", x: 0, y: 35, w: 12, h: 5, minW: 3, minH: 4 },
];

export function defaultLayouts(): ResponsiveLayouts {
  return { lg: DEFAULT_LG_LAYOUT.map((it) => ({ ...it })) };
}

export interface GridConfig {
  layouts: ResponsiveLayouts;
  hidden: WidgetKey[];
}

export function defaultGridConfig(): GridConfig {
  return { layouts: defaultLayouts(), hidden: [] };
}

/* ------------------------------------------------------------------ */
/* Persistence (per user)                                              */
/* ------------------------------------------------------------------ */

function isLayoutItem(v: unknown): v is LayoutItem {
  const it = v as LayoutItem | undefined;
  return !!it && typeof it.i === "string" && typeof it.x === "number";
}

function normalizeGrid(raw: unknown): GridConfig | null {
  const cfg = (raw as { grid?: GridConfig } | undefined)?.grid;
  if (!cfg || typeof cfg !== "object" || !cfg.layouts) return null;
  const layouts: ResponsiveLayouts = {};
  for (const [bp, list] of Object.entries(cfg.layouts)) {
    if (Array.isArray(list)) {
      layouts[bp] = (list as unknown[]).filter(isLayoutItem);
    }
  }
  if (!layouts.lg && !layouts.md && Object.keys(layouts).length === 0) return null;
  return { layouts, hidden: Array.isArray(cfg.hidden) ? cfg.hidden : [] };
}

export const gridConfigQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["dashboard_grid", userId],
    enabled: !!userId,
    queryFn: async (): Promise<GridConfig | null> => {
      const { data, error } = await supabase
        .from("user_dashboard_settings")
        .select("config")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return normalizeGrid(data?.config);
    },
  });

export async function saveGridConfig(userId: string, cfg: GridConfig) {
  const { error } = await supabase.from("user_dashboard_settings").upsert(
    {
      user_id: userId,
      config: { grid: cfg } as never,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function resetGridConfig(userId: string) {
  const { error } = await supabase
    .from("user_dashboard_settings")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

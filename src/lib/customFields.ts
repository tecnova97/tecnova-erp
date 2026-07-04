import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Flexible custom metadata fields. Owners define fields per entity type; the
// values are stored in the entity's `custom_data` JSONB column keyed by
// `field_key`. Default fixed fields (NVT, eSASS …) remain untouched.
// ---------------------------------------------------------------------------

export type CustomEntityType = "projekt" | "rechnung_gruppe" | "auftrag";
export type CustomFieldTyp =
  | "text"
  | "number"
  | "date"
  | "select"
  | "boolean"
  | "file"
  | "url";

export const CUSTOM_ENTITY_LABEL: Record<CustomEntityType, string> = {
  projekt: "Projekt-Felder",
  rechnung_gruppe: "Abrechnungs-Felder",
  auftrag: "Auftrag-Felder",
};

export const FIELD_TYPES: { value: CustomFieldTyp; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Zahl" },
  { value: "date", label: "Datum" },
  { value: "select", label: "Auswahl" },
  { value: "boolean", label: "Ja / Nein" },
  { value: "file", label: "Dateiverweis" },
  { value: "url", label: "URL" },
];

export const fieldTypLabel = (t: string) =>
  FIELD_TYPES.find((x) => x.value === t)?.label ?? t;

export interface CustomFieldDef {
  id: string;
  entity_type: CustomEntityType;
  field_key: string;
  label: string;
  feldtyp: CustomFieldTyp;
  optionen: string[];
  sichtbar: boolean;
  erforderlich: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CustomData = Record<string, unknown>;

/** All field definitions (optionally filtered by entity type). */
export const customFieldDefsQuery = (entityType?: CustomEntityType) =>
  queryOptions({
    queryKey: ["custom_field_defs", entityType ?? "all"],
    queryFn: async (): Promise<CustomFieldDef[]> => {
      let q = supabase
        .from("custom_field_defs")
        .select("*")
        .order("sort_order", { ascending: true });
      if (entityType) q = q.eq("entity_type", entityType);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((d) => ({
        ...(d as CustomFieldDef),
        optionen: Array.isArray((d as { optionen: unknown }).optionen)
          ? ((d as { optionen: string[] }).optionen)
          : [],
      }));
    },
  });

/** Turn a label into a stable snake_case key. */
export function slugifyKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `feld_${Date.now()}`
  );
}

export type CustomFieldDefInput = {
  entity_type: CustomEntityType;
  field_key: string;
  label: string;
  feldtyp: CustomFieldTyp;
  optionen: string[];
  sichtbar: boolean;
  erforderlich: boolean;
  sort_order: number;
};

export async function createCustomFieldDef(input: CustomFieldDefInput) {
  const { error } = await supabase.from("custom_field_defs").insert(input as never);
  if (error) throw error;
}

export async function updateCustomFieldDef(
  id: string,
  patch: Partial<Omit<CustomFieldDefInput, "entity_type" | "field_key">>,
) {
  const { error } = await supabase
    .from("custom_field_defs")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCustomFieldDef(id: string) {
  const { error } = await supabase.from("custom_field_defs").delete().eq("id", id);
  if (error) throw error;
}

/** Format a stored value for read-only display. */
export function formatCustomValue(def: CustomFieldDef, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (def.feldtyp) {
    case "boolean":
      return value ? "Ja" : "Nein";
    case "date":
      try {
        return new Date(String(value)).toLocaleDateString("de-DE");
      } catch {
        return String(value);
      }
    case "number":
      return String(value);
    default:
      return String(value);
  }
}

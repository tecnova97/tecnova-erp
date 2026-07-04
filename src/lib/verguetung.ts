import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Internal employee compensation (NOT German payroll — internal estimation only)
// ---------------------------------------------------------------------------

export interface VerguetungBase {
  id: string;
  mitarbeiter_id: string;
  grundlohn: number | null;
  stundenlohn: number | null;
  sollstunden: number | null;
  eintrittsdatum: string | null;
  beschaeftigungsart: string | null;
  steuer_notizen: string | null;
  interne_notizen: string | null;
  eigene_sichtbar: boolean;
}

export interface VerguetungEintrag {
  id: string;
  mitarbeiter_id: string;
  typ: string;
  betrag: number;
  monat: string; // YYYY-MM
  datum: string;
  beschreibung: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Leistungsnotiz {
  id: string;
  mitarbeiter_id: string;
  typ: string;
  text: string;
  created_by: string | null;
  created_at: string;
}

export const BESCHAEFTIGUNGSARTEN = [
  "Vollzeit", "Teilzeit", "Minijob", "Werkstudent", "Aushilfe", "Freelancer", "Sonstiges",
] as const;

/** Variable compensation entry types with their effect on the estimated payout. */
export const EINTRAG_TYPEN = [
  { key: "bonus", label: "Bonus", sign: 1 },
  { key: "praemie", label: "Prämie", sign: 1 },
  { key: "spesen", label: "Spesen", sign: 1 },
  { key: "erstattung", label: "Erstattung", sign: 1 },
  { key: "abschlag", label: "Abschlag", sign: -1 },
  { key: "vorschuss", label: "Vorschuss", sign: -1 },
  { key: "abzug", label: "Abzug", sign: -1 },
  { key: "sonstiges", label: "Sonstiges", sign: 1 },
] as const;

export function eintragTyp(key: string) {
  return EINTRAG_TYPEN.find((t) => t.key === key) ?? { key, label: key, sign: 1 as const };
}

export const NOTIZ_TYPEN = [
  { key: "positiv", label: "Positive Notiz", tone: "success" },
  { key: "negativ", label: "Negative Notiz", tone: "destructive" },
  { key: "bonus_empfehlung", label: "Bonus-Empfehlung", tone: "primary" },
  { key: "abzug_grund", label: "Abzugsgrund", tone: "warning" },
  { key: "kommentar", label: "Interner Kommentar", tone: "muted" },
] as const;

export function notizTyp(key: string) {
  return NOTIZ_TYPEN.find((t) => t.key === key) ?? { key, label: key, tone: "muted" as const };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export const verguetungBaseQuery = (mitarbeiterId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["verguetung_base", mitarbeiterId],
    enabled,
    queryFn: async (): Promise<VerguetungBase | null> => {
      const { data, error } = await supabase
        .from("mitarbeiter_verguetung")
        .select("*")
        .eq("mitarbeiter_id", mitarbeiterId)
        .maybeSingle();
      if (error) throw error;
      return (data as VerguetungBase) ?? null;
    },
  });

export const verguetungEintraegeQuery = (mitarbeiterId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["verguetung_eintraege", mitarbeiterId],
    enabled,
    queryFn: async (): Promise<VerguetungEintrag[]> => {
      const { data, error } = await supabase
        .from("mitarbeiter_verguetung_eintraege")
        .select("*")
        .eq("mitarbeiter_id", mitarbeiterId)
        .order("datum", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VerguetungEintrag[];
    },
  });

export const leistungsnotizenQuery = (mitarbeiterId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["leistungsnotizen", mitarbeiterId],
    enabled,
    queryFn: async (): Promise<Leistungsnotiz[]> => {
      const { data, error } = await supabase
        .from("mitarbeiter_leistungsnotizen")
        .select("*")
        .eq("mitarbeiter_id", mitarbeiterId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Leistungsnotiz[];
    },
  });

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export async function upsertVerguetungBase(
  mitarbeiterId: string,
  values: Partial<Omit<VerguetungBase, "id" | "mitarbeiter_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("mitarbeiter_verguetung")
    .upsert({ mitarbeiter_id: mitarbeiterId, ...values } as never, { onConflict: "mitarbeiter_id" });
  if (error) throw error;
}

export async function addVerguetungEintrag(
  entry: Pick<VerguetungEintrag, "mitarbeiter_id" | "typ" | "betrag" | "monat" | "datum" | "beschreibung">,
  userId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("mitarbeiter_verguetung_eintraege")
    .insert({ ...entry, created_by: userId } as never);
  if (error) throw error;
}

export async function deleteVerguetungEintrag(id: string): Promise<void> {
  const { error } = await supabase.from("mitarbeiter_verguetung_eintraege").delete().eq("id", id);
  if (error) throw error;
}

export async function addLeistungsnotiz(
  mitarbeiterId: string,
  typ: string,
  text: string,
  userId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("mitarbeiter_leistungsnotizen")
    .insert({ mitarbeiter_id: mitarbeiterId, typ, text, created_by: userId } as never);
  if (error) throw error;
}

/** Current month in YYYY-MM. */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monat: string): string {
  const [y, m] = monat.split("-").map(Number);
  if (!y || !m) return monat;
  return new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

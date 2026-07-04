import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Blocker / Sperrzeiten — worker absences and time blocks in the calendar.
// ---------------------------------------------------------------------------
export interface BlockerRow {
  id: string;
  mitarbeiter_id: string;
  titel: string;
  typ: string;
  grund: string | null;
  start_zeit: string;
  end_zeit: string;
  farbe: string;
  notiz: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  mitarbeiter?: {
    id: string;
    vorname: string;
    nachname: string;
    farbe: string;
  } | null;
}

export interface BlockerTyp {
  key: string;
  label: string;
  farbe: string;
  /** Whole-day absences that also block scheduling and count as "abwesend". */
  abwesenheit?: boolean;
}

/** Blocker/Sperrzeit types. Colors feed the calendar chips. */
export const BLOCKER_TYPEN: BlockerTyp[] = [
  { key: "privat", label: "Privat", farbe: "#ec4899" },
  { key: "pause", label: "Pause", farbe: "#64748b" },
  { key: "fahrzeit", label: "Fahrzeit", farbe: "#0ea5e9" },
  { key: "krank", label: "Krank", farbe: "#ef4444", abwesenheit: true },
  { key: "urlaub", label: "Urlaub", farbe: "#22c55e", abwesenheit: true },
  { key: "werkstatt", label: "Werkstatt", farbe: "#f59e0b" },
  { key: "nicht_verfuegbar", label: "Nicht verfügbar", farbe: "#71717a", abwesenheit: true },
];

export function blockerTyp(key: string): BlockerTyp {
  return BLOCKER_TYPEN.find((t) => t.key === key) ?? { key, label: key, farbe: "#64748b" };
}

const BLOCKER_SELECT =
  "*, mitarbeiter:mitarbeiter(id,vorname,nachname,farbe)";

export const blockerQuery = () =>
  queryOptions({
    queryKey: ["blocker"],
    queryFn: async (): Promise<BlockerRow[]> => {
      const { data, error } = await supabase
        .from("blocker")
        .select(BLOCKER_SELECT)
        .order("start_zeit", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BlockerRow[];
    },
  });

export interface BlockerInput {
  mitarbeiter_id: string;
  titel: string;
  typ: string;
  grund?: string | null;
  start_zeit: string;
  end_zeit: string;
  farbe: string;
  notiz?: string | null;
}

export async function createBlocker(input: BlockerInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("blocker").insert({
    ...input,
    created_by: userData.user?.id ?? null,
  });
  if (error) throw error;
}

export async function updateBlocker(id: string, patch: Partial<BlockerInput>): Promise<void> {
  const { error } = await supabase.from("blocker").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBlocker(id: string): Promise<void> {
  const { error } = await supabase.from("blocker").delete().eq("id", id);
  if (error) throw error;
}

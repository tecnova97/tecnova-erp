import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/datetime";

/**
 * Build a completion entry block that gets appended to an Auftrag's
 * Beschreibung when a worker completes an order and enters completion text.
 *
 * Format:
 *   [05.07.2026 16:42 · Abdul Kader Salmo]
 *   <entered text>
 */
export function buildCompletionEntry(text: string, employeeName: string, when: Date = new Date()): string {
  const stamp = formatDateTime(when);
  const emp = employeeName.trim() || "Mitarbeiter";
  return `[${stamp} · ${emp}]\n${text.trim()}`;
}

/**
 * Append a completion entry below the existing Beschreibung without
 * overwriting it. Returns the combined value.
 */
export function combineBeschreibung(existing: string | null | undefined, entry: string): string {
  const base = (existing ?? "").trim();
  return base ? `${base}\n\n${entry}` : entry;
}

/**
 * Persist the completion text to the Auftrag Beschreibung, appending a
 * timestamped, attributed entry below the current description.
 * No-op when there is no text to append.
 */
export async function appendCompletionToBeschreibung(params: {
  auftragId: string;
  text: string;
  employeeName: string;
  existingBeschreibung: string | null | undefined;
  when?: Date;
}): Promise<void> {
  const text = params.text?.trim();
  if (!text) return;
  const entry = buildCompletionEntry(text, params.employeeName, params.when);
  const next = combineBeschreibung(params.existingBeschreibung, entry);
  const { error } = await supabase
    .from("auftraege")
    .update({ beschreibung: next } as never)
    .eq("id", params.auftragId);
  if (error) throw error;
}

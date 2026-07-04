import { supabase } from "@/integrations/supabase/client";
import { addMinutes, areIntervalsOverlapping, parseISO } from "date-fns";
import type { AuftragRow } from "@/lib/queries";
import { type BlockerRow, blockerTyp } from "@/lib/blocker";

// ---------------------------------------------------------------------------
// Scheduling — Kalender only schedules EXISTING Aufträge. New Aufträge are
// created exclusively from the Aufträge page or the Import Center.
// ---------------------------------------------------------------------------

/** Default appointment length in minutes when none is set yet. */
export const DEFAULT_TERMIN_MINUTES = 120;

export function auftragInterval(a: AuftragRow): { start: Date; end: Date } | null {
  if (!a.termin_start) return null;
  const start = parseISO(a.termin_start);
  const end = a.termin_ende
    ? parseISO(a.termin_ende)
    : addMinutes(start, DEFAULT_TERMIN_MINUTES);
  return { start, end };
}

export function blockerInterval(b: BlockerRow): { start: Date; end: Date } {
  return { start: parseISO(b.start_zeit), end: parseISO(b.end_zeit) };
}

export function auftragMitarbeiterIds(a: AuftragRow): string[] {
  return (a.zuweisungen ?? [])
    .map((z) => z.mitarbeiter?.id)
    .filter((id): id is string => Boolean(id));
}

export interface Conflict {
  kind: "auftrag" | "blocker" | "abwesenheit";
  message: string;
}

/**
 * Detect scheduling conflicts for a worker in a given interval, ignoring the
 * order currently being moved (ignoreAuftragId).
 */
export function detectConflicts(params: {
  mitarbeiterId: string;
  start: Date;
  end: Date;
  auftraege: AuftragRow[];
  blocker: BlockerRow[];
  ignoreAuftragId?: string;
}): Conflict[] {
  const { mitarbeiterId, start, end, auftraege, blocker, ignoreAuftragId } = params;
  const conflicts: Conflict[] = [];
  const interval = { start, end };

  for (const a of auftraege) {
    if (a.id === ignoreAuftragId) continue;
    if (!auftragMitarbeiterIds(a).includes(mitarbeiterId)) continue;
    const iv = auftragInterval(a);
    if (!iv) continue;
    if (areIntervalsOverlapping(interval, iv, { inclusive: false })) {
      conflicts.push({
        kind: "auftrag",
        message: `Überschneidung mit „${a.titel}“ (${a.auftragsnummer}).`,
      });
    }
  }

  for (const b of blocker) {
    if (b.mitarbeiter_id !== mitarbeiterId) continue;
    const iv = blockerInterval(b);
    if (areIntervalsOverlapping(interval, iv, { inclusive: false })) {
      const t = blockerTyp(b.typ);
      conflicts.push({
        kind: t.abwesenheit ? "abwesenheit" : "blocker",
        message: t.abwesenheit
          ? `Mitarbeiter ist an diesem Tag „${t.label}“.`
          : `Überschneidung mit Blocker „${b.titel}“ (${t.label}).`,
      });
    }
  }

  return conflicts;
}

/** Update the appointment window of an existing Auftrag. */
export async function scheduleAuftrag(
  auftragId: string,
  startISO: string,
  endISO: string,
): Promise<void> {
  const { error } = await supabase
    .from("auftraege")
    .update({ termin_start: startISO, termin_ende: endISO })
    .eq("id", auftragId);
  if (error) throw error;
}

/**
 * Assign an Auftrag to a worker (idempotent) and optionally move it to a new
 * time window. Used by drag & drop and the "Auftrag einplanen" dialog.
 */
export async function assignAndSchedule(params: {
  auftragId: string;
  mitarbeiterId: string;
  startISO?: string;
  endISO?: string;
  replaceAssignment?: boolean;
}): Promise<void> {
  const { auftragId, mitarbeiterId, startISO, endISO, replaceAssignment } = params;

  if (startISO && endISO) {
    await scheduleAuftrag(auftragId, startISO, endISO);
  }

  if (replaceAssignment) {
    const { error: delErr } = await supabase
      .from("auftrag_mitarbeiter")
      .delete()
      .eq("auftrag_id", auftragId);
    if (delErr) throw delErr;
  }

  // Idempotent insert of the assignment.
  const { data: existing } = await supabase
    .from("auftrag_mitarbeiter")
    .select("id")
    .eq("auftrag_id", auftragId)
    .eq("mitarbeiter_id", mitarbeiterId)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("auftrag_mitarbeiter")
      .insert({ auftrag_id: auftragId, mitarbeiter_id: mitarbeiterId });
    if (error) throw error;
  }
}

/** Move a blocker to a new worker lane and/or time window. */
export async function updateBlockerTime(
  blockerId: string,
  mitarbeiterId: string,
  startISO: string,
  endISO: string,
): Promise<void> {
  const { error } = await supabase
    .from("blocker")
    .update({ mitarbeiter_id: mitarbeiterId, start_zeit: startISO, end_zeit: endISO })
    .eq("id", blockerId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Time grid — used by the Tagesplanung board.
// ---------------------------------------------------------------------------
export interface TimeGrid {
  startHour: number;
  endHour: number;
  slotMinutes: number;
  pxPerMinute: number;
}

export const DAY_GRID: TimeGrid = {
  startHour: 6,
  endHour: 20,
  slotMinutes: 30,
  pxPerMinute: 1.1,
};

/** Vertical offset (px) of a time within the grid. */
export function minutesFromGridStart(date: Date, grid: TimeGrid): number {
  return (date.getHours() - grid.startHour) * 60 + date.getMinutes();
}

/** Snap a minute value to the nearest slot. */
export function snapMinutes(minutes: number, grid: TimeGrid): number {
  return Math.round(minutes / grid.slotMinutes) * grid.slotMinutes;
}

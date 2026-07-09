import { addMinutes, parseISO } from "date-fns";
import type { AuftragRow } from "@/lib/queries";

// ---------------------------------------------------------------------------
// Disposition calendar — time grid + overlap layout.
// ---------------------------------------------------------------------------

/** Default appointment length (minutes) when an Auftrag has no Termin Ende. */
export const DEFAULT_DURATION_MIN = 60;

export interface TimeGrid {
  startHour: number;
  endHour: number;
  /** Snap increment in minutes for drag/resize. */
  snapMinutes: number;
  /** Vertical pixels per minute. */
  pxPerMinute: number;
}

export const CAL_GRID: TimeGrid = {
  startHour: 6,
  endHour: 20,
  snapMinutes: 15,
  pxPerMinute: 0.95,
};

export function gridHeight(grid: TimeGrid): number {
  return (grid.endHour - grid.startHour) * 60 * grid.pxPerMinute;
}

export function gridHours(grid: TimeGrid): number[] {
  return Array.from({ length: grid.endHour - grid.startHour + 1 }, (_, i) => grid.startHour + i);
}

/** Resolve start/end of an Auftrag appointment (end falls back to default). */
export function auftragTimes(a: AuftragRow): { start: Date; end: Date } | null {
  if (!a.termin_start) return null;
  const start = parseISO(a.termin_start);
  const end = a.termin_ende ? parseISO(a.termin_ende) : addMinutes(start, DEFAULT_DURATION_MIN);
  return { start: start, end: end.getTime() > start.getTime() ? end : addMinutes(start, DEFAULT_DURATION_MIN) };
}

/** Vertical offset (px) of a time within the grid, clamped to the visible day. */
export function topFor(date: Date, grid: TimeGrid): number {
  const minutes = (date.getHours() - grid.startHour) * 60 + date.getMinutes();
  const clamped = Math.max(0, Math.min(minutes, (grid.endHour - grid.startHour) * 60));
  return clamped * grid.pxPerMinute;
}

/** Height (px) for an interval, clamped so it never exceeds the visible grid. */
export function heightFor(start: Date, end: Date, grid: TimeGrid): number {
  const top = topFor(start, grid);
  const bottom = topFor(end, grid);
  return Math.max(18, bottom - top);
}

/** Snap a minute value to the grid increment. */
export function snap(minutes: number, grid: TimeGrid): number {
  return Math.round(minutes / grid.snapMinutes) * grid.snapMinutes;
}

export interface PositionedEvent {
  item: AuftragRow;
  start: Date;
  end: Date;
  col: number;
  cols: number;
  groupId: number;
}

/**
 * Column-packing overlap layout (interval graph greedy coloring). Events that
 * share time are placed in adjacent columns so nothing overlaps unreadably.
 */
export function packOverlaps(events: AuftragRow[]): PositionedEvent[] {
  const items = events
    .map((item) => {
      const t = auftragTimes(item);
      return t ? { item, start: t.start, end: t.end } : null;
    })
    .filter((v): v is { item: AuftragRow; start: Date; end: Date } => v !== null)
    .sort(
      (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
    );

  const result: PositionedEvent[] = [];
  let group: typeof items = [];
  let groupEnd = -Infinity;
  let groupId = 0;

  const flush = () => {
    if (!group.length) return;
    const columns: number[] = []; // column -> end time (ms)
    const placed: { ev: (typeof group)[number]; col: number }[] = [];
    for (const ev of group) {
      let col = columns.findIndex((endMs) => ev.start.getTime() >= endMs);
      if (col === -1) {
        columns.push(ev.end.getTime());
        col = columns.length - 1;
      } else {
        columns[col] = ev.end.getTime();
      }
      placed.push({ ev, col });
    }
    const cols = columns.length;
    for (const p of placed) {
      result.push({
        item: p.ev.item,
        start: p.ev.start,
        end: p.ev.end,
        col: p.col,
        cols,
        groupId,
      });
    }
    group = [];
    groupId += 1;
  };

  for (const ev of items) {
    if (group.length && ev.start.getTime() >= groupEnd) {
      flush();
      groupEnd = -Infinity;
    }
    group.push(ev);
    groupEnd = Math.max(groupEnd, ev.end.getTime());
  }
  flush();
  return result;
}

/** Max side-by-side columns before extra events collapse into an overflow tile. */
export const MAX_VISIBLE_COLS = 3;

export interface LaidOutEvent extends PositionedEvent {
  /** Left offset as a fraction 0..1 of the lane width. */
  left: number;
  /** Width as a fraction 0..1 of the lane width. */
  width: number;
}

export interface OverflowTile {
  groupId: number;
  left: number;
  width: number;
  start: Date;
  end: Date;
  items: PositionedEvent[];
}

/**
 * Turn packed events into rendered geometry with an overflow bucket per group
 * when more than MAX_VISIBLE_COLS events run concurrently.
 */
export function layoutEvents(events: AuftragRow[]): {
  visible: LaidOutEvent[];
  overflow: OverflowTile[];
} {
  const packed = packOverlaps(events);
  const visible: LaidOutEvent[] = [];
  const overflowByGroup = new Map<number, PositionedEvent[]>();

  for (const ev of packed) {
    const cols = ev.cols;
    if (cols <= MAX_VISIBLE_COLS) {
      visible.push({ ...ev, left: ev.col / cols, width: 1 / cols });
      continue;
    }
    // Reserve the last visible column for the overflow tile.
    const usable = MAX_VISIBLE_COLS - 1;
    if (ev.col < usable) {
      visible.push({ ...ev, left: ev.col / MAX_VISIBLE_COLS, width: 1 / MAX_VISIBLE_COLS });
    } else {
      const list = overflowByGroup.get(ev.groupId) ?? [];
      list.push(ev);
      overflowByGroup.set(ev.groupId, list);
    }
  }

  const overflow: OverflowTile[] = [];
  for (const [groupId, list] of overflowByGroup) {
    const start = new Date(Math.min(...list.map((e) => e.start.getTime())));
    const end = new Date(Math.max(...list.map((e) => e.end.getTime())));
    overflow.push({
      groupId,
      left: (MAX_VISIBLE_COLS - 1) / MAX_VISIBLE_COLS,
      width: 1 / MAX_VISIBLE_COLS,
      start,
      end,
      items: list,
    });
  }

  return { visible, overflow };
}

/** Assigned Mitarbeiter ids for an Auftrag. */
export function assignedIds(a: AuftragRow): string[] {
  return (a.zuweisungen ?? [])
    .map((z) => z.mitarbeiter?.id)
    .filter((id): id is string => Boolean(id));
}

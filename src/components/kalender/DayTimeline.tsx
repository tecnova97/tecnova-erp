import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addMinutes, isSameDay } from "date-fns";
import { formatDe } from "@/lib/datetime";

import type { AuftragRow } from "@/lib/queries";
import { scheduleAuftrag } from "@/lib/disposition";
import {
  CAL_GRID,
  type TimeGrid,
  gridHeight,
  gridHours,
  topFor,
  heightFor,
  snap,
  auftragTimes,
  layoutEvents,
  type LaidOutEvent,
  type OverflowTile,
} from "@/lib/kalender-layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type GetStatus,
  auftraggeberName,
  auftragAddress,
  MitarbeiterDots,
  ContactIcons,
  StatusBadge,
  OpenLink,
} from "@/components/kalender/parts";

interface PendingMove {
  auftrag: AuftragRow;
  start: Date;
  end: Date;
}

export function DayTimeline({
  day,
  auftraege,
  get,
  canMove,
  canCreate,
  fotoIds,
  onOpen,
  onCreate,
  grid = CAL_GRID,
}: {
  day: Date;
  auftraege: AuftragRow[];
  get: GetStatus;
  canMove: boolean;
  canCreate: boolean;
  fotoIds: Set<string>;
  onOpen: (id: string) => void;
  onCreate: (start: Date) => void;
  grid?: TimeGrid;
}) {
  const qc = useQueryClient();
  const laneRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);

  const dayEvents = useMemo(
    () =>
      auftraege.filter((a) => {
        const t = auftragTimes(a);
        return t && isSameDay(t.start, day);
      }),
    [auftraege, day],
  );

  const { visible, overflow } = useMemo(() => layoutEvents(dayEvents), [dayEvents]);

  const height = gridHeight(grid);
  const hours = gridHours(grid);
  const now = new Date();
  const showNow = isSameDay(now, day) && now.getHours() >= grid.startHour && now.getHours() < grid.endHour;

  const commit = async (auftrag: AuftragRow, start: Date, end: Date) => {
    try {
      await scheduleAuftrag(auftrag.id, start.toISOString(), end.toISOString());
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["auftraege"] }),
        qc.invalidateQueries({ queryKey: ["auftrag", auftrag.id] }),
      ]);
      toast.success("Termin geändert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Änderung fehlgeschlagen");
    }
  };

  const handleDblClick = (e: React.MouseEvent) => {
    if (!canCreate || !laneRef.current) return;
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = laneRef.current.getBoundingClientRect();
    const minutes = snap(Math.max(0, (e.clientY - rect.top) / grid.pxPerMinute), grid);
    const d = new Date(day);
    d.setHours(grid.startHour, 0, 0, 0);
    onCreate(addMinutes(d, minutes));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex overflow-x-auto">
        <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-border bg-card">
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute -translate-y-1/2 pl-2 text-[11px] font-semibold text-muted-foreground"
                style={{ top: (h - grid.startHour) * 60 * grid.pxPerMinute }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        <div
          ref={laneRef}
          onDoubleClick={handleDblClick}
          className="relative flex-1"
          style={{ height, minWidth: 320 }}
        >
          {hours.map((h) => (
            <div
              key={h}
              className="pointer-events-none absolute inset-x-0 border-t border-border/60"
              style={{ top: (h - grid.startHour) * 60 * grid.pxPerMinute }}
            />
          ))}

          {showNow && (
            <div
              className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
              style={{ top: topFor(now, grid) }}
            >
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span className="h-px flex-1 bg-destructive" />
            </div>
          )}

          {visible.map((ev) => (
            <EventBlock
              key={ev.item.id}
              ev={ev}
              get={get}
              grid={grid}
              canMove={canMove}
              hasFotos={fotoIds.has(ev.item.id)}
              onOpen={onOpen}
              onRequestMove={(start, end) => setPending({ auftrag: ev.item, start, end })}
            />
          ))}

          {overflow.map((tile) => (
            <OverflowBlock key={tile.groupId} tile={tile} grid={grid} get={get} onOpen={onOpen} />
          ))}

          {dayEvents.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <p className="text-sm text-muted-foreground">
                Keine Termine{canCreate ? " · Doppelklick zum Anlegen" : ""}.
              </p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termin ändern?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && (
                <>
                  „{pending.auftrag.titel}“ auf{" "}
                  <strong>
                    {formatDe(pending.start, "EEE dd.MM. HH:mm")}–{formatDe(pending.end, "HH:mm")}
                  </strong>{" "}
                  verschieben.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const p = pending;
                setPending(null);
                if (p) await commit(p.auftrag, p.start, p.end);
              }}
            >
              Termin ändern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EventBlock({
  ev,
  get,
  grid,
  canMove,
  hasFotos,
  onOpen,
  onRequestMove,
}: {
  ev: LaidOutEvent;
  get: GetStatus;
  grid: TimeGrid;
  canMove: boolean;
  hasFotos: boolean;
  onOpen: (id: string) => void;
  onRequestMove: (start: Date, end: Date) => void;
}) {
  const s = get(ev.item.status);
  const baseTop = topFor(ev.start, grid);
  const baseHeight = heightFor(ev.start, ev.end, grid);
  const [drag, setDrag] = useState<{ dy: number; dh: number } | null>(null);
  const moving = useRef(false);

  const startInteraction = (mode: "move" | "resize", e: React.PointerEvent) => {
    if (!canMove) return;
    e.stopPropagation();
    e.preventDefault();
    moving.current = true;
    const startY = e.clientY;
    const onMove = (mv: PointerEvent) => {
      const delta = mv.clientY - startY;
      setDrag(mode === "move" ? { dy: delta, dh: 0 } : { dy: 0, dh: delta });
    };
    const onUp = (up: PointerEvent) => {
      moving.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const delta = up.clientY - startY;
      setDrag(null);
      if (Math.abs(delta) < 4) return;
      const deltaMin = snap(delta / grid.pxPerMinute, grid);
      if (deltaMin === 0) return;
      if (mode === "move") {
        onRequestMove(addMinutes(ev.start, deltaMin), addMinutes(ev.end, deltaMin));
      } else {
        const newEnd = addMinutes(ev.end, deltaMin);
        if (newEnd.getTime() - ev.start.getTime() >= grid.snapMinutes * 60000) {
          onRequestMove(ev.start, newEnd);
        }
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const top = baseTop + (drag?.dy ?? 0);
  const boxHeight = Math.max(18, baseHeight + (drag?.dh ?? 0));
  const compact = boxHeight < 46;

  return (
    <div
      data-event
      className="absolute overflow-hidden rounded-lg border-l-[3px] bg-card px-1.5 py-1 shadow-sm"
      style={{
        top,
        height: boxHeight,
        left: `calc(${ev.left * 100}% + 2px)`,
        width: `calc(${ev.width * 100}% - 4px)`,
        borderColor: s.farbe,
        backgroundColor: `color-mix(in oklab, ${s.farbe} 12%, var(--card))`,
        zIndex: drag ? 40 : 10,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!moving.current) onOpen(ev.item.id);
      }}
    >
      <div
        className={canMove ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
        onPointerDown={(e) => startInteraction("move", e)}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-bold" style={{ color: s.farbe }}>
            {formatDe(ev.start, "HH:mm")}
          </span>
          <MitarbeiterDots a={ev.item} max={compact ? 2 : 3} />
        </div>
        {!compact && (
          <>
            <p className="truncate text-xs font-semibold leading-tight text-foreground">
              {ev.item.titel}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {auftraggeberName(ev.item)}
            </p>
            {boxHeight > 78 && (
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {auftragAddress(ev.item)}
              </p>
            )}
            {boxHeight > 96 && (
              <div className="mt-1 flex items-center gap-1.5">
                <StatusBadge get={get} statusKey={ev.item.status} />
                <ContactIcons a={ev.item} hasFotos={hasFotos} />
                <OpenLink id={ev.item.id} className="ml-auto" />
              </div>
            )}
          </>
        )}
      </div>

      {canMove && !compact && (
        <div
          onPointerDown={(e) => startInteraction("resize", e)}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          title="Dauer anpassen"
        >
          <div className="mx-auto h-0.5 w-6 rounded-full bg-foreground/25" />
        </div>
      )}
    </div>
  );
}

function OverflowBlock({
  tile,
  grid,
  get,
  onOpen,
}: {
  tile: OverflowTile;
  grid: TimeGrid;
  get: GetStatus;
  onOpen: (id: string) => void;
}) {
  const top = topFor(tile.start, grid);
  const height = heightFor(tile.start, tile.end, grid);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-event
          className="absolute grid place-items-center rounded-lg border border-dashed border-border bg-muted/60 text-xs font-bold text-muted-foreground hover:bg-muted"
          style={{
            top,
            height,
            left: `calc(${tile.left * 100}% + 2px)`,
            width: `calc(${tile.width * 100}% - 4px)`,
            zIndex: 15,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          +{tile.items.length} weitere
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <p className="px-1 pb-1 text-xs font-bold text-muted-foreground">
          {formatDe(tile.start, "HH:mm")}–{formatDe(tile.end, "HH:mm")}
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {tile.items.map((ev) => {
            const s = get(ev.item.status);
            return (
              <button
                key={ev.item.id}
                onClick={() => onOpen(ev.item.id)}
                className="flex w-full items-start gap-2 rounded-md border border-border p-2 text-left hover:bg-muted"
              >
                <span className="mt-0.5 h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.farbe }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {formatDe(ev.start, "HH:mm")} · {ev.item.titel}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {auftraggeberName(ev.item)}
                  </p>
                </div>
                <StatusBadge get={get} statusKey={ev.item.status} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

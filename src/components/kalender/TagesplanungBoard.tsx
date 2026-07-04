import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addMinutes, format, isSameDay, parseISO } from "date-fns";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Phone, Navigation as NavIcon, ExternalLink, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { AuftragRow } from "@/lib/queries";
import type { BlockerRow } from "@/lib/blocker";
import { blockerTyp } from "@/lib/blocker";
import { useStatuses } from "@/lib/status";
import {
  DAY_GRID,
  auftragInterval,
  auftragMitarbeiterIds,
  assignAndSchedule,
  scheduleAuftrag,
  detectConflicts,
  minutesFromGridStart,
  snapMinutes,
  updateBlockerTime,
  type Conflict,
} from "@/lib/disposition";
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

interface Mitarbeiter {
  id: string;
  vorname: string;
  nachname: string;
  farbe: string;
  telefon?: string | null;
}

interface PendingMove {
  run: () => Promise<void>;
  conflicts: Conflict[];
}

const GRID = DAY_GRID;
const HOURS = Array.from({ length: GRID.endHour - GRID.startHour + 1 }, (_, i) => GRID.startHour + i);
const GRID_HEIGHT = (GRID.endHour - GRID.startHour) * 60 * GRID.pxPerMinute;

export function TagesplanungBoard({
  day,
  mitarbeiter,
  auftraege,
  blocker,
  canMove,
  onSlotClick,
  onBlockerClick,
}: {
  day: Date;
  mitarbeiter: Mitarbeiter[];
  auftraege: AuftragRow[];
  blocker: BlockerRow[];
  canMove: boolean;
  onSlotClick: (mitarbeiterId: string, start: Date) => void;
  onBlockerClick: (b: BlockerRow) => void;
}) {
  const qc = useQueryClient();
  const { get } = useStatuses();
  const [pending, setPending] = useState<PendingMove | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const dayAuftraege = useMemo(
    () => auftraege.filter((a) => a.termin_start && isSameDay(parseISO(a.termin_start), day)),
    [auftraege, day],
  );
  const dayBlocker = useMemo(
    () => blocker.filter((b) => isSameDay(parseISO(b.start_zeit), day)),
    [blocker, day],
  );

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["auftraege"] }),
      qc.invalidateQueries({ queryKey: ["blocker"] }),
    ]);

  const applyOrConfirm = async (conflicts: Conflict[], run: () => Promise<void>) => {
    if (conflicts.length > 0) {
      setPending({ conflicts, run });
      return;
    }
    await run();
  };

  const onDragEnd = async (e: DragEndEvent) => {
    if (!canMove) return;
    const over = e.over;
    if (!over) return;
    const laneId = String(over.id).replace("lane:", "");
    const deltaMin = snapMinutes(Math.round(e.delta.y / GRID.pxPerMinute), GRID);
    const data = e.active.data.current as
      | { type: "auftrag"; auftrag: AuftragRow; fromLane: string }
      | { type: "blocker"; blocker: BlockerRow }
      | undefined;
    if (!data) return;

    if (data.type === "auftrag") {
      const a = data.auftrag;
      const iv = auftragInterval(a);
      if (!iv) return;
      const newStart = addMinutes(iv.start, deltaMin);
      const newEnd = addMinutes(iv.end, deltaMin);
      const laneChanged = laneId !== data.fromLane;
      if (!laneChanged && deltaMin === 0) return;
      const conflicts = detectConflicts({
        mitarbeiterId: laneId,
        start: newStart,
        end: newEnd,
        auftraege,
        blocker,
        ignoreAuftragId: a.id,
      });
      await applyOrConfirm(conflicts, async () => {
        if (laneChanged) {
          await assignAndSchedule({
            auftragId: a.id,
            mitarbeiterId: laneId,
            startISO: newStart.toISOString(),
            endISO: newEnd.toISOString(),
            replaceAssignment: true,
          });
        } else {
          await scheduleAuftrag(a.id, newStart.toISOString(), newEnd.toISOString());
        }
        await invalidate();
        toast.success("Gespeichert");
      });
    } else if (data.type === "blocker") {
      const b = data.blocker;
      const start = parseISO(b.start_zeit);
      const end = parseISO(b.end_zeit);
      if (deltaMin === 0 && laneId === b.mitarbeiter_id) return;
      const newStart = addMinutes(start, deltaMin);
      const newEnd = addMinutes(end, deltaMin);
      await applyOrConfirm([], async () => {
        await updateBlockerTime(b.id, laneId, newStart.toISOString(), newEnd.toISOString());
        await invalidate();
        toast.success("Gespeichert");
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex overflow-x-auto">
          {/* Time gutter */}
          <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-border bg-card">
            <div className="h-10 border-b border-border" />
            <div className="relative" style={{ height: GRID_HEIGHT }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute -translate-y-1/2 pl-2 text-[11px] font-semibold text-muted-foreground"
                  style={{ top: (h - GRID.startHour) * 60 * GRID.pxPerMinute }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
          </div>

          {/* Worker lanes */}
          {mitarbeiter.map((m) => (
            <Lane
              key={m.id}
              m={m}
              day={day}
              auftraege={dayAuftraege.filter((a) => auftragMitarbeiterIds(a).includes(m.id))}
              blocker={dayBlocker.filter((b) => b.mitarbeiter_id === m.id)}
              get={get}
              canMove={canMove}
              onSlotClick={onSlotClick}
              onBlockerClick={onBlockerClick}
              invalidate={invalidate}
            />
          ))}

          {mitarbeiter.length === 0 && (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
              Keine Mitarbeiter sichtbar.
            </div>
          )}
        </div>
      </DndContext>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminkonflikt</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1">
                <p>Beim Verschieben wurden Konflikte erkannt:</p>
                <ul className="ml-4 list-disc text-warning">
                  {pending?.conflicts.map((c, i) => <li key={i}>{c.message}</li>)}
                </ul>
                <p>Trotzdem speichern?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const p = pending;
                setPending(null);
                if (p) await p.run();
              }}
            >
              Trotzdem speichern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type GetStatus = ReturnType<typeof useStatuses>["get"];

function Lane({
  m,
  day,
  auftraege,
  blocker,
  get,
  canMove,
  onSlotClick,
  onBlockerClick,
  invalidate,
}: {
  m: Mitarbeiter;
  day: Date;
  auftraege: AuftragRow[];
  blocker: BlockerRow[];
  get: GetStatus;
  canMove: boolean;
  onSlotClick: (mitarbeiterId: string, start: Date) => void;
  onBlockerClick: (b: BlockerRow) => void;
  invalidate: () => Promise<unknown>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane:${m.id}` });
  const laneRef = useRef<HTMLDivElement>(null);

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (!laneRef.current) return;
    const rect = laneRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = snapMinutes(Math.max(0, Math.round(y / GRID.pxPerMinute)), GRID);
    const d = new Date(day);
    d.setHours(GRID.startHour, 0, 0, 0);
    onSlotClick(m.id, addMinutes(d, minutes));
  };

  return (
    <div className="w-52 shrink-0 border-r border-border last:border-r-0">
      <div className="flex h-10 items-center gap-2 border-b border-border bg-muted/40 px-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: m.farbe }}
        />
        <span className="truncate text-sm font-bold">
          {m.vorname} {m.nachname}
        </span>
      </div>
      <div
        ref={(node) => {
          setNodeRef(node);
          laneRef.current = node;
        }}
        onClick={handleBackgroundClick}
        className={`relative ${isOver ? "bg-primary/5" : ""}`}
        style={{ height: GRID_HEIGHT }}
      >
        {/* hour lines */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="pointer-events-none absolute left-0 right-0 border-t border-border/60"
            style={{ top: (h - GRID.startHour) * 60 * GRID.pxPerMinute }}
          />
        ))}

        {blocker.map((b) => (
          <BlockerChip key={b.id} b={b} canMove={canMove} onClick={() => onBlockerClick(b)} />
        ))}
        {auftraege.map((a) => (
          <AuftragChip
            key={a.id}
            a={a}
            fromLane={m.id}
            get={get}
            canMove={canMove}
            invalidate={invalidate}
          />
        ))}
      </div>
    </div>
  );
}

function chipGeometry(start: Date, end: Date) {
  const top = minutesFromGridStart(start, GRID) * GRID.pxPerMinute;
  const height = Math.max(24, ((end.getTime() - start.getTime()) / 60000) * GRID.pxPerMinute);
  return { top, height };
}

function BlockerChip({
  b,
  canMove,
  onClick,
}: {
  b: BlockerRow;
  canMove: boolean;
  onClick: () => void;
}) {
  const start = parseISO(b.start_zeit);
  const end = parseISO(b.end_zeit);
  const { top, height } = chipGeometry(start, end);
  const t = blockerTyp(b.typ);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `blocker:${b.id}`,
    data: { type: "blocker", blocker: b },
    disabled: !canMove,
  });
  const style: React.CSSProperties = {
    top,
    height,
    backgroundColor: `${b.farbe}26`,
    borderColor: b.farbe,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 40 : 5,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute left-1 right-1 cursor-pointer overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-[11px]"
    >
      <p className="truncate font-bold" style={{ color: b.farbe }}>
        {t.label}
      </p>
      <p className="truncate text-muted-foreground">
        {format(start, "HH:mm")}–{format(end, "HH:mm")} · {b.titel}
      </p>
    </div>
  );
}

function AuftragChip({
  a,
  fromLane,
  get,
  canMove,
  invalidate,
}: {
  a: AuftragRow;
  fromLane: string;
  get: GetStatus;
  canMove: boolean;
  invalidate: () => Promise<unknown>;
}) {
  const iv = auftragInterval(a)!;
  const { top, height } = chipGeometry(iv.start, iv.end);
  const s = get(a.status);
  const workers = auftragMitarbeiterIds(a).length;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `auftrag:${a.id}`,
    data: { type: "auftrag", auftrag: a, fromLane },
    disabled: !canMove,
  });

  const [resizeH, setResizeH] = useState<number | null>(null);
  const resizing = useRef(false);

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = true;
    const startY = e.clientY;
    const baseH = height;
    const onMove = (ev: PointerEvent) => {
      if (!resizing.current) return;
      setResizeH(Math.max(24, baseH + (ev.clientY - startY)));
    };
    const onUp = async (ev: PointerEvent) => {
      resizing.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const newH = Math.max(24, baseH + (ev.clientY - startY));
      setResizeH(null);
      const minutes = snapMinutes(Math.round(newH / GRID.pxPerMinute), GRID);
      const newEnd = addMinutes(iv.start, Math.max(GRID.slotMinutes, minutes));
      if (newEnd.getTime() !== iv.end.getTime()) {
        await scheduleAuftrag(a.id, iv.start.toISOString(), newEnd.toISOString());
        await invalidate();
        toast.success("Gespeichert");
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const style: React.CSSProperties = {
    top,
    height: resizeH ?? height,
    backgroundColor: `${s.farbe}1a`,
    borderColor: s.farbe,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 40 : 10,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group absolute left-1 right-1 overflow-hidden rounded-md border-l-4 bg-card px-1.5 py-1 text-[11px] shadow-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div {...listeners} {...attributes} className={canMove ? "cursor-grab active:cursor-grabbing" : ""}>
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold" style={{ color: s.farbe }}>
            {format(iv.start, "HH:mm")}
          </span>
          {workers > 1 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" />
              {workers}
            </span>
          )}
        </div>
        <p className="truncate font-semibold text-foreground">{a.kunde_name ?? a.kunde?.name ?? a.titel}</p>
        <p className="truncate text-muted-foreground">
          {[a.strasse, a.hausnummer].filter(Boolean).join(" ")} {a.ort}
        </p>
      </div>

      <div className="mt-0.5 flex items-center gap-1.5">
        {(a.kunde_telefon || a.kunde?.telefon) && (
          <a
            href={`tel:${a.kunde_telefon ?? a.kunde?.telefon}`}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-primary"
            title="Anrufen"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
        {[a.strasse, a.ort].some(Boolean) && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              [a.strasse, a.hausnummer, a.plz, a.ort].filter(Boolean).join(" "),
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-primary"
            title="Navigation"
          >
            <NavIcon className="h-3.5 w-3.5" />
          </a>
        )}
        <Link
          to="/auftraege/$id"
          params={{ id: a.id }}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto text-muted-foreground hover:text-primary"
          title="Details öffnen"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {canMove && (
        <div
          onPointerDown={startResize}
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
          title="Dauer anpassen"
        >
          <div className="mx-auto h-0.5 w-6 rounded-full bg-foreground/30" />
        </div>
      )}
    </div>
  );
}

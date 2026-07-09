import { useMemo } from "react";
import { isSameDay } from "date-fns";
import { formatDe } from "@/lib/datetime";
import { AlertTriangle, UserX, Users } from "lucide-react";
import type { AuftragRow } from "@/lib/queries";
import type { BlockerRow } from "@/lib/blocker";
import { auftragTimes, assignedIds } from "@/lib/kalender-layout";
import { TagesplanungBoard } from "@/components/kalender/TagesplanungBoard";
import {
  type GetStatus,
  auftraggeberName,
  StatusBadge,
} from "@/components/kalender/parts";
import { cn } from "@/lib/utils";

interface Mitarbeiter {
  id: string;
  vorname: string;
  nachname: string;
  farbe: string;
  telefon?: string | null;
}

/** Day-scoped resource/disposition board: worker workload + unassigned queue. */
export function ResourcePlanung({
  day,
  mitarbeiter,
  auftraege,
  blocker,
  get,
  canMove,
  onSlotClick,
  onBlockerClick,
  onOpen,
}: {
  day: Date;
  mitarbeiter: Mitarbeiter[];
  auftraege: AuftragRow[];
  blocker: BlockerRow[];
  get: GetStatus;
  canMove: boolean;
  onSlotClick: (mitarbeiterId: string, start: Date) => void;
  onBlockerClick: (b: BlockerRow) => void;
  onOpen: (id: string) => void;
}) {
  const dayAuftraege = useMemo(
    () =>
      auftraege.filter((a) => {
        const t = auftragTimes(a);
        return t && isSameDay(t.start, day);
      }),
    [auftraege, day],
  );

  const unassigned = useMemo(
    () => dayAuftraege.filter((a) => assignedIds(a).length === 0),
    [dayAuftraege],
  );

  const workload = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of dayAuftraege) {
      for (const id of assignedIds(a)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [dayAuftraege]);

  return (
    <div className="space-y-3">
      {/* Workload summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {mitarbeiter.map((m) => {
          const n = workload.get(m.id) ?? 0;
          return (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5 shadow-soft"
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: m.farbe }}
              >
                {m.vorname?.[0]}
                {m.nachname?.[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">
                  {m.vorname} {m.nachname}
                </p>
                <p
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold",
                    n === 0 && "text-muted-foreground",
                    n >= 1 && n <= 4 && "text-success",
                    n > 4 && "text-warning",
                  )}
                >
                  {n === 0 ? (
                    <>frei</>
                  ) : (
                    <>
                      {n > 4 && <AlertTriangle className="h-3 w-3" />}
                      {n} {n === 1 ? "Auftrag" : "Aufträge"}
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })}
        {mitarbeiter.length === 0 && (
          <p className="col-span-full py-4 text-center text-sm text-muted-foreground">
            Keine Mitarbeiter sichtbar.
          </p>
        )}
      </div>

      {/* Unassigned queue */}
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-warning">
            <UserX className="h-4 w-4" /> Ohne Mitarbeiter ({unassigned.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((a) => (
              <button
                key={a.id}
                onClick={() => onOpen(a.id)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-left text-xs shadow-sm hover:border-primary/40"
              >
                <span className="font-bold">{formatDe(a.termin_start, "HH:mm")}</span>
                <span className="max-w-[10rem] truncate font-semibold">{a.titel}</span>
                <span className="max-w-[8rem] truncate text-muted-foreground">
                  {auftraggeberName(a)}
                </span>
                <StatusBadge get={get} statusKey={a.status} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        Mitarbeiter-Planung · {formatDe(day, "EEEE, dd.MM.yyyy")}
      </div>

      <TagesplanungBoard
        day={day}
        mitarbeiter={mitarbeiter}
        auftraege={auftraege}
        blocker={blocker}
        canMove={canMove}
        onSlotClick={onSlotClick}
        onBlockerClick={onBlockerClick}
      />
    </div>
  );
}

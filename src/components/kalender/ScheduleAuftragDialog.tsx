import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addMinutes } from "date-fns";
import { formatDe } from "@/lib/datetime";
import { Search, AlertTriangle } from "lucide-react";
import { auftraegeQuery, mitarbeiterQuery, type AuftragRow } from "@/lib/queries";
import { blockerQuery } from "@/lib/blocker";
import { useStatuses, statusStyle } from "@/lib/status";
import {
  assignAndSchedule,
  detectConflicts,
  DEFAULT_TERMIN_MINUTES,
} from "@/lib/disposition";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Schedule an EXISTING Auftrag into a worker's lane at a given time. Never
 * creates a new Auftrag — that only happens on the Aufträge page / Import.
 */
export function ScheduleAuftragDialog({
  open,
  onOpenChange,
  mitarbeiterId,
  start,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mitarbeiterId: string;
  start: Date;
}) {
  const qc = useQueryClient();
  const { get } = useStatuses();
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: blocker = [] } = useQuery(blockerQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const [q, setQ] = useState("");
  const [dauer, setDauer] = useState(DEFAULT_TERMIN_MINUTES);
  const [saving, setSaving] = useState(false);

  const worker = mitarbeiter.find((m: any) => m.id === mitarbeiterId);
  const end = addMinutes(start, dauer);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return auftraege
      .filter((a) => {
        if (!term) return true;
        return [a.titel, a.auftragsnummer, a.kunde_name, a.kunde?.name, a.ort]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      })
      .slice(0, 40);
  }, [auftraege, q]);

  const conflictsFor = (a: AuftragRow) =>
    detectConflicts({
      mitarbeiterId,
      start,
      end,
      auftraege,
      blocker,
      ignoreAuftragId: a.id,
    });

  const schedule = async (a: AuftragRow) => {
    setSaving(true);
    try {
      await assignAndSchedule({
        auftragId: a.id,
        mitarbeiterId,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["auftraege"] }),
        qc.invalidateQueries({ queryKey: ["auftrag", a.id] }),
      ]);
      toast.success("Gespeichert – Auftrag eingeplant");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Einplanen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Auftrag einplanen</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-semibold">
            {worker ? `${worker.vorname} ${worker.nachname}` : "Mitarbeiter"}
          </span>{" "}
          · {formatDe(start, "EEE dd.MM. HH:mm")}–{formatDe(end, "HH:mm")}
          <div className="mt-1.5 flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Dauer</label>
            <select
              value={dauer}
              onChange={(e) => setDauer(Number(e.target.value))}
              className="h-7 rounded border border-input bg-background px-1.5 text-xs"
            >
              {[30, 60, 90, 120, 180, 240, 480].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} Min` : `${m / 60} Std`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Auftrag suchen (Titel, Nr., Kunde, Ort)…"
            className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-2 text-sm"
          />
        </div>

        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Keine Aufträge gefunden.</p>
          )}
          {filtered.map((a) => {
            const s = get(a.status);
            const conflicts = conflictsFor(a);
            return (
              <button
                key={a.id}
                onClick={() => schedule(a)}
                disabled={saving}
                className="flex w-full items-start gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
              >
                <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.farbe }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.titel}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[a.auftragsnummer, a.kunde_name ?? a.kunde?.name, a.ort].filter(Boolean).join(" · ")}
                  </p>
                  {conflicts.length > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
                      <AlertTriangle className="h-3 w-3" /> {conflicts[0].message}
                    </p>
                  )}
                </div>
                <span className="badge-status shrink-0" style={statusStyle(s.farbe)}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

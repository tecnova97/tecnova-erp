import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { auftraegeQuery } from "@/lib/queries";
import { zahlungsereignisseQuery, zahlungUmsatzMapQuery } from "@/lib/zahlungen";
import { addEventsToGruppe } from "@/lib/abrechnung";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { fmtDate, fmtEuro } from "@/lib/erp";

export function AddEventsDialog({
  open,
  onOpenChange,
  gruppeId,
  existingEventIds,
  startOrder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gruppeId: string;
  existingEventIds: Set<string>;
  startOrder: number;
}) {
  const qc = useQueryClient();
  const { canAny } = useAuth();
  const canUmsatz = canAny([PERM.profitCard, PERM.profitDetail, PERM.umsatzView, PERM.gewinnView]);
  const { data: events = [] } = useQuery(zahlungsereignisseQuery());
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: umsatzMap = {} } = useQuery(zahlungUmsatzMapQuery(canUmsatz));

  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const auftragById = useMemo(() => {
    const m = new Map<string, (typeof auftraege)[number]>();
    for (const a of auftraege) m.set(a.id, a);
    return m;
  }, [auftraege]);

  const rows = useMemo(() => {
    return events
      .filter((e) => !existingEventIds.has(e.id))
      .filter((e) => {
        if (!q) return true;
        const a = auftragById.get(e.auftrag_id);
        return [a?.titel, a?.auftragsnummer, a?.kunde?.name, a?.projekt?.name, a?.nvt, e.status_label]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q.toLowerCase()));
      });
  }, [events, existingEventIds, q, auftragById]);

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = async () => {
    if (sel.size === 0) return;
    setSaving(true);
    try {
      await addEventsToGruppe(gruppeId, [...sel], startOrder);
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_events", gruppeId] });
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_event_links"] });
      toast.success(`${sel.size} Zahlungsereignis(se) zugeordnet`);
      setSel(new Set());
      onOpenChange(false);
    } catch (e) {
      toast.error("Zuordnung fehlgeschlagen", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Zahlungsereignisse zuordnen</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftrag, Auftraggeber, Projekt, NVT, Status…" className="pl-9" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Keine passenden Zahlungsereignisse.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((e) => {
                const a = auftragById.get(e.auftrag_id);
                return (
                  <li key={e.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                    <Checkbox checked={sel.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                    <button className="flex flex-1 items-center gap-3 text-left" onClick={() => toggle(e.id)}>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">#{e.nummer ?? "?"}</span>
                      <span className="flex-1">
                        <span className="font-medium">{a?.titel ?? "Auftrag entfernt"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {a?.kunde?.name ?? "–"} · {a?.projekt?.name ?? "kein Projekt"} · {fmtDate(e.datum)}
                        </span>
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: `${e.status_farbe}20`, color: e.status_farbe }}>
                        {e.status_label}
                      </span>
                      {canUmsatz && (
                        <span className="w-24 text-right text-sm font-semibold tabular-nums">
                          {fmtEuro(umsatzMap[e.id]?.umsatz ?? 0)}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <span className="mr-auto self-center text-sm text-muted-foreground">{sel.size} ausgewählt</span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving || sel.size === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Zuordnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

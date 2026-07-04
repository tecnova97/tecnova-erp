import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ListChecks, Loader2, Euro } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  auftragLeistungenQuery,
  auftragLeistungPreiseQuery,
  lineTotal,
  type AuftragLeistung,
} from "@/lib/auftragLeistungen";
import { leistungenQuery, type Leistungsposition } from "@/lib/settings";
import { fmtEuro, fmtNum } from "@/lib/erp";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


export function AuftragLeistungen({
  auftragId,
  canEditOverride,
}: {
  auftragId: string;
  /** Allows editing for assigned workers during the completion flow. */
  canEditOverride?: boolean;
}) {
  const qc = useQueryClient();
  const { can, canAny } = useAuth();
  const canEdit = can(PERM.auftraegeEdit) || !!canEditOverride;
  const canPrice = canAny([
    PERM.preiseView,
    PERM.profitDetail,
    PERM.umsatzView,
    PERM.finanzenManage,
    PERM.gewinnView,
  ]);

  const { data: zeilen = [], isLoading } = useQuery(auftragLeistungenQuery(auftragId));
  const { data: preise = {} } = useQuery(auftragLeistungPreiseQuery(auftragId, canPrice));
  const { data: katalog = [] } = useQuery(leistungenQuery());

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const gesamt = useMemo(() => {
    if (!canPrice) return null;
    return zeilen.reduce((sum, z) => sum + (lineTotal(z, preise[z.id]) ?? 0), 0);
  }, [zeilen, preise, canPrice]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["auftrag_leistungen", auftragId] }).then(() =>
      qc.invalidateQueries({ queryKey: ["auftrag_leistung_preise", auftragId] }),
    );

  const addLeistung = async (l: Leistungsposition) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("auftrag_leistungen")
        .insert({
          auftrag_id: auftragId,
          leistung_id: l.id,
          code: l.code,
          name: l.name,
          berechnungsart: l.berechnungsart,
          einheit: l.einheit,
          menge: 1,
          mitarbeiter_anzahl: 1,
          sort_order: zeilen.length,
        } as never);
      if (error) throw error;
      // Catalog price is snapshotted automatically by a DB trigger.
      await invalidate();
      setAdding(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hinzufügen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, p: Partial<AuftragLeistung>) => {
    const { error } = await supabase.from("auftrag_leistungen").update(p as never).eq("id", id);
    if (error) toast.error(error.message);
    else await invalidate();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("auftrag_leistungen").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await invalidate();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[10vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <ListChecks className="h-4 w-4" /> Leistungspositionen
        </h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" /> Position
          </Button>
        )}
      </div>

      {canEdit && adding && (
        <div className="mb-4 rounded-xl border border-dashed border-border bg-background p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Aus Katalog wählen</p>
          <div className="flex flex-wrap gap-2">
            {katalog.filter((k) => k.aktiv).map((k) => (
              <button
                key={k.id}
                disabled={busy}
                onClick={() => addLeistung(k)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted disabled:opacity-50"
              >
                <span className="font-mono text-xs text-muted-foreground">{k.code}</span> {k.name}
              </button>
            ))}
            {katalog.length === 0 && (
              <span className="text-sm text-muted-foreground">Keine Leistungen im Katalog.</span>
            )}
          </div>
        </div>
      )}

      {zeilen.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Noch keine Leistungspositionen erfasst.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Code</th>
                <th className="py-2 pr-3 font-semibold">Bezeichnung</th>
                <th className="py-2 pr-3 font-semibold">Menge</th>
                <th className="py-2 pr-3 font-semibold">Einheit</th>
                {canPrice && <th className="py-2 pr-3 text-right font-semibold">Preis</th>}
                {canPrice && <th className="py-2 pr-3 text-right font-semibold">Gesamt</th>}
                {canEdit && <th className="py-2" />}
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => (
                <tr key={z.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{z.code || "–"}</td>
                  <td className="py-2 pr-3">{z.name || "–"}</td>
                  <td className="py-2 pr-3">
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={z.menge}
                          onChange={(e) => patch(z.id, { menge: Number(e.target.value) })}
                          className="h-8 w-20"
                        />
                        {z.berechnungsart === "stunde_mitarbeiter" && (
                          <>
                            <span className="text-xs text-muted-foreground">×</span>
                            <Input
                              type="number"
                              value={z.mitarbeiter_anzahl}
                              onChange={(e) => patch(z.id, { mitarbeiter_anzahl: Number(e.target.value) })}
                              className="h-8 w-16"
                              title="Anzahl Mitarbeiter"
                            />
                          </>
                        )}
                      </div>
                    ) : (
                      <span>
                        {fmtNum(z.menge)}
                        {z.berechnungsart === "stunde_mitarbeiter" ? ` × ${z.mitarbeiter_anzahl} MA` : ""}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{z.einheit || "–"}</td>
                  {canPrice && <td className="py-2 pr-3 text-right">{fmtEuro(preise[z.id])}</td>}
                  {canPrice && (
                    <td className="py-2 pr-3 text-right font-semibold">{fmtEuro(lineTotal(z, preise[z.id]))}</td>
                  )}
                  {canEdit && (
                    <td className="py-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => remove(z.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {canPrice && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="py-3 pr-3 text-right text-sm font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Euro className="h-4 w-4" /> Gesamtbetrag
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right text-base font-extrabold">{fmtEuro(gesamt)}</td>
                  {canEdit && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

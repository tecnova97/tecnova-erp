import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListChecks, Plus, Trash2, Save, RotateCcw, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  leistungenQuery,
  leistungPreiseQuery,
  BERECHNUNGSARTEN,
  type Leistungsposition,
} from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirePermission } from "@/components/PermissionGuard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SortableList } from "@/components/dnd/SortableList";

export const Route = createFileRoute("/_authenticated/einstellungen/leistungen")({
  component: () => (
    <RequirePermission perm={PERM.leistungenManage}>
      <LeistungenPage />
    </RequirePermission>
  ),
});

type Row = Leistungsposition & { preis: number; _new?: boolean; _dirty?: boolean; _priceDirty?: boolean };

function LeistungenPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canPrice = can(PERM.leistungenManage) || can(PERM.finanzenManage);
  const canEditPrice = can(PERM.leistungenManage);

  const { data: positions, isLoading } = useQuery(leistungenQuery());
  const { data: preise } = useQuery(leistungPreiseQuery(canPrice));
  const [rows, setRows] = useState<Row[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setRows(
      (positions ?? [])
        .map((p) => ({ ...p, preis: preise?.[p.id] ?? 0 }))
        .sort((a, b) => a.sort_order - b.sort_order),
    );
    setDeleted([]);
  };
  useEffect(() => {
    if (positions) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, preise]);

  const dirty = rows.some((r) => r._dirty || r._new || r._priceDirty) || deleted.length > 0;

  const patch = (id: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p, _dirty: true } : r)));

  const reorder = (next: Row[]) =>
    setRows(next.map((r, i) => ({ ...r, sort_order: i + 1, _dirty: true })));

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        id: `new-${Date.now()}`,
        code: "",
        name: "",
        berechnungsart: "pauschale",
        einheit: "Pauschale",
        aktiv: true,
        sort_order: rs.length + 1,
        worker_ohne_preis: true,
        preis: 0,
        _new: true,
      },
    ]);

  const removeRow = (id: string, isNew?: boolean) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    if (!isNew) setDeleted((d) => [...d, id]);
  };

  const save = async () => {
    setBusy(true);
    try {
      for (const id of deleted) {
        const { error } = await supabase.from("leistungspositionen").delete().eq("id", id);
        if (error) throw error;
      }
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const payload = {
          code: r.code.trim(),
          name: r.name.trim(),
          berechnungsart: r.berechnungsart,
          einheit: r.einheit,
          aktiv: r.aktiv,
          sort_order: i + 1,
          worker_ohne_preis: r.worker_ohne_preis,
        };
        if (r._new) {
          const { data: created, error } = await supabase
            .from("leistungspositionen")
            .insert(payload as never)
            .select("id")
            .single();
          if (error) throw error;
          if (canEditPrice && created) {
            const { error: pe } = await supabase
              .from("leistung_preise")
              .upsert({ leistung_id: (created as { id: string }).id, preis: r.preis } as never, { onConflict: "leistung_id" });
            if (pe) throw pe;
          }
        } else {
          if (r._dirty) {
            const { error } = await supabase.from("leistungspositionen").update(payload as never).eq("id", r.id);
            if (error) throw error;
          }
          if (canEditPrice && (r._priceDirty || r._dirty)) {
            const { error: pe } = await supabase
              .from("leistung_preise")
              .upsert({ leistung_id: r.id, preis: r.preis } as never, { onConflict: "leistung_id" });
            if (pe) throw pe;
          }
        }
      }
      await qc.invalidateQueries({ queryKey: ["leistungspositionen"] });
      await qc.invalidateQueries({ queryKey: ["leistung_preise"] });
      toast.success("Leistungspositionen gespeichert.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SettingsSection
      title="Leistungspositionen"
      icon={<ListChecks className="h-4 w-4 text-primary" />}
      description="Standardpositionen für Aufträge und Abrechnung – Code, Bezeichnung, Preis, Berechnungsart und Einheit."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={reset} disabled={busy || !dirty}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Abbrechen
          </Button>
          <Button size="sm" onClick={save} disabled={busy || !dirty}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Speichern
          </Button>
        </>
      }
    >
      {!canPrice && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Preise sind ausgeblendet – dafür fehlt dir die Finanzberechtigung.
        </p>
      )}

      <SortableList
        items={rows}
        onReorder={reorder}
        renderItem={(r, handle) => (
          <div className={`rounded-xl border border-border bg-background p-3 ${!r.aktiv ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              {handle}
              <Input
                value={r.code}
                onChange={(e) => patch(r.id, { code: e.target.value })}
                placeholder="Code"
                className="h-9 w-24 font-mono"
              />
              <Input
                value={r.name}
                onChange={(e) => patch(r.id, { name: e.target.value })}
                placeholder="Bezeichnung"
                className="h-9 min-w-[12rem] flex-1"
              />
              <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeRow(r.id, r._new)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-8">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Berechnung</span>
                <Select
                  value={r.berechnungsart}
                  onValueChange={(v) => {
                    const art = BERECHNUNGSARTEN.find((b) => b.key === v);
                    patch(r.id, { berechnungsart: v, einheit: art?.einheit ?? r.einheit });
                  }}
                >
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BERECHNUNGSARTEN.map((b) => (
                      <SelectItem key={b.key} value={b.key}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Einheit</span>
                <Input value={r.einheit} onChange={(e) => patch(r.id, { einheit: e.target.value })} className="h-8 w-32" />
              </div>
              {canPrice && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Preis €</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.preis}
                    disabled={!canEditPrice}
                    onChange={(e) => patch(r.id, { preis: Number(e.target.value), _priceDirty: true })}
                    className="h-8 w-28"
                  />
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={r.aktiv} onCheckedChange={(v) => patch(r.id, { aktiv: v === true })} /> Aktiv
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={r.worker_ohne_preis}
                  onCheckedChange={(v) => patch(r.id, { worker_ohne_preis: v === true })}
                />
                Für Monteur ohne Preis sichtbar
              </label>
            </div>
          </div>
        )}
      />

      <Button variant="outline" className="mt-4" onClick={addRow}>
        <Plus className="mr-1.5 h-4 w-4" /> Position hinzufügen
      </Button>
    </SettingsSection>
  );
}

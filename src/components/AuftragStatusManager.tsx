import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, Star, Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { statusZuweisungenQuery, useStatusAccess } from "@/lib/multiStatus";
import { useStatuses, statusStyle } from "@/lib/status";
import { logHistorie } from "@/lib/historie";
import { Button } from "@/components/ui/button";
import { SortableList } from "@/components/dnd/SortableList";

/**
 * Multi-status manager for an Auftrag. Statuses are assignable, orderable and
 * can be hidden (kept in history) or shown on the card. Every action respects
 * the per-status view/assign/remove permissions (roles + individual users).
 */
export function AuftragStatusManager({ auftragId }: { auftragId: string }) {
  const qc = useQueryClient();
  const { active: statuses, get } = useStatuses();
  const { canView, canAssign, canRemove } = useStatusAccess();
  const { data: zuweisungen = [], isLoading } = useQuery(statusZuweisungenQuery(auftragId));
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["auftrag_status_zuweisungen", auftragId] }).then(() => {
      qc.invalidateQueries({ queryKey: ["auftraege"] });
      qc.invalidateQueries({ queryKey: ["auftrag", auftragId] });
      // Assigning a status flagged "Erzeugt Zahlungsereignis" creates a paid
      // billing event via DB trigger — refresh the payment/revenue views so it
      // shows up immediately here and on "Bezahlte Aufträge".
      qc.invalidateQueries({ queryKey: ["zahlungsereignisse"] });
      qc.invalidateQueries({ queryKey: ["zahlung_umsatz_map"] });
      qc.invalidateQueries({ queryKey: ["auftrag_umsatz_map"] });
      qc.invalidateQueries({ queryKey: ["auftrag_gewinn_map"] });
    });

  const visibleRows = zuweisungen.filter((z) => canView(z.status_key));
  const assignedKeys = new Set(zuweisungen.map((z) => z.status_key));
  const addable = statuses.filter((s) => !assignedKeys.has(s.key) && canAssign(s.key));

  const addStatus = async (key: string) => {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const nextOrder = (zuweisungen.reduce((m, z) => Math.max(m, z.sort_order), 0) || 0) + 1;
      const { error } = await supabase.from("auftrag_status_zuweisungen").insert({
        auftrag_id: auftragId,
        status_key: key,
        sichtbar: true,
        sort_order: nextOrder,
        assigned_by: u.user?.id,
      } as never);
      if (error) throw error;
      await logHistorie(auftragId, "Status hinzugefügt", `Status „${get(key).label}" zugewiesen`, "status");
      await invalidate();
      setAdding(false);
      toast.success("Gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? `Speichern fehlgeschlagen: ${e.message}` : "Konnte Status nicht zuweisen.");
    } finally {
      setBusy(false);
    }
  };

  const toggleSichtbar = async (id: string, sichtbar: boolean) => {
    const { error } = await supabase
      .from("auftrag_status_zuweisungen")
      .update({ sichtbar: !sichtbar } as never)
      .eq("id", id);
    if (error) return toast.error(`Speichern fehlgeschlagen: ${error.message}`);
    await invalidate();
    toast.success("Gespeichert");
  };

  const removeStatus = async (id: string, key: string, isPrimary: boolean) => {
    if (isPrimary) return toast.error("Der Hauptstatus kann nicht entfernt werden.");
    const { error } = await supabase.from("auftrag_status_zuweisungen").delete().eq("id", id);
    if (error) return toast.error(`Speichern fehlgeschlagen: ${error.message}`);
    await logHistorie(auftragId, "Status entfernt", `Status „${get(key).label}" entfernt`, "status");
    await invalidate();
    toast.success("Gespeichert");
  };

  const makePrimary = async (key: string) => {
    const def = get(key);
    const { error } = await supabase
      .from("auftraege")
      .update({
        status: key,
        abgeschlossen_am: def.ist_abschluss ? new Date().toISOString() : null,
      } as never)
      .eq("id", auftragId);
    if (error) return toast.error(`Speichern fehlgeschlagen: ${error.message}`);
    await logHistorie(auftragId, "Hauptstatus geändert", `Hauptstatus auf „${def.label}" gesetzt`, "status");
    await invalidate();
    toast.success("Gespeichert");
  };

  const reorder = async (next: typeof zuweisungen) => {
    // optimistic order
    qc.setQueryData(["auftrag_status_zuweisungen", auftragId], next);
    for (let i = 0; i < next.length; i++) {
      if (next[i].sort_order !== i + 1) {
        await supabase.from("auftrag_status_zuweisungen").update({ sort_order: i + 1 } as never).eq("id", next[i].id);
      }
    }
    await invalidate();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[8vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <Layers className="h-4 w-4" /> Status
        </h3>
        {addable.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" /> Status
          </Button>
        )}
      </div>

      {adding && addable.length > 0 && (
        <div className="mb-4 rounded-xl border border-dashed border-border bg-background p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Status zuweisen</p>
          <div className="flex flex-wrap gap-2">
            {addable.map((s) => (
              <button
                key={s.key}
                disabled={busy}
                onClick={() => addStatus(s.key)}
                className="badge-status transition-opacity hover:opacity-80 disabled:opacity-50"
                style={statusStyle(s.farbe)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {visibleRows.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">Keine sichtbaren Status.</p>
      ) : (
        <SortableList
          items={visibleRows}
          onReorder={reorder}
          renderItem={(z, handle) => {
            const s = get(z.status_key);
            return (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-2.5">
                {handle}
                <span className="badge-status" style={statusStyle(s.farbe)}>
                  {s.label}
                </span>
                {z.is_primary && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <Star className="h-3 w-3 fill-primary" /> Hauptstatus
                  </span>
                )}
                {!z.sichtbar && <span className="text-xs text-muted-foreground">(ausgeblendet)</span>}
                <div className="ml-auto flex items-center gap-0.5">
                  {!z.is_primary && canAssign(z.status_key) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Als Hauptstatus setzen"
                      onClick={() => makePrimary(z.status_key)}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  {canAssign(z.status_key) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title={z.sichtbar ? "Auf Karte ausblenden" : "Auf Karte anzeigen"}
                      onClick={() => toggleSichtbar(z.id, z.sichtbar)}
                    >
                      {z.sichtbar ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  )}
                  {!z.is_primary && canRemove(z.status_key) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      title="Status entfernen"
                      onClick={() => removeStatus(z.id, z.status_key, z.is_primary)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}

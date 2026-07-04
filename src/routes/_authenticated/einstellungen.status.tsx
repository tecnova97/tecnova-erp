import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Palette, Plus, Trash2, Save, RotateCcw, Loader2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { statusDefinitionenQuery, type StatusDef } from "@/lib/queries";
import { statusStyle } from "@/lib/status";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RequirePermission } from "@/components/PermissionGuard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { ColorPicker } from "@/components/settings/ColorPicker";
import { SortableList } from "@/components/dnd/SortableList";
import { StatusZugriffDialog } from "@/components/StatusZugriffDialog";

export const Route = createFileRoute("/_authenticated/einstellungen/status")({
  component: () => (
    <RequirePermission perm={PERM.statusManage}>
      <StatusPage />
    </RequirePermission>
  ),
});

type Row = StatusDef & { _new?: boolean; _dirty?: boolean };

const FLAGS: { key: keyof StatusDef; label: string }[] = [
  { key: "aktiv", label: "Aktiv" },
  { key: "sichtbar_dashboard", label: "Dashboard" },
  { key: "sichtbar_worker", label: "Monteur" },
  { key: "worker_waehlbar", label: "Monteur wählbar" },
  { key: "ist_abschluss", label: "Abschluss" },
  { key: "ist_bezahlt", label: "Erzeugt Zahlungsereignis" },
  { key: "sperrt_bearbeitung", label: "Sperrt Bearbeitung" },
  { key: "ausschluss_kontakte_ohne_termin", label: "Aus Kontakte ohne Termin ausschließen" },
];

function slugify(label: string, existing: Set<string>) {
  const base =
    label
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "status";
  let key = base;
  let i = 1;
  while (existing.has(key)) key = `${base}_${i++}`;
  return key;
}

function StatusPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(statusDefinitionenQuery());
  const [rows, setRows] = useState<Row[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [zugriffFor, setZugriffFor] = useState<{ key: string; label: string } | null>(null);

  const reset = () => {
    setRows((data ?? []).map((s) => ({ ...s })).sort((a, b) => a.reihenfolge - b.reihenfolge));
    setDeleted([]);
  };
  useEffect(() => {
    if (data) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const dirty = rows.some((r) => r._dirty || r._new) || deleted.length > 0;

  const patch = (id: string, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p, _dirty: true } : r)));

  const reorder = (next: Row[]) =>
    setRows(next.map((r, i) => ({ ...r, reihenfolge: i + 1, _dirty: true })));


  const addRow = () => {
    const tempId = `new-${Date.now()}`;
    setRows((rs) => [
      ...rs,
      {
        id: tempId,
        key: "",
        label: "Neuer Status",
        farbe: "#3b82f6",
        reihenfolge: rs.length + 1,
        aktiv: true,
        ist_abschluss: false,
        ist_bezahlt: false,
        sichtbar_dashboard: true,
        sichtbar_worker: true,
        worker_waehlbar: true,
        sperrt_bearbeitung: false,
        ausschluss_kontakte_ohne_termin: false,
        _new: true,
      },
    ]);
  };

  const removeRow = (id: string, isNew?: boolean) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    if (!isNew) setDeleted((d) => [...d, id]);
  };

  const save = async () => {
    setBusy(true);
    try {
      const existingKeys = new Set(rows.filter((r) => !r._new).map((r) => r.key));
      for (const id of deleted) {
        const { error } = await supabase.from("status_definitionen").delete().eq("id", id);
        if (error) throw error;
      }
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const payload = {
          label: r.label.trim() || "Status",
          farbe: r.farbe,
          reihenfolge: i + 1,
          aktiv: r.aktiv,
          ist_abschluss: r.ist_abschluss,
          ist_bezahlt: r.ist_bezahlt,
          sichtbar_dashboard: r.sichtbar_dashboard,
          sichtbar_worker: r.sichtbar_worker,
          worker_waehlbar: r.worker_waehlbar,
          sperrt_bearbeitung: r.sperrt_bearbeitung,
          ausschluss_kontakte_ohne_termin: r.ausschluss_kontakte_ohne_termin,
        };
        if (r._new) {
          const key = slugify(r.label.trim() || "status", existingKeys);
          existingKeys.add(key);
          const { error } = await supabase
            .from("status_definitionen")
            .insert({ key, ...payload } as never);
          if (error) throw error;
        } else if (r._dirty) {
          const { error } = await supabase.from("status_definitionen").update(payload as never).eq("id", r.id);
          if (error) throw error;
        }
      }
      await qc.invalidateQueries({ queryKey: ["status_definitionen"] });
      toast.success("Statusverwaltung gespeichert.");
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
      title="Statusverwaltung"
      icon={<Palette className="h-4 w-4 text-primary" />}
      description="Status anlegen, umbenennen, einfärben, sortieren und Sichtbarkeit sowie Verhalten steuern."
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
      <SortableList
        items={rows}
        onReorder={reorder}
        renderItem={(r, handle) => (
          <div className={`rounded-xl border border-border bg-background p-3 ${!r.aktiv ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              {handle}
              <ColorPicker value={r.farbe} onChange={(v) => patch(r.id, { farbe: v })} />
              <Input
                value={r.label}
                onChange={(e) => patch(r.id, { label: e.target.value })}
                className="h-9 max-w-[16rem] flex-1"
              />
              <span className="badge-status" style={statusStyle(r.farbe)}>
                {r.label || "—"}
              </span>
              <div className="ml-auto flex items-center gap-1">
                {!r._new && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    onClick={() => setZugriffFor({ key: r.key, label: r.label || r.key })}
                    title="Zugriff (Rollen & Benutzer)"
                  >
                    <Shield className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive"
                  onClick={() => removeRow(r.id, r._new)}
                  title="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 pl-8">
              {FLAGS.map((f) => (
                <label key={f.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={r[f.key] as boolean}
                    onCheckedChange={(v) => patch(r.id, { [f.key]: v === true } as Partial<Row>)}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        )}
      />


      <Button variant="outline" className="mt-4" onClick={addRow}>
        <Plus className="mr-1.5 h-4 w-4" /> Status hinzufügen
      </Button>

      {zugriffFor && (
        <StatusZugriffDialog
          statusKey={zugriffFor.key}
          statusLabel={zugriffFor.label}
          open={!!zugriffFor}
          onOpenChange={(v) => !v && setZugriffFor(null)}
        />
      )}
    </SettingsSection>
  );
}

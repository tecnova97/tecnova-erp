import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pencil,
  Trash2,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { kundenQuery, projekteQuery, mitarbeiterQuery } from "@/lib/queries";
import { useStatuses } from "@/lib/status";
import { fmtDateTime } from "@/lib/erp";
import {
  importRowsQuery,
  IMPORT_FIELDS,
  validateRow,
  confirmImport,
  type ImportBatch,
  type ImportRow,
  type ParsedRow,
  type ReferenceData,
  type ValidationStatus,
} from "@/lib/imports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const VAL_META: Record<ValidationStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "OK", cls: "bg-emerald-500/12 text-emerald-600", icon: CheckCircle2 },
  warning: { label: "Warnung", cls: "bg-amber-500/12 text-amber-600", icon: AlertTriangle },
  error: { label: "Fehler", cls: "bg-destructive/12 text-destructive", icon: XCircle },
};

/** Spreadsheet-style inline editable cell with copy/paste support and undo (Esc). */
function CellEdit({
  value,
  editable,
  placeholder,
  className,
  onCommit,
}: {
  value: string;
  editable: boolean;
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);

  // Keep in sync with external updates when not actively editing.
  if (!focused && local !== value) setLocal(value);

  if (!editable) {
    return (
      <span className={cn("block truncate", !value && "text-muted-foreground")}>
        {value || placeholder || "–"}
      </span>
    );
  }

  return (
    <input
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onCommit(local.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setLocal(value); // undo
          setFocused(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        "w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition-colors hover:border-border focus:border-primary focus:bg-background",
        className,
      )}
    />
  );
}

export function ImportReview({ batch, onBack }: { batch: ImportBatch; onBack: () => void }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canEdit = can(PERM.importeEdit) || can(PERM.importeReview);
  const canConfirm = can(PERM.importeConfirm);

  const { data: rows = [], isLoading } = useQuery(importRowsQuery(batch.id));
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const { active: statuses } = useStatuses();

  const refs: ReferenceData = useMemo(
    () => ({
      kunden: kunden.map((k) => ({ id: k.id, name: k.name })),
      projekte: projekte.map((p) => ({ id: p.id, name: p.name })),
      mitarbeiter: mitarbeiter.map((m) => ({ id: m.id, vorname: m.vorname, nachname: m.nachname })),
      statuses: statuses.map((s) => ({ key: s.key, label: s.label })),
    }),
    [kunden, projekte, mitarbeiter, statuses],
  );

  const [editRow, setEditRow] = useState<ImportRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const kundeName = (id: string) => kunden.find((k) => k.id === id)?.name ?? "";
  const statusLabel = (key: string) => statuses.find((s) => s.key === key)?.label ?? key;

  const selectedRows = rows.filter((r) => r.selected);
  const importable = selectedRows.filter((r) => r.validation_status !== "error" && !r.created_auftrag_id);
  const stats = {
    total: rows.length,
    ok: rows.filter((r) => r.validation_status === "ok").length,
    warning: rows.filter((r) => r.validation_status === "warning").length,
    error: rows.filter((r) => r.validation_status === "error").length,
    imported: rows.filter((r) => r.created_auftrag_id).length,
  };

  const patchRow = async (id: string, patch: Partial<ImportRow>) => {
    await supabase.from("import_rows").update(patch as never).eq("id", id);
    qc.invalidateQueries({ queryKey: ["import_rows", batch.id] });
  };

  const toggleSelect = (row: ImportRow) => patchRow(row.id, { selected: !row.selected });

  const selectAll = (val: boolean) =>
    Promise.all(rows.map((r) => patchRow(r.id, { selected: val }))).then(() =>
      qc.invalidateQueries({ queryKey: ["import_rows", batch.id] }),
    );

  const selectValidOnly = async () => {
    await Promise.all(rows.map((r) => patchRow(r.id, { selected: r.validation_status !== "error" })));
  };

  const deleteRow = async (row: ImportRow) => {
    await supabase.from("import_rows").delete().eq("id", row.id);
    await supabase
      .from("import_batches")
      .update({ row_count: Math.max(0, batch.row_count - 1) } as never)
      .eq("id", batch.id);
    qc.invalidateQueries();
    toast.success("Zeile entfernt");
  };

  const deleteSelected = async () => {
    const del = selectedRows.filter((r) => !r.created_auftrag_id);
    if (del.length === 0) return;
    await supabase.from("import_rows").delete().in("id", del.map((r) => r.id));
    await supabase
      .from("import_batches")
      .update({ row_count: Math.max(0, batch.row_count - del.length) } as never)
      .eq("id", batch.id);
    qc.invalidateQueries();
    toast.success(`${del.length} Zeile${del.length === 1 ? "" : "n"} entfernt`);
  };

  // Inline (spreadsheet-style) edit of a single parsed field with re-validation.
  const patchParsed = async (row: ImportRow, field: keyof ParsedRow, value: string) => {
    const current = (row.parsed_data_json?.[field] ?? "") as string;
    if (String(current) === value) return;
    const { data: userData } = await supabase.auth.getUser();
    const parsed = { ...row.parsed_data_json, [field]: value || null } as ParsedRow;
    const v = validateRow(parsed, refs);
    await supabase
      .from("import_rows")
      .update({
        parsed_data_json: parsed as never,
        validation_status: v.status,
        error_messages: v.messages.join(" ") || null,
        edited_by: userData.user?.id ?? null,
        edited_at: new Date().toISOString(),
      } as never)
      .eq("id", row.id);
    const newErrors = rows.filter((r) =>
      r.id === row.id ? v.status === "error" : r.validation_status === "error",
    ).length;
    await supabase.from("import_batches").update({ error_count: newErrors } as never).eq("id", batch.id);
    qc.invalidateQueries();
  };

  const saveEdit = async (parsed: ParsedRow) => {
    if (!editRow) return;
    const { data: userData } = await supabase.auth.getUser();
    const v = validateRow(parsed, refs);
    await supabase
      .from("import_rows")
      .update({
        parsed_data_json: parsed as never,
        validation_status: v.status,
        error_messages: v.messages.join(" ") || null,
        edited_by: userData.user?.id ?? null,
        edited_at: new Date().toISOString(),
      } as never)
      .eq("id", editRow.id);
    // Recompute batch error count
    const newErrors = rows.filter((r) => (r.id === editRow.id ? v.status === "error" : r.validation_status === "error")).length;
    await supabase.from("import_batches").update({ error_count: newErrors } as never).eq("id", batch.id);
    qc.invalidateQueries();
    setEditRow(null);
    toast.success("Zeile gespeichert");
  };

  const doConfirm = async () => {
    setBusy(true);
    try {
      const { created, skipped } = await confirmImport(batch, rows, confirmNotes);
      toast.success(
        `${created} Auftrag${created === 1 ? "" : "e"} erstellt${skipped ? `, ${skipped} übersprungen` : ""}.`,
      );
      setConfirmOpen(false);
      setConfirmNotes("");
      qc.invalidateQueries();
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const alreadyConfirmed = batch.status === "confirmed";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Zurück
          </Button>
          <div>
            <h2 className="text-lg font-bold leading-tight">
              {batch.original_filename ?? batch.source_name ?? "Import"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {stats.total} Zeilen · {stats.ok} OK · {stats.warning} Warnungen · {stats.error} Fehler
              {stats.imported ? ` · ${stats.imported} bereits importiert` : ""}
            </p>
          </div>
        </div>
        {canConfirm && !alreadyConfirmed && (
          <Button onClick={() => setConfirmOpen(true)} disabled={importable.length === 0}>
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Import bestätigen ({importable.length})
          </Button>
        )}
      </div>

      {canEdit && !alreadyConfirmed && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => selectAll(true)}>Alle auswählen</Button>
          <Button variant="outline" size="sm" onClick={() => selectAll(false)}>Auswahl aufheben</Button>
          <Button variant="outline" size="sm" onClick={selectValidOnly}>Nur gültige auswählen</Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            disabled={selectedRows.filter((r) => !r.created_auftrag_id).length === 0}
            onClick={deleteSelected}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Ausgewählte löschen
          </Button>
          <span className="text-xs text-muted-foreground">
            Zellen direkt bearbeiten · {selectedRows.length} ausgewählt
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Keine Zeilen in diesem Import.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-10 p-3"></th>
                <th className="w-10 p-3">#</th>
                <th className="p-3">Titel</th>
                <th className="p-3">Kunde</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Ort</th>
                <th className="p-3">Termin</th>
                <th className="p-3">Status</th>
                <th className="p-3">Prüfung</th>
                <th className="w-24 p-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const p = row.parsed_data_json;
                const meta = VAL_META[row.validation_status];
                const Icon = meta.icon;
                const editable = canEdit && !alreadyConfirmed && !row.created_auftrag_id;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/60 last:border-0",
                      row.created_auftrag_id && "opacity-60",
                      !row.selected && "bg-muted/30",
                    )}
                  >
                    <td className="p-3">
                      <Checkbox
                        checked={row.selected}
                        disabled={!canEdit || alreadyConfirmed || !!row.created_auftrag_id}
                        onCheckedChange={() => toggleSelect(row)}
                      />
                    </td>
                    <td className="p-3 text-muted-foreground">{row.row_number}</td>
                    <td className="p-1.5 font-medium">
                      <CellEdit
                        value={p.titel ?? ""}
                        editable={editable}
                        placeholder="— fehlt —"
                        onCommit={(v) => patchParsed(row, "titel", v)}
                      />
                    </td>
                    <td className="p-1.5">
                      <CellEdit
                        value={p.kunde_name ?? (p.auftraggeber_id ? kundeName(p.auftraggeber_id) : "")}
                        editable={editable && !p.auftraggeber_id}
                        onCommit={(v) => patchParsed(row, "kunde_name", v)}
                      />
                    </td>
                    <td className="p-1.5">
                      <CellEdit
                        value={p.kunde_telefon ?? ""}
                        editable={editable}
                        onCommit={(v) => patchParsed(row, "kunde_telefon", v)}
                      />
                    </td>
                    <td className="p-1.5">
                      <div className="flex gap-1">
                        <CellEdit
                          value={p.plz ?? ""}
                          editable={editable}
                          className="w-16"
                          placeholder="PLZ"
                          onCommit={(v) => patchParsed(row, "plz", v)}
                        />
                        <CellEdit
                          value={p.ort ?? ""}
                          editable={editable}
                          placeholder="Ort"
                          onCommit={(v) => patchParsed(row, "ort", v)}
                        />
                      </div>
                    </td>
                    <td className="p-3">{p.termin_start ? fmtDateTime(p.termin_start) : "–"}</td>
                    <td className="p-3">{p.status ? statusLabel(p.status) : <span className="text-muted-foreground">Neue Aufträge</span>}</td>
                    <td className="p-3">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", meta.cls)}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      {row.error_messages && (
                        <div className="mt-1 max-w-[220px] text-[11px] text-muted-foreground">{row.error_messages}</div>
                      )}
                      {row.duplicate_candidate_id && (
                        <div className="mt-1 text-[11px] text-amber-600">Mögliches Duplikat</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        {row.created_auftrag_id ? (
                          <Badge variant="secondary" className="text-[11px]">Importiert</Badge>
                        ) : (
                          <>
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditRow(row)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRow(row)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <RowEditDialog
          row={editRow}
          refs={refs}
          onClose={() => setEditRow(null)}
          onSave={saveEdit}
        />
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import bestätigen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Es werden <strong>{importable.length}</strong> Auftrag{importable.length === 1 ? "" : "e"} erstellt.
              Zeilen mit Fehlern werden übersprungen. Aufträge ohne eigenen Status erhalten „Neue Aufträge".
            </p>
            <div className="space-y-1.5">
              <Label>Notiz (optional)</Label>
              <Textarea value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>Abbrechen</Button>
            <Button onClick={doConfirm} disabled={busy || importable.length === 0}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Aufträge erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row editor — full field set
// ---------------------------------------------------------------------------
function RowEditDialog({
  row,
  refs,
  onClose,
  onSave,
}: {
  row: ImportRow;
  refs: ReferenceData;
  onClose: () => void;
  onSave: (p: ParsedRow) => Promise<void>;
}) {
  const [p, setP] = useState<ParsedRow>({ ...row.parsed_data_json });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ParsedRow, v: string | string[]) => setP((prev) => ({ ...prev, [k]: v }));

  const NONE = "__none__";

  const save = async () => {
    setBusy(true);
    try {
      await onSave(p);
    } finally {
      setBusy(false);
    }
  };

  const toggleMitarbeiter = (id: string) => {
    setP((prev) => ({
      ...prev,
      mitarbeiter_ids: prev.mitarbeiter_ids.includes(id)
        ? prev.mitarbeiter_ids.filter((x) => x !== id)
        : [...prev.mitarbeiter_ids, id],
    }));
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Zeile {row.row_number} bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {IMPORT_FIELDS.map((f) => {
            if (f.kind === "kunde") {
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Select value={p.auftraggeber_id || NONE} onValueChange={(v) => set("auftraggeber_id", v === NONE ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="– wählen –" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>– kein –</SelectItem>
                      {refs.kunden.map((k) => (<SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {p._auftraggeber_text && !p.auftraggeber_id && (
                    <p className="text-[11px] text-amber-600">Original: „{p._auftraggeber_text}"</p>
                  )}
                </div>
              );
            }
            if (f.kind === "projekt") {
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Select value={p.projekt_id || NONE} onValueChange={(v) => set("projekt_id", v === NONE ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="– wählen –" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>– kein –</SelectItem>
                      {refs.projekte.map((k) => (<SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {p._projekt_text && !p.projekt_id && (
                    <p className="text-[11px] text-amber-600">Original: „{p._projekt_text}"</p>
                  )}
                </div>
              );
            }
            if (f.kind === "status") {
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Select value={p.status || NONE} onValueChange={(v) => set("status", v === NONE ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Neue Aufträge" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Neue Aufträge (Standard)</SelectItem>
                      {refs.statuses.map((s) => (<SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            if (f.kind === "mitarbeiter") {
              return (
                <div key={f.key} className="space-y-1.5 sm:col-span-2">
                  <Label>{f.label}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {refs.mitarbeiter.map((m) => {
                      const on = p.mitarbeiter_ids.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMitarbeiter(m.id)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs transition-colors",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                          )}
                        >
                          {m.vorname} {m.nachname}
                        </button>
                      );
                    })}
                    {refs.mitarbeiter.length === 0 && <span className="text-xs text-muted-foreground">Keine Mitarbeiter</span>}
                  </div>
                </div>
              );
            }
            if (f.kind === "datetime") {
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(p.termin_start)}
                    onChange={(e) => set("termin_start", e.target.value ? new Date(e.target.value).toISOString() : "")}
                  />
                </div>
              );
            }
            if (f.kind === "textarea") {
              return (
                <div key={f.key} className="space-y-1.5 sm:col-span-2">
                  <Label>{f.label}</Label>
                  <Textarea value={(p[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} rows={2} />
                </div>
              );
            }
            return (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}{f.required && " *"}</Label>
                <Input value={(p[f.key] as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Abbrechen</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

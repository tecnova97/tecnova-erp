import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, Loader2, ArrowRight, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { kundenQuery, projekteQuery, mitarbeiterQuery } from "@/lib/queries";
import { useStatuses } from "@/lib/status";
import {
  parseCsv,
  parseExcel,
  autoMap,
  buildParsedRow,
  validateRow,
  findDuplicate,
  mappingProfilesQuery,
  IMPORT_FIELDS,
  SOURCE_LABEL,
  type ColumnMapping,
  type ImportSourceType,
  type ParsedFile,
  type ParsedRow,
  type ReferenceData,
} from "@/lib/imports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NONE = "__none__";
const IGNORE = "__ignore__";

export function ImportUpload({ onImported }: { onImported: (batchId: string) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const { active: statuses } = useStatuses();
  const { data: profiles = [] } = useQuery(mappingProfilesQuery());

  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ImportSourceType>("csv");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [defStatus, setDefStatus] = useState("");
  const [defKunde, setDefKunde] = useState("");
  const [defProjekt, setDefProjekt] = useState("");
  const [profileName, setProfileName] = useState("");
  const [busy, setBusy] = useState(false);

  const refs: ReferenceData = useMemo(
    () => ({
      kunden: kunden.map((k) => ({ id: k.id, name: k.name })),
      projekte: projekte.map((p) => ({ id: p.id, name: p.name })),
      mitarbeiter: mitarbeiter.map((m) => ({ id: m.id, vorname: m.vorname, nachname: m.nachname })),
      statuses: statuses.map((s) => ({ key: s.key, label: s.label })),
    }),
    [kunden, projekte, mitarbeiter, statuses],
  );

  const handleFile = async (f: File) => {
    setFile(f);
    const lower = f.name.toLowerCase();
    try {
      let result: ParsedFile;
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        result = parseExcel(await f.arrayBuffer());
        setSource("excel");
      } else {
        result = parseCsv(await f.text());
        setSource(lower.includes("clickup") ? "clickup" : "csv");
      }
      if (!result.headers.length) {
        toast.error("Keine Spalten erkannt. Bitte Datei prüfen.");
        return;
      }
      setParsed(result);
      setMapping(autoMap(result.headers));
      toast.success(`${result.rows.length} Zeilen erkannt.`);
    } catch {
      toast.error("Datei konnte nicht gelesen werden.");
    }
  };

  const applyProfile = (id: string) => {
    const prof = profiles.find((p) => p.id === id);
    if (!prof) return;
    setMapping((prof.column_mapping_json ?? {}) as ColumnMapping);
    setDefStatus(prof.default_status_id ?? "");
    setDefKunde(prof.default_auftraggeber_id ?? "");
    setDefProjekt(prof.default_project_id ?? "");
    toast.success(`Mapping „${prof.name}" geladen.`);
  };

  const saveProfile = async () => {
    if (!profileName.trim()) { toast.error("Bitte einen Namen für das Profil eingeben."); return; }
    const { error } = await supabase.from("import_mapping_profiles").insert({
      name: profileName.trim(),
      source_type: source,
      column_mapping_json: mapping as never,
      default_status_id: defStatus || null,
      default_auftraggeber_id: defKunde || null,
      default_project_id: defProjekt || null,
      created_by: user?.id ?? null,
    } as never);
    if (error) { toast.error("Profil konnte nicht gespeichert werden."); return; }
    setProfileName("");
    qc.invalidateQueries({ queryKey: ["import_mapping_profiles"] });
    toast.success("Mapping-Profil gespeichert.");
  };

  const runImport = async () => {
    if (!parsed || !file) return;
    const hasTitel = Object.values(mapping).includes("titel");
    if (!hasTitel) { toast.error('Bitte mindestens eine Spalte dem Feld „Titel" zuordnen.'); return; }
    setBusy(true);
    try {
      // 1) Upload original file (audit)
      const path = `${user?.id ?? "anon"}/${Date.now()}-${file.name}`;
      await supabase.storage.from("importe").upload(path, file, { upsert: false }).catch(() => {});

      // 2) Existing Aufträge for duplicate detection
      const { data: existing } = await supabase
        .from("auftraege")
        .select("id,titel,kunde_name,kunde_telefon");

      // 3) Create batch
      const { data: batchData, error: batchErr } = await supabase
        .from("import_batches")
        .insert({
          source_type: source,
          source_name: SOURCE_LABEL[source],
          uploaded_file_url: path,
          original_filename: file.name,
          uploaded_by: user?.id ?? null,
          status: "needs_review",
          row_count: parsed.rows.length,
        } as never)
        .select("id")
        .single();
      if (batchErr) throw batchErr;
      const batchId = (batchData as { id: string }).id;

      // 4) Build + validate rows
      let errorCount = 0;
      const rowsPayload = parsed.rows.map((raw, i) => {
        const p: ParsedRow = buildParsedRow(raw, mapping, refs, {
          status: defStatus,
          auftraggeber_id: defKunde,
          projekt_id: defProjekt,
        });
        const v = validateRow(p, refs);
        if (v.status === "error") errorCount++;
        const dup = findDuplicate(p, (existing ?? []) as never[]);
        return {
          import_batch_id: batchId,
          row_number: i + 1,
          raw_data_json: raw as never,
          parsed_data_json: p as never,
          validation_status: v.status,
          error_messages: v.messages.join(" ") || null,
          duplicate_candidate_id: dup,
          selected: v.status !== "error",
        };
      });

      // 5) Insert rows in chunks
      for (let i = 0; i < rowsPayload.length; i += 200) {
        const chunk = rowsPayload.slice(i, i + 200);
        const { error } = await supabase.from("import_rows").insert(chunk as never);
        if (error) throw error;
      }

      await supabase.from("import_batches").update({ error_count: errorCount } as never).eq("id", batchId);
      await supabase.rpc("log_activity", {
        _action: "import.uploaded",
        _entity_type: "import",
        _entity_id: batchId,
        _entity_name: file.name,
        _before: null,
        _after: { rows: parsed.rows.length, source } as never,
      });

      qc.invalidateQueries();
      toast.success(`${parsed.rows.length} Zeilen in den Import-Eingang geladen.`);
      // Reset
      setFile(null); setParsed(null); setMapping({});
      if (fileRef.current) fileRef.current.value = "";
      onImported(batchId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        className="rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center transition-colors hover:border-primary/50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
      >
        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">CSV- oder Excel-Datei hierher ziehen</p>
        <p className="text-xs text-muted-foreground">oder klicken zum Auswählen · .csv, .xlsx, .xls</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <Button variant="outline" className="mt-4" onClick={() => fileRef.current?.click()}>
          Datei auswählen
        </Button>
        {file && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            {file.name}
          </div>
        )}
      </div>

      {parsed && (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Quelle</Label>
              <Select value={source} onValueChange={(v) => setSource(v as ImportSourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["csv", "excel", "clickup", "esass", "other"] as ImportSourceType[]).map((s) => (
                    <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mapping-Profil</Label>
              <Select onValueChange={applyProfile}>
                <SelectTrigger><SelectValue placeholder="Profil laden…" /></SelectTrigger>
                <SelectContent>
                  {profiles.length === 0 && <SelectItem value={NONE} disabled>Keine Profile</SelectItem>}
                  {profiles.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Standard-Status</Label>
              <Select value={defStatus || NONE} onValueChange={(v) => setDefStatus(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Neue Aufträge" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Neue Aufträge (Standard)</SelectItem>
                  {statuses.map((s) => (<SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Standard-Auftraggeber</Label>
              <Select value={defKunde || NONE} onValueChange={(v) => setDefKunde(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="– kein –" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>– kein –</SelectItem>
                  {kunden.map((k) => (<SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Column mapping */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Spalten zuordnen</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {parsed.headers.map((h) => (
                <div key={h} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={h}>{h}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {parsed.rows[0]?.[h] || "—"}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Select
                    value={mapping[h] || IGNORE}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v === IGNORE ? "" : (v as keyof ParsedRow) }))}
                  >
                    <SelectTrigger className="h-9 w-[150px] shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE}>Ignorieren</SelectItem>
                      {IMPORT_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Save profile + run */}
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Mapping als Profil speichern</Label>
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Profilname"
                  className="w-56"
                />
              </div>
              <Button variant="outline" onClick={saveProfile}>
                <Save className="mr-1.5 h-4 w-4" /> Speichern
              </Button>
            </div>
            <Button onClick={runImport} disabled={busy}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              In Import-Eingang einlesen ({parsed.rows.length})
            </Button>
          </div>
        </div>
      )}

      {/* Future sources */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Weitere Quellen (in Vorbereitung)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "E-Mail Import", d: "Aufträge aus Gmail / Outlook Postfach" },
            { t: "eSASS Import", d: "eSASS-Benachrichtigungen automatisch einlesen" },
            { t: "PDF Import", d: "PDF-Aufträge per OCR erkennen" },
            { t: "ClickUp API", d: "Direkte Anbindung an ClickUp" },
          ].map((c) => (
            <div key={c.t} className={cn("rounded-xl border border-dashed border-border bg-muted/30 p-4 opacity-70")}>
              <p className="text-sm font-medium">{c.t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.d}</p>
              <span className="mt-3 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Bald verfügbar</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

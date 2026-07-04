import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Inbox,
  UploadCloud,
  SlidersHorizontal,
  History as HistoryIcon,
  Settings2,
  Loader2,
  FileSpreadsheet,
  Eye,
  Trash2,
  Ban,
  CheckCircle2,
} from "lucide-react";
import {
  importBatchesQuery,
  mappingProfilesQuery,
  deleteBatch,
  BATCH_STATUS_LABEL,
  BATCH_STATUS_CLS,
  SOURCE_LABEL,
  type ImportBatch,
  type BatchStatus,
  type ImportSourceType,
} from "@/lib/imports";
import { profilesQuery } from "@/lib/queries";
import { fmtDateTime } from "@/lib/erp";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { RequirePermission } from "@/components/PermissionGuard";
import { ImportUpload } from "@/components/import/ImportUpload";
import { ImportReview } from "@/components/import/ImportReview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/importe")({
  head: () => ({ meta: [{ title: "Import Center – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.importeView}>
      <ImportCenterPage />
    </RequirePermission>
  ),
});

type TabKey = "eingang" | "hochladen" | "mapping" | "historie" | "einstellungen";

const TABS: { key: TabKey; label: string; icon: typeof Inbox; perm?: string }[] = [
  { key: "eingang", label: "Eingang", icon: Inbox },
  { key: "hochladen", label: "Hochladen", icon: UploadCloud, perm: PERM.importeUpload },
  { key: "mapping", label: "Mapping", icon: SlidersHorizontal, perm: PERM.importeMapping },
  { key: "historie", label: "Historie", icon: HistoryIcon, perm: PERM.importeHistory },
  { key: "einstellungen", label: "Einstellungen", icon: Settings2 },
];

function ImportCenterPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<TabKey>("eingang");
  const [reviewId, setReviewId] = useState<string | null>(null);

  const { data: batches = [] } = useQuery(importBatchesQuery());
  const reviewBatch = batches.find((b) => b.id === reviewId) ?? null;

  const visibleTabs = TABS.filter((t) => !t.perm || can(t.perm));

  if (reviewBatch) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <ImportReview batch={reviewBatch} onBack={() => setReviewId(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Center</h1>
        <p className="text-sm text-muted-foreground">
          Externe Aufträge einlesen, prüfen und kontrolliert übernehmen.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "eingang" && <EingangTab onOpen={(id) => setReviewId(id)} />}
      {tab === "hochladen" && can(PERM.importeUpload) && (
        <ImportUpload onImported={(id) => setReviewId(id)} />
      )}
      {tab === "mapping" && can(PERM.importeMapping) && <MappingTab />}
      {tab === "historie" && can(PERM.importeHistory) && <HistorieTab />}
      {tab === "einstellungen" && <EinstellungenTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Eingang
// ---------------------------------------------------------------------------
function EingangTab({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { data: batches = [], isLoading } = useQuery(importBatchesQuery());
  const { data: profiles = [] } = useQuery(profilesQuery());
  const [delBatch, setDelBatch] = useState<ImportBatch | null>(null);

  const uploaderName = (id: string | null) => {
    if (!id) return "–";
    const p = profiles.find((x) => x.id === id);
    return p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "–" : "–";
  };

  const setStatus = async (b: ImportBatch, status: BatchStatus) => {
    await supabase.from("import_batches").update({ status } as never).eq("id", b.id);
    qc.invalidateQueries({ queryKey: ["import_batches"] });
    toast.success(status === "ignored" ? "Import ignoriert." : "Status aktualisiert.");
  };

  const doDelete = async () => {
    if (!delBatch) return;
    try {
      await deleteBatch(delBatch.id, delBatch.uploaded_file_url);
      qc.invalidateQueries({ queryKey: ["import_batches"] });
      toast.success("Import gelöscht.");
    } catch {
      toast.error("Löschen fehlgeschlagen.");
    } finally {
      setDelBatch(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!batches.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Keine Importe vorhanden</p>
        <p className="text-xs text-muted-foreground">Lade im Reiter „Hochladen" eine CSV- oder Excel-Datei hoch.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {batches.map((b) => {
          const st = (b.status as BatchStatus) ?? "needs_review";
          return (
            <div key={b.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.original_filename ?? b.source_name ?? "Import"}</p>
                    <p className="text-xs text-muted-foreground">
                      {SOURCE_LABEL[(b.source_type as ImportSourceType)] ?? b.source_type} ·{" "}
                      {fmtDateTime(b.uploaded_at)} · {uploaderName(b.uploaded_by)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md bg-muted px-2 py-0.5">{b.row_count} Zeilen</span>
                      {b.error_count > 0 && (
                        <span className="rounded-md bg-destructive/12 px-2 py-0.5 text-destructive">{b.error_count} Fehler</span>
                      )}
                      {b.created_auftrag_count > 0 && (
                        <span className="rounded-md bg-emerald-500/12 px-2 py-0.5 text-emerald-600">
                          {b.created_auftrag_count} Aufträge
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge className={cn("shrink-0", BATCH_STATUS_CLS[st])}>{BATCH_STATUS_LABEL[st]}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={() => onOpen(b.id)}>
                  <Eye className="mr-1.5 h-4 w-4" />
                  {st === "confirmed" ? "Ansehen" : "Prüfen"}
                </Button>
                {st !== "confirmed" && st !== "ignored" && can(PERM.importeReview) && (
                  <Button variant="ghost" size="sm" onClick={() => setStatus(b, "ignored")}>
                    <Ban className="mr-1.5 h-4 w-4" /> Ignorieren
                  </Button>
                )}
                {st === "ignored" && can(PERM.importeReview) && (
                  <Button variant="ghost" size="sm" onClick={() => setStatus(b, "needs_review")}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Reaktivieren
                  </Button>
                )}
                {can(PERM.importeDelete) && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDelBatch(b)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Löschen
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!delBatch} onOpenChange={(v) => !v && setDelBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Import „{delBatch?.original_filename}" und alle zugehörigen Zeilen werden entfernt.
              Bereits erstellte Aufträge bleiben erhalten. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------
function MappingTab() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { data: profiles = [], isLoading } = useQuery(mappingProfilesQuery());

  const del = async (id: string) => {
    await supabase.from("import_mapping_profiles").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["import_mapping_profiles"] });
    toast.success("Profil gelöscht.");
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Mapping-Profile speichern die Spaltenzuordnung je Quelle. Neue Profile werden beim Hochladen erstellt.
      </p>
      {!profiles.length ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Noch keine Mapping-Profile gespeichert.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {SOURCE_LABEL[(p.source_type as ImportSourceType)] ?? p.source_type} ·{" "}
                    {Object.values((p.column_mapping_json as Record<string, string>) ?? {}).filter(Boolean).length} Felder
                  </p>
                </div>
                {can(PERM.importeMapping) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => del(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Historie
// ---------------------------------------------------------------------------
function HistorieTab() {
  const { data: batches = [], isLoading } = useQuery(importBatchesQuery());
  const { data: profiles = [] } = useQuery(profilesQuery());
  const done = batches.filter((b) => b.status === "confirmed");

  const uploaderName = (id: string | null) => {
    if (!id) return "–";
    const p = profiles.find((x) => x.id === id);
    return p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "–" : "–";
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!done.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Noch keine bestätigten Importe.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="p-3">Datei</th>
            <th className="p-3">Quelle</th>
            <th className="p-3">Datum</th>
            <th className="p-3">Von</th>
            <th className="p-3 text-right">Aufträge</th>
          </tr>
        </thead>
        <tbody>
          {done.map((b) => (
            <tr key={b.id} className="border-b border-border/60 last:border-0">
              <td className="p-3 font-medium">{b.original_filename ?? "–"}</td>
              <td className="p-3">{SOURCE_LABEL[(b.source_type as ImportSourceType)] ?? b.source_type}</td>
              <td className="p-3">{fmtDateTime(b.uploaded_at)}</td>
              <td className="p-3">{uploaderName(b.uploaded_by)}</td>
              <td className="p-3 text-right font-semibold text-emerald-600">{b.created_auftrag_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Einstellungen (info / future sources)
// ---------------------------------------------------------------------------
function EinstellungenTab() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h3 className="text-sm font-semibold">Standardverhalten</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>• Importierte Aufträge erhalten standardmäßig den Status <strong>„Neue Aufträge"</strong>.</li>
          <li>• Kein Import erstellt Aufträge ohne vorherige Prüfung im Eingang.</li>
          <li>• Originaldateien und Rohdaten werden zur Nachvollziehbarkeit aufbewahrt.</li>
          <li>• Aufträge mit Kontaktdaten ohne Termin erscheinen unter „Kontakte ohne Termin".</li>
          <li>• Jeder Import wird in der Aktivität protokolliert.</li>
        </ul>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h3 className="text-sm font-semibold">Geplante Anbindungen</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {["E-Mail Import (Gmail/Outlook)", "eSASS Import", "PDF / OCR Erkennung", "ClickUp API", "Lexware Export", "Rechnungsaufmaß Import"].map((x) => (
            <div key={x} className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm">
              <span>{x}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Bald</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

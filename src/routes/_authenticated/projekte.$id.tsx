import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FolderKanban, Building2, MapPin, Calendar, User, Hash, Pencil, Archive,
  Trash2, Plus, FileText, Image, History, Euro, Info, ClipboardList, X, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import {
  projektDetailQuery, zahlungsereignisseAllQuery, ausgabenAllQuery, logActivity,
} from "@/lib/module-queries";
import { auftraegeQuery, auftragUmsatzMapQuery, dokumenteQuery, fotosQuery } from "@/lib/queries";
import { PROJEKT_STATUS_CONFIG, fmtDate, fmtDateTime, fmtEuro, fmtAdresse } from "@/lib/erp";
import type { ProjektStatus } from "@/lib/erp";
import { cn } from "@/lib/utils";
import { BackLink, InfoRow, Section, StatCard, EmptyState } from "@/components/detail/parts";
import { AuftraegeSubList } from "@/components/detail/AuftraegeSubList";
import { DokumenteView, FotosView } from "@/components/detail/FilesView";
import { VerlaufList } from "@/components/detail/VerlaufList";
import { customFieldDefsQuery, type CustomData } from "@/lib/customFields";
import { CustomFieldsView } from "@/components/custom/CustomFields";
import { ProjektFormDialog } from "@/components/ProjektFormDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/projekte/$id")({
  head: () => ({ meta: [{ title: "Projekt – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.projekteView}>
      <ProjektDetail />
    </RequirePermission>
  ),
});

function ProjektDetail() {
  const { id } = Route.useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = can(PERM.projekteEdit);
  const canDelete = can(PERM.projekteDelete);
  const canFinanzen = can(PERM.projekteFinanzen);

  const { data: projekt, isLoading } = useQuery(projektDetailQuery(id));
  const { data: alleAuftraege = [] } = useQuery(auftraegeQuery());
  const { data: umsatzMap = {} } = useQuery(auftragUmsatzMapQuery(canFinanzen));
  const { data: dokumente = [] } = useQuery(dokumenteQuery());
  const { data: fotos = [] } = useQuery(fotosQuery());
  const { data: zahlungen = [] } = useQuery(zahlungsereignisseAllQuery(canFinanzen));
  const { data: ausgaben = [] } = useQuery(ausgabenAllQuery(canFinanzen));
  const { data: customDefs = [] } = useQuery(customFieldDefsQuery("projekt"));

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const auftraege = useMemo(() => alleAuftraege.filter((a) => a.projekt_id === id), [alleAuftraege, id]);
  const auftragIds = useMemo(() => new Set(auftraege.map((a) => a.id)), [auftraege]);

  const projektDok = useMemo(() => dokumente.filter((d) => d.auftrag && auftragIds.has(d.auftrag.id)), [dokumente, auftragIds]);
  const projektFotos = useMemo(() => fotos.filter((f) => f.auftrag && auftragIds.has(f.auftrag.id)), [fotos, auftragIds]);

  const fin = useMemo(() => {
    const gesamt = auftraege.reduce((s, a) => s + (umsatzMap[a.id] ?? 0), 0);
    const bezahlt = auftraege.filter((a) => a.bezahlt).reduce((s, a) => s + (umsatzMap[a.id] ?? 0), 0);
    const ausg = ausgaben.filter((x) => auftragIds.has(x.auftrag_id)).reduce((s, x) => s + Number(x.betrag), 0);
    return { gesamt, bezahlt, offen: gesamt - bezahlt, ausgaben: ausg, gewinn: gesamt - ausg };
  }, [auftraege, umsatzMap, ausgaben, auftragIds]);

  const projektZahlungen = useMemo(
    () => zahlungen.filter((z) => auftragIds.has(z.auftrag_id)),
    [zahlungen, auftragIds],
  );

  if (isLoading || !projekt) return <p className="text-sm text-muted-foreground">Lädt…</p>;

  const cfg = PROJEKT_STATUS_CONFIG[projekt.status as ProjektStatus];

  const doArchive = async () => {
    const { error } = await supabase.from("projekte").update({ archiviert: !projekt.archiviert }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(projekt.archiviert ? "Wiederhergestellt." : "Archiviert.");
    qc.invalidateQueries();
    setConfirmArchive(false);
  };
  const doDelete = async () => {
    const { error } = await supabase.from("projekte").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Projekt gelöscht.");
    qc.invalidateQueries();
    navigate({ to: "/projekte" });
  };
  const removeAuftrag = async (auftragId: string, nr: string) => {
    const { error } = await supabase.from("auftraege").update({ projekt_id: null }).eq("id", auftragId);
    if (error) return toast.error(error.message);
    await logActivity("auftrag_removed", "projekt", id, `${nr} entfernt`);
    toast.success("Auftrag aus Projekt entfernt.");
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-5">
      <BackLink to="/projekte" label="Projekte" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <FolderKanban className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{projekt.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {projekt.kunde?.name && (
                <Link to="/kunden/$id" params={{ id: projekt.kunde.id }} className="hover:text-foreground">
                  {projekt.kunde.name}
                </Link>
              )}
              {cfg && <span className={cn("badge", cfg.cls)}>{cfg.label}</span>}
              {projekt.archiviert && <span className="badge bg-muted text-muted-foreground">Archiviert</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Bearbeiten
            </Button>
          )}
          {canDelete && (
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)} className="gap-1.5">
                <Archive className="h-4 w-4" /> {projekt.archiviert ? "Wiederherstellen" : "Archivieren"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="gap-1.5 text-destructive">
                <Trash2 className="h-4 w-4" /> Löschen
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="uebersicht">
        <TabsList className="flex-wrap">
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="auftraege">Aufträge ({auftraege.length})</TabsTrigger>
          <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
          {canFinanzen && <TabsTrigger value="finanzen">Finanzen</TabsTrigger>}
        </TabsList>

        <TabsContent value="uebersicht" className="mt-4">
          <Section title="Projektdaten" icon={Info}>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow icon={FolderKanban} label="Projektname">{projekt.name}</InfoRow>
              <InfoRow icon={Building2} label="Auftraggeber">
                {projekt.kunde ? (
                  <Link to="/kunden/$id" params={{ id: projekt.kunde.id }} className="text-primary hover:underline">
                    {projekt.kunde.name}
                  </Link>
                ) : "—"}
              </InfoRow>
              <InfoRow icon={ClipboardList} label="Status">{cfg?.label ?? projekt.status}</InfoRow>
              <InfoRow icon={Hash} label="NVT">{projekt.nvt || "—"}</InfoRow>
              <InfoRow icon={Hash} label="eSASS-Nr.">{projekt.esass_nr || "—"}</InfoRow>
              <InfoRow icon={Hash} label="AG-Bestell-Nr.">{projekt.ag_bestell_nr || "—"}</InfoRow>
              <InfoRow icon={Hash} label="AG-LEB-Nr.">{projekt.ag_leb_nr || "—"}</InfoRow>
              <InfoRow icon={Calendar} label="Leistungszeitraum">
                {projekt.leistung_von || projekt.leistung_bis
                  ? `${fmtDate(projekt.leistung_von)} bis ${fmtDate(projekt.leistung_bis)}`
                  : "—"}
              </InfoRow>
              <InfoRow icon={Hash} label="Kostenstelle">{projekt.kostenstelle || "—"}</InfoRow>
              <InfoRow icon={User} label="Projektleiter">{projekt.projektleiter || "—"}</InfoRow>
              <InfoRow icon={Hash} label="AG SM-Nr.">{projekt.ag_sm_nr || "—"}</InfoRow>
              <InfoRow icon={Hash} label="AG Vertrags-Nr.">{projekt.ag_vertrags_nr || "—"}</InfoRow>
              <InfoRow icon={MapPin} label="Leistungsort">{projekt.leistungsort || fmtAdresse(projekt) || "—"}</InfoRow>
              <InfoRow icon={Calendar} label="Startdatum">{fmtDate(projekt.start_datum) || "—"}</InfoRow>
              <InfoRow icon={Calendar} label="Enddatum">{fmtDate(projekt.end_datum) || "—"}</InfoRow>
              <CustomFieldsView defs={customDefs} values={(projekt.custom_data ?? {}) as CustomData} />
            </div>
            {projekt.notizen && (
              <div className="mt-5 rounded-xl bg-muted/50 p-4 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notizen</p>
                {projekt.notizen}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="auftraege" className="mt-4">
          <AuftraegeSubList
            auftraege={auftraege}
            umsatzMap={canFinanzen ? umsatzMap : undefined}
            header={
              can(PERM.auftraegeEdit) ? (
                <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Auftrag zuordnen
                </Button>
              ) : undefined
            }
          />
          {can(PERM.auftraegeEdit) && auftraege.length > 0 && (
            <div className="mt-4">
              <Section title="Zuordnung verwalten" icon={ClipboardList}>
                <div className="divide-y divide-border">
                  {auftraege.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="text-muted-foreground">{a.auftragsnummer}</span>
                      <span className="min-w-0 flex-1 truncate">{a.titel}</span>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeAuftrag(a.id, a.auftragsnummer)}>
                        <X className="mr-1 h-4 w-4" /> Entfernen
                      </Button>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dokumente" className="mt-4">
          <Section title="Dokumente" icon={FileText}>
            <DokumenteView dokumente={projektDok} />
          </Section>
        </TabsContent>

        <TabsContent value="fotos" className="mt-4">
          <Section title="Fotos" icon={Image}>
            <FotosView fotos={projektFotos} />
          </Section>
        </TabsContent>

        <TabsContent value="verlauf" className="mt-4">
          <Section title="Verlauf" icon={History}>
            <VerlaufList entityType="projekt" entityId={id} />
          </Section>
        </TabsContent>

        {canFinanzen && (
          <TabsContent value="finanzen" className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Gesamtumsatz" value={fmtEuro(fin.gesamt)} tone="primary" />
              <StatCard label="Bezahlt" value={fmtEuro(fin.bezahlt)} tone="success" />
              <StatCard label="Offen" value={fmtEuro(fin.offen)} tone="warning" />
              <StatCard label="Ausgaben" value={fmtEuro(fin.ausgaben)} tone="destructive" />
              <StatCard label="Gewinn" value={fmtEuro(fin.gewinn)} tone={fin.gewinn >= 0 ? "success" : "destructive"} />
            </div>
            <Section title="Zahlungsereignisse" icon={Euro}>
              {projektZahlungen.length === 0 ? (
                <EmptyState>Keine Zahlungsereignisse.</EmptyState>
              ) : (
                <div className="divide-y divide-border">
                  {projektZahlungen.map((z) => (
                    <div key={z.id} className={cn("flex items-center gap-3 py-2.5 text-sm", z.storniert && "opacity-50")}>
                      <span className="badge" style={{ color: z.status_farbe, backgroundColor: `${z.status_farbe}22` }}>
                        {z.status_label}
                      </span>
                      <span className="flex-1 text-muted-foreground">{fmtDateTime(z.datum)}</span>
                      {z.storniert && <span className="text-xs text-destructive">Storniert</span>}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>
        )}
      </Tabs>

      <ProjektFormDialog open={editOpen} onOpenChange={setEditOpen} projekt={projekt} />
      <AddAuftragDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projektId={id}
        auftraege={alleAuftraege.filter((a) => a.projekt_id !== id)}
      />

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{projekt.archiviert ? "Projekt wiederherstellen?" : "Projekt archivieren?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {projekt.archiviert ? "Das Projekt wird wieder aktiv gesetzt." : "Das Projekt wird ins Archiv verschoben."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={doArchive}>Bestätigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projekt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Zugeordnete Aufträge bleiben bestehen, verlieren aber die Projektzuordnung.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddAuftragDialog({
  open, onOpenChange, projektId, auftraege,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projektId: string;
  auftraege: { id: string; auftragsnummer: string; titel: string; kunde_name: string | null; kunde?: { name: string } | null }[];
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return auftraege.slice(0, 50);
    return auftraege
      .filter((a) => `${a.auftragsnummer} ${a.titel} ${a.kunde_name ?? a.kunde?.name ?? ""}`.toLowerCase().includes(needle))
      .slice(0, 50);
  }, [auftraege, q]);

  const add = async (a: { id: string; auftragsnummer: string }) => {
    const { error } = await supabase.from("auftraege").update({ projekt_id: projektId }).eq("id", a.id);
    if (error) return toast.error(error.message);
    await logActivity("auftrag_added", "projekt", projektId, `${a.auftragsnummer} zugeordnet`);
    toast.success("Auftrag zugeordnet.");
    qc.invalidateQueries();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Auftrag zuordnen</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftrag suchen…" className="pl-9" autoFocus />
        </div>
        <div className="max-h-80 divide-y divide-border overflow-y-auto">
          {list.length === 0 ? (
            <EmptyState>Keine Aufträge gefunden.</EmptyState>
          ) : (
            list.map((a) => (
              <button key={a.id} onClick={() => add(a)} className="flex w-full items-center gap-2 py-2.5 text-left text-sm hover:bg-muted/50">
                <span className="text-muted-foreground">{a.auftragsnummer}</span>
                <span className="min-w-0 flex-1 truncate">{a.titel}</span>
                <Plus className="h-4 w-4 text-primary" />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

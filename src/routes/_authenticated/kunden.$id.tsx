import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2, Phone, Mail, MapPin, Globe, User, Calendar, Pencil, Archive,
  Trash2, Plus, FileText, History, Euro, Info, FolderKanban, ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import {
  kundeDetailQuery, zahlungsereignisseAllQuery, logActivity,
} from "@/lib/module-queries";
import {
  auftraegeQuery, auftragUmsatzMapQuery, projekteQuery, dokumenteQuery, profilesQuery,
} from "@/lib/queries";
import { PROJEKT_STATUS_CONFIG, fmtDate, fmtDateTime, fmtEuro, fmtAdresse } from "@/lib/erp";
import type { ProjektStatus } from "@/lib/erp";
import { cn } from "@/lib/utils";
import { BackLink, InfoRow, Section, StatCard, EmptyState } from "@/components/detail/parts";
import { AuftraegeSubList } from "@/components/detail/AuftraegeSubList";
import { DokumenteView } from "@/components/detail/FilesView";
import { VerlaufList } from "@/components/detail/VerlaufList";
import { KundeFormDialog } from "@/components/KundeFormDialog";
import { ProjektFormDialog } from "@/components/ProjektFormDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/kunden/$id")({
  head: () => ({ meta: [{ title: "Auftraggeber – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.auftraggeberView}>
      <KundeDetail />
    </RequirePermission>
  ),
});

function KundeDetail() {
  const { id } = Route.useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = can(PERM.auftraggeberEdit);
  const canDelete = can(PERM.auftraggeberDelete);
  const canFinanzen = can(PERM.auftraggeberFinanzen);

  const { data: kunde, isLoading } = useQuery(kundeDetailQuery(id));
  const { data: profiles = [] } = useQuery(profilesQuery());
  const { data: alleAuftraege = [] } = useQuery(auftraegeQuery());
  const { data: alleProjekte = [] } = useQuery(projekteQuery());
  const { data: umsatzMap = {} } = useQuery(auftragUmsatzMapQuery(canFinanzen));
  const { data: dokumente = [] } = useQuery(dokumenteQuery());
  const { data: zahlungen = [] } = useQuery(zahlungsereignisseAllQuery(canFinanzen));

  const [editOpen, setEditOpen] = useState(false);
  const [projektOpen, setProjektOpen] = useState(false);
  const [projektSuche, setProjektSuche] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const auftraege = useMemo(() => alleAuftraege.filter((a) => a.kunde_id === id), [alleAuftraege, id]);
  const auftragIds = useMemo(() => new Set(auftraege.map((a) => a.id)), [auftraege]);
  const projekte = useMemo(() => alleProjekte.filter((p) => p.kunde_id === id), [alleProjekte, id]);
  const kundeDok = useMemo(() => dokumente.filter((d) => d.auftrag && auftragIds.has(d.auftrag.id)), [dokumente, auftragIds]);
  const kundeZahlungen = useMemo(() => zahlungen.filter((z) => auftragIds.has(z.auftrag_id)), [zahlungen, auftragIds]);

  const projekteGefiltert = useMemo(() => {
    const n = projektSuche.trim().toLowerCase();
    if (!n) return projekte;
    return projekte.filter((p) => `${p.name} ${p.nvt ?? ""} ${fmtAdresse(p)}`.toLowerCase().includes(n));
  }, [projekte, projektSuche]);

  const fin = useMemo(() => {
    const gesamt = auftraege.reduce((s, a) => s + (umsatzMap[a.id] ?? 0), 0);
    const bezahlt = auftraege.filter((a) => a.bezahlt).reduce((s, a) => s + (umsatzMap[a.id] ?? 0), 0);
    const erledigtOffen = auftraege
      .filter((a) => a.abgeschlossen_am && !a.bezahlt)
      .reduce((s, a) => s + (umsatzMap[a.id] ?? 0), 0);
    return { gesamt, bezahlt, erledigtOffen, offen: gesamt - bezahlt };
  }, [auftraege, umsatzMap]);

  const profName = (uid: string | null) => {
    if (!uid) return "—";
    const p = profiles.find((x) => x.id === uid);
    return p ? [p.vorname, p.nachname].filter(Boolean).join(" ") || p.email || "Unbekannt" : "Unbekannt";
  };

  if (isLoading || !kunde) return <p className="text-sm text-muted-foreground">Lädt…</p>;

  const doArchive = async () => {
    const { error } = await supabase.from("kunden").update({ archiviert: !kunde.archiviert }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(kunde.archiviert ? "Wiederhergestellt." : "Archiviert.");
    qc.invalidateQueries();
    setConfirmArchive(false);
  };
  const doDelete = async () => {
    const { error } = await supabase.from("kunden").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Auftraggeber gelöscht.");
    qc.invalidateQueries();
    navigate({ to: "/kunden" });
  };

  return (
    <div className="space-y-5">
      <BackLink to="/kunden" label="Auftraggeber" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{kunde.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {kunde.ansprechpartner && <span>{kunde.ansprechpartner}</span>}
              {kunde.archiviert && <span className="badge bg-muted text-muted-foreground">Archiviert</span>}
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
                <Archive className="h-4 w-4" /> {kunde.archiviert ? "Wiederherstellen" : "Archivieren"}
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
          <TabsTrigger value="projekte">Projekte ({projekte.length})</TabsTrigger>
          <TabsTrigger value="auftraege">Aufträge ({auftraege.length})</TabsTrigger>
          <TabsTrigger value="dokumente">Dokumente</TabsTrigger>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
          {canFinanzen && <TabsTrigger value="finanzen">Finanzen</TabsTrigger>}
        </TabsList>

        <TabsContent value="uebersicht" className="mt-4">
          <Section title="Kontaktdaten" icon={Info}>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow icon={Building2} label="Firmenname">{kunde.name}</InfoRow>
              <InfoRow icon={User} label="Ansprechpartner">{kunde.ansprechpartner || "—"}</InfoRow>
              <InfoRow icon={Phone} label="Telefon">
                {kunde.telefon ? <a href={`tel:${kunde.telefon}`} className="text-primary hover:underline">{kunde.telefon}</a> : "—"}
              </InfoRow>
              <InfoRow icon={Phone} label="Festnetz">{kunde.festnetz || "—"}</InfoRow>
              <InfoRow icon={Mail} label="E-Mail">
                {kunde.email ? <a href={`mailto:${kunde.email}`} className="text-primary hover:underline">{kunde.email}</a> : "—"}
              </InfoRow>
              <InfoRow icon={Globe} label="Website">
                {kunde.website ? <a href={kunde.website.startsWith("http") ? kunde.website : `https://${kunde.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{kunde.website}</a> : "—"}
              </InfoRow>
              <InfoRow icon={MapPin} label="Straße & Nr.">{[kunde.strasse, kunde.hausnummer].filter(Boolean).join(" ") || "—"}</InfoRow>
              <InfoRow icon={MapPin} label="PLZ / Ort">{[kunde.plz, kunde.ort].filter(Boolean).join(" ") || "—"}</InfoRow>
            </div>
            {kunde.notizen && (
              <div className="mt-5 rounded-xl bg-muted/50 p-4 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notizen</p>
                {kunde.notizen}
              </div>
            )}
            <div className="mt-5 grid gap-5 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <InfoRow icon={Calendar} label="Erstellt am">{fmtDateTime(kunde.created_at)}</InfoRow>
              <InfoRow icon={User} label="Erstellt von">{profName(kunde.created_by)}</InfoRow>
              <InfoRow icon={Calendar} label="Zuletzt geändert">{fmtDateTime(kunde.updated_at)}</InfoRow>
              <InfoRow icon={User} label="Geändert von">{profName(kunde.updated_by)}</InfoRow>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="projekte" className="mt-4">
          <Section
            title="Projekte"
            icon={FolderKanban}
            action={can(PERM.projekteCreate) ? (
              <Button size="sm" onClick={() => setProjektOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Neues Projekt
              </Button>
            ) : undefined}
          >
            <div className="mb-3">
              <Input value={projektSuche} onChange={(e) => setProjektSuche(e.target.value)} placeholder="Projekte durchsuchen…" />
            </div>
            {projekteGefiltert.length === 0 ? (
              <EmptyState>Keine Projekte.</EmptyState>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {projekteGefiltert.map((p) => {
                  const cfg = PROJEKT_STATUS_CONFIG[p.status as ProjektStatus];
                  return (
                    <Link key={p.id} to="/projekte/$id" params={{ id: p.id }} className="block rounded-xl border border-border bg-background p-4 hover:border-primary/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{p.name}</span>
                        {cfg && <span className={cn("badge", cfg.cls)}>{cfg.label}</span>}
                      </div>
                      {fmtAdresse(p) && <p className="mt-1 text-xs text-muted-foreground">{fmtAdresse(p)}</p>}
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="auftraege" className="mt-4">
          <AuftraegeSubList auftraege={auftraege} umsatzMap={canFinanzen ? umsatzMap : undefined} />
        </TabsContent>

        <TabsContent value="dokumente" className="mt-4">
          <Section title="Dokumente" icon={FileText}>
            <DokumenteView dokumente={kundeDok} />
          </Section>
        </TabsContent>

        <TabsContent value="verlauf" className="mt-4">
          <Section title="Verlauf" icon={History}>
            <VerlaufList entityType="kunde" entityId={id} />
          </Section>
        </TabsContent>

        {canFinanzen && (
          <TabsContent value="finanzen" className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Gesamtumsatz" value={fmtEuro(fin.gesamt)} tone="primary" />
              <StatCard label="Bezahlt" value={fmtEuro(fin.bezahlt)} tone="success" />
              <StatCard label="Erledigt, nicht bezahlt" value={fmtEuro(fin.erledigtOffen)} tone="warning" />
              <StatCard label="Offen" value={fmtEuro(fin.offen)} tone="warning" />
              <StatCard label="Anzahl Aufträge" value={auftraege.length} />
              <StatCard label="Anzahl Projekte" value={projekte.length} />
            </div>
            <Section title="Zahlungsereignisse" icon={Euro}>
              {kundeZahlungen.length === 0 ? (
                <EmptyState>Keine Zahlungsereignisse.</EmptyState>
              ) : (
                <div className="divide-y divide-border">
                  {kundeZahlungen.map((z) => (
                    <div key={z.id} className={cn("flex items-center gap-3 py-2.5 text-sm", z.storniert && "opacity-50")}>
                      <span className="badge" style={{ color: z.status_farbe, backgroundColor: `${z.status_farbe}22` }}>{z.status_label}</span>
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

      <KundeFormDialog open={editOpen} onOpenChange={setEditOpen} kunde={kunde} />
      <ProjektFormDialog open={projektOpen} onOpenChange={setProjektOpen} defaultKundeId={id} />

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{kunde.archiviert ? "Wiederherstellen?" : "Archivieren?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {kunde.archiviert ? "Der Auftraggeber wird wieder aktiv gesetzt." : "Der Auftraggeber wird ins Archiv verschoben."}
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
            <AlertDialogTitle>Auftraggeber löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  User, Phone, Mail, Pencil, Trash2, Plus, History, Info, Calendar,
  Briefcase, Truck, CalendarDays, Link2, Link2Off, BadgeCheck, ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import {
  mitarbeiterDetailQuery, ausstattungQuery, urlaubForMitarbeiterQuery,
  ausstattungTypLabel, urlaubTypLabel, URLAUB_STATUS, logActivity, profilesExtendedQuery,
  type AusstattungRow, type UrlaubRow,

} from "@/lib/module-queries";
import {
  auftraegeQuery, auftragUmsatzMapQuery, mitarbeiterQuery,
} from "@/lib/queries";


import { blockerQuery, blockerTyp } from "@/lib/blocker";
import { fmtDate, fmtDateTime, fmtEuro, initials } from "@/lib/erp";
import { cn } from "@/lib/utils";
import { BackLink, InfoRow, Section, StatCard, EmptyState } from "@/components/detail/parts";
import { AuftraegeSubList } from "@/components/detail/AuftraegeSubList";
import { VerlaufList } from "@/components/detail/VerlaufList";
import { MitarbeiterFormDialog } from "@/components/MitarbeiterFormDialog";
import { VerguetungTab } from "@/components/mitarbeiter/VerguetungTab";
import { AusstattungDialog } from "@/components/AusstattungDialog";
import { UrlaubDialog } from "@/components/UrlaubDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/mitarbeiter/$id")({
  head: () => ({ meta: [{ title: "Mitarbeiter – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.mitarbeiterView}>
      <MitarbeiterDetail />
    </RequirePermission>
  ),
});

function MitarbeiterDetail() {
  const { id } = Route.useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = can(PERM.mitarbeiterEdit);
  const canDelete = can(PERM.mitarbeiterDelete);
  const canLeistung = can(PERM.mitarbeiterLeistung);
  const canGehaltView = can(PERM.gehaltView) || can(PERM.mitarbeiterGehalt);
  const canAusstattungView = can(PERM.mitarbeiterAusstattungView);
  const canAusstattungAssign = can(PERM.mitarbeiterAusstattungAssign);
  const canUrlaub = can(PERM.mitarbeiterUrlaubManage);
  const canUmsatz = canLeistung; // performance revenue gated by Leistung permission

  const { data: m, isLoading } = useQuery(mitarbeiterDetailQuery(id));
  const { data: profiles = [] } = useQuery(profilesExtendedQuery());
  const { data: alleMitarbeiter = [] } = useQuery(mitarbeiterQuery());

  const { data: alleAuftraege = [] } = useQuery(auftraegeQuery());
  const { data: umsatzMap = {} } = useQuery(auftragUmsatzMapQuery(canUmsatz));
  const { data: blocker = [] } = useQuery(blockerQuery());
  const { data: ausstattung = [] } = useQuery(ausstattungQuery(id));
  const { data: urlaub = [] } = useQuery(urlaubForMitarbeiterQuery(id));

  const [editOpen, setEditOpen] = useState(false);
  const [ausstOpen, setAusstOpen] = useState(false);
  const [ausstEdit, setAusstEdit] = useState<AusstattungRow | null>(null);
  const [urlaubOpen, setUrlaubOpen] = useState(false);
  const [urlaubEdit, setUrlaubEdit] = useState<UrlaubRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const auftraege = useMemo(
    () => alleAuftraege.filter((a) => a.zuweisungen.some((z) => z.mitarbeiter?.id === id)),
    [alleAuftraege, id],
  );
  const mBlocker = useMemo(() => blocker.filter((b) => b.mitarbeiter_id === id), [blocker, id]);

  const linkedProfile = useMemo(
    () => (m?.linked_user_id ? profiles.find((p) => p.id === m.linked_user_id) : null),
    [m, profiles],
  );

  const leistung = useMemo(() => {
    const done = auftraege.filter((a) => a.abgeschlossen_am);
    const open = auftraege.filter((a) => !a.abgeschlossen_am);
    const umsatz = auftraege.reduce((s, a) => s + (umsatzMap[a.id] ?? 0), 0);
    const now = new Date();
    const monthDays = new Set(
      done
        .filter((a) => {
          const d = a.abgeschlossen_am ? new Date(a.abgeschlossen_am) : null;
          return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .map((a) => new Date(a.abgeschlossen_am!).toDateString()),
    );
    // per-month completed counts (last 6 months)
    const byMonth: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const count = done.filter((a) => {
        const x = new Date(a.abgeschlossen_am!);
        return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear();
      }).length;
      byMonth.push({ label: d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }), count });
    }
    return { done: done.length, open: open.length, umsatz, workedDays: monthDays.size, byMonth };
  }, [auftraege, umsatzMap]);

  const profName = (uid: string | null) => {
    if (!uid) return "—";
    const p = profiles.find((x) => x.id === uid);
    return p ? [p.vorname, p.nachname].filter(Boolean).join(" ") || p.email || "Unbekannt" : "Unbekannt";
  };

  if (isLoading || !m) return <p className="text-sm text-muted-foreground">Lädt…</p>;

  const doDelete = async () => {
    const { error } = await supabase.from("mitarbeiter").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Mitarbeiter gelöscht.");
    qc.invalidateQueries();
    navigate({ to: "/mitarbeiter" });
  };
  const toggleAktiv = async () => {
    const { error } = await supabase.from("mitarbeiter").update({ aktiv: !m.aktiv }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(m.aktiv ? "Deaktiviert." : "Aktiviert.");
    qc.invalidateQueries();
  };
  const setLinkedUser = async (uid: string | null) => {
    const { error } = await supabase.from("mitarbeiter").update({ linked_user_id: uid }).eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity(uid ? "link" : "unlink", "mitarbeiter", id, `${m.vorname} ${m.nachname}`);
    toast.success(uid ? "Benutzer verknüpft." : "Verknüpfung entfernt.");
    qc.invalidateQueries();
    setLinkOpen(false);
  };

  const linkedElsewhere = new Set(
    alleMitarbeiter.filter((x) => x.id !== id && x.linked_user_id).map((x) => x.linked_user_id as string),
  );
  const linkableProfiles = profiles.filter(
    (p) => !p.disabled && (p.id === m.linked_user_id || !linkedElsewhere.has(p.id)),
  );


  return (
    <div className="space-y-5">
      <BackLink to="/mitarbeiter" label="Mitarbeiter" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full text-base font-bold text-white" style={{ backgroundColor: m.farbe }}>
            {initials(m.vorname, m.nachname)}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{m.vorname} {m.nachname}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{m.rolle || m.position || "Mitarbeiter"}</span>
              {m.aktiv ? (
                <span className="badge bg-success/15 text-success">Aktiv</span>
              ) : (
                <span className="badge bg-muted text-muted-foreground">Inaktiv</span>
              )}
              {m.linked_user_id && <span className="badge bg-primary/10 text-primary"><Link2 className="mr-1 inline h-3 w-3" />Verknüpft</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
                <Pencil className="h-4 w-4" /> Bearbeiten
              </Button>
              <Button variant="outline" size="sm" onClick={toggleAktiv} className="gap-1.5">
                <BadgeCheck className="h-4 w-4" /> {m.aktiv ? "Deaktivieren" : "Aktivieren"}
              </Button>
            </>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="gap-1.5 text-destructive">
              <Trash2 className="h-4 w-4" /> Löschen
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="uebersicht">
        <TabsList className="flex-wrap">
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="auftraege">Aufträge ({auftraege.length})</TabsTrigger>
          <TabsTrigger value="kalender">Kalender</TabsTrigger>
          <TabsTrigger value="urlaub">Urlaub</TabsTrigger>
          {canAusstattungView && <TabsTrigger value="ausstattung">Ausstattung</TabsTrigger>}
          {canLeistung && <TabsTrigger value="leistung">Leistung</TabsTrigger>}
          {canGehaltView && <TabsTrigger value="verguetung">Vergütung</TabsTrigger>}
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
        </TabsList>

        <TabsContent value="uebersicht" className="mt-4">
          <Section
            title="Stammdaten"
            icon={Info}
            action={canEdit ? (
              <Button size="sm" variant="outline" onClick={() => setLinkOpen((o) => !o)} className="gap-1.5">
                {m.linked_user_id ? <Link2Off className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                Benutzer {m.linked_user_id ? "verwalten" : "verknüpfen"}
              </Button>
            ) : undefined}
          >
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow icon={User} label="Name">{m.vorname} {m.nachname}</InfoRow>
              <InfoRow icon={Mail} label="E-Mail">{m.email || "—"}</InfoRow>
              <InfoRow icon={Phone} label="Telefon">
                {m.telefon ? <a href={`tel:${m.telefon}`} className="text-primary hover:underline">{m.telefon}</a> : "—"}
              </InfoRow>
              <InfoRow icon={Briefcase} label="Rolle">{m.rolle || m.position || "—"}</InfoRow>
              <InfoRow icon={BadgeCheck} label="Status">{m.aktiv ? "Aktiv" : "Inaktiv"}</InfoRow>
              <InfoRow icon={Link2} label="Benutzerkonto">
                {linkedProfile ? (linkedProfile.email ?? "Verknüpft") : "Nicht verknüpft"}
              </InfoRow>
              <InfoRow icon={Calendar} label="Erstellt am">{fmtDateTime(m.created_at)}</InfoRow>
              <InfoRow icon={Calendar} label="Letzter Login">
                {linkedProfile?.last_login_at ? fmtDateTime(linkedProfile.last_login_at) : "—"}
              </InfoRow>
            </div>

            {linkOpen && canEdit && (
              <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
                <p className="mb-2 text-sm font-semibold">Benutzerkonto verknüpfen</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={m.linked_user_id ?? "none"} onValueChange={(v) => setLinkedUser(v === "none" ? null : v)}>
                    <SelectTrigger className="w-72"><SelectValue placeholder="Benutzer auswählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Verknüpfung</SelectItem>
                      {linkableProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {[p.vorname, p.nachname].filter(Boolean).join(" ") || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {m.notizen && (
              <div className="mt-5 rounded-xl bg-muted/50 p-4 text-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notizen</p>
                {m.notizen}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="auftraege" className="mt-4">
          <AuftraegeSubList auftraege={auftraege} umsatzMap={canUmsatz ? umsatzMap : undefined} />
        </TabsContent>

        <TabsContent value="kalender" className="mt-4 space-y-4">
          <Section
            title="Termine"
            icon={CalendarDays}
            action={<Link to="/kalender" className="text-sm text-primary hover:underline">Zum Kalender</Link>}
          >
            {auftraege.filter((a) => a.termin_start).length === 0 ? (
              <EmptyState>Keine Termine.</EmptyState>
            ) : (
              <div className="divide-y divide-border">
                {auftraege
                  .filter((a) => a.termin_start)
                  .sort((a, b) => (a.termin_start ?? "").localeCompare(b.termin_start ?? ""))
                  .map((a) => (
                    <Link key={a.id} to="/auftraege/$id" params={{ id: a.id }} className="flex items-center gap-3 py-2.5 text-sm hover:bg-muted/40">
                      <span className="w-32 shrink-0 text-muted-foreground">{fmtDateTime(a.termin_start)}</span>
                      <span className="min-w-0 flex-1 truncate">{a.titel}</span>
                    </Link>
                  ))}
              </div>
            )}
          </Section>
          <Section title="Sperrzeiten & Abwesenheiten" icon={CalendarDays}>
            {mBlocker.length === 0 ? (
              <EmptyState>Keine Sperrzeiten.</EmptyState>
            ) : (
              <div className="divide-y divide-border">
                {mBlocker.map((b) => {
                  const t = blockerTyp(b.typ);
                  return (
                    <div key={b.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="badge" style={{ color: t.farbe, backgroundColor: `${t.farbe}22` }}>{t.label}</span>
                      <span className="min-w-0 flex-1 truncate">{b.titel}</span>
                      <span className="text-xs text-muted-foreground">{fmtDateTime(b.start_zeit)} – {fmtDateTime(b.end_zeit)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="urlaub" className="mt-4">
          <Section
            title="Urlaub & Abwesenheit"
            icon={CalendarDays}
            action={(canUrlaub || canEdit) ? (
              <Button size="sm" onClick={() => { setUrlaubEdit(null); setUrlaubOpen(true); }} className="gap-1.5">
                <Plus className="h-4 w-4" /> Eintrag
              </Button>
            ) : undefined}
          >
            {urlaub.length === 0 ? (
              <EmptyState>Keine Einträge.</EmptyState>
            ) : (
              <div className="divide-y divide-border">
                {urlaub.map((u) => {
                  const st = URLAUB_STATUS[u.status] ?? { label: u.status, cls: "bg-muted text-muted-foreground" };
                  return (
                    <button
                      key={u.id}
                      onClick={() => canUrlaub ? (setUrlaubEdit(u), setUrlaubOpen(true)) : undefined}
                      className={cn("flex w-full items-center gap-3 py-2.5 text-left text-sm", canUrlaub && "hover:bg-muted/40")}
                    >
                      <span className="badge bg-muted text-foreground">{urlaubTypLabel(u.typ)}</span>
                      <span className="min-w-0 flex-1">{fmtDate(u.start_datum)} – {fmtDate(u.end_datum)}</span>
                      <span className={cn("badge", st.cls)}>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Section>
        </TabsContent>

        {canAusstattungView && (
          <TabsContent value="ausstattung" className="mt-4">
            <Section
              title="Ausstattung"
              icon={Truck}
              action={canAusstattungAssign ? (
                <Button size="sm" onClick={() => { setAusstEdit(null); setAusstOpen(true); }} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Zuweisen
                </Button>
              ) : undefined}
            >
              {ausstattung.length === 0 ? (
                <EmptyState>Keine Ausstattung zugewiesen.</EmptyState>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {ausstattung.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => canAusstattungAssign ? (setAusstEdit(a), setAusstOpen(true)) : undefined}
                      className={cn("rounded-xl border border-border bg-background p-4 text-left", canAusstattungAssign && "hover:border-primary/40")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{a.bezeichnung}</span>
                        <span className="badge bg-muted text-muted-foreground">{ausstattungTypLabel(a.typ)}</span>
                      </div>
                      <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {a.kennzeichen && <p>Kennzeichen: {a.kennzeichen}</p>}
                        {a.seriennummer && <p>S/N: {a.seriennummer}</p>}
                        {a.ausgabe_datum && <p>Ausgabe: {fmtDate(a.ausgabe_datum)}</p>}
                        {a.rueckgabe_datum && <p>Rückgabe: {fmtDate(a.rueckgabe_datum)}</p>}
                        {a.notiz && <p>{a.notiz}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>
        )}

        {canLeistung && (
          <TabsContent value="leistung" className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Erledigte Aufträge" value={leistung.done} tone="success" />
              <StatCard label="Offene Aufträge" value={leistung.open} tone="warning" />
              <StatCard label="Umsatz generiert" value={fmtEuro(leistung.umsatz)} tone="primary" />
              <StatCard label="Arbeitstage (Monat)" value={leistung.workedDays} />
            </div>
            <Section title="Leistung pro Monat" icon={ClipboardList}>
              <div className="flex items-end gap-3">
                {leistung.byMonth.map((mo) => {
                  const max = Math.max(1, ...leistung.byMonth.map((x) => x.count));
                  return (
                    <div key={mo.label} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-semibold">{mo.count}</span>
                      <div className="flex h-24 w-full items-end">
                        <div className="w-full rounded-t bg-primary/70" style={{ height: `${(mo.count / max) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{mo.label}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          </TabsContent>
        )}

        {canGehaltView && (
          <TabsContent value="verguetung" className="mt-4">
            <VerguetungTab
              mitarbeiterId={id}
              auftraege={auftraege}
              umsatzMap={umsatzMap}
              canViewPerf={canLeistung}
            />
          </TabsContent>
        )}

        <TabsContent value="verlauf" className="mt-4">
          <Section title="Verlauf" icon={History}>
            <VerlaufList entityType="mitarbeiter" entityId={id} />
          </Section>
        </TabsContent>
      </Tabs>

      <MitarbeiterFormDialog open={editOpen} onOpenChange={setEditOpen} mitarbeiter={m} />
      <AusstattungDialog open={ausstOpen} onOpenChange={setAusstOpen} mitarbeiterId={id} eintrag={ausstEdit} />
      <UrlaubDialog open={urlaubOpen} onOpenChange={setUrlaubOpen} mitarbeiterId={id} eintrag={urlaubEdit} canManage={canUrlaub} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitarbeiter löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Erwägen Sie stattdessen die Deaktivierung.
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


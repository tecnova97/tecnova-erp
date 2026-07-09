import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Navigation,
  Pencil,
  Upload,
  CheckCircle2,
  Camera,
  FileText,
  Clock,
  Building2,
  FolderKanban,
  AlertTriangle,
  Trash2,
  EyeOff,
  Eye,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  auftragQuery,
  fotosForAuftragQuery,
  dokumenteForAuftragQuery,
  historieQuery,
  profilesQuery,
  createSignedUrl,
  type HistorieRow,
} from "@/lib/queries";
import { useStatuses, statusStyle } from "@/lib/status";
import { logHistorie, HISTORIE_TYP_LABEL, type HistorieTyp } from "@/lib/historie";
import { fmtDateTime, fmtDate, fmtRelative, fmtBytes, fmtStrasse, fmtOrt, initials } from "@/lib/erp";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { MultiStatusBadges } from "@/components/badges";
import { SignedImage } from "@/components/SignedImage";
import { AuftragFormDialog } from "@/components/AuftragFormDialog";
import { AuftragLeistungen } from "@/components/AuftragLeistungen";
import { AuftragStatusManager } from "@/components/AuftragStatusManager";
import { AuftragAusgaben } from "@/components/AuftragAusgaben";
import { AuftragZahlungen } from "@/components/AuftragZahlungen";
import { WorkerCompleteDialog } from "@/components/WorkerCompleteDialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/** Where the user opened this Auftrag from — drives the "Zurück" target/label. */
type DetailSource = "dashboard" | "auftraege" | "kalender" | "mobile";

export const Route = createFileRoute("/_authenticated/auftraege/$id")({
  validateSearch: (search: Record<string, unknown>): { source?: DetailSource } => {
    const s = search.source;
    return {
      source:
        s === "dashboard" || s === "auftraege" || s === "kalender" || s === "mobile"
          ? s
          : undefined,
    };
  },
  component: () => (
    <RequirePermission perm={PERM.auftraegeView}>
      <AuftragDetailPage />
    </RequirePermission>
  ),
});

function AuftragDetailPage() {
  const { id } = Route.useParams();
  const { source } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { isStaff, role, user, can } = useAuth();
  const canEdit = can(PERM.auftraegeEdit);
  const canDeleteAuftrag = can(PERM.auftraegeDelete);
  const { get: getStatus } = useStatuses();
  const { data: a, isLoading } = useQuery(auftragQuery(id));
  const { data: fotos = [] } = useQuery(fotosForAuftragQuery(id));
  const { data: dokumente = [] } = useQuery(dokumenteForAuftragQuery(id));
  const { data: historie = [] } = useQuery(historieQuery(id));
  const { data: profiles = [] } = useQuery(profilesQuery());
  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; pdf: boolean } | null>(null);
  const fotoInput = useRef<HTMLInputElement>(null);
  const kameraInput = useRef<HTMLInputElement>(null);
  const dokInput = useRef<HTMLInputElement>(null);

  const isOwner = role === "owner";
  const userName = (uid: string | null) => {
    if (!uid) return "System";
    const p = profiles.find((x) => x.id === uid);
    return p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "Unbekannt" : "Unbekannt";
  };

  const backLabel =
    source === "dashboard"
      ? "Zurück zum Dashboard"
      : source === "kalender"
        ? "Zurück zum Kalender"
        : "Zurück zu Aufträgen";

  // Prefer real browser history so the previous list restores its exact scroll
  // position (and we return to wherever the user actually came from). Only fall
  // back to an explicit route when there is no in-app history (e.g. deep link).
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
      return;
    }
    switch (source) {
      case "dashboard":
        navigate({ to: "/dashboard" });
        break;
      case "kalender":
        navigate({ to: "/kalender" });
        break;
      default:
        navigate({ to: "/auftraege" });
    }
  };

  if (isLoading || !a) {
    return <p className="text-sm text-muted-foreground">Lädt…</p>;
  }

  const ma = a.zuweisungen.map((z) => z.mitarbeiter).filter(Boolean);
  const adresse = [fmtStrasse(a), fmtOrt(a)].filter(Boolean).join(", ");
  const tel = a.kunde_telefon ?? null;
  const isDone = getStatus(a.status).ist_abschluss;

  const openNavigation = () => {
    if (!adresse) {
      toast.error("Keine Adresse vorhanden.");
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const deleteAuftrag = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("auftraege").delete().eq("id", id);
      if (error) throw error;
      toast.success("Auftrag wurde gelöscht.");
      setDeleteOpen(false);
      await qc.invalidateQueries();
      navigate({ to: "/auftraege" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auftrag konnte nicht gelöscht werden.");
    } finally {
      setDeleting(false);
    }
  };
  // WorkerCompleteDialog (multi-status engine + guided completion flow).

  // Payment is now derived automatically from the assigned status (ist_bezahlt).


  const uploadFotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("fotos").upload(path, file);
        if (upErr) throw upErr;
        const { error: insErr } = await supabase
          .from("fotos")
          .insert({ auftrag_id: id, storage_path: path, dateiname: file.name, uploaded_by: u.user?.id });
        if (insErr) throw insErr;
      }
      await logHistorie(id, "Fotos hochgeladen", `${files.length} Foto(s) hinzugefügt`, "foto");
      toast.success("Fotos hochgeladen.");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const uploadDok = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("dokumente").upload(path, file);
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("dokumente").insert({
          auftrag_id: id,
          storage_path: path,
          dateiname: file.name,
          dateityp: file.type,
          groesse: file.size,
          uploaded_by: u.user?.id,
        });
        if (insErr) throw insErr;
      }
      await logHistorie(id, "Dokument hochgeladen", `${files.length} Datei(en) hinzugefügt`, "datei");
      toast.success("Dokumente hochgeladen.");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async (bucket: string, path: string, name: string, pdf: boolean) => {
    const url = await createSignedUrl(bucket, path);
    if (url) setPreview({ url, name, pdf });
  };

  const deleteFoto = async (fotoId: string, path: string) => {
    if (!confirm("Foto wirklich löschen?")) return;
    await supabase.storage.from("fotos").remove([path]);
    await supabase.from("fotos").delete().eq("id", fotoId);
    await logHistorie(id, "Foto gelöscht", null, "foto");
    toast.success("Foto gelöscht.");
    qc.invalidateQueries();
  };

  const deleteDok = async (dokId: string, path: string) => {
    if (!confirm("Datei wirklich löschen?")) return;
    await supabase.storage.from("dokumente").remove([path]);
    await supabase.from("dokumente").delete().eq("id", dokId);
    await logHistorie(id, "Datei gelöscht", null, "datei");
    toast.success("Datei gelöscht.");
    qc.invalidateQueries();
  };

  const canDelete = (uploadedBy: string | null) => isStaff || uploadedBy === user?.id;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{a.auftragsnummer}</span>
              <MultiStatusBadges auftrag={a} />
              
              {a.bezahlt && (
                <span className="badge-status" style={{ color: "#16a34a", backgroundColor: "rgba(22,163,74,0.13)" }}>
                  Bezahlt
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight">{a.titel}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-2">
                <Pencil className="h-4 w-4" /> Bearbeiten
              </Button>
            )}
            {canDeleteAuftrag && (
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(true)}
                className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Löschen
              </Button>
            )}
          </div>
        </div>

        {a.wichtiginfo && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm font-medium text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="whitespace-pre-wrap">{a.wichtiginfo}</span>
          </div>
        )}

        {/* Worker quick actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tel && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href={`tel:${tel}`}><Phone className="h-4 w-4" /> Anrufen</a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={openNavigation}>
            <Navigation className="h-4 w-4" /> Navigation
          </Button>
          {!isDone && (
            <Button onClick={() => setCompleteOpen(true)} size="sm" className="gap-2 bg-success text-success-foreground hover:bg-success/90">
              <CheckCircle2 className="h-4 w-4" /> Abschließen
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="uebersicht">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="dateien">Dokumente & Fotos</TabsTrigger>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
        </TabsList>

        {/* ÜBERSICHT */}
        <TabsContent value="uebersicht" className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="grid gap-4 sm:grid-cols-2">
              {a.kunde && <InfoRow icon={Building2} label="Auftraggeber">{a.kunde.name}</InfoRow>}
              {a.projekt && <InfoRow icon={FolderKanban} label="Projekt">{a.projekt.name}</InfoRow>}
              {a.kunde_name && <InfoRow icon={Building2} label="Kunde">{a.kunde_name}</InfoRow>}
              {a.termin_start && <InfoRow icon={Clock} label="Termin">{fmtDateTime(a.termin_start)} Uhr</InfoRow>}
              {tel && (
                <InfoRow icon={Phone} label="Telefon">
                  <a href={`tel:${tel}`} className="text-primary">{tel}</a>
                </InfoRow>
              )}
              {a.kunde_email && (
                <InfoRow icon={Mail} label="E-Mail">
                  <a href={`mailto:${a.kunde_email}`} className="text-primary">{a.kunde_email}</a>
                </InfoRow>
              )}
              {adresse && (
                <InfoRow icon={MapPin} label="Adresse">
                  <span>{adresse}</span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-primary"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Route
                  </a>
                </InfoRow>
              )}
            </div>

            {ma.length > 0 && (
              <div className="mt-5">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zugewiesene Mitarbeiter</p>
                <div className="flex flex-wrap gap-2">
                  {ma.map((m) => (
                    <span key={m!.id} className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-sm">
                      <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: m!.farbe }}>
                        {initials(m!.vorname, m!.nachname)}
                      </span>
                      {m!.vorname} {m!.nachname}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {a.beschreibung && (
              <div className="mt-5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beschreibung</p>
                <p className="whitespace-pre-wrap text-sm">{a.beschreibung}</p>
              </div>
            )}

            {isStaff && a.interne_notizen && (
              <div className="mt-5 rounded-xl bg-muted p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interne Notizen</p>
                <p className="whitespace-pre-wrap text-sm">{a.interne_notizen}</p>
              </div>
            )}
          </div>

          {/* Multi-Status-Verwaltung (mehrere Status, Sichtbarkeit, Reihenfolge, Berechtigungen) */}
          <AuftragStatusManager auftragId={a.id} />

          <AuftragZahlungen auftragId={a.id} />


          <AuftragLeistungen auftragId={a.id} />

          <AuftragAusgaben auftragId={a.id} />
        </TabsContent>


        {/* DOKUMENTE & FOTOS */}
        <TabsContent value="dateien" className="space-y-5">
          <Section title="Fotos" icon={Camera} action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => kameraInput.current?.click()} className="gap-2">
                <Camera className="h-4 w-4" /> Foto aufnehmen
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => fotoInput.current?.click()} className="gap-2">
                <ImageIcon className="h-4 w-4" /> Aus Galerie/Dateien
              </Button>
            </div>
          }>
            <input ref={fotoInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadFotos(e.target.files)} />
            <input ref={kameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => uploadFotos(e.target.files)} />
            {fotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Fotos.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {fotos.map((f) => (
                  <div key={f.id} className="group relative overflow-hidden rounded-xl border border-border">
                    <button onClick={() => openPreview("fotos", f.storage_path, f.dateiname ?? "Foto", false)} className="block aspect-square w-full">
                      <SignedImage bucket="fotos" path={f.storage_path} alt={f.dateiname ?? "Foto"} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] text-white">
                      {userName(f.uploaded_by)} · {fmtDate(f.created_at)}
                    </div>
                    {canDelete(f.uploaded_by) && (
                      <button onClick={() => deleteFoto(f.id, f.storage_path)} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Dokumente" icon={FileText} action={
            <Button size="sm" variant="outline" disabled={busy} onClick={() => dokInput.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Datei hochladen
            </Button>
          }>
            <input ref={dokInput} type="file" accept="image/*,.pdf,.doc,.docx" multiple className="hidden" onChange={(e) => uploadDok(e.target.files)} />
            {dokumente.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Dokumente.</p>
            ) : (
              <ul className="divide-y divide-border">
                {dokumente.map((d) => {
                  const isPdf = (d.dateityp ?? "").includes("pdf") || (d.dateiname ?? "").toLowerCase().endsWith(".pdf");
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{d.dateiname}</span>
                          <span className="block text-xs text-muted-foreground">
                            {userName(d.uploaded_by)} · {fmtDateTime(d.created_at)} · {fmtBytes(d.groesse)}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openPreview("dokumente", d.storage_path, d.dateiname, isPdf)}>
                          {isPdf ? "Vorschau" : "Öffnen"}
                        </Button>
                        {canDelete(d.uploaded_by) && (
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteDok(d.id, d.storage_path)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </TabsContent>

        {/* VERLAUF */}
        <TabsContent value="verlauf">
          <VerlaufTab
            historie={historie}
            isOwner={isOwner}
            userName={userName}
            profiles={profiles}
            onChanged={() => qc.invalidateQueries()}
          />
        </TabsContent>
      </Tabs>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">{preview?.name}</DialogTitle>
          <button onClick={() => setPreview(null)} className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/80 text-foreground shadow-soft">
            <X className="h-4 w-4" />
          </button>
          {preview?.pdf ? (
            <iframe src={preview.url} title={preview.name} className="h-[75vh] w-full rounded-lg" />
          ) : preview ? (
            <img src={preview.url} alt={preview.name} className="max-h-[80vh] w-full rounded-lg object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>

      {canEdit && <AuftragFormDialog open={editOpen} onOpenChange={setEditOpen} auftrag={a} />}

      <WorkerCompleteDialog open={completeOpen} onOpenChange={setCompleteOpen} auftrag={a} />

      {canDeleteAuftrag && (
        <AlertDialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Auftrag löschen</AlertDialogTitle>
              <AlertDialogDescription>
                Auftrag wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  deleteAuftrag();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Löscht…" : "Endgültig löschen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function VerlaufTab({
  historie,
  isOwner,
  userName,
  profiles,
  onChanged,
}: {
  historie: HistorieRow[];
  isOwner: boolean;
  userName: (uid: string | null) => string;
  profiles: { id: string; vorname: string | null; nachname: string | null; email: string | null }[];
  onChanged: () => void;
}) {
  const [typFilter, setTypFilter] = useState<string>("alle");
  const [userFilter, setUserFilter] = useState<string>("alle");
  const [dateFilter, setDateFilter] = useState<string>("");

  const usersInHistory = useMemo(() => {
    const ids = [...new Set(historie.map((h) => h.user_id).filter(Boolean))] as string[];
    return ids.map((id) => ({ id, name: userName(id) }));
  }, [historie, userName]);

  const filtered = historie.filter((h) => {
    if (!isOwner && !h.sichtbar) return false;
    if (typFilter !== "alle" && h.typ !== typFilter) return false;
    if (userFilter !== "alle" && h.user_id !== userFilter) return false;
    if (dateFilter && !h.created_at.startsWith(dateFilter)) return false;
    return true;
  });

  const toggleSichtbar = async (h: HistorieRow) => {
    await supabase.from("auftrag_historie").update({ sichtbar: !h.sichtbar } as never).eq("id", h.id);
    toast.success(h.sichtbar ? "Eintrag ausgeblendet." : "Eintrag eingeblendet.");
    onChanged();
  };

  const remove = async (h: HistorieRow) => {
    if (!confirm("Verlaufseintrag löschen?")) return;
    await supabase.from("auftrag_historie").delete().eq("id", h.id);
    toast.success("Eintrag gelöscht.");
    onChanged();
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap gap-2">
        <Select value={typFilter} onValueChange={setTypFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Aktionstyp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Aktionen</SelectItem>
            {(Object.keys(HISTORIE_TYP_LABEL) as HistorieTyp[]).map((t) => (
              <SelectItem key={t} value={t}>{HISTORIE_TYP_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Benutzer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Benutzer</SelectItem>
            {usersInHistory.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePicker
          value={dateFilter}
          onChange={setDateFilter}
          className="w-auto text-sm"
        />
        {(typFilter !== "alle" || userFilter !== "alle" || dateFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setTypFilter("alle"); setUserFilter("alle"); setDateFilter(""); }}>
            Zurücksetzen
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Verlaufseinträge.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((h) => (
            <li key={h.id} className={`flex gap-3 text-sm ${!h.sichtbar ? "opacity-50" : ""}`}>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-tight">
                  {h.aktion}
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {HISTORIE_TYP_LABEL[h.typ as HistorieTyp] ?? h.typ}
                  </span>
                </p>
                {h.details && <p className="text-xs text-muted-foreground">{h.details}</p>}
                <p className="text-xs text-muted-foreground">
                  {userName(h.user_id)} · {fmtDateTime(h.created_at)} ({fmtRelative(h.created_at)})
                </p>
              </div>
              {isOwner && (
                <span className="flex shrink-0 items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleSichtbar(h)}>
                    {h.sichtbar ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(h)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof Camera;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

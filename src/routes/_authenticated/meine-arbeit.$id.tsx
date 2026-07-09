import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  Building2,
  MapPin,
  Mail,
  FolderKanban,
  AlertTriangle,
  Users,
  Info,
  Files,
  History,
  FileText,
  ImageIcon,
  X,
  Loader2,
} from "lucide-react";
import {
  auftragQuery,
  fotosForAuftragQuery,
  dokumenteForAuftragQuery,
  historieQuery,
  profilesQuery,
  createSignedUrl,
} from "@/lib/queries";
import { documentsQuery, currentVersion, fileCategory } from "@/lib/dms";
import { useStatuses, statusStyle } from "@/lib/status";
import { HISTORIE_TYP_LABEL, type HistorieTyp } from "@/lib/historie";
import { fmtDateTime, fmtStrasse, fmtOrt, fmtAdresse, fmtRelative } from "@/lib/erp";
import { RequirePermission } from "@/components/PermissionGuard";
import { PERM } from "@/lib/permissions";
import { MultiStatusBadges } from "@/components/badges";
import { SignedImage } from "@/components/SignedImage";
import { CompletionWizard } from "@/components/worker/CompletionWizard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meine-arbeit/$id")({
  component: () => (
    <RequirePermission perm={PERM.auftraegeView}>
      <MobileDetailPage />
    </RequirePermission>
  ),
});

function MobileDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
      return;
    }
    navigate({ to: "/meine-arbeit" });
  };
  const { get } = useStatuses();
  const { data: a, isLoading } = useQuery(auftragQuery(id));
  const { data: fotos = [] } = useQuery(fotosForAuftragQuery(id));
  const { data: dokumente = [] } = useQuery(dokumenteForAuftragQuery(id));
  const { data: allDmsDocs = [] } = useQuery(documentsQuery());
  const { data: historie = [] } = useQuery(historieQuery(id));
  const { data: profiles = [] } = useQuery(profilesQuery());

  const [wizardOpen, setWizardOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; pdf: boolean } | null>(null);

  if (isLoading || !a) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const workers = a.zuweisungen.map((z) => z.mitarbeiter).filter(Boolean);
  const adresse = fmtAdresse(a);
  const tel = a.kunde_telefon ?? null;
  const festnetz = a.kunde_festnetz ?? null;
  const callNumber = tel ?? festnetz;
  const isDone = get(a.status).ist_abschluss;

  const userName = (uid: string | null) => {
    if (!uid) return "System";
    const p = profiles.find((x) => x.id === uid);
    return p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "Unbekannt" : "Unbekannt";
  };

  const call = () => {
    if (!callNumber) return toast.error("Keine Telefonnummer vorhanden.");
    window.location.href = `tel:${callNumber}`;
  };

  const openNavigation = () => {
    if (!adresse) return toast.error("Keine Adresse vorhanden.");
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const openFile = async (bucket: string, path: string, name: string, pdf: boolean) => {
    const url = await createSignedUrl(bucket, path);
    if (!url) return toast.error("Datei konnte nicht geöffnet werden.");
    setPreview({ url, name, pdf });
  };

  const visibleHistorie = historie.filter((h) => h.sichtbar);

  const dmsDocs = allDmsDocs.filter(
    (d) => !d.archiviert && d.links.some((l) => l.entity_type === "auftrag" && l.entity_id === id),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background active:scale-95"
          aria-label="Zurück"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <span className="text-xs font-semibold text-muted-foreground">{a.auftragsnummer}</span>
          <h2 className="truncate text-lg font-extrabold leading-tight">{a.titel}</h2>
        </div>
      </div>

      <MultiStatusBadges auftrag={a} />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={call}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold active:scale-95"
        >
          <Phone className="h-4 w-4" /> Anrufen
        </button>
        <button
          type="button"
          onClick={openNavigation}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold active:scale-95"
        >
          <Navigation className="h-4 w-4" /> Navigation
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">
            <Info className="mr-1.5 h-4 w-4" /> Info
          </TabsTrigger>
          <TabsTrigger value="dateien">
            <Files className="mr-1.5 h-4 w-4" /> Dateien
          </TabsTrigger>
          <TabsTrigger value="verlauf">
            <History className="mr-1.5 h-4 w-4" /> Verlauf
          </TabsTrigger>
        </TabsList>

        {/* Informationen */}
        <TabsContent value="info" className="space-y-4">
          <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
            {a.termin_start && (
              <Row icon={<Clock className="h-4 w-4" />} label="Termin" value={fmtDateTime(a.termin_start)} />
            )}
            {(a.kunde_name || a.kunde) && (
              <Row icon={<Building2 className="h-4 w-4" />} label="Kunde" value={a.kunde_name ?? a.kunde?.name} />
            )}
            {tel && <Row icon={<Phone className="h-4 w-4" />} label="Telefon" value={tel} />}
            {festnetz && <Row icon={<Phone className="h-4 w-4" />} label="Festnetz" value={festnetz} />}
            {a.kunde_email && <Row icon={<Mail className="h-4 w-4" />} label="E-Mail" value={a.kunde_email} />}
            {(fmtStrasse(a) || fmtOrt(a)) && (
              <Row
                icon={<MapPin className="h-4 w-4" />}
                label="Adresse"
                value={
                  <>
                    {fmtStrasse(a)}
                    {fmtStrasse(a) && fmtOrt(a) && <br />}
                    {fmtOrt(a)}
                  </>
                }
              />
            )}
            {a.kunde?.name && (
              <Row icon={<Building2 className="h-4 w-4" />} label="Auftraggeber" value={a.kunde.name} />
            )}
            {a.projekt?.name && (
              <Row icon={<FolderKanban className="h-4 w-4" />} label="Projekt" value={a.projekt.name} />
            )}
          </section>

          {a.wichtiginfo && (
            <div className="flex items-start gap-2 rounded-2xl bg-warning/10 p-4 text-sm font-medium text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">Wichtig</p>
                <p>{a.wichtiginfo}</p>
              </div>
            </div>
          )}

          {a.beschreibung && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Beschreibung</p>
              <p className="whitespace-pre-wrap text-sm">{a.beschreibung}</p>
            </section>
          )}

          {workers.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Zugewiesene Monteure
              </p>
              <div className="flex flex-wrap gap-2">
                {workers.map((w) => (
                  <span
                    key={w!.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-sm font-medium"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: w!.farbe }} />
                    {w!.vorname} {w!.nachname}
                  </span>
                ))}
              </div>
            </section>
          )}

          {!isDone && (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground active:scale-[0.99]"
            >
              <CheckCircle2 className="h-5 w-5" /> Abschließen / Abmelden
            </button>
          )}
        </TabsContent>

        {/* Dateien */}
        <TabsContent value="dateien" className="space-y-4">
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" /> Fotos ({fotos.length})
            </p>
            {fotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Fotos vorhanden.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => openFile("fotos", f.storage_path ?? "", f.dateiname ?? "", false)}
                    className="aspect-square overflow-hidden rounded-xl border border-border active:scale-95"
                  >
                    <SignedImage
                      bucket="fotos"
                      path={f.storage_path ?? ""}
                      alt={f.dateiname ?? ""}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Dokumente ({dokumente.length})
            </p>
            {dokumente.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Dokumente vorhanden.</p>
            ) : (
              <div className="space-y-2">
                {dokumente.map((d) => {
                  const isPdf = (d.dateityp ?? "").includes("pdf") || (d.dateiname ?? "").toLowerCase().endsWith(".pdf");
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => openFile("dokumente", d.storage_path ?? "", d.dateiname ?? "", isPdf)}
                      className="flex w-full items-center gap-2 rounded-xl border border-border bg-card p-3 text-left active:scale-[0.99]"
                    >
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.dateiname}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {dmsDocs.length > 0 && (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Freigegebene Dokumente ({dmsDocs.length})
              </p>
              <div className="space-y-2">
                {dmsDocs.map((d) => {
                  const cv = currentVersion(d);
                  if (!cv) return null;
                  const isPdf = fileCategory(cv.extension, cv.mime_type) === "pdf";
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => openFile("dms", cv.storage_path, cv.original_dateiname, isPdf)}
                      className="flex w-full items-center gap-2 rounded-xl border border-border bg-card p-3 text-left active:scale-[0.99]"
                    >
                      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </TabsContent>

        {/* Verlauf */}
        <TabsContent value="verlauf">
          {visibleHistorie.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Einträge.</p>
          ) : (
            <ol className="space-y-3">
              {visibleHistorie.map((h) => (
                <li key={h.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {HISTORIE_TYP_LABEL[h.typ as HistorieTyp] ?? h.typ}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtRelative(h.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold">{h.aktion}</p>
                  {h.details && <p className="text-sm text-muted-foreground">{h.details}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">von {userName(h.user_id)}</p>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>

      {/* Completion wizard (full screen) */}
      {wizardOpen && <CompletionWizard auftrag={a} onClose={() => setWizardOpen(false)} />}

      {/* File preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">{preview?.name}</DialogTitle>
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="min-w-0 truncate text-sm font-semibold">{preview?.name}</span>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg active:scale-95"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {preview &&
            (preview.pdf ? (
              <iframe title={preview.name} src={preview.url} className="h-[80vh] w-full" />
            ) : /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(preview.name) ? (
              <div className="flex max-h-[80vh] items-center justify-center overflow-auto bg-muted/30 p-2">
                <img src={preview.url} alt={preview.name} className="max-h-[78vh] w-auto object-contain" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Vorschau nicht möglich.</p>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  In neuem Tab öffnen
                </a>
              </div>
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

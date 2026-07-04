import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Search, Trash2, FileText, Upload, Ruler, Info, ClipboardList, Download,
} from "lucide-react";
import {
  rechnungGruppeQuery, gruppeEventsForGruppeQuery, gruppeDokumenteQuery,
  removeEventFromGruppe, updateEventLink, setRechnungGruppeStatus,
  uploadGruppeDokument, deleteGruppeDokument,
  RG_STATUS_LABEL, RG_STATUS_TONE, RG_STATUS_ORDER, RG_DOK_TYPES,
  type RechnungGruppeStatus, type RechnungGruppeDokument,
} from "@/lib/abrechnung";
import { auftraegeQuery, profilesQuery, createSignedUrl } from "@/lib/queries";
import { zahlungsereignisseQuery, zahlungUmsatzMapQuery } from "@/lib/zahlungen";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { fmtDate, fmtDateTime, fmtEuro, fmtBytes } from "@/lib/erp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RechnungGruppeDialog } from "@/components/abrechnung/RechnungGruppeDialog";
import { AddEventsDialog } from "@/components/abrechnung/AddEventsDialog";
import { FinanzSektion } from "@/components/abrechnung/FinanzSektion";
import { VerlaufList } from "@/components/detail/VerlaufList";
import { customFieldDefsQuery, type CustomData } from "@/lib/customFields";
import { CustomFieldsView } from "@/components/custom/CustomFields";
import { Euro } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/abrechnung/$id")({
  head: () => ({ meta: [{ title: "Rechnungsgruppe – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.abrechnungView}>
      <DetailPage />
    </RequirePermission>
  ),
});

function DetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, canAny } = useAuth();
  const canEdit = can(PERM.abrechnungEdit);
  const canEvents = can(PERM.abrechnungEvents);
  const canUpload = can(PERM.abrechnungUpload);
  const canUmsatz = canAny([PERM.profitCard, PERM.profitDetail, PERM.umsatzView, PERM.gewinnView]);

  const { data: gruppe, isLoading } = useQuery(rechnungGruppeQuery(id));
  const { data: links = [] } = useQuery(gruppeEventsForGruppeQuery(id));
  const { data: events = [] } = useQuery(zahlungsereignisseQuery());
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: umsatzMap = {} } = useQuery(zahlungUmsatzMapQuery(canUmsatz));
  const { data: docs = [] } = useQuery(gruppeDokumenteQuery(id));
  const { data: customDefs = [] } = useQuery(customFieldDefsQuery("rechnung_gruppe"));

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const eventById = useMemo(() => {
    const m = new Map<string, (typeof events)[number]>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);
  const auftragById = useMemo(() => {
    const m = new Map<string, (typeof auftraege)[number]>();
    for (const a of auftraege) m.set(a.id, a);
    return m;
  }, [auftraege]);

  const existingIds = useMemo(() => new Set(links.map((l) => l.zahlungsereignis_id)), [links]);
  const total = useMemo(
    () => links.filter((l) => l.included).reduce((s, l) => s + (umsatzMap[l.zahlungsereignis_id]?.umsatz ?? 0), 0),
    [links, umsatzMap],
  );

  if (isLoading || !gruppe) return <p className="p-6 text-sm text-muted-foreground">Lädt…</p>;

  const setStatus = async (s: RechnungGruppeStatus) => {
    try {
      await setRechnungGruppeStatus(id, s);
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppe", id] });
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppen"] });
      toast.success(`Status: ${RG_STATUS_LABEL[s]}`);
    } catch (e) { toast.error("Fehlgeschlagen", { description: (e as Error).message }); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/abrechnung" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Abrechnung
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight">{gruppe.nummer}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${RG_STATUS_TONE[gruppe.status]}`}>{RG_STATUS_LABEL[gruppe.status]}</span>
          </div>
          {gruppe.name && <p className="text-sm text-muted-foreground">{gruppe.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          {canUmsatz && (
            <div className="rounded-xl border border-border bg-card px-4 py-2 text-right shadow-soft">
              <p className="text-xs text-muted-foreground">Summe</p>
              <p className="text-lg font-extrabold tabular-nums">{fmtEuro(total)}</p>
            </div>
          )}
          {canEdit && <Button variant="outline" onClick={() => setEditOpen(true)}>Bearbeiten</Button>}
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-soft">
          <span className="text-xs font-medium text-muted-foreground">Status setzen:</span>
          {RG_STATUS_ORDER.map((s) => (
            <Button key={s} variant={gruppe.status === s ? "default" : "outline"} size="sm" onClick={() => setStatus(s)}>
              {RG_STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      )}

      <Tabs defaultValue="uebersicht">
        <TabsList className="flex-wrap">
          <TabsTrigger value="uebersicht"><Info className="mr-1.5 h-4 w-4" />Übersicht</TabsTrigger>
          <TabsTrigger value="events"><ClipboardList className="mr-1.5 h-4 w-4" />Zahlungsereignisse</TabsTrigger>
          {(canUmsatz || canEdit) && <TabsTrigger value="finanzen"><Euro className="mr-1.5 h-4 w-4" />Finanzen</TabsTrigger>}
          <TabsTrigger value="aufmass"><Ruler className="mr-1.5 h-4 w-4" />Aufmaß</TabsTrigger>
          <TabsTrigger value="dokumente"><FileText className="mr-1.5 h-4 w-4" />Dokumente</TabsTrigger>
          <TabsTrigger value="verlauf">Verlauf</TabsTrigger>
        </TabsList>

        {/* ÜBERSICHT */}
        <TabsContent value="uebersicht" className="mt-5">
          <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:grid-cols-2 lg:grid-cols-3">
            <Meta label="Auftraggeber" value={gruppe.auftraggeber?.name} />
            <Meta label="Projekt" value={gruppe.projekt?.name} />
            <Meta label="NVT" value={gruppe.nvt} />
            <Meta label="eSASS-Nr." value={gruppe.esass_nr} />
            <Meta label="AG-Bestell-Nr." value={gruppe.ag_bestell_nr} />
            <Meta label="AG-LEB-Nr." value={gruppe.ag_leb_nr} />
            <Meta label="SM-Nr." value={gruppe.sm_nr} />
            <Meta label="Kostenstelle" value={gruppe.kostenstelle} />
            <Meta label="Projektleiter" value={gruppe.projektleiter} />
            <Meta label="Leistungsort" value={gruppe.leistungsort} />
            <Meta label="Leistungszeitraum" value={
              gruppe.leistungszeitraum_von || gruppe.leistungszeitraum_bis
                ? `${gruppe.leistungszeitraum_von ? fmtDate(gruppe.leistungszeitraum_von) : "…"} – ${gruppe.leistungszeitraum_bis ? fmtDate(gruppe.leistungszeitraum_bis) : "…"}`
                : null
            } />
            <Meta label="Status" value={RG_STATUS_LABEL[gruppe.status]} />
            <CustomFieldsView defs={customDefs} values={(gruppe.custom_data ?? {}) as CustomData} />
          </div>
          {gruppe.notes && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notiz</p>
              <p className="whitespace-pre-wrap text-sm">{gruppe.notes}</p>
            </div>
          )}
        </TabsContent>

        {/* ZAHLUNGSEREIGNISSE */}
        <TabsContent value="events" className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{links.length} zugeordnete Zahlungsereignisse</p>
            {canEvents && gruppe.status !== "storniert" && (
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Ereignisse zuordnen</Button>
            )}
          </div>
          {links.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">Noch keine Zahlungsereignisse zugeordnet.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    {canEvents && <th className="px-3 py-3 font-semibold">Aktiv</th>}
                    <th className="px-4 py-3 font-semibold">#</th>
                    <th className="px-4 py-3 font-semibold">Auftrag</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Datum</th>
                    <th className="px-4 py-3 font-semibold">Positionen</th>
                    {canUmsatz && <th className="px-4 py-3 text-right font-semibold">Umsatz</th>}
                    {canEvents && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => {
                    const e = eventById.get(l.zahlungsereignis_id);
                    const a = e ? auftragById.get(e.auftrag_id) : undefined;
                    const positionen = canUmsatz ? (umsatzMap[l.zahlungsereignis_id]?.positionen ?? []) : (e?.leistungen ?? []);
                    return (
                      <tr key={l.id} className={`border-b border-border/60 hover:bg-muted/40 ${!l.included ? "opacity-50" : ""}`}>
                        {canEvents && (
                          <td className="px-3 py-3">
                            <Checkbox checked={l.included} onCheckedChange={async (v) => {
                              await updateEventLink(l.id, { included: Boolean(v) });
                              await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_events", id] });
                            }} />
                          </td>
                        )}
                        <td className="px-4 py-3"><span className="font-mono text-xs">#{e?.nummer ?? "?"}</span></td>
                        <td className="px-4 py-3">{a ? <Link to="/auftraege/$id" params={{ id: a.id }} className="font-medium hover:text-primary">{a.titel}</Link> : <span className="text-muted-foreground">entfernt</span>}</td>
                        <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: `${e?.status_farbe}20`, color: e?.status_farbe }}>{e?.status_label}</span></td>
                        <td className="px-4 py-3">{fmtDate(e?.datum ?? null)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {positionen.length ? positionen.map((p) => p.code || p.name).join(", ") : "–"}
                        </td>
                        {canUmsatz && <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtEuro(umsatzMap[l.zahlungsereignis_id]?.umsatz ?? 0)}</td>}
                        {canEvents && (
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => {
                              await removeEventFromGruppe(l.id);
                              await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_events", id] });
                              await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_event_links"] });
                            }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {canUmsatz && (
                  <tfoot>
                    <tr className="border-t border-border font-semibold">
                      <td className="px-4 py-3" colSpan={canEvents ? 5 : 4}>Summe (aktive Positionen)</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtEuro(total)}</td>
                      {canEvents && <td />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </TabsContent>

        {/* FINANZEN */}
        {(canUmsatz || canEdit) && (
          <TabsContent value="finanzen" className="mt-5">
            <FinanzSektion gruppe={gruppe} eventsSum={total} hasEvents={links.length > 0} canEdit={canEdit} canUmsatz={canUmsatz} />
          </TabsContent>
        )}


        {/* AUFMASS */}
        <TabsContent value="aufmass" className="mt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <AufmassCard title="Rechnungsaufmaß" desc="Grundlage für die Rechnungsstellung. PDF-Erzeugung folgt in einem späteren Schritt." />
            <AufmassCard title="Rechnungsanlage" desc="Zusammenstellung der Leistungen als Rechnungsanlage. Vorbereitung für Export (Lexware/DATEV)." />
          </div>
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
            Die automatische Erzeugung von Rechnungsaufmaß und Rechnungsanlage sowie der Export (Lexware, DATEV, PDF) sind vorbereitet und werden in einem nächsten Schritt aktiviert. Bis dahin können erstellte Dateien im Reiter „Dokumente" hinterlegt werden.
          </div>
        </TabsContent>

        {/* DOKUMENTE */}
        <TabsContent value="dokumente" className="mt-5">
          <DokumenteTab gruppeId={id} canUpload={canUpload} docs={docs} />
        </TabsContent>

        {/* VERLAUF */}
        <TabsContent value="verlauf" className="mt-5">
          <VerlaufList entityType="rechnung_gruppe" entityId={id} />
        </TabsContent>
      </Tabs>

      <RechnungGruppeDialog open={editOpen} onOpenChange={setEditOpen} gruppe={gruppe} />
      <AddEventsDialog open={addOpen} onOpenChange={setAddOpen} gruppeId={id} existingEventIds={existingIds} startOrder={links.length} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "–"}</p>
    </div>
  );
}

function AufmassCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-2 flex items-center gap-2">
        <Ruler className="h-5 w-5 text-primary" />
        <h3 className="font-bold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <Button variant="outline" size="sm" className="mt-4" disabled>In Vorbereitung</Button>
    </div>
  );
}

function DokumenteTab({
  gruppeId, canUpload, docs,
}: {
  gruppeId: string;
  canUpload: boolean;
  docs: RechnungGruppeDokument[];
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typ, setTyp] = useState("rechnung");
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await uploadGruppeDokument(gruppeId, f, typ);
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_dokumente", gruppeId] });
      toast.success("Datei(en) hochgeladen");
    } catch (e) { toast.error("Upload fehlgeschlagen", { description: (e as Error).message }); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const open = async (path: string) => {
    try {
      const url = await createSignedUrl("abrechnung", path);
      if (url) window.open(url, "_blank");
    }
    catch (e) { toast.error("Öffnen fehlgeschlagen", { description: (e as Error).message }); }
  };
  const remove = async (docId: string, path: string) => {
    if (!confirm("Datei löschen?")) return;
    try {
      await deleteGruppeDokument(docId, path);
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_dokumente", gruppeId] });
      toast.success("Datei gelöscht");
    } catch (e) { toast.error("Löschen fehlgeschlagen", { description: (e as Error).message }); }
  };

  const typLabel = (t: string) => RG_DOK_TYPES.find((x) => x.value === t)?.label ?? t;

  return (
    <div className="space-y-4">
      {canUpload && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-soft">
          <Select value={typ} onValueChange={setTyp}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{RG_DOK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="mr-1.5 h-4 w-4" /> {uploading ? "Lädt…" : "Datei hochladen"}
          </Button>
        </div>
      )}
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">Noch keine Dateien hinterlegt.</div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.titel}</p>
                <p className="text-xs text-muted-foreground">{typLabel(d.typ)} · {fmtBytes(d.groesse)} · {fmtDateTime(d.created_at)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => open(d.datei_pfad)}><Download className="h-4 w-4" /></Button>
              {canUpload && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(d.id, d.datei_pfad)}><Trash2 className="h-4 w-4" /></Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

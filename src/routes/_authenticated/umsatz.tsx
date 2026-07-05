import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Euro, TrendingUp, Wallet, Receipt, Plus, Pencil, Trash2, FileText, Users, FolderKanban, ClipboardList,
} from "lucide-react";
import { auftraegeQuery, kundenQuery, projekteQuery, mitarbeiterQuery, profilesQuery } from "@/lib/queries";
import { zahlungsereignisseQuery, zahlungUmsatzMapQuery } from "@/lib/zahlungen";
import {
  betriebsausgabenQuery, offeneWerteQuery, ausgabeKategorieLabel, deleteAusgabe, type Betriebsausgabe,
} from "@/lib/finanzen";
import { gruppeEventLinksQuery } from "@/lib/abrechnung";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { fmtDate, fmtEuro } from "@/lib/erp";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { AusgabeDialog } from "@/components/finanzen/AusgabeDialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/umsatz")({
  head: () => ({ meta: [{ title: "Umsatz / Gewinn – TecNova ERP" }] }),
  component: () => (
    <RequirePermission
      perm={[PERM.umsatzView, PERM.gewinnView, PERM.profitCard, PERM.profitDetail]}
      description="Der Bereich Umsatz / Gewinn ist nur für berechtigte Rollen sichtbar."
    >
      <UmsatzPage />
    </RequirePermission>
  ),
});

function UmsatzPage() {
  const { can, canAny } = useAuth();
  const canUmsatz = canAny([PERM.profitCard, PERM.profitDetail, PERM.umsatzView, PERM.gewinnView]);
  const canGewinn = can(PERM.gewinnView);
  const canAusgabenView = canAny([PERM.ausgabenView, PERM.ausgabenEdit]);
  const canAusgabenEdit = can(PERM.ausgabenEdit);

  const { data: events = [] } = useQuery(zahlungsereignisseQuery());
  const { data: umsatzMap = {} } = useQuery(zahlungUmsatzMapQuery(canUmsatz));
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const { data: profiles = [] } = useQuery(profilesQuery());
  const { data: ausgaben = [] } = useQuery(betriebsausgabenQuery(canAusgabenView));
  const { data: offeneWerte = {} } = useQuery(offeneWerteQuery(canUmsatz));
  const { data: eventLinks = [] } = useQuery(gruppeEventLinksQuery());

  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [tab, setTab] = useState("uebersicht");

  const auftragById = useMemo(() => {
    const m = new Map<string, (typeof auftraege)[number]>();
    for (const a of auftraege) m.set(a.id, a);
    return m;
  }, [auftraege]);

  const gruppeByEvent = useMemo(() => {
    const m = new Map<string, { id: string; nummer: string }>();
    for (const l of eventLinks) if (l.gruppe) m.set(l.zahlungsereignis_id, l.gruppe);
    return m;
  }, [eventLinks]);

  const inRange = (d: string | null) => {
    if (!d) return true;
    const day = d.slice(0, 10);
    if (von && day < von) return false;
    if (bis && day > bis) return false;
    return true;
  };

  const fEvents = useMemo(() => events.filter((e) => inRange(e.datum)), [events, von, bis]);
  const fAusgaben = useMemo(() => ausgaben.filter((a) => inRange(a.datum)), [ausgaben, von, bis]);

  const rev = (id: string) => umsatzMap[id]?.umsatz ?? 0;
  const bezahlterUmsatz = fEvents.reduce((s, e) => s + rev(e.id), 0);
  const offenerUmsatz = Object.values(offeneWerte).reduce((s, v) => s + v, 0);
  const gesamtUmsatz = bezahlterUmsatz + offenerUmsatz;
  const gesamtAusgaben = fAusgaben.reduce((s, a) => s + Number(a.betrag), 0);
  const gewinn = bezahlterUmsatz - gesamtAusgaben;
  const bezahlteAuftraege = new Set(fEvents.map((e) => e.auftrag_id)).size;

  const userName = (uid: string | null) => {
    if (!uid) return "System";
    const p = profiles.find((x) => x.id === uid);
    return p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "–" : "–";
  };
  const maName = (a: (typeof auftraege)[number] | undefined) =>
    (a?.zuweisungen ?? []).map((z) => z.mitarbeiter ? `${z.mitarbeiter.vorname} ${z.mitarbeiter.nachname}` : "").filter(Boolean).join(", ") || "–";

  // Aggregation per Auftrag
  const auftragAgg = useMemo(() => {
    const m = new Map<string, { revenue: number; count: number }>();
    for (const e of fEvents) {
      const cur = m.get(e.auftrag_id) ?? { revenue: 0, count: 0 };
      cur.revenue += rev(e.id);
      cur.count += 1;
      m.set(e.auftrag_id, cur);
    }
    return [...m.entries()].map(([id, v]) => ({ auftrag: auftragById.get(id), id, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [fEvents, umsatzMap, auftragById]);

  // Per Auftraggeber
  const kundeAgg = useMemo(() => {
    return kunden.map((k) => {
      const kEvents = fEvents.filter((e) => auftragById.get(e.auftrag_id)?.kunde_id === k.id);
      const bezahlt = kEvents.reduce((s, e) => s + rev(e.id), 0);
      const offen = auftraege.filter((a) => a.kunde_id === k.id).reduce((s, a) => s + (offeneWerte[a.id] ?? 0), 0);
      const auftragIds = new Set([...kEvents.map((e) => e.auftrag_id)]);
      return { k, bezahlt, offen, gesamt: bezahlt + offen, events: kEvents.length, auftraege: auftragIds.size };
    }).filter((r) => r.gesamt > 0 || r.events > 0).sort((a, b) => b.gesamt - a.gesamt);
  }, [kunden, fEvents, auftraege, offeneWerte, auftragById, umsatzMap]);

  // Per Projekt
  const projektAgg = useMemo(() => {
    return projekte.map((p) => {
      const pEvents = fEvents.filter((e) => auftragById.get(e.auftrag_id)?.projekt_id === p.id);
      const revenue = pEvents.reduce((s, e) => s + rev(e.id), 0);
      const aus = fAusgaben.filter((a) => a.projekt_id === p.id).reduce((s, a) => s + Number(a.betrag), 0);
      const auftragIds = new Set(pEvents.map((e) => e.auftrag_id));
      return { p, revenue, aus, gewinn: revenue - aus, events: pEvents.length, auftraege: auftragIds.size };
    }).filter((r) => r.events > 0 || r.aus > 0).sort((a, b) => b.revenue - a.revenue);
  }, [projekte, fEvents, fAusgaben, auftragById, umsatzMap]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Umsatz / Gewinn</h2>
          <p className="text-sm text-muted-foreground">
            Interne Finanzübersicht auf Basis der Zahlungsereignisse. Stornierte Ereignisse zählen nicht.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Von</label>
            <DatePicker value={von} onChange={setVon} className="h-9" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Bis</label>
            <DatePicker value={bis} onChange={setBis} className="h-9" />
          </div>
          {(von || bis) && <Button variant="ghost" size="sm" onClick={() => { setVon(""); setBis(""); }}>Zurücksetzen</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="events">Zahlungsereignisse</TabsTrigger>
          <TabsTrigger value="auftraege">Aufträge</TabsTrigger>
          <TabsTrigger value="auftraggeber">Auftraggeber</TabsTrigger>
          <TabsTrigger value="projekte">Projekte</TabsTrigger>
          <TabsTrigger value="offen">Offener Umsatz</TabsTrigger>
          {canAusgabenView && <TabsTrigger value="ausgaben">Ausgaben</TabsTrigger>}
          {canGewinn && <TabsTrigger value="gewinn">Gewinn</TabsTrigger>}
        </TabsList>

        {/* ÜBERSICHT */}
        <TabsContent value="uebersicht" className="mt-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi icon={Euro} tone="bg-primary/10 text-primary" label="Gesamtumsatz" value={canUmsatz ? fmtEuro(gesamtUmsatz) : "—"} onClick={() => setTab("auftraggeber")} />
            <Kpi icon={TrendingUp} tone="bg-success/15 text-success" label="Bezahlter Umsatz" value={canUmsatz ? fmtEuro(bezahlterUmsatz) : "—"} onClick={() => setTab("events")} />
            <Kpi icon={Wallet} tone="bg-warning/15 text-warning" label="Offener Umsatz" value={canUmsatz ? fmtEuro(offenerUmsatz) : "—"} onClick={() => setTab("offen")} />
            <Kpi icon={Receipt} tone="bg-destructive/15 text-destructive" label="Gesamtausgaben" value={canAusgabenView ? fmtEuro(gesamtAusgaben) : "—"} onClick={canAusgabenView ? () => setTab("ausgaben") : undefined} />
            <Kpi icon={TrendingUp} tone="bg-accent/15 text-accent" label="Gewinn" value={canGewinn ? fmtEuro(gewinn) : "—"} onClick={canGewinn ? () => setTab("gewinn") : undefined} />
            <Kpi icon={FileText} tone="bg-primary/10 text-primary" label="Zahlungsereignisse" value={fEvents.length} onClick={() => setTab("events")} />
            <Kpi icon={ClipboardList} tone="bg-success/15 text-success" label="Bezahlte Aufträge" value={bezahlteAuftraege} onClick={() => setTab("auftraege")} />
            <Kpi icon={Euro} tone="bg-muted text-muted-foreground" label="Marge" value={canGewinn && bezahlterUmsatz ? `${Math.round((gewinn / bezahlterUmsatz) * 100)}%` : "—"} onClick={canGewinn ? () => setTab("gewinn") : undefined} />
          </div>
        </TabsContent>

        {/* ZAHLUNGSEREIGNISSE */}
        <TabsContent value="events" className="mt-5">
          <TableWrap>
            <thead>
              <Tr head>
                <Th>#</Th><Th>Auftrag</Th><Th>Status</Th><Th>Datum</Th><Th>Auftraggeber</Th>
                <Th>Projekt</Th><Th>Mitarbeiter</Th><Th>Positionen</Th><Th>Rechnungsgruppe</Th>
                {canUmsatz && <Th right>Umsatz</Th>}
              </Tr>
            </thead>
            <tbody>
              {fEvents.map((e) => {
                const a = auftragById.get(e.auftrag_id);
                const g = gruppeByEvent.get(e.id);
                const posCount = canUmsatz ? (umsatzMap[e.id]?.positionen.length ?? 0) : (e.leistungen?.length ?? 0);
                return (
                  <Tr key={e.id}>
                    <Td><span className="font-mono text-xs">#{e.nummer ?? "?"}</span></Td>
                    <Td>{a ? <Link to="/auftraege/$id" params={{ id: a.id }} className="font-medium hover:text-primary">{a.titel}</Link> : <span className="text-muted-foreground">entfernt</span>}</Td>
                    <Td><Pill label={e.status_label} color={e.status_farbe} /></Td>
                    <Td>{fmtDate(e.datum)}</Td>
                    <Td>{a?.kunde?.name ?? "–"}</Td>
                    <Td>{a?.projekt?.name ?? "–"}</Td>
                    <Td className="max-w-[160px] truncate">{maName(a)}</Td>
                    <Td>{posCount}</Td>
                    <Td>{g ? <Link to="/abrechnung/$id" params={{ id: g.id }} className="font-mono text-xs hover:text-primary">{g.nummer}</Link> : <span className="text-xs text-muted-foreground">–</span>}</Td>
                    {canUmsatz && <Td right className="font-semibold tabular-nums">{fmtEuro(rev(e.id))}</Td>}
                  </Tr>
                );
              })}
            </tbody>
          </TableWrap>
          {fEvents.length === 0 && <Empty />}
        </TabsContent>

        {/* AUFTRÄGE */}
        <TabsContent value="auftraege" className="mt-5">
          <TableWrap>
            <thead>
              <Tr head>
                <Th>Auftrag</Th><Th>Status</Th><Th>Auftraggeber</Th><Th>Projekt</Th><Th>Mitarbeiter</Th>
                <Th right>Ereignisse</Th>{canUmsatz && <Th right>Umsatz</Th>}
              </Tr>
            </thead>
            <tbody>
              {auftragAgg.map((r) => (
                <Tr key={r.id}>
                  <Td>{r.auftrag ? <Link to="/auftraege/$id" params={{ id: r.id }} className="font-medium hover:text-primary">{r.auftrag.titel}</Link> : <span className="text-muted-foreground">entfernt</span>}</Td>
                  <Td>{r.auftrag?.status ?? "–"}</Td>
                  <Td>{r.auftrag?.kunde?.name ?? "–"}</Td>
                  <Td>{r.auftrag?.projekt?.name ?? "–"}</Td>
                  <Td className="max-w-[160px] truncate">{maName(r.auftrag)}</Td>
                  <Td right>{r.count}</Td>
                  {canUmsatz && <Td right className="font-semibold tabular-nums">{fmtEuro(r.revenue)}</Td>}
                </Tr>
              ))}
            </tbody>
          </TableWrap>
          {auftragAgg.length === 0 && <Empty />}
        </TabsContent>

        {/* AUFTRAGGEBER */}
        <TabsContent value="auftraggeber" className="mt-5">
          <TableWrap>
            <thead>
              <Tr head>
                <Th>Auftraggeber</Th>{canUmsatz && <><Th right>Gesamt</Th><Th right>Bezahlt</Th><Th right>Offen</Th></>}
                <Th right>Aufträge</Th><Th right>Ereignisse</Th>
              </Tr>
            </thead>
            <tbody>
              {kundeAgg.map((r) => (
                <Tr key={r.k.id}>
                  <Td><Link to="/kunden/$id" params={{ id: r.k.id }} className="font-medium hover:text-primary">{r.k.name}</Link></Td>
                  {canUmsatz && <><Td right className="font-semibold tabular-nums">{fmtEuro(r.gesamt)}</Td><Td right className="tabular-nums text-success">{fmtEuro(r.bezahlt)}</Td><Td right className="tabular-nums text-warning">{fmtEuro(r.offen)}</Td></>}
                  <Td right>{r.auftraege}</Td>
                  <Td right>{r.events}</Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
          {kundeAgg.length === 0 && <Empty />}
        </TabsContent>

        {/* PROJEKTE */}
        <TabsContent value="projekte" className="mt-5">
          <TableWrap>
            <thead>
              <Tr head>
                <Th>Projekt</Th>{canUmsatz && <Th right>Umsatz</Th>}{canAusgabenView && <Th right>Ausgaben</Th>}{canGewinn && <Th right>Gewinn</Th>}
                <Th right>Aufträge</Th><Th right>Ereignisse</Th>
              </Tr>
            </thead>
            <tbody>
              {projektAgg.map((r) => (
                <Tr key={r.p.id}>
                  <Td><Link to="/projekte/$id" params={{ id: r.p.id }} className="font-medium hover:text-primary">{r.p.name}</Link></Td>
                  {canUmsatz && <Td right className="font-semibold tabular-nums">{fmtEuro(r.revenue)}</Td>}
                  {canAusgabenView && <Td right className="tabular-nums text-destructive">{fmtEuro(r.aus)}</Td>}
                  {canGewinn && <Td right className="tabular-nums">{fmtEuro(r.gewinn)}</Td>}
                  <Td right>{r.auftraege}</Td>
                  <Td right>{r.events}</Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
          {projektAgg.length === 0 && <Empty />}
        </TabsContent>

        {/* OFFENER UMSATZ */}
        <TabsContent value="offen" className="mt-5">
          {(() => {
            const offenList = auftraege
              .map((a) => ({ a, wert: offeneWerte[a.id] ?? 0 }))
              .filter((r) => r.wert > 0)
              .sort((x, y) => y.wert - x.wert);
            if (!canUmsatz) return <Empty label="Finanzwerte sind ausgeblendet – dir fehlt die Finanzberechtigung." />;
            if (offenList.length === 0) return <Empty label="Keine offenen Umsätze gefunden." />;
            return (
              <TableWrap>
                <thead>
                  <Tr head>
                    <Th>Auftrag</Th><Th>Auftraggeber</Th><Th>Projekt</Th><Th>Status</Th><Th right>Offener Wert</Th>
                  </Tr>
                </thead>
                <tbody>
                  {offenList.map(({ a, wert }) => (
                    <Tr key={a.id}>
                      <Td><Link to="/auftraege/$id" params={{ id: a.id }} className="font-medium hover:text-primary">{a.titel}</Link></Td>
                      <Td>{a.kunde?.name ?? "–"}</Td>
                      <Td>{a.projekt?.name ?? "–"}</Td>
                      <Td>{a.status ?? "–"}</Td>
                      <Td right className="font-semibold tabular-nums text-warning">{fmtEuro(wert)}</Td>
                    </Tr>
                  ))}
                </tbody>
                <tfoot>
                  <Tr head>
                    <Th>Summe</Th><Th>{""}</Th><Th>{""}</Th><Th>{""}</Th>
                    <Th right>{fmtEuro(offenList.reduce((s, r) => s + r.wert, 0))}</Th>
                  </Tr>
                </tfoot>
              </TableWrap>
            );
          })()}
        </TabsContent>


        {/* AUSGABEN */}
        {canAusgabenView && (
          <TabsContent value="ausgaben" className="mt-5">
            <AusgabenTab
              ausgaben={fAusgaben}
              canEdit={canAusgabenEdit}
              userName={userName}
              auftragById={auftragById}
              kunden={kunden}
              projekte={projekte}
              mitarbeiter={mitarbeiter}
            />
          </TabsContent>
        )}

        {/* GEWINN */}
        {canGewinn && (
          <TabsContent value="gewinn" className="mt-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Kpi icon={TrendingUp} tone="bg-success/15 text-success" label="Bezahlter Umsatz" value={fmtEuro(bezahlterUmsatz)} />
              <Kpi icon={Receipt} tone="bg-destructive/15 text-destructive" label="Ausgaben" value={fmtEuro(gesamtAusgaben)} />
              <Kpi icon={Euro} tone="bg-primary/10 text-primary" label="Gewinn" value={fmtEuro(gewinn)} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Gewinn = Umsatz aus aktiven Zahlungsereignissen − erfasste Betriebsausgaben (im gewählten Zeitraum).
            </p>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AusgabenTab({
  ausgaben, canEdit, userName, auftragById, kunden, projekte, mitarbeiter,
}: {
  ausgaben: Betriebsausgabe[];
  canEdit: boolean;
  userName: (u: string | null) => string;
  auftragById: Map<string, { id: string; titel: string }>;
  kunden: { id: string; name: string }[];
  projekte: { id: string; name: string }[];
  mitarbeiter: { id: string; vorname: string; nachname: string }[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Betriebsausgabe | null>(null);

  const kName = (id: string | null) => kunden.find((k) => k.id === id)?.name;
  const pName = (id: string | null) => projekte.find((p) => p.id === id)?.name;
  const mName = (id: string | null) => { const m = mitarbeiter.find((x) => x.id === id); return m ? `${m.vorname} ${m.nachname}` : undefined; };

  const remove = async (a: Betriebsausgabe) => {
    if (!confirm("Ausgabe löschen?")) return;
    try {
      await deleteAusgabe(a.id);
      await qc.invalidateQueries({ queryKey: ["betriebsausgaben"] });
      toast.success("Ausgabe gelöscht");
    } catch (e) { toast.error("Löschen fehlgeschlagen", { description: (e as Error).message }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{ausgaben.length} Ausgaben</p>
        {canEdit && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="mr-1.5 h-4 w-4" /> Neue Ausgabe</Button>}
      </div>
      <TableWrap>
        <thead>
          <Tr head>
            <Th>Datum</Th><Th>Bezeichnung</Th><Th>Kategorie</Th><Th>Zuordnung</Th><Th>Erfasst von</Th><Th right>Betrag</Th>{canEdit && <Th right>Aktion</Th>}
          </Tr>
        </thead>
        <tbody>
          {ausgaben.map((a) => {
            const zuord = [
              a.auftrag_id && auftragById.get(a.auftrag_id)?.titel,
              pName(a.projekt_id) && `Projekt: ${pName(a.projekt_id)}`,
              kName(a.auftraggeber_id) && `AG: ${kName(a.auftraggeber_id)}`,
              mName(a.mitarbeiter_id) && `MA: ${mName(a.mitarbeiter_id)}`,
            ].filter(Boolean).join(", ");
            return (
              <Tr key={a.id}>
                <Td>{fmtDate(a.datum)}</Td>
                <Td className="font-medium">{a.bezeichnung}</Td>
                <Td>{ausgabeKategorieLabel(a.kategorie)}</Td>
                <Td className="max-w-[220px] truncate text-xs text-muted-foreground">{zuord || "–"}</Td>
                <Td className="text-xs text-muted-foreground">{userName(a.created_by)}</Td>
                <Td right className="font-semibold tabular-nums">{fmtEuro(a.betrag)}</Td>
                {canEdit && (
                  <Td right>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEdit(a); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </Td>
                )}
              </Tr>
            );
          })}
        </tbody>
      </TableWrap>
      {ausgaben.length === 0 && <Empty label="Noch keine Ausgaben erfasst." />}
      <AusgabeDialog open={open} onOpenChange={setOpen} ausgabe={edit} />
    </div>
  );
}

function Kpi({ icon: Icon, tone, label, value, onClick }: { icon: typeof Euro; tone: string; label: string; value: number | string; onClick?: () => void }) {
  const inner = (
    <>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
      <p className="mt-4 text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="group rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:border-primary/40 hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {inner}
        <span className="mt-2 inline-block text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">Details ansehen →</span>
      </button>
    );
  }
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">{inner}</div>;
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
function Tr({ children, head }: { children: React.ReactNode; head?: boolean }) {
  return <tr className={head ? "border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground" : "border-b border-border/60 hover:bg-muted/40"}>{children}</tr>;
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-3 font-semibold ${right ? "text-right" : ""}`}>{children}</th>;
}
function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : ""} ${className ?? ""}`}>{children}</td>;
}
function Pill({ label, color }: { label: string; color: string }) {
  return <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: `${color}20`, color }}>{label}</span>;
}
function Empty({ label = "Keine Daten im gewählten Zeitraum." }: { label?: string }) {
  return <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">{label}</div>;
}

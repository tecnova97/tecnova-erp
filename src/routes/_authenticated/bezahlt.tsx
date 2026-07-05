import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, X, BadgeEuro, MapPin, ChevronDown, ChevronRight, StickyNote } from "lucide-react";
import {
  auftraegeQuery,
  kundenQuery,
  projekteQuery,
  mitarbeiterQuery,
  profilesQuery,
} from "@/lib/queries";
import { zahlungsereignisseQuery, zahlungUmsatzMapQuery } from "@/lib/zahlungen";
import { gruppeEventLinksQuery, rechnungGruppenQuery, type RechnungGruppe } from "@/lib/abrechnung";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { statusStyle } from "@/lib/status";
import { fmtDate, fmtEuro, fmtStrasse, fmtOrt } from "@/lib/erp";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/bezahlt")({
  head: () => ({ meta: [{ title: "Bezahlte Aufträge – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.bezahltView}>
      <BezahltePage />
    </RequirePermission>
  ),
});

function BezahltePage() {
  const { canAny } = useAuth();
  const canUmsatz = canAny([PERM.profitCard, PERM.profitDetail, PERM.umsatzView, PERM.gewinnView]);
  const { data: events = [], isLoading } = useQuery(zahlungsereignisseQuery());
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const { data: profiles = [] } = useQuery(profilesQuery());
  const { data: umsatzMap = {} } = useQuery(zahlungUmsatzMapQuery(canUmsatz));
  const { data: gruppen = [] } = useQuery(rechnungGruppenQuery());
  const { data: gruppeLinks = [] } = useQuery(gruppeEventLinksQuery());

  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("alle");
  const [fKunde, setFKunde] = useState("alle");
  const [fProjekt, setFProjekt] = useState("alle");
  const [fMitarbeiter, setFMitarbeiter] = useState("alle");
  const [fGruppe, setFGruppe] = useState("alle");
  const [fNvt, setFNvt] = useState("alle");
  const [fEsass, setFEsass] = useState("alle");
  const [fAgLeb, setFAgLeb] = useState("alle");
  const [fDatum, setFDatum] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const gruppeByEvent = useMemo(() => {
    const gById = new Map<string, RechnungGruppe>();
    for (const g of gruppen) gById.set(g.id, g);
    const m = new Map<string, RechnungGruppe>();
    for (const l of gruppeLinks) {
      const g = gById.get(l.rechnung_gruppe_id);
      if (g) m.set(l.zahlungsereignis_id, g);
    }
    return m;
  }, [gruppen, gruppeLinks]);

  const nvtOptions = useMemo(
    () => [...new Set(gruppen.map((g) => g.nvt).filter(Boolean))].map((v) => ({ value: v as string, label: v as string })),
    [gruppen],
  );
  const esassOptions = useMemo(
    () => [...new Set(gruppen.map((g) => g.esass_nr).filter(Boolean))].map((v) => ({ value: v as string, label: v as string })),
    [gruppen],
  );
  const agLebOptions = useMemo(
    () => [...new Set(gruppen.map((g) => g.ag_leb_nr).filter(Boolean))].map((v) => ({ value: v as string, label: v as string })),
    [gruppen],
  );

  const auftragById = useMemo(() => {
    const m = new Map<string, (typeof auftraege)[number]>();
    for (const a of auftraege) m.set(a.id, a);
    return m;
  }, [auftraege]);

  const userName = (uid: string | null) => {
    if (!uid) return "System";
    const p = profiles.find((x) => x.id === uid);
    return p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "Unbekannt" : "Unbekannt";
  };

  // Distinct statuses present across events (label + color from the snapshot).
  const statusOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of events) m.set(e.status_key, e.status_label);
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [events]);

  const rows = useMemo(() => {
    return events.filter((e) => {
      const a = auftragById.get(e.auftrag_id);
      const workerNames = (a?.zuweisungen ?? [])
        .map((z) => (z.mitarbeiter ? `${z.mitarbeiter.vorname} ${z.mitarbeiter.nachname}` : ""))
        .join(" ");
      const matchQ =
        !q ||
        [
          a?.titel,
          a?.auftragsnummer,
          a?.kunde_name,
          a?.kunde?.name,
          a?.projekt?.name,
          a?.ort,
          a?.strasse,
          e.status_label,
          e.notiz,
          workerNames,
        ]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q.toLowerCase()));
      const matchStatus = fStatus === "alle" || e.status_key === fStatus;
      const matchKunde = fKunde === "alle" || a?.kunde_id === fKunde;
      const matchProjekt = fProjekt === "alle" || a?.projekt_id === fProjekt;
      const matchMa = fMitarbeiter === "alle" || (a?.zuweisungen ?? []).some((z) => z.mitarbeiter?.id === fMitarbeiter);
      const matchDatum = !fDatum || (e.datum ?? "").startsWith(fDatum);
      const grp = gruppeByEvent.get(e.id);
      const matchGruppe =
        fGruppe === "alle" || (fGruppe === "ohne" ? !grp : grp?.id === fGruppe);
      const matchNvt = fNvt === "alle" || grp?.nvt === fNvt;
      const matchEsass = fEsass === "alle" || grp?.esass_nr === fEsass;
      const matchAgLeb = fAgLeb === "alle" || grp?.ag_leb_nr === fAgLeb;
      return matchQ && matchStatus && matchKunde && matchProjekt && matchMa && matchDatum
        && matchGruppe && matchNvt && matchEsass && matchAgLeb;
    });
  }, [events, auftragById, q, fStatus, fKunde, fProjekt, fMitarbeiter, fDatum, gruppeByEvent, fGruppe, fNvt, fEsass, fAgLeb]);

  const hasFilters =
    fStatus !== "alle" || fKunde !== "alle" || fProjekt !== "alle" || fMitarbeiter !== "alle" ||
    fGruppe !== "alle" || fNvt !== "alle" || fEsass !== "alle" || fAgLeb !== "alle" || !!fDatum;
  const reset = () => {
    setFStatus("alle");
    setFKunde("alle");
    setFProjekt("alle");
    setFMitarbeiter("alle");
    setFGruppe("alle");
    setFNvt("alle");
    setFEsass("alle");
    setFAgLeb("alle");
    setFDatum("");
  };

  const gesamt = canUmsatz ? rows.reduce((s, e) => s + (umsatzMap[e.id]?.umsatz ?? 0), 0) : null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const colSpan = 9 + (canUmsatz ? 1 : 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BadgeEuro className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Bezahlte Aufträge</h1>
          <p className="text-sm text-muted-foreground">
            Jedes Zahlungsereignis wird dauerhaft und einzeln erfasst. Ein Auftrag kann mehrere
            Zahlungen erzeugen.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Titel, Auftraggeber, Projekt, Mitarbeiter, Status, Notiz…"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={fStatus} onChange={setFStatus} all="Alle Status" options={statusOptions} />
        <FilterSelect value={fKunde} onChange={setFKunde} all="Alle Auftraggeber"
          options={kunden.map((k) => ({ value: k.id, label: k.name }))} />
        <FilterSelect value={fProjekt} onChange={setFProjekt} all="Alle Projekte"
          options={projekte.map((p) => ({ value: p.id, label: p.name }))} />
        <FilterSelect value={fMitarbeiter} onChange={setFMitarbeiter} all="Alle Mitarbeiter"
          options={mitarbeiter.map((m) => ({ value: m.id, label: `${m.vorname} ${m.nachname}` }))} />
        <FilterSelect value={fGruppe} onChange={setFGruppe} all="Alle Rechnungsgruppen"
          options={[{ value: "ohne", label: "Ohne Zuordnung" }, ...gruppen.map((g) => ({ value: g.id, label: g.nummer }))]} />
        {nvtOptions.length > 0 && <FilterSelect value={fNvt} onChange={setFNvt} all="Alle NVT" options={nvtOptions} />}
        {esassOptions.length > 0 && <FilterSelect value={fEsass} onChange={setFEsass} all="Alle eSASS" options={esassOptions} />}
        {agLebOptions.length > 0 && <FilterSelect value={fAgLeb} onChange={setFAgLeb} all="Alle AG-LEB" options={agLebOptions} />}
        <DatePicker
          value={fDatum}
          onChange={setFDatum}
          className="h-9 w-auto text-sm"
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Filter zurücksetzen
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} Zahlungsereignisse</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Keine Zahlungsereignisse gefunden.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3 font-semibold">Nr.</th>
                <th className="px-4 py-3 font-semibold">Auftrag</th>
                <th className="px-4 py-3 font-semibold">Auftraggeber / Projekt</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Datum</th>
                <th className="px-4 py-3 font-semibold">Rechnungsgruppe</th>
                <th className="px-4 py-3 font-semibold">Benutzer</th>
                <th className="px-4 py-3 font-semibold">Notiz</th>
                {canUmsatz && <th className="px-4 py-3 text-right font-semibold">Umsatz</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const a = auftragById.get(e.auftrag_id);
                const adresse = a ? [fmtStrasse(a), fmtOrt(a)].filter(Boolean).join(", ") : "";
                const isOpen = expanded.has(e.id);
                const priced = umsatzMap[e.id];
                const positionen = priced?.positionen ?? [];
                const freiPositionen = e.leistungen ?? [];
                const hasDetails = (canUmsatz ? positionen.length : freiPositionen.length) > 0;
                const grp = gruppeByEvent.get(e.id);
                return (
                  <>
                    <tr key={e.id} className="border-b border-border/60 hover:bg-muted/40">
                      <td className="px-2 py-3 align-top">
                        {hasDetails && (
                          <button
                            onClick={() => toggle(e.id)}
                            className="grid h-6 w-6 place-items-center rounded hover:bg-muted"
                            title="Leistungspositionen anzeigen"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top"><span className="font-mono text-xs text-muted-foreground">#{e.nummer ?? "?"}</span></td>
                      <td className="px-4 py-3 align-top">
                        {a ? (
                          <Link to="/auftraege/$id" params={{ id: a.id }} className="font-semibold hover:text-primary">
                            {a.titel}
                          </Link>
                        ) : (
                          <span className="font-semibold text-muted-foreground">Auftrag entfernt</span>
                        )}
                        <div className="text-xs text-muted-foreground">{a?.auftragsnummer ?? "–"}</div>
                        {adresse && (
                          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {adresse}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div>{a?.kunde?.name ?? a?.kunde_name ?? "–"}</div>
                        <div className="text-xs text-muted-foreground">{a?.projekt?.name ?? "–"}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="badge-status" style={statusStyle(e.status_farbe)}>
                          {e.status_label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">{fmtDate(e.datum)}</td>
                      <td className="px-4 py-3 align-top">
                        {grp ? (
                          <Link to="/abrechnung/$id" params={{ id: grp.id }} className="font-mono text-xs font-semibold hover:text-primary">{grp.nummer}</Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">{userName(e.created_by)}</td>
                      <td className="px-4 py-3 align-top">
                        {e.notiz ? (
                          <span className="inline-flex items-start gap-1 text-xs text-muted-foreground">
                            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" /> {e.notiz}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </td>
                      {canUmsatz && (
                        <td className="px-4 py-3 text-right align-top font-semibold">
                          {fmtEuro(priced?.umsatz ?? 0)}
                        </td>
                      )}
                    </tr>
                    {isOpen && hasDetails && (
                      <tr key={`${e.id}-details`} className="border-b border-border/60 bg-muted/30">
                        <td />
                        <td colSpan={colSpan - 1} className="px-4 py-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Leistungspositionen (Stand Zahlung)
                          </p>
                          <table className="w-full max-w-2xl text-xs">
                            <tbody>
                              {(canUmsatz ? positionen : freiPositionen).map((p, i) => (
                                <tr key={i} className="border-b border-border/40 last:border-0">
                                  <td className="py-1 pr-3 font-medium">{p.name}</td>
                                  <td className="py-1 pr-3 text-muted-foreground">{p.code}</td>
                                  <td className="py-1 pr-3 text-right">
                                    {p.menge} {p.einheit}
                                  </td>
                                  {canUmsatz && "total" in p && (
                                    <td className="py-1 text-right font-semibold">{fmtEuro((p as { total: number }).total)}</td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            {canUmsatz && (
              <tfoot>
                <tr>
                  <td colSpan={colSpan - 1} className="px-4 py-3 text-right font-semibold">
                    Gesamtumsatz (alle Zahlungsereignisse)
                  </td>
                  <td className="px-4 py-3 text-right text-base font-extrabold">{fmtEuro(gesamt)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  all,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[10rem]"><SelectValue placeholder={all} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="alle">{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Euro,
  TrendingUp,
  Wallet,
  ChevronDown,
  ChevronRight,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { auftraegeQuery, kundenQuery, type AuftragRow } from "@/lib/queries";
import { zahlungsereignisseQuery, zahlungUmsatzMapQuery } from "@/lib/zahlungen";
import { offeneWerteQuery } from "@/lib/finanzen";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { useStatuses, statusStyle } from "@/lib/status";
import { fmtDate, fmtEuro, fmtStrasse, fmtOrt } from "@/lib/erp";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveRouteScrollState } from "@/hooks/useRouteScrollRestoration";

const PAYMENT_STATUS = ["alle", "bezahlt", "offen"] as const;
type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const Route = createFileRoute("/_authenticated/finanzen/umsatz")({
  head: () => ({ meta: [{ title: "Umsatz nach Auftraggeber – TecNova ERP" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    paymentStatus:
      typeof s.paymentStatus === "string" && (PAYMENT_STATUS as readonly string[]).includes(s.paymentStatus)
        ? (s.paymentStatus as PaymentStatus)
        : undefined,
    kunde: typeof s.kunde === "string" ? s.kunde : undefined,
    von: typeof s.von === "string" ? s.von : undefined,
    bis: typeof s.bis === "string" ? s.bis : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  component: () => (
    <RequirePermission
      perm={[PERM.umsatzView, PERM.gewinnView, PERM.profitCard, PERM.profitDetail, PERM.bezahltView]}
      description="Finanzdaten sind nur für berechtigte Rollen sichtbar."
    >
      <UmsatzUebersichtPage />
    </RequirePermission>
  ),
});

interface AuftragFinanz {
  a: AuftragRow;
  bezahlt: number;
  offen: number;
  umsatz: number;
  lastDate: string | null;
}


function UmsatzUebersichtPage() {
  const { canAny } = useAuth();
  const canUmsatz = canAny([PERM.profitCard, PERM.profitDetail, PERM.umsatzView, PERM.gewinnView]);
  const { get } = useStatuses();

  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: events = [] } = useQuery(zahlungsereignisseQuery());
  const { data: umsatzMap = {} } = useQuery(zahlungUmsatzMapQuery(canUmsatz));
  const { data: offeneWerte = {} } = useQuery(offeneWerteQuery(canUmsatz));

  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const paymentStatus: PaymentStatus = search.paymentStatus ?? "alle";
  const fKunde = search.kunde ?? "alle";
  const fStatus = search.status ?? "alle";
  const von = search.von ?? "";
  const bis = search.bis ?? "";

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setSearch = (patch: Record<string, string | undefined>) =>
    navigate({
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev, ...patch };
        // Normalise "alle"/"" to undefined so the URL stays clean.
        for (const k of Object.keys(next)) {
          const v = (next as Record<string, unknown>)[k];
          if (v === "alle" || v === "") (next as Record<string, unknown>)[k] = undefined;
        }
        return next;
      },
      replace: true,
    });

  const inRange = (d: string | null) => {
    if (!d) return true;
    const day = d.slice(0, 10);
    if (von && day < von) return false;
    if (bis && day > bis) return false;
    return true;
  };

  const rev = (id: string) => umsatzMap[id]?.umsatz ?? 0;

  const auftragById = useMemo(() => {
    const m = new Map<string, (typeof auftraege)[number]>();
    for (const a of auftraege) m.set(a.id, a);
    return m;
  }, [auftraege]);

  // Per-Auftrag finance aggregation (consistent with existing Zahlung/Leistung logic).
  const auftragFinanz = useMemo(() => {
    const bezahltMap = new Map<string, number>();
    const lastDateMap = new Map<string, string>();
    for (const e of events) {
      if (!inRange(e.datum)) continue;
      bezahltMap.set(e.auftrag_id, (bezahltMap.get(e.auftrag_id) ?? 0) + rev(e.id));
      const prev = lastDateMap.get(e.auftrag_id);
      if (!prev || (e.datum ?? "") > prev) lastDateMap.set(e.auftrag_id, e.datum);
    }
    const rows: AuftragFinanz[] = [];
    for (const a of auftraege) {
      const bezahlt = bezahltMap.get(a.id) ?? 0;
      const offen = offeneWerte[a.id] ?? 0;
      const umsatz = bezahlt + offen;
      if (umsatz <= 0) continue;
      rows.push({ a, bezahlt, offen, umsatz, lastDate: lastDateMap.get(a.id) ?? a.bezahlt_am ?? null });
    }
    return rows;
  }, [auftraege, events, umsatzMap, offeneWerte, von, bis]);

  // Apply payment-status + status filters at the Auftrag level.
  const filteredAuftraege = useMemo(() => {
    return auftragFinanz.filter((r) => {
      if (paymentStatus === "bezahlt" && r.bezahlt <= 0) return false;
      if (paymentStatus === "offen" && r.offen <= 0) return false;
      if (fStatus !== "alle" && r.a.status !== fStatus) return false;
      return true;
    });
  }, [auftragFinanz, paymentStatus, fStatus]);

  // Group by Auftraggeber.
  const groups = useMemo(() => {
    const byKunde = new Map<string, AuftragFinanz[]>();
    for (const r of filteredAuftraege) {
      const key = r.a.kunde_id ?? "__none__";
      if (fKunde !== "alle" && key !== fKunde) continue;
      if (!byKunde.has(key)) byKunde.set(key, []);
      byKunde.get(key)!.push(r);
    }
    const kundeName = (id: string) =>
      id === "__none__" ? "Ohne Auftraggeber" : kunden.find((k) => k.id === id)?.name ?? "Unbekannt";
    return [...byKunde.entries()]
      .map(([id, rows]) => {
        const bezahlt = rows.reduce((s, r) => s + r.bezahlt, 0);
        const offen = rows.reduce((s, r) => s + r.offen, 0);
        return {
          id,
          name: kundeName(id),
          rows: rows.sort((a, b) => b.umsatz - a.umsatz),
          bezahlt,
          offen,
          umsatz: bezahlt + offen,
        };
      })
      .sort((a, b) => b.umsatz - a.umsatz);
  }, [filteredAuftraege, fKunde, kunden]);

  const totals = useMemo(() => {
    const bezahlt = groups.reduce((s, g) => s + g.bezahlt, 0);
    const offen = groups.reduce((s, g) => s + g.offen, 0);
    return { bezahlt, offen, umsatz: bezahlt + offen };
  }, [groups]);

  const statusOptions = useMemo(() => {
    const keys = new Set(auftraege.map((a) => a.status));
    return [...keys].map((k) => ({ value: k, label: get(k).label }));
  }, [auftraege, get]);

  const hasFilters = paymentStatus !== "alle" || fKunde !== "alle" || fStatus !== "alle" || !!von || !!bis;

  const title =
    paymentStatus === "offen" ? "Offene Umsätze" : paymentStatus === "bezahlt" ? "Bezahlte Umsätze" : "Umsatz nach Auftraggeber";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Euro className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Umsatz gruppiert nach Auftraggeber. Bezahlt aus Zahlungsereignissen, Offen aus noch nicht
              bezahlten Aufträgen.
            </p>
          </div>
        </div>
        <Link
          to="/umsatz"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="h-4 w-4" /> Umsatz / Gewinn (Detail)
        </Link>
      </div>

      {/* KPI summary */}
      {canUmsatz && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard icon={TrendingUp} label="Umsatz" value={fmtEuro(totals.umsatz)} color="var(--foreground)" />
          <KpiCard icon={Wallet} label="Bezahlt" value={fmtEuro(totals.bezahlt)} color="var(--success)" />
          <KpiCard icon={Euro} label="Offen" value={fmtEuro(totals.offen)} color="var(--primary)" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Auftraggeber</label>
          <Select value={fKunde} onValueChange={(v) => setSearch({ kunde: v })}>
            <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Auftraggeber</SelectItem>
              {kunden.map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={fStatus} onValueChange={(v) => setSearch({ status: v })}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Zahlung</label>
          <Select value={paymentStatus} onValueChange={(v) => setSearch({ paymentStatus: v })}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle</SelectItem>
              <SelectItem value="bezahlt">Bezahlt</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Von</label>
          <DatePicker value={von} onChange={(v) => setSearch({ von: v })} className="h-9" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Bis</label>
          <DatePicker value={bis} onChange={(v) => setSearch({ bis: v })} className="h-9" />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearch({ paymentStatus: undefined, kunde: undefined, status: undefined, von: undefined, bis: undefined })}
          >
            Zurücksetzen
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{groups.length} Auftraggeber</span>
      </div>

      {!canUmsatz ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Finanzwerte sind ausgeblendet – dir fehlt die Finanzberechtigung.
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Keine Umsätze für die gewählten Filter gefunden.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = expanded.has(g.id);
            return (
              <div key={g.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <button
                  onClick={() => toggle(g.id)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.rows.length} Aufträge</p>
                  </div>
                  <div className="flex shrink-0 gap-6 text-right">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Umsatz</p>
                      <p className="font-bold tabular-nums">{fmtEuro(g.umsatz)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bezahlt</p>
                      <p className="font-bold tabular-nums text-success">{fmtEuro(g.bezahlt)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Offen</p>
                      <p className="font-bold tabular-nums text-warning">{fmtEuro(g.offen)}</p>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-2 font-semibold">Auftrag</th>
                            <th className="px-4 py-2 font-semibold">Status</th>
                            <th className="px-4 py-2 text-right font-semibold">Umsatz</th>
                            <th className="px-4 py-2 text-right font-semibold">Bezahlt</th>
                            <th className="px-4 py-2 text-right font-semibold">Offen</th>
                            <th className="px-4 py-2 font-semibold">Letzte Zahlung</th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map(({ a, bezahlt, offen, umsatz, lastDate }) => {
                            const st = get(a.status);
                            const adresse = [fmtStrasse(a), fmtOrt(a)].filter(Boolean).join(", ");
                            return (
                              <tr key={a.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                                <td className="px-4 py-3 align-top">
                                  <Link
                                    to="/auftraege/$id"
                                    params={{ id: a.id }}
                                    search={{ source: "dashboard" }}
                                    onClick={() => saveRouteScrollState(a.id)}
                                    data-route-scroll-id={a.id}
                                    className="font-semibold hover:text-primary"
                                  >
                                    {a.titel}
                                  </Link>
                                  <div className="text-xs text-muted-foreground">{a.auftragsnummer ?? "–"}</div>
                                  {adresse && (
                                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      <MapPin className="h-3 w-3" /> {adresse}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <span className="badge-status" style={statusStyle(st.farbe)}>{st.label}</span>
                                </td>
                                <td className="px-4 py-3 text-right align-top font-semibold tabular-nums">{fmtEuro(umsatz)}</td>
                                <td className="px-4 py-3 text-right align-top tabular-nums text-success">{fmtEuro(bezahlt)}</td>
                                <td className="px-4 py-3 text-right align-top tabular-nums text-warning">{fmtEuro(offen)}</td>
                                <td className="px-4 py-3 align-top whitespace-nowrap text-muted-foreground">
                                  {lastDate ? fmtDate(lastDate) : "–"}
                                </td>
                                <td className="px-4 py-3 text-right align-top">
                                  <Link
                                    to="/auftraege/$id"
                                    params={{ id: a.id }}
                                    search={{ source: "dashboard" }}
                                    onClick={() => saveRouteScrollState(a.id)}
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    Öffnen <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4" style={{ color }} /> {label}
      </div>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

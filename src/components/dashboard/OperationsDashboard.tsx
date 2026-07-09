import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  isToday,
  parseISO,
  startOfToday,
  endOfDay,
  addDays,
  isBefore,
  isWithinInterval,
  format,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  Sun,
  CalendarClock,
  ClipboardList,
  PhoneCall,
  AlertTriangle,
  History,
  Euro,
  Users,
  Plus,
  CalendarDays,
  Upload,
  FolderKanban,
  Building2,
  MapPin,
  Clock,
  ChevronRight,
  Wind,
  FileText,
  CheckCircle2,
  Phone,
  Mail,
} from "lucide-react";
import {
  auftraegeQuery,
  mitarbeiterQuery,
  historieRecentQuery,
  profilesQuery,
  auftragUmsatzMapQuery,
} from "@/lib/queries";
import type { AuftragRow } from "@/lib/queries";
import { rechnungGruppenQuery, gruppeEventLinksQuery } from "@/lib/abrechnung";
import { zahlungsereignisseQuery, zahlungUmsatzMapQuery } from "@/lib/zahlungen";
import { weatherQuery } from "@/lib/weather";
import { useStatuses } from "@/lib/status";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { fmtTime, fmtEuro, fmtStrasse, fmtOrt, fmtRelative, initials } from "@/lib/erp";
import { CollapsibleStatusSection } from "@/components/CollapsibleStatusSection";
import { AuftragFormDialog } from "@/components/AuftragFormDialog";
import { ProjektFormDialog } from "@/components/ProjektFormDialog";
import { KundeFormDialog } from "@/components/KundeFormDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { saveRouteScrollState } from "@/hooks/useRouteScrollRestoration";
import { cn } from "@/lib/utils";

/* ================================================================== */
/* Shared primitives                                                    */
/* ================================================================== */

function Section({
  title,
  icon: Icon,
  count,
  action,
  children,
  className,
  tone = "default",
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5 shadow-soft",
        tone === "danger" ? "border-destructive/40 bg-destructive/5" : "border-border",
        className,
      )}
    >
      <header className="mb-4 flex items-center gap-2">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
            tone === "danger" ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="min-w-0 truncate text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {count != null && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold",
              tone === "danger"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            {count}
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

/** Compact appointment/order row: time · customer · address · employees · status color. */
function OpsAuftragItem({
  a,
  danger = false,
}: {
  a: AuftragRow;
  danger?: boolean;
}) {
  const { get } = useStatuses();
  const st = get(a.status);
  const ma = (a.zuweisungen ?? []).map((z) => z.mitarbeiter).filter(Boolean) as NonNullable<
    AuftragRow["zuweisungen"][number]["mitarbeiter"]
  >[];
  const adr = [fmtStrasse(a), fmtOrt(a)].filter(Boolean).join(", ");

  return (
    <Link
      to="/auftraege/$id"
      params={{ id: a.id }}
      onClick={() => saveRouteScrollState(a.id)}
      data-route-scroll-id={a.id}
      className={cn(
        "group flex items-stretch gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted",
        danger ? "border-destructive/40 hover:border-destructive/60" : "border-border hover:border-primary/40",
      )}
    >
      <span
        className="mt-0.5 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: st.farbe }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold leading-tight">{a.titel}</p>
          {a.termin_start && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 text-xs font-semibold",
                danger ? "text-destructive" : "text-foreground",
              )}
            >
              <Clock className="h-3.5 w-3.5" /> {fmtTime(a.termin_start)}
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {a.kunde?.name || a.kunde_name || "–"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {adr && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{adr}</span>
            </span>
          )}
          <span className="badge-status text-[11px]" style={{ color: st.farbe, backgroundColor: `${st.farbe}22` }}>
            {st.label}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between">
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        <div className="flex -space-x-2">
          {ma.slice(0, 3).map((m) => (
            <span
              key={m.id}
              title={`${m.vorname} ${m.nachname}`}
              className="grid h-6 w-6 place-items-center rounded-full border-2 border-card text-[9px] font-bold text-white"
              style={{ backgroundColor: m.farbe }}
            >
              {initials(m.vorname, m.nachname)}
            </span>
          ))}
          {ma.length > 3 && (
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-muted text-[9px] font-bold">
              +{ma.length - 3}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

const isDoneStatus = (
  a: AuftragRow,
  get: (k: string) => { ist_abschluss: boolean },
) => a.status === "storniert" || get(a.status).ist_abschluss;

/* ================================================================== */
/* 1 · Heute                                                            */
/* ================================================================== */
function HeuteSection() {
  const { data: auftraege, isLoading } = useQuery(auftraegeQuery());
  const list = (auftraege ?? []).filter(
    (a) => a.termin_start && isToday(parseISO(a.termin_start)),
  );

  return (
    <Section title="Heute" icon={Sun} count={isLoading ? undefined : list.length} className="lg:col-span-2">
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : list.length === 0 ? (
        <EmptyHint text="Keine Termine für heute geplant." />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {list.map((a) => (
            <OpsAuftragItem key={a.id} a={a} />
          ))}
        </div>
      )}
    </Section>
  );
}

/* ================================================================== */
/* 2 · Nächste Termine (7 Tage)                                         */
/* ================================================================== */
function NaechsteTermineSection() {
  const { data: auftraege, isLoading } = useQuery(auftraegeQuery());

  const groups = useMemo(() => {
    const from = addDays(startOfToday(), 1);
    const to = endOfDay(addDays(startOfToday(), 7));
    const items = (auftraege ?? []).filter((a) => {
      if (!a.termin_start) return false;
      const d = parseISO(a.termin_start);
      return isWithinInterval(d, { start: from, end: to });
    });
    const byDay = new Map<string, { label: string; items: AuftragRow[] }>();
    for (const a of items) {
      const d = parseISO(a.termin_start!);
      const key = format(d, "yyyy-MM-dd");
      if (!byDay.has(key))
        byDay.set(key, { label: format(d, "EEEE, dd. MMM", { locale: de }), items: [] });
      byDay.get(key)!.items.push(a);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [auftraege]);

  const total = groups.reduce((s, [, g]) => s + g.items.length, 0);

  return (
    <Section
      title="Nächste Termine"
      icon={CalendarClock}
      count={isLoading ? undefined : total}
      className="lg:col-span-2"
    >
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : groups.length === 0 ? (
        <EmptyHint text="Keine Termine in den nächsten 7 Tagen." />
      ) : (
        <div className="space-y-4">
          {groups.map(([key, g]) => (
            <div key={key}>
              <p className="mb-2 text-xs font-bold capitalize text-muted-foreground">{g.label}</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {g.items.map((a) => (
                  <OpsAuftragItem key={a.id} a={a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ================================================================== */
/* 3 · Offene Aufträge (nach Status, klappbar)                          */
/* ================================================================== */
function OffeneAuftraegeSection() {
  const { active: statuses } = useStatuses();
  const { data: auftraege, isLoading } = useQuery(auftraegeQuery());

  const openStatuses = statuses.filter((s) => !s.ist_abschluss && s.key !== "storniert");

  return (
    <Section title="Offene Aufträge" icon={ClipboardList} className="lg:col-span-2">
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="space-y-3">
          {openStatuses.map((s) => {
            const list = (auftraege ?? []).filter((a) => a.status === s.key);
            return (
              <CollapsibleStatusSection
                key={s.id}
                storageKey={`ops.offene.${s.id}`}
                color={s.farbe}
                label={s.label}
                count={list.length}
                className="rounded-xl border border-border bg-background p-3"
              >
                {list.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">Keine Aufträge</p>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {list.map((a) => (
                      <OpsAuftragItem key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </CollapsibleStatusSection>
            );
          })}
          {openStatuses.length === 0 && <EmptyHint text="Keine offenen Status konfiguriert." />}
        </div>
      )}
    </Section>
  );
}

/* ================================================================== */
/* 4 · Kontakte ohne Termin                                             */
/* ================================================================== */
function KontakteOhneTerminSection() {
  const { get } = useStatuses();
  const { data: auftraege, isLoading } = useQuery(auftraegeQuery());

  const list = (auftraege ?? []).filter((a) => {
    if (a.termin_start) return false;
    const keys = new Set<string>([
      a.status,
      ...(a.status_zuweisungen ?? []).map((z) => z.status_key),
    ]);
    for (const k of keys) if (get(k).ausschluss_kontakte_ohne_termin) return false;
    return !!(a.kunde_telefon || a.kunde_festnetz || a.kunde_email);
  });

  return (
    <Section title="Kontakte ohne Termin" icon={PhoneCall} count={isLoading ? undefined : list.length}>
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : list.length === 0 ? (
        <EmptyHint text="Alle Kontakte haben einen Termin." />
      ) : (
        <ul className="space-y-2">
          {list.slice(0, 8).map((a) => {
            const tel = a.kunde_telefon || a.kunde_festnetz;
            return (
              <li key={a.id}>
                <Link
                  to="/auftraege/$id"
                  params={{ id: a.id }}
                  onClick={() => saveRouteScrollState(a.id)}
                  data-route-scroll-id={a.id}
                  className="block rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <p className="truncate font-semibold leading-tight">{a.titel}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {a.kunde?.name || a.kunde_name || "–"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {tel && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {tel}
                      </span>
                    )}
                    {a.kunde_email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {a.kunde_email}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ================================================================== */
/* 5 · Überfällige Aufträge                                             */
/* ================================================================== */
function UeberfaelligeSection() {
  const { get } = useStatuses();
  const { data: auftraege, isLoading } = useQuery(auftraegeQuery());
  const today = startOfToday();

  const list = (auftraege ?? []).filter((a) => {
    if (!a.termin_start) return false;
    if (isDoneStatus(a, get)) return false;
    return isBefore(parseISO(a.termin_start), today);
  });

  return (
    <Section
      title="Überfällige Aufträge"
      icon={AlertTriangle}
      count={isLoading ? undefined : list.length}
      tone="danger"
    >
      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : list.length === 0 ? (
        <EmptyHint text="Keine überfälligen Aufträge. 👍" />
      ) : (
        <div className="space-y-2.5">
          {list.slice(0, 10).map((a) => (
            <OpsAuftragItem key={a.id} a={a} danger />
          ))}
        </div>
      )}
    </Section>
  );
}

/* ================================================================== */
/* 6 · Kürzlich geändert                                                */
/* ================================================================== */
function KuerzlichGeaendertSection() {
  const { data: eintraege, isLoading } = useQuery(historieRecentQuery());
  const { data: profiles = [] } = useQuery(profilesQuery());

  const nameOf = (id: string | null) => {
    if (!id) return "System";
    const p = profiles.find((x) => x.id === id);
    if (!p) return "Unbekannt";
    return [p.vorname, p.nachname].filter(Boolean).join(" ") || p.email || "Unbekannt";
  };

  return (
    <Section title="Kürzlich geändert" icon={History}>
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : (eintraege ?? []).length === 0 ? (
        <EmptyHint text="Noch keine Änderungen." />
      ) : (
        <ul className="space-y-2">
          {(eintraege ?? []).map((e) => {
            const inner = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold leading-tight">{e.aktion}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {fmtRelative(e.created_at)}
                  </span>
                </div>
                {e.details && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.details}</p>
                )}
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{nameOf(e.user_id)}</span>
                  {e.auftrag && ` · ${e.auftrag.auftragsnummer}`}
                </p>
              </>
            );
            const cls =
              "block rounded-xl border border-border bg-background p-3 transition-colors";
            return (
              <li key={e.id}>
                {e.auftrag ? (
                  <Link
                    to="/auftraege/$id"
                    params={{ id: e.auftrag.id }}
                    onClick={() => saveRouteScrollState(e.auftrag!.id)}
                    className={cn(cls, "hover:border-primary/40 hover:bg-muted")}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ================================================================== */
/* 7 · Finanzübersicht                                                  */
/* ================================================================== */
function FinanzStat({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{value}</p>
      )}
    </div>
  );
}

function FinanzuebersichtSection() {
  const { canAny } = useAuth();
  const canFinance = canAny([PERM.umsatzView, PERM.zahlungsereignisseView, PERM.abrechnungView]);

  const { data: events, isLoading: l1 } = useQuery(zahlungsereignisseQuery());
  const { data: umsatzMap = {}, isLoading: l2 } = useQuery(zahlungUmsatzMapQuery(canFinance));
  const { data: auftraege, isLoading: l3 } = useQuery(auftraegeQuery());
  const { data: auftragUmsatz = {}, isLoading: l4 } = useQuery(auftragUmsatzMapQuery(canFinance));
  const { data: gruppen, isLoading: l5 } = useQuery(rechnungGruppenQuery());
  const { data: links, isLoading: l6 } = useQuery(gruppeEventLinksQuery());

  if (!canFinance) return null;

  const loading = l1 || l2 || l3 || l4 || l5 || l6;

  // Jedes Zahlungsereignis wird genau EINMAL gezählt (kein Doppelzählen).
  const bereitsBezahlt = (events ?? []).reduce(
    (sum, e) => sum + (umsatzMap[e.id]?.umsatz ?? 0),
    0,
  );

  // Bereits einer Rechnungsgruppe zugeordnete Events.
  const linkedEventIds = new Set(
    (links ?? []).filter((l) => l.included).map((l) => l.zahlungsereignis_id),
  );
  const offeneLeistungen = (events ?? []).filter((e) => !linkedEventIds.has(e.id)).length;

  // Noch nicht bezahlt: Umsatz aktiver, nicht bezahlter Aufträge.
  const nochNichtBezahlt = (auftraege ?? [])
    .filter((a) => !a.bezahlt && a.status !== "storniert")
    .reduce((sum, a) => sum + (auftragUmsatz[a.id] ?? 0), 0);

  const rechnungenErstellt = (gruppen ?? []).filter((g) => g.status !== "storniert").length;

  return (
    <Section title="Finanzübersicht" icon={Euro} className="lg:col-span-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FinanzStat icon={ClipboardList} label="Offene Leistungen" value={String(offeneLeistungen)} loading={loading} />
        <FinanzStat icon={CheckCircle2} label="Bereits bezahlt" value={fmtEuro(bereitsBezahlt)} loading={loading} />
        <FinanzStat icon={Euro} label="Noch nicht bezahlt" value={fmtEuro(nochNichtBezahlt)} loading={loading} />
        <FinanzStat icon={FileText} label="Rechnungen erstellt" value={String(rechnungenErstellt)} loading={loading} />
      </div>
    </Section>
  );
}

/* ================================================================== */
/* 8 · Mitarbeiter heute                                                */
/* ================================================================== */
function MitarbeiterHeuteSection() {
  const { get } = useStatuses();
  const { data: mitarbeiter, isLoading: lm } = useQuery(mitarbeiterQuery());
  const { data: auftraege, isLoading: la } = useQuery(auftraegeQuery());
  const loading = lm || la;

  const rows = useMemo(() => {
    const todays = (auftraege ?? []).filter(
      (a) => a.termin_start && isToday(parseISO(a.termin_start)) && a.status !== "storniert",
    );
    return (mitarbeiter ?? [])
      .filter((m: { aktiv?: boolean }) => m.aktiv !== false)
      .map((m: { id: string; vorname: string; nachname: string; farbe: string }) => {
        const assigned = todays.filter((a) =>
          (a.zuweisungen ?? []).some((z) => z.mitarbeiter?.id === m.id),
        );
        const done = assigned.filter((a) => get(a.status).ist_abschluss).length;
        return { m, total: assigned.length, done, open: assigned.length - done };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [mitarbeiter, auftraege, get]);

  return (
    <Section title="Mitarbeiter heute" icon={Users} count={loading ? undefined : rows.length} className="lg:col-span-2">
      {loading ? (
        <ListSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyHint text="Heute keine Mitarbeiter eingeplant." />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {rows.map(({ m, total, done, open }) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: m.farbe }}
              >
                {initials(m.vorname, m.nachname)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight">
                  {m.vorname} {m.nachname}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{total} Einsätze</span>
                  <span className="text-primary">{open} offen</span>
                  <span className="text-success">{done} erledigt</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ================================================================== */
/* 9 · Schnellaktionen                                                  */
/* ================================================================== */
function SchnellaktionenSection() {
  const navigate = useNavigate();
  const { can, isStaff } = useAuth();
  const [auftragOpen, setAuftragOpen] = useState(false);
  const [projektOpen, setProjektOpen] = useState(false);
  const [kundeOpen, setKundeOpen] = useState(false);

  const actions: {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    show: boolean;
    primary?: boolean;
  }[] = [
    {
      label: "Neuer Auftrag",
      icon: Plus,
      onClick: () => setAuftragOpen(true),
      show: isStaff || can(PERM.auftraegeCreate),
      primary: true,
    },
    { label: "Kalender", icon: CalendarDays, onClick: () => navigate({ to: "/kalender" }), show: can(PERM.kalenderView) },
    { label: "Import Center", icon: Upload, onClick: () => navigate({ to: "/importe" }), show: can(PERM.importeView) },
    { label: "Neues Projekt", icon: FolderKanban, onClick: () => setProjektOpen(true), show: isStaff || can(PERM.projekteCreate) },
    { label: "Neuer Kunde", icon: Building2, onClick: () => setKundeOpen(true), show: isStaff || can(PERM.auftraggeberCreate) },
  ];

  const visible = actions.filter((a) => a.show);
  if (visible.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {visible.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={a.onClick}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center font-semibold shadow-soft transition-all active:scale-95",
              a.primary
                ? "border-transparent bg-primary text-primary-foreground hover:opacity-90"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted",
            )}
          >
            <a.icon className="h-6 w-6" />
            <span className="text-sm">{a.label}</span>
          </button>
        ))}
      </div>

      <AuftragFormDialog
        open={auftragOpen}
        onOpenChange={setAuftragOpen}
        onCreated={(id) => navigate({ to: "/auftraege/$id", params: { id } })}
      />
      <ProjektFormDialog open={projektOpen} onOpenChange={setProjektOpen} />
      <KundeFormDialog open={kundeOpen} onOpenChange={setKundeOpen} />
    </>
  );
}

/* ================================================================== */
/* 10 · Wetter                                                          */
/* ================================================================== */
function WetterSection() {
  const { data: w, isLoading, isError } = useQuery(weatherQuery());

  return (
    <Section title="Wetter · Hameln" icon={Sun}>
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : isError || !w ? (
        <EmptyHint text="Wetter nicht verfügbar." />
      ) : (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-4">
          <span className="text-4xl leading-none" aria-hidden>
            {w.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-extrabold tracking-tight">{w.temperature}°C</p>
            <p className="truncate text-sm text-muted-foreground">{w.label}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Wind className="h-3 w-3" /> {w.windSpeed} km/h
            </p>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ================================================================== */
/* Layout                                                              */
/* ================================================================== */
export function OperationsDashboard() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight">
            Hallo {profile?.vorname ?? ""} 👋
          </h2>
          <p className="text-sm text-muted-foreground">Was braucht heute deine Aufmerksamkeit?</p>
        </div>
      </div>

      <SchnellaktionenSection />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <HeuteSection />
        <WetterSection />
        <UeberfaelligeSection />
        <NaechsteTermineSection />
        <OffeneAuftraegeSection />
        <KontakteOhneTerminSection />
        <MitarbeiterHeuteSection />
        <KuerzlichGeaendertSection />
        <FinanzuebersichtSection />
      </div>
    </div>
  );
}

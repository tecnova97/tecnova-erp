import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  isToday,
  parseISO,
  startOfToday,
  endOfDay,
  addDays,
  isWithinInterval,
  format,
} from "date-fns";
import { de } from "date-fns/locale";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import {
  Sun,
  CalendarClock,
  ClipboardList,
  PhoneCall,
  History,
  Euro,
  Plus,
  CalendarDays,
  Upload,
  FolderKanban,
  Building2,
  MapPin,
  Clock,
  ChevronRight,
  Wind,
  

  Phone,
  Mail,
  ListChecks,
  Wallet,
  TrendingUp,
  LayoutGrid,
  GripVertical,
  EyeOff,
  Save,
  RotateCcw,
  X,
  Loader2,
} from "lucide-react";
import {
  auftraegeQuery,
  historieRecentQuery,
  profilesQuery,
} from "@/lib/queries";

import type { AuftragRow } from "@/lib/queries";
import { zahlungsereignisseQuery, zahlungUmsatzMapQuery } from "@/lib/zahlungen";
import { offeneWerteQuery } from "@/lib/finanzen";
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
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  WIDGET_META,
  widgetTitle,
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_ROW_HEIGHT,
  GRID_MARGIN,
  defaultGridConfig,
  gridConfigQuery,
  saveGridConfig,
  resetGridConfig,
  type WidgetKey,
  type GridConfig,
} from "@/lib/dashboard-grid";
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
        "flex h-full min-h-0 flex-col rounded-2xl border bg-card p-5 shadow-soft",
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
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

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
      search={{ source: "dashboard" }}
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
                  search={{ source: "dashboard" }}
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
/* 5 · Heutige Aufträge – Status                                        */
/* ================================================================== */
function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2 text-center">
      <p className="text-lg font-extrabold leading-none tracking-tight" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function HeutigeStatusSection() {
  const { get } = useStatuses();
  const { data: auftraege, isLoading } = useQuery(auftraegeQuery());

  const { list, stats } = useMemo(() => {
    const today = (auftraege ?? [])
      .filter((a) => a.termin_start && isToday(parseISO(a.termin_start)))
      .sort((a, b) => (a.termin_start ?? "").localeCompare(b.termin_start ?? ""));
    let erledigt = 0;
    let offen = 0;
    let bezahlt = 0;
    for (const a of today) {
      if (a.bezahlt) bezahlt++;
      if (a.status !== "storniert" && get(a.status).ist_abschluss) erledigt++;
      else if (a.status !== "storniert") offen++;
    }
    return { list: today, stats: { total: today.length, erledigt, offen, bezahlt } };
  }, [auftraege, get]);

  return (
    <Section
      title="Heutige Aufträge – Status"
      icon={ListChecks}
      count={isLoading ? undefined : stats.total}
    >
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : list.length === 0 ? (
        <EmptyHint text="Heute keine Aufträge geplant." />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatPill label="Gesamt" value={stats.total} color="var(--foreground)" />
            <StatPill label="Offen / Laufend" value={stats.offen} color="var(--primary)" />
            <StatPill label="Erledigt" value={stats.erledigt} color="var(--success)" />
            <StatPill label="Bezahlt" value={stats.bezahlt} color="var(--success)" />
          </div>
          <div className="grid gap-2.5">
            {list.map((a) => (
              <OpsAuftragItem key={a.id} a={a} />
            ))}
          </div>
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
                    search={{ source: "dashboard" }}
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

function useCanFinance() {
  const { canAny } = useAuth();
  return canAny([PERM.umsatzView, PERM.gewinnView, PERM.profitCard, PERM.profitDetail]);
}

function FinanzCard({
  icon: Icon,
  label,
  value,
  loading,
  to,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  loading: boolean;
  to: string;
  color: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col justify-between rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted"
    >
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-4 w-4" style={{ color }} /> {label}
        </span>
        <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <p className="mt-2 text-2xl font-extrabold tracking-tight" style={{ color }}>
          {value}
        </p>
      )}
    </Link>
  );
}

function FinanzSection() {
  const canFinance = useCanFinance();

  const { data: events, isLoading: l1 } = useQuery(zahlungsereignisseQuery());
  const { data: umsatzMap = {}, isLoading: l2 } = useQuery(zahlungUmsatzMapQuery(canFinance));
  const { data: offeneWerte = {}, isLoading: l3 } = useQuery(offeneWerteQuery(canFinance));

  if (!canFinance) return null;

  const loading = l1 || l2 || l3;

  // Bezahlt: realisierter Umsatz aus allen aktiven Zahlungsereignissen.
  const bezahlt = (events ?? []).reduce((sum, e) => sum + (umsatzMap[e.id]?.umsatz ?? 0), 0);
  // Offen: berechenbarer Wert der noch nicht bezahlten Aufträge.
  const offen = Object.values(offeneWerte).reduce((sum, v) => sum + Number(v ?? 0), 0);
  // Umsatz: gesamter berechenbarer Betrag = bezahlt + offen.
  const umsatz = bezahlt + offen;

  return (
    <Section title="Finanzübersicht" icon={Euro}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FinanzCard
          icon={TrendingUp}
          label="Umsatz"
          value={fmtEuro(umsatz)}
          loading={loading}
          to="/umsatz"
          color="var(--foreground)"
        />
        <FinanzCard
          icon={Wallet}
          label="Bezahlt"
          value={fmtEuro(bezahlt)}
          loading={loading}
          to="/bezahlt"
          color="var(--success)"
        />
        <FinanzCard
          icon={Euro}
          label="Offen"
          value={fmtEuro(offen)}
          loading={loading}
          to="/umsatz"
          color="var(--primary)"
        />
      </div>
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
    { label: "Neuer Auftraggeber", icon: Building2, onClick: () => setKundeOpen(true), show: isStaff || can(PERM.auftraggeberCreate) },
  ];

  const visible = actions.filter((a) => a.show);
  if (visible.length === 0) return null;

  return (
    <Section title="Schnellaktionen" icon={Plus}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
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
    </Section>
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
/* Widget registry + grid layout                                       */
/* ================================================================== */

const WIDGET_RENDER: Record<WidgetKey, () => React.ReactElement> = {
  schnellaktionen: () => <SchnellaktionenSection />,
  heute: () => <HeuteSection />,
  wetter: () => <WetterSection />,
  "heute-status": () => <HeutigeStatusSection />,
  "naechste-termine": () => <NaechsteTermineSection />,
  offene: () => <OffeneAuftraegeSection />,
  "kontakte-ohne-termin": () => <KontakteOhneTerminSection />,
  kuerzlich: () => <KuerzlichGeaendertSection />,
  finanz: () => <FinanzSection />,
};

const ResponsiveGridLayout = WidthProvider(Responsive);

function WidgetShell({
  wKey,
  editing,
  onHide,
  children,
}: {
  wKey: WidgetKey;
  editing: boolean;
  onHide: (k: WidgetKey) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full">
      {editing && (
        <div className="widget-drag absolute inset-x-0 top-0 z-20 flex h-8 cursor-move items-center justify-between rounded-t-2xl border-b border-primary/20 bg-primary/10 px-2 backdrop-blur-sm">
          <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-primary">
            <GripVertical className="h-4 w-4 shrink-0" />
            <span className="truncate">{widgetTitle(wKey)}</span>
          </span>
          <button
            type="button"
            onClick={() => onHide(wKey)}
            className="shrink-0 rounded-md p-1 text-primary hover:bg-primary/20"
            title="Ausblenden"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      )}
      <div
        className={cn(
          "h-full",
          editing && "pointer-events-none select-none overflow-hidden pt-8 opacity-95",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function OperationsDashboard() {
  const { profile, canAny } = useAuth();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const userId = profile?.id;
  const canFinance = canAny([PERM.umsatzView, PERM.gewinnView, PERM.profitCard, PERM.profitDetail]);

  const { data: saved } = useQuery(gridConfigQuery(userId));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GridConfig | null>(null);
  const [busy, setBusy] = useState(false);

  // The active (persisted) configuration, falling back to defaults.
  const active: GridConfig = saved ?? defaultGridConfig();
  const cfg: GridConfig = editing && draft ? draft : active;

  // All widget keys available to this user (finance gated).
  const available = useMemo(
    () => WIDGET_META.filter((w) => !w.finance || canFinance).map((w) => w.key),
    [canFinance],
  );

  const hiddenSet = new Set(cfg.hidden);
  const visibleKeys = available.filter((k) => !hiddenSet.has(k));
  const hiddenKeys = available.filter((k) => hiddenSet.has(k));

  // Mobile stacks widgets top-to-bottom following the saved desktop positions.
  const mobileOrder = useMemo(() => {
    const lg = cfg.layouts.lg ?? [];
    const pos = new Map(lg.map((it) => [it.i, it.y * 100 + it.x]));
    return [...visibleKeys].sort(
      (a, b) => (pos.get(a) ?? 9999) - (pos.get(b) ?? 9999),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.layouts, cfg.hidden.join(",")]);


  const startEdit = () => {
    setDraft({
      layouts: JSON.parse(JSON.stringify(active.layouts)),
      hidden: [...active.hidden],
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditing(false);
  };

  const hideWidget = (k: WidgetKey) =>
    setDraft((d) => (d ? { ...d, hidden: [...new Set([...d.hidden, k])] } : d));

  const showWidget = (k: WidgetKey) =>
    setDraft((d) => (d ? { ...d, hidden: d.hidden.filter((x) => x !== k) } : d));

  const save = async () => {
    if (!userId || !draft) return;
    setBusy(true);
    try {
      await saveGridConfig(userId, draft);
      await qc.invalidateQueries({ queryKey: ["dashboard_grid", userId] });
      setEditing(false);
      setDraft(null);
      toast.success("Dashboard-Layout gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const resetLayout = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await resetGridConfig(userId);
      await qc.invalidateQueries({ queryKey: ["dashboard_grid", userId] });
      setDraft({
        layouts: defaultGridConfig().layouts,
        hidden: [],
      });
      toast.success("Layout zurückgesetzt.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Zurücksetzen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd. MMMM yyyy", { locale: de })}
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight">
            Hallo {profile?.vorname ?? ""} 👋
          </h2>
          <p className="text-sm text-muted-foreground">Was braucht heute deine Aufmerksamkeit?</p>
        </div>

        {/* Desktop-only layout customization */}
        {!isMobile && (
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={resetLayout} disabled={busy}>
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Layout zurücksetzen
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={busy}>
                  <X className="mr-1.5 h-4 w-4" /> Abbrechen
                </Button>
                <Button size="sm" onClick={save} disabled={busy}>
                  {busy ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}{" "}
                  Speichern
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <LayoutGrid className="mr-1.5 h-4 w-4" /> Layout bearbeiten
              </Button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Ziehe Widgets an der Kopfleiste, um sie zu verschieben. Ziehe die untere rechte Ecke,
            um die Größe zu ändern.
          </p>
          {hiddenKeys.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Ausgeblendet:</span>
              {hiddenKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => showWidget(k)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:border-primary/40 hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" /> {widgetTitle(k)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isMobile ? (
        // Mobile: clean single-column stack in configured order.
        <div className="space-y-4">
          {mobileOrder.map((k) => (
            <div key={k}>{WIDGET_RENDER[k]()}</div>
          ))}
        </div>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_HEIGHT}
          margin={GRID_MARGIN}
          layouts={cfg.layouts}
          isDraggable={editing}
          isResizable={editing}
          draggableHandle=".widget-drag"
          onLayoutChange={(_current, all) => {
            if (editing) setDraft((d) => (d ? { ...d, layouts: all } : d));
          }}
          measureBeforeMount={false}
          useCSSTransforms
        >
          {visibleKeys.map((k) => (
            <div key={k}>
              <WidgetShell wKey={k} editing={editing} onHide={hideWidget}>
                {WIDGET_RENDER[k]()}
              </WidgetShell>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}


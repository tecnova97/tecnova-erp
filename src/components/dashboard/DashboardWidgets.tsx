import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { isToday, parseISO } from "date-fns";
import {
  ClipboardList,
  CalendarDays,
  Building2,
  FolderKanban,
  Phone,
  Mail,
  MapPin,
  Activity,
  Clock3,
} from "lucide-react";
import { auftraegeQuery, auftragUmsatzMapQuery } from "@/lib/queries";
import { useStatuses, statusStyle } from "@/lib/status";
import { AuftragCard } from "@/components/AuftragCard";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { fmtTime, fmtStrasse, fmtOrt } from "@/lib/erp";


function EmptyHint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

/* ------------------------------------------------------------------ */
export function StatusUebersichtWidget() {
  const { active: statuses } = useStatuses();
  const { canAny } = useAuth();
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const canUmsatz = canAny([PERM.profitCard, PERM.profitDetail, PERM.umsatzView]);
  const { data: umsatzMap = {} } = useQuery(auftragUmsatzMapQuery(canUmsatz));

  const visible = statuses.filter((s) => s.sichtbar_dashboard);
  if (visible.length === 0)
    return <EmptyHint text="Keine Status für das Dashboard aktiviert." />;

  return (
    <div className="space-y-5">
      {visible.map((s) => {
        const list = auftraege.filter((a) => a.status === s.key);
        return (
          <div key={s.id}>
            <div className="mb-2 flex items-center gap-2">
              <span className="badge-status text-xs" style={statusStyle(s.farbe)}>
                {s.label}
              </span>
              <span className="text-sm font-bold text-muted-foreground">{list.length}</span>
            </div>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border py-3 text-center text-xs text-muted-foreground">
                Keine Aufträge
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((a) => (
                  <AuftragCard
                    key={a.id}
                    auftrag={a}
                    showDay
                    umsatz={canUmsatz ? umsatzMap[a.id] : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function KontakteOhneTerminWidget() {
  const { get } = useStatuses();
  const { data: auftraege = [] } = useQuery(auftraegeQuery());

  const list = auftraege.filter((a) => {
    // Already has an appointment → not relevant.
    if (a.termin_start) return false;
    // Excluded if ANY assigned status (multi-status) is flagged to exclude.
    const keys = new Set<string>([a.status, ...(a.status_zuweisungen ?? []).map((z) => z.status_key)]);
    for (const k of keys) {
      if (get(k).ausschluss_kontakte_ohne_termin) return false;
    }
    // At least ONE contact detail is enough (no address required).
    const hasContact = !!(
      a.kunde_name ||
      a.kunde?.name ||
      a.kunde_telefon ||
      a.kunde?.telefon ||
      a.kunde_festnetz ||
      a.kunde_email
    );
    return hasContact;
  });

  if (list.length === 0) return <EmptyHint text="Alle Kontakte haben einen Termin." />;

  return (
    <ul className="space-y-2">
      {list.slice(0, 8).map((a) => {
        const tel = a.kunde_telefon || a.kunde_festnetz;
        const mail = a.kunde_email;
        const adr = [fmtStrasse(a), fmtOrt(a)].filter(Boolean).join(", ");
        return (
          <li key={a.id}>
            <Link
              to="/auftraege/$id"
              params={{ id: a.id }}
              className="block rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted"
            >
              <p className="font-semibold leading-tight">{a.titel}</p>
              <p className="text-sm text-muted-foreground">{a.kunde?.name || a.kunde_name || "–"}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {tel && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {tel}</span>}
                {mail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {mail}</span>}
                {adr && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {adr}</span>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
export function HeutigeAuftraegeWidget() {
  const { get } = useStatuses();
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const today = auftraege.filter((a) => a.termin_start && isToday(parseISO(a.termin_start)));

  if (today.length === 0) return <EmptyHint text="Keine Aufträge für heute geplant." />;

  return (
    <ul className="space-y-2">
      {today.map((a) => {
        const st = get(a.status);
        const adr = [fmtStrasse(a), fmtOrt(a)].filter(Boolean).join(", ");
        return (
          <li key={a.id}>
            <Link
              to="/auftraege/$id"
              params={{ id: a.id }}
              className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted"
            >
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: st.farbe }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold leading-tight">{a.titel}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.auftragsnummer}</span>
                </div>
                <p className="text-sm text-muted-foreground">{a.kunde?.name || a.kunde_name || "–"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {adr && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {adr}</span>}
                  {a.termin_start && (
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {fmtTime(a.termin_start)}</span>
                  )}
                  <span className="badge-status text-[11px]" style={statusStyle(st.farbe)}>{st.label}</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}



/* ------------------------------------------------------------------ */
/** Compact quick-access buttons shown next to the Dashboard title. */
export function QuickAccessBar() {
  const items = [
    { to: "/auftraege", icon: ClipboardList, label: "Aufträge" },
    { to: "/kalender", icon: CalendarDays, label: "Kalender" },
    { to: "/kunden", icon: Building2, label: "Auftraggeber" },
    { to: "/projekte", icon: FolderKanban, label: "Projekte" },
    { to: "/aktivitaet", icon: Activity, label: "Aktivität" },
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted"
        >
          <i.icon className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">{i.label}</span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function WidgetBody({ type }: { type: string }) {
  switch (type) {
    case "status-uebersicht":
      return <StatusUebersichtWidget />;
    case "kontakte-ohne-termin":
      return <KontakteOhneTerminWidget />;
    case "heutige-auftraege":
      return <HeutigeAuftraegeWidget />;
    default:
      return <EmptyHint text="Unbekanntes Widget." />;
  }
}


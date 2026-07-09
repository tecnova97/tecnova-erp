import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, endOfWeek, isToday } from "date-fns";
import { formatDe } from "@/lib/datetime";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Ban,
  Truck,
  StickyNote,
  CalendarRange,
  ListTodo,
  Clock,
  Users,
} from "lucide-react";
import {
  auftraegeQuery,
  mitarbeiterQuery,
  kundenQuery,
  projekteQuery,
  fotosQuery,
  type AuftragRow,
} from "@/lib/queries";
import { blockerQuery, blockerTyp, type BlockerRow } from "@/lib/blocker";
import { useStatuses } from "@/lib/status";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { RequirePermission } from "@/components/PermissionGuard";
import { PERM } from "@/lib/permissions";
import { assignedIds } from "@/lib/kalender-layout";
import { DayTimeline } from "@/components/kalender/DayTimeline";
import { WeekTimeline } from "@/components/kalender/WeekTimeline";
import { AgendaView } from "@/components/kalender/AgendaView";
import { ResourcePlanung } from "@/components/kalender/ResourcePlanung";
import { BlockerDialog } from "@/components/kalender/BlockerDialog";
import { ScheduleAuftragDialog } from "@/components/kalender/ScheduleAuftragDialog";
import { AuftragFormDialog } from "@/components/AuftragFormDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/kalender")({
  head: () => ({
    meta: [
      { title: "Disposition & Kalender – TecNova ERP" },
      {
        name: "description",
        content:
          "Professionelle Einsatzplanung für Glasfaser-Aufträge: Tages-, Wochen-, Agenda- und Mitarbeiter-Planung.",
      },
    ],
  }),
  component: () => (
    <RequirePermission perm={PERM.kalenderView}>
      <KalenderPage />
    </RequirePermission>
  ),
});

type View = "tag" | "woche" | "agenda" | "mitarbeiter";

interface SlotTarget {
  mitarbeiterId: string;
  start: Date;
}

function startOfWeekMon(d: Date) {
  const day = (d.getDay() + 6) % 7;
  const r = new Date(d);
  r.setDate(d.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

const VIEW_META: { key: View; label: string; icon: typeof Clock }[] = [
  { key: "tag", label: "Tag", icon: Clock },
  { key: "woche", label: "Woche", icon: CalendarRange },
  { key: "agenda", label: "Agenda", icon: ListTodo },
  { key: "mitarbeiter", label: "Mitarbeiter", icon: Users },
];

function KalenderPage() {
  const navigate = useNavigate();
  const { get, active: activeStatuses } = useStatuses();
  const { user, role, can } = useAuth();
  const isMobile = useIsMobile();

  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: blocker = [] } = useQuery(blockerQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: fotos = [] } = useQuery(fotosQuery());

  const isStaff = role === "owner" || role === "disponent";
  const canAlle = role === "owner" || can(PERM.kalenderAlleMitarbeiter);
  const canPlan = role === "owner" || can(PERM.kalenderPlan);
  const canMove = role === "owner" || can(PERM.kalenderMove);
  const canCreate = role === "owner" || can(PERM.auftraegeCreate);
  const canBlockerCreate = role === "owner" || can(PERM.kalenderBlockerCreate);
  const canAbwesenheit = role === "owner" || can(PERM.kalenderAbwesenheit);

  const [view, setView] = useState<View>("tag");
  const [viewTouched, setViewTouched] = useState(false);
  const [cursor, setCursor] = useState(new Date());

  // Filters
  const [fMitarbeiter, setFMitarbeiter] = useState("");
  const [fKunde, setFKunde] = useState("");
  const [fProjekt, setFProjekt] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [onlyOffen, setOnlyOffen] = useState(false);
  const [onlyOhneMa, setOnlyOhneMa] = useState(false);
  const [onlyHeute, setOnlyHeute] = useState(false);

  // Dialog state
  const [slotTarget, setSlotTarget] = useState<SlotTarget | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<SlotTarget | null>(null);
  const [createStart, setCreateStart] = useState<Date | null>(null);
  const [blockerDialog, setBlockerDialog] = useState<{
    existing?: BlockerRow | null;
    mitarbeiterId?: string;
    start?: Date;
    typ?: string;
  } | null>(null);

  // Mobile defaults to agenda; desktop to day (unless user picked one).
  useEffect(() => {
    if (viewTouched) return;
    setView(isMobile ? "agenda" : "tag");
  }, [isMobile, viewTouched]);

  const pickView = (v: View) => {
    setViewTouched(true);
    setView(v);
  };

  const fotoIds = useMemo(
    () => new Set((fotos as { auftrag_id: string }[]).map((f) => f.auftrag_id)),
    [fotos],
  );

  const visibleMitarbeiter = useMemo(() => {
    let list = (mitarbeiter as any[]).filter((m) => m.aktiv);
    if (!canAlle) list = list.filter((m) => m.linked_user_id === user?.id);
    if (fMitarbeiter) list = list.filter((m) => m.id === fMitarbeiter);
    return list;
  }, [mitarbeiter, canAlle, user?.id, fMitarbeiter]);

  const visibleIds = useMemo(
    () => new Set(visibleMitarbeiter.map((m) => m.id)),
    [visibleMitarbeiter],
  );

  const filtered = useMemo(
    () =>
      auftraege.filter((a) => {
        if (!a.termin_start) return false;
        if (fKunde && a.kunde_id !== fKunde) return false;
        if (fProjekt && a.projekt_id !== fProjekt) return false;
        if (fStatus && a.status !== fStatus) return false;
        if (onlyOffen && get(a.status).ist_abschluss) return false;
        const ids = assignedIds(a);
        if (onlyOhneMa && ids.length > 0) return false;
        if (onlyHeute && !isToday(new Date(a.termin_start))) return false;
        if (!canAlle && ids.length > 0 && !ids.some((id) => visibleIds.has(id))) return false;
        if (fMitarbeiter && !ids.includes(fMitarbeiter)) return false;
        return true;
      }),
    [
      auftraege,
      fKunde,
      fProjekt,
      fStatus,
      fMitarbeiter,
      onlyOffen,
      onlyOhneMa,
      onlyHeute,
      canAlle,
      visibleIds,
      get,
    ],
  );

  const visibleBlocker = useMemo(
    () =>
      blocker.filter((b) => {
        if (!visibleIds.has(b.mitarbeiter_id)) return false;
        const t = blockerTyp(b.typ);
        if (t.abwesenheit && !canAbwesenheit) {
          const own =
            visibleMitarbeiter.find((m) => m.id === b.mitarbeiter_id)?.linked_user_id === user?.id;
          if (!own) return false;
        }
        return true;
      }),
    [blocker, visibleIds, canAbwesenheit, visibleMitarbeiter, user?.id],
  );

  const step = (dir: -1 | 1) => {
    if (view === "woche") setCursor((c) => addWeeks(c, dir));
    else setCursor((c) => addDays(c, dir));
  };

  const openDetail = (id: string) => navigate({ to: "/auftraege/$id", params: { id } });
  const openCreate = (start: Date) => {
    if (canCreate) setCreateStart(start);
  };

  const title =
    view === "woche"
      ? `${formatDe(startOfWeekMon(cursor), "dd.MM.")} – ${formatDe(endOfWeek(cursor, { weekStartsOn: 1 }), "dd.MM.yyyy")}`
      : view === "agenda"
        ? "Agenda"
        : formatDe(cursor, "EEEE, dd. MMMM yyyy");

  const activeFilterCount =
    (fMitarbeiter ? 1 : 0) +
    (fKunde ? 1 : 0) +
    (fProjekt ? 1 : 0) +
    (fStatus ? 1 : 0) +
    (onlyOffen ? 1 : 0) +
    (onlyOhneMa ? 1 : 0) +
    (onlyHeute ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {view !== "agenda" && (
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => step(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => step(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="h-9" onClick={() => setCursor(new Date())}>
              Heute
            </Button>
          </div>
        )}
        <h2 className="text-lg font-extrabold capitalize tracking-tight">{title}</h2>

        <div className="ml-auto flex items-center gap-2">
          {view !== "agenda" && (
            <DatePicker
              value={formatDe(cursor, "yyyy-MM-dd")}
              onChange={(v) => v && setCursor(new Date(v))}
              className="hidden h-9 w-auto text-sm font-medium sm:flex"
            />
          )}
          <div className="flex overflow-x-auto rounded-lg border border-border p-0.5">
            {VIEW_META.map((v) => (
              <button
                key={v.key}
                onClick={() => pickView(v.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  view === v.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <v.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter value={fMitarbeiter} onChange={setFMitarbeiter} label="Alle Mitarbeiter">
          {(mitarbeiter as any[])
            .filter((m) => canAlle || m.linked_user_id === user?.id)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.vorname} {m.nachname}
              </option>
            ))}
        </Filter>
        <Filter value={fStatus} onChange={setFStatus} label="Alle Status">
          {activeStatuses.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Filter>
        <Filter value={fKunde} onChange={setFKunde} label="Alle Auftraggeber">
          {(kunden as any[]).map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </Filter>
        <Filter value={fProjekt} onChange={setFProjekt} label="Alle Projekte">
          {(projekte as any[]).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Filter>

        <Toggle active={onlyHeute} onClick={() => setOnlyHeute((v) => !v)}>
          Nur heute
        </Toggle>
        <Toggle active={onlyOffen} onClick={() => setOnlyOffen((v) => !v)}>
          Nur offene
        </Toggle>
        <Toggle active={onlyOhneMa} onClick={() => setOnlyOhneMa((v) => !v)}>
          Ohne Mitarbeiter
        </Toggle>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            className="h-9"
            onClick={() => {
              setFMitarbeiter("");
              setFKunde("");
              setFProjekt("");
              setFStatus("");
              setOnlyOffen(false);
              setOnlyOhneMa(false);
              setOnlyHeute(false);
            }}
          >
            Zurücksetzen ({activeFilterCount})
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isStaff && canBlockerCreate && (
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setBlockerDialog({ mitarbeiterId: fMitarbeiter || undefined })}
            >
              <Ban className="mr-1.5 h-4 w-4" /> Blocker
            </Button>
          )}
          {canCreate && (
            <Button className="h-9" onClick={() => openCreate(defaultCreateStart(cursor))}>
              <Plus className="mr-1.5 h-4 w-4" /> Auftrag
            </Button>
          )}
        </div>
      </div>

      {/* Views */}
      {view === "tag" && (
        <DayTimeline
          day={cursor}
          auftraege={filtered}
          get={get}
          canMove={canMove}
          canCreate={canCreate}
          fotoIds={fotoIds}
          onOpen={openDetail}
          onCreate={openCreate}
        />
      )}
      {view === "woche" && (
        <WeekTimeline
          cursor={cursor}
          auftraege={filtered}
          get={get}
          canCreate={canCreate}
          onOpen={openDetail}
          onCreate={openCreate}
          onDay={(d) => {
            setCursor(d);
            pickView("tag");
          }}
        />
      )}
      {view === "agenda" && (
        <AgendaView auftraege={filtered} get={get} fotoIds={fotoIds} onOpen={openDetail} />
      )}
      {view === "mitarbeiter" && (
        <ResourcePlanung
          day={cursor}
          mitarbeiter={visibleMitarbeiter}
          auftraege={filtered}
          blocker={visibleBlocker}
          get={get}
          canMove={canMove}
          onSlotClick={(mitarbeiterId, start) => setSlotTarget({ mitarbeiterId, start })}
          onBlockerClick={(b) => setBlockerDialog({ existing: b })}
          onOpen={openDetail}
        />
      )}

      {/* Slot action chooser (Mitarbeiter view) */}
      <Dialog open={!!slotTarget} onOpenChange={(o) => !o && setSlotTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {slotTarget && formatDe(slotTarget.start, "HH:mm 'Uhr'")} · Aktion wählen
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <SlotAction
              icon={Plus}
              label="Auftrag einplanen"
              disabled={!canPlan}
              onClick={() => {
                setScheduleTarget(slotTarget);
                setSlotTarget(null);
              }}
            />
            <SlotAction
              icon={Plus}
              label="Neuen Auftrag anlegen"
              disabled={!canCreate}
              onClick={() => {
                if (slotTarget) openCreate(slotTarget.start);
                setSlotTarget(null);
              }}
            />
            <SlotAction
              icon={Ban}
              label="Blocker hinzufügen"
              disabled={!canBlockerCreate}
              onClick={() => {
                setBlockerDialog({
                  mitarbeiterId: slotTarget?.mitarbeiterId,
                  start: slotTarget?.start,
                  typ: "privat",
                });
                setSlotTarget(null);
              }}
            />
            <SlotAction
              icon={Truck}
              label="Fahrzeit hinzufügen"
              disabled={!canBlockerCreate}
              onClick={() => {
                setBlockerDialog({
                  mitarbeiterId: slotTarget?.mitarbeiterId,
                  start: slotTarget?.start,
                  typ: "fahrzeit",
                });
                setSlotTarget(null);
              }}
            />
            <SlotAction
              icon={StickyNote}
              label="Notiz hinzufügen"
              disabled={!canBlockerCreate}
              onClick={() => {
                setBlockerDialog({
                  mitarbeiterId: slotTarget?.mitarbeiterId,
                  start: slotTarget?.start,
                  typ: "privat",
                });
                setSlotTarget(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {scheduleTarget && (
        <ScheduleAuftragDialog
          open={!!scheduleTarget}
          onOpenChange={(o) => !o && setScheduleTarget(null)}
          mitarbeiterId={scheduleTarget.mitarbeiterId}
          start={scheduleTarget.start}
        />
      )}

      {createStart && (
        <AuftragFormDialog
          open={!!createStart}
          onOpenChange={(o) => !o && setCreateStart(null)}
          defaultTerminStart={toLocalInput(createStart)}
          onCreated={(id) => {
            setCreateStart(null);
            openDetail(id);
          }}
        />
      )}

      {blockerDialog && (
        <BlockerDialog
          open={!!blockerDialog}
          onOpenChange={(o) => !o && setBlockerDialog(null)}
          existing={blockerDialog.existing ?? null}
          defaultMitarbeiterId={blockerDialog.mitarbeiterId}
          defaultStart={blockerDialog.start}
          defaultEnd={
            blockerDialog.start ? new Date(blockerDialog.start.getTime() + 60 * 60000) : undefined
          }
          defaultTyp={blockerDialog.typ}
        />
      )}
    </div>
  );
}

/** Default start for the "+ Auftrag" toolbar button: 08:00 on the cursor day. */
function defaultCreateStart(cursor: Date): Date {
  const d = new Date(cursor);
  d.setHours(8, 0, 0, 0);
  return d;
}

/** Convert a Date to the datetime-local value the form expects (yyyy-MM-ddTHH:mm). */
function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function SlotAction({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </button>
  );
}

function Filter({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium"
    >
      <option value="">{label}</option>
      {children}
    </select>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarClock,
  Plus,
  Ban,
  Truck,
  StickyNote,
} from "lucide-react";
import {
  auftraegeQuery,
  mitarbeiterQuery,
  kundenQuery,
  type AuftragRow,
} from "@/lib/queries";
import { blockerQuery, blockerTyp, type BlockerRow } from "@/lib/blocker";
import { useStatuses } from "@/lib/status";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RequirePermission } from "@/components/PermissionGuard";
import { PERM } from "@/lib/permissions";
import { TagesplanungBoard } from "@/components/kalender/TagesplanungBoard";
import { BlockerDialog } from "@/components/kalender/BlockerDialog";
import { ScheduleAuftragDialog } from "@/components/kalender/ScheduleAuftragDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/kalender")({
  head: () => ({ meta: [{ title: "Kalender – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.kalenderView}>
      <KalenderPage />
    </RequirePermission>
  ),
});

type View = "month" | "week" | "day" | "tagesplanung";

interface SlotTarget {
  mitarbeiterId: string;
  start: Date;
}

function KalenderPage() {
  const navigate = useNavigate();
  const { get } = useStatuses();
  const { user, role, can } = useAuth();
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: blocker = [] } = useQuery(blockerQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const { data: kunden = [] } = useQuery(kundenQuery());

  const isStaff = role === "owner" || role === "disponent";
  const canAlle = role === "owner" || can(PERM.kalenderAlleMitarbeiter);
  const canPlan = role === "owner" || can(PERM.kalenderPlan);
  const canMove = role === "owner" || can(PERM.kalenderMove);
  const canBlockerCreate = role === "owner" || can(PERM.kalenderBlockerCreate);
  const canAbwesenheit = role === "owner" || can(PERM.kalenderAbwesenheit);

  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const [fMitarbeiter, setFMitarbeiter] = useState("");
  const [fKunde, setFKunde] = useState("");
  const [fStatus, setFStatus] = useState("");

  // Slot / dialog state for the Tagesplanung board.
  const [slotTarget, setSlotTarget] = useState<SlotTarget | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<SlotTarget | null>(null);
  const [blockerDialog, setBlockerDialog] = useState<{
    existing?: BlockerRow | null;
    mitarbeiterId?: string;
    start?: Date;
    typ?: string;
  } | null>(null);

  const { active: activeStatuses } = useStatuses();

  // Which employees are visible: staff with "alle" see everyone (active), all
  // others only see their own lane (mapped via linked_user_id).
  const visibleMitarbeiter = useMemo(() => {
    let list = (mitarbeiter as any[]).filter((m) => m.aktiv);
    if (!canAlle) {
      list = list.filter((m) => m.linked_user_id === user?.id);
    }
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
        if (fStatus && a.status !== fStatus) return false;
        const ids = (a.zuweisungen ?? []).map((z) => z.mitarbeiter?.id).filter(Boolean) as string[];
        // Non-privileged users only see appointments touching their own lanes.
        if (!canAlle && !ids.some((id) => visibleIds.has(id))) return false;
        if (fMitarbeiter && !ids.includes(fMitarbeiter)) return false;
        return true;
      }),
    [auftraege, fKunde, fStatus, fMitarbeiter, canAlle, visibleIds],
  );

  const visibleBlocker = useMemo(
    () =>
      blocker.filter((b) => {
        if (!visibleIds.has(b.mitarbeiter_id)) return false;
        const t = blockerTyp(b.typ);
        // Absences of others require the dedicated permission.
        if (t.abwesenheit && !canAbwesenheit) {
          const own = visibleMitarbeiter.find((m) => m.id === b.mitarbeiter_id)?.linked_user_id === user?.id;
          if (!own) return false;
        }
        return true;
      }),
    [blocker, visibleIds, canAbwesenheit, visibleMitarbeiter, user?.id],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, AuftragRow[]>();
    for (const a of filtered) {
      const key = format(new Date(a.termin_start!), "yyyy-MM-dd");
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    }
    for (const arr of m.values())
      arr.sort((a, b) => new Date(a.termin_start!).getTime() - new Date(b.termin_start!).getTime());
    return m;
  }, [filtered]);

  const step = (dir: -1 | 1) => {
    if (view === "month") setCursor((c) => addMonths(c, dir));
    else if (view === "week") setCursor((c) => addWeeks(c, dir));
    else setCursor((c) => addDays(c, dir));
  };

  // Clicking a day opens Tagesplanung for that day (never Auftrag creation).
  const openTagesplanung = (d: Date) => {
    setCursor(d);
    setView("tagesplanung");
  };

  const openDetail = (id: string) => navigate({ to: "/auftraege/$id", params: { id } });

  const title =
    view === "month"
      ? format(cursor, "MMMM yyyy", { locale: de })
      : view === "week"
        ? `${format(startOfWeekMon(cursor), "dd.MM.", { locale: de })} – ${format(endOfWeek(cursor, { weekStartsOn: 1 }), "dd.MM.yyyy", { locale: de })}`
        : format(cursor, "EEEE, dd. MMMM yyyy", { locale: de });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
        <h2 className="text-lg font-extrabold capitalize tracking-tight">{title}</h2>

        <div className="ml-auto flex items-center gap-2">
          <input
            type="date"
            value={format(cursor, "yyyy-MM-dd")}
            onChange={(e) => e.target.value && setCursor(new Date(e.target.value))}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm font-medium"
          />
          <div className="flex rounded-lg border border-border p-0.5">
            {(["month", "week", "day", "tagesplanung"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "month" ? "Monat" : v === "week" ? "Woche" : v === "day" ? "Tag" : "Tagesplanung"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
        {isStaff && canBlockerCreate && (
          <Button
            variant="outline"
            className="ml-auto h-9"
            onClick={() => setBlockerDialog({ mitarbeiterId: fMitarbeiter || undefined })}
          >
            <Ban className="mr-1.5 h-4 w-4" /> Blocker
          </Button>
        )}
      </div>

      {view === "month" && (
        <MonthView cursor={cursor} byDay={byDay} get={get} onDay={openTagesplanung} onOpen={openDetail} />
      )}
      {view === "week" && (
        <WeekView cursor={cursor} byDay={byDay} get={get} onDay={openTagesplanung} onOpen={openDetail} />
      )}
      {view === "day" && (
        <DayView cursor={cursor} byDay={byDay} get={get} onOpen={openDetail} />
      )}
      {view === "tagesplanung" && (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            Tagesplanung für {format(cursor, "EEEE, dd.MM.yyyy", { locale: de })}
          </div>
          <TagesplanungBoard
            day={cursor}
            mitarbeiter={visibleMitarbeiter}
            auftraege={filtered}
            blocker={visibleBlocker}
            canMove={canMove}
            onSlotClick={(mitarbeiterId, start) => setSlotTarget({ mitarbeiterId, start })}
            onBlockerClick={(b) => setBlockerDialog({ existing: b })}
          />
        </>
      )}

      {/* Slot action chooser */}
      <Dialog open={!!slotTarget} onOpenChange={(o) => !o && setSlotTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {slotTarget && format(slotTarget.start, "HH:mm 'Uhr'")} · Aktion wählen
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

      {blockerDialog && (
        <BlockerDialog
          open={!!blockerDialog}
          onOpenChange={(o) => !o && setBlockerDialog(null)}
          existing={blockerDialog.existing ?? null}
          defaultMitarbeiterId={blockerDialog.mitarbeiterId}
          defaultStart={blockerDialog.start}
          defaultEnd={blockerDialog.start ? new Date(blockerDialog.start.getTime() + 60 * 60000) : undefined}
          defaultTyp={blockerDialog.typ}
        />
      )}
    </div>
  );
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

function startOfWeekMon(d: Date) {
  const day = (d.getDay() + 6) % 7;
  const r = new Date(d);
  r.setDate(d.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
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

type GetStatus = ReturnType<typeof useStatuses>["get"];

function Chip({ a, get, onOpen }: { a: AuftragRow; get: GetStatus; onOpen: (id: string) => void }) {
  const s = get(a.status);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen(a.id);
      }}
      className="flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-xs hover:opacity-80"
      style={{ backgroundColor: `${s.farbe}1f` }}
      title={a.titel}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.farbe }} />
      <span className="shrink-0 font-semibold text-muted-foreground">
        {format(new Date(a.termin_start!), "HH:mm")}
      </span>
      <span className="truncate font-medium">{a.titel}</span>
    </button>
  );
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function MonthView({
  cursor,
  byDay,
  get,
  onDay,
  onOpen,
}: {
  cursor: Date;
  byDay: Map<string, AuftragRow[]>;
  get: GetStatus;
  onDay: (d: Date) => void;
  onOpen: (id: string) => void;
}) {
  const start = startOfWeekMon(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-bold uppercase text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          const otherMonth = d.getMonth() !== cursor.getMonth();
          return (
            <div
              key={key}
              onClick={() => onDay(d)}
              className={cn(
                "min-h-[7rem] cursor-pointer border-b border-r border-border p-1.5 transition-colors hover:bg-muted/40",
                otherMonth && "bg-muted/20 text-muted-foreground",
              )}
            >
              <div
                className={cn(
                  "mb-1 text-right text-xs font-semibold",
                  key === today && "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                )}
              >
                {format(d, "d")}
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((a) => (
                  <Chip key={a.id} a={a} get={get} onOpen={onOpen} />
                ))}
                {items.length > 3 && (
                  <p className="px-1 text-[11px] text-muted-foreground">+{items.length - 3} weitere</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  cursor,
  byDay,
  get,
  onDay,
  onOpen,
}: {
  cursor: Date;
  byDay: Map<string, AuftragRow[]>;
  get: GetStatus;
  onDay: (d: Date) => void;
  onOpen: (id: string) => void;
}) {
  const start = startOfWeekMon(cursor);
  const days = eachDayOfInterval({ start, end: addDays(start, 6) });
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const items = byDay.get(key) ?? [];
        return (
          <div key={key} className="rounded-2xl border border-border bg-card p-2 shadow-soft">
            <button
              onClick={() => onDay(d)}
              className="mb-2 flex w-full items-center justify-between rounded-md px-1 py-0.5 hover:bg-muted"
            >
              <span className="text-xs font-bold uppercase text-muted-foreground">
                {format(d, "EEE", { locale: de })}
              </span>
              <span
                className={cn(
                  "text-sm font-bold",
                  key === today && "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground",
                )}
              >
                {format(d, "d")}
              </span>
            </button>
            <div className="space-y-1">
              {items.length === 0 && <p className="px-1 py-2 text-[11px] text-muted-foreground">—</p>}
              {items.map((a) => (
                <Chip key={a.id} a={a} get={get} onOpen={onOpen} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  cursor,
  byDay,
  get,
  onOpen,
}: {
  cursor: Date;
  byDay: Map<string, AuftragRow[]>;
  get: GetStatus;
  onOpen: (id: string) => void;
}) {
  const key = format(cursor, "yyyy-MM-dd");
  const items = byDay.get(key) ?? [];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <CalendarDays className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Keine Termine an diesem Tag.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const s = get(a.status);
            return (
              <button
                key={a.id}
                onClick={() => onOpen(a.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted"
              >
                <div className="w-14 shrink-0 text-sm font-bold">
                  {format(new Date(a.termin_start!), "HH:mm")}
                </div>
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.farbe }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.titel}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[a.auftragsnummer, a.kunde_name ?? a.kunde?.name, a.ort].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="badge-status shrink-0" style={{ color: s.farbe, backgroundColor: `${s.farbe}22` }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useMemo, useRef } from "react";
import { addDays, isSameDay } from "date-fns";
import { formatDe } from "@/lib/datetime";
import type { AuftragRow } from "@/lib/queries";
import {
  CAL_GRID,
  type TimeGrid,
  gridHeight,
  gridHours,
  topFor,
  heightFor,
  snap,
  auftragTimes,
  layoutEvents,
} from "@/lib/kalender-layout";
import { addMinutes } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type GetStatus,
  auftraggeberName,
  MitarbeiterDots,
  StatusBadge,
} from "@/components/kalender/parts";
import { cn } from "@/lib/utils";

function startOfWeekMon(d: Date) {
  const day = (d.getDay() + 6) % 7;
  const r = new Date(d);
  r.setDate(d.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function WeekTimeline({
  cursor,
  auftraege,
  get,
  canCreate,
  onOpen,
  onCreate,
  onDay,
  grid = CAL_GRID,
}: {
  cursor: Date;
  auftraege: AuftragRow[];
  get: GetStatus;
  canCreate: boolean;
  onOpen: (id: string) => void;
  onCreate: (start: Date) => void;
  onDay: (d: Date) => void;
  grid?: TimeGrid;
}) {
  const days = useMemo(() => {
    const start = startOfWeekMon(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const height = gridHeight(grid);
  const hours = gridHours(grid);
  const now = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {/* Sticky day headers */}
      <div className="sticky top-0 z-20 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border bg-card">
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, now);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onDay(d)}
              className="flex flex-col items-center gap-0.5 border-l border-border py-2 hover:bg-muted/50"
            >
              <span className="text-[11px] font-bold uppercase text-muted-foreground">
                {formatDe(d, "EEE")}
              </span>
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full text-sm font-bold",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {formatDe(d, "d")}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex overflow-x-auto">
        <div className="grid w-full grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ minWidth: 720 }}>
          {/* Time gutter */}
          <div className="relative border-r border-border" style={{ height }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute -translate-y-1/2 pl-2 text-[11px] font-semibold text-muted-foreground"
                style={{ top: (h - grid.startHour) * 60 * grid.pxPerMinute }}
              >
                {String(h).padStart(2, "0")}
              </div>
            ))}
          </div>

          {days.map((d) => (
            <DayColumn
              key={d.toISOString()}
              day={d}
              auftraege={auftraege}
              get={get}
              grid={grid}
              height={height}
              hours={hours}
              canCreate={canCreate}
              showNow={isSameDay(now, d)}
              now={now}
              onOpen={onOpen}
              onCreate={onCreate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  auftraege,
  get,
  grid,
  height,
  hours,
  canCreate,
  showNow,
  now,
  onOpen,
  onCreate,
}: {
  day: Date;
  auftraege: AuftragRow[];
  get: GetStatus;
  grid: TimeGrid;
  height: number;
  hours: number[];
  canCreate: boolean;
  showNow: boolean;
  now: Date;
  onOpen: (id: string) => void;
  onCreate: (start: Date) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dayEvents = useMemo(
    () =>
      auftraege.filter((a) => {
        const t = auftragTimes(a);
        return t && isSameDay(t.start, day);
      }),
    [auftraege, day],
  );
  const { visible, overflow } = useMemo(() => layoutEvents(dayEvents), [dayEvents]);

  const handleDblClick = (e: React.MouseEvent) => {
    if (!canCreate || !ref.current) return;
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = ref.current.getBoundingClientRect();
    const minutes = snap(Math.max(0, (e.clientY - rect.top) / grid.pxPerMinute), grid);
    const dd = new Date(day);
    dd.setHours(grid.startHour, 0, 0, 0);
    onCreate(addMinutes(dd, minutes));
  };

  return (
    <div
      ref={ref}
      onDoubleClick={handleDblClick}
      className="relative border-l border-border"
      style={{ height }}
    >
      {hours.map((h) => (
        <div
          key={h}
          className="pointer-events-none absolute inset-x-0 border-t border-border/50"
          style={{ top: (h - grid.startHour) * 60 * grid.pxPerMinute }}
        />
      ))}

      {showNow && now.getHours() >= grid.startHour && now.getHours() < grid.endHour && (
        <div
          className="pointer-events-none absolute inset-x-0 z-30 h-px bg-destructive"
          style={{ top: topFor(now, grid) }}
        />
      )}

      {visible.map((ev) => {
        const s = get(ev.item.status);
        const top = topFor(ev.start, grid);
        const boxHeight = heightFor(ev.start, ev.end, grid);
        return (
          <button
            key={ev.item.id}
            data-event
            onClick={() => onOpen(ev.item.id)}
            className="absolute overflow-hidden rounded-md border-l-2 px-1 py-0.5 text-left shadow-sm"
            style={{
              top,
              height: boxHeight,
              left: `calc(${ev.left * 100}% + 1px)`,
              width: `calc(${ev.width * 100}% - 2px)`,
              borderColor: s.farbe,
              backgroundColor: `color-mix(in oklab, ${s.farbe} 14%, var(--card))`,
            }}
            title={`${ev.item.titel} · ${auftraggeberName(ev.item)}`}
          >
            <div className="flex items-center justify-between gap-0.5">
              <span className="text-[10px] font-bold" style={{ color: s.farbe }}>
                {formatDe(ev.start, "HH:mm")}
              </span>
              {boxHeight > 34 && <MitarbeiterDots a={ev.item} max={2} />}
            </div>
            {boxHeight > 26 && (
              <p className="truncate text-[10px] font-semibold leading-tight text-foreground">
                {ev.item.titel}
              </p>
            )}
          </button>
        );
      })}

      {overflow.map((tile) => {
        const top = topFor(tile.start, grid);
        const boxHeight = heightFor(tile.start, tile.end, grid);
        return (
          <Popover key={tile.groupId}>
            <PopoverTrigger asChild>
              <button
                data-event
                className="absolute grid place-items-center rounded-md border border-dashed border-border bg-muted/60 text-[10px] font-bold text-muted-foreground hover:bg-muted"
                style={{
                  top,
                  height: boxHeight,
                  left: `calc(${tile.left * 100}% + 1px)`,
                  width: `calc(${tile.width * 100}% - 2px)`,
                }}
              >
                +{tile.items.length}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="start">
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {tile.items.map((ev) => {
                  const s = get(ev.item.status);
                  return (
                    <button
                      key={ev.item.id}
                      onClick={() => onOpen(ev.item.id)}
                      className="flex w-full items-start gap-2 rounded-md border border-border p-2 text-left hover:bg-muted"
                    >
                      <span className="mt-0.5 h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.farbe }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          {formatDe(ev.start, "HH:mm")} · {ev.item.titel}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {auftraggeberName(ev.item)}
                        </p>
                      </div>
                      <StatusBadge get={get} statusKey={ev.item.status} />
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

import { useMemo } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { formatDe, WEEKDAYS_DE } from "@/lib/datetime";
import type { AuftragRow } from "@/lib/queries";
import { auftragTimes } from "@/lib/kalender-layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type GetStatus,
  auftraggeberName,
  StatusBadge,
} from "@/components/kalender/parts";
import { cn } from "@/lib/utils";

interface DayEntry {
  item: AuftragRow;
  start: Date;
}

/** How many appointment chips fit in a cell before collapsing into "+N weitere". */
const MAX_CHIPS = 3;

export function MonthGrid({
  cursor,
  auftraege,
  get,
  onDay,
  onOpen,
}: {
  cursor: Date;
  auftraege: AuftragRow[];
  get: GetStatus;
  onDay: (day: Date) => void;
  onOpen: (id: string) => void;
}) {
  const weeks = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    for (const item of auftraege) {
      const t = auftragTimes(item);
      if (!t) continue;
      const key = formatDe(t.start, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push({ item, start: t.start });
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.start.getTime() - b.start.getTime());
    return map;
  }, [auftraege]);

  return (
    <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAYS_DE.map((d, i) => (
          <div
            key={d}
            className={cn(
              "px-2 py-2 text-center text-[11px] font-black uppercase tracking-wide text-muted-foreground",
              i >= 5 && "text-muted-foreground/70",
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="grid flex-1 grid-rows-6">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day) => {
              const key = formatDe(day, "yyyy-MM-dd");
              const entries = byDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const chips = entries.slice(0, MAX_CHIPS);
              const overflow = entries.length - chips.length;
              return (
                <button
                  key={key}
                  onClick={() => onDay(day)}
                  className={cn(
                    "group flex min-h-[92px] flex-col gap-1 border-b border-r border-border/70 p-1.5 text-left transition-colors hover:bg-muted/40",
                    !inMonth && "bg-muted/20",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                        isToday(day)
                          ? "bg-primary text-primary-foreground"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/60",
                      )}
                    >
                      {formatDe(day, "d")}
                    </span>
                    {entries.length > 0 && (
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {entries.length}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-0.5">
                    {chips.map((e) => {
                      const s = get(e.item.status);
                      return (
                        <span
                          key={e.item.id}
                          role="button"
                          tabIndex={0}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onOpen(e.item.id);
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                              ev.stopPropagation();
                              onOpen(e.item.id);
                            }
                          }}
                          className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] font-medium leading-tight hover:brightness-95"
                          style={{
                            backgroundColor: `color-mix(in oklab, ${s.farbe} 16%, var(--card))`,
                            color: "var(--foreground)",
                            borderLeft: `2px solid ${s.farbe}`,
                          }}
                          title={`${formatDe(e.start, "HH:mm")} · ${e.item.titel}`}
                        >
                          <span className="shrink-0 font-bold" style={{ color: s.farbe }}>
                            {formatDe(e.start, "HH:mm")}
                          </span>
                          <span className="truncate">{e.item.titel}</span>
                        </span>
                      );
                    })}

                    {overflow > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(ev) => ev.stopPropagation()}
                            className="mt-auto w-fit rounded px-1 text-[10px] font-bold text-primary hover:underline"
                          >
                            +{overflow} weitere
                          </span>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2" align="start">
                          <p className="px-1 pb-1 text-xs font-bold text-muted-foreground">
                            {formatDe(day, "EEEE, dd.MM.yyyy")}
                          </p>
                          <div className="max-h-72 space-y-1 overflow-y-auto">
                            {entries.map((e) => {
                              const s = get(e.item.status);
                              return (
                                <button
                                  key={e.item.id}
                                  onClick={() => onOpen(e.item.id)}
                                  className="flex w-full items-start gap-2 rounded-md border border-border p-2 text-left hover:bg-muted"
                                >
                                  <span
                                    className="mt-0.5 h-7 w-1 shrink-0 rounded-full"
                                    style={{ backgroundColor: s.farbe }}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold">
                                      {formatDe(e.start, "HH:mm")} · {e.item.titel}
                                    </p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                      {auftraggeberName(e.item)}
                                    </p>
                                  </div>
                                  <StatusBadge get={get} statusKey={e.item.status} />
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

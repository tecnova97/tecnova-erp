import { useMemo } from "react";
import { isSameDay, isAfter, differenceInCalendarDays, startOfDay } from "date-fns";
import { formatDe } from "@/lib/datetime";
import type { AuftragRow } from "@/lib/queries";
import { auftragTimes } from "@/lib/kalender-layout";
import {
  type GetStatus,
  auftraggeberName,
  MitarbeiterDots,
  ContactIcons,
  StatusBadge,
  AddressLine,
} from "@/components/kalender/parts";

interface AgendaEntry {
  item: AuftragRow;
  start: Date;
  end: Date;
}

export function AgendaView({
  auftraege,
  get,
  fotoIds,
  onOpen,
}: {
  auftraege: AuftragRow[];
  get: GetStatus;
  fotoIds: Set<string>;
  onOpen: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const entries: AgendaEntry[] = auftraege
      .map((item) => {
        const t = auftragTimes(item);
        return t ? { item, start: t.start, end: t.end } : null;
      })
      .filter((e): e is AgendaEntry => e !== null)
      .filter((e) => !isAfter(today, e.start))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const heute: AgendaEntry[] = [];
    const morgen: AgendaEntry[] = [];
    const woche: AgendaEntry[] = [];
    const spaeter: AgendaEntry[] = [];
    for (const e of entries) {
      const diff = differenceInCalendarDays(e.start, today);
      if (diff <= 0) heute.push(e);
      else if (diff === 1) morgen.push(e);
      else if (diff <= 7) woche.push(e);
      else spaeter.push(e);
    }
    return [
      { key: "heute", label: "Heute", items: heute },
      { key: "morgen", label: "Morgen", items: morgen },
      { key: "woche", label: "Diese Woche", items: woche },
      { key: "spaeter", label: "Später", items: spaeter },
    ].filter((g) => g.items.length > 0);
  }, [auftraege]);

  if (groups.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-card py-16 text-sm text-muted-foreground shadow-soft">
        Keine anstehenden Termine.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-black uppercase tracking-wide text-muted-foreground">
            {g.label}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
              {g.items.length}
            </span>
          </h3>
          <div className="space-y-2">
            {g.items.map((e) => (
              <button
                key={e.item.id}
                onClick={() => onOpen(e.item.id)}
                className="flex w-full items-stretch gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-soft transition hover:border-primary/40"
              >
                <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-muted/60 py-1">
                  <span className="text-sm font-black">{formatDe(e.start, "HH:mm")}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {formatDe(e.start, "dd.MM.")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-bold">{e.item.titel}</p>
                    <StatusBadge get={get} statusKey={e.item.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {auftraggeberName(e.item)}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <AddressLine a={e.item} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <MitarbeiterDots a={e.item} />
                    <ContactIcons a={e.item} hasFotos={fotoIds.has(e.item.id)} className="ml-auto" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

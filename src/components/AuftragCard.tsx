import { Link } from "@tanstack/react-router";
import { MapPin, Clock, ChevronRight, AlertTriangle, Euro } from "lucide-react";
import type { AuftragRow } from "@/lib/queries";
import { fmtDay, fmtTime, fmtEuro, fmtStrasse, fmtOrt, initials } from "@/lib/erp";
import { MultiStatusBadges } from "@/components/badges";
import { cn } from "@/lib/utils";
import { saveRouteScrollState } from "@/hooks/useRouteScrollRestoration";

export function AuftragCard({
  auftrag,
  showDay = true,
  umsatz,
}: {
  auftrag: AuftragRow;
  showDay?: boolean;
  /** Revenue for this order — only passed when the viewer may see it. */
  umsatz?: number;
}) {
  const ma = auftrag.zuweisungen.map((z) => z.mitarbeiter).filter(Boolean) as NonNullable<
    AuftragRow["zuweisungen"][number]["mitarbeiter"]
  >[];

  return (
    <Link
      to="/auftraege/$id"
      params={{ id: auftrag.id }}
      onClick={() => saveRouteScrollState(auftrag.id)}
      data-route-scroll-id={auftrag.id}
      className="group block rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:border-primary/40 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {auftrag.auftragsnummer}
            </span>
          </div>
          <h3 className="mt-1 truncate font-semibold leading-tight">{auftrag.titel}</h3>
          {(auftrag.kunde_name || auftrag.kunde) && (
            <p className="truncate text-sm text-muted-foreground">
              {auftrag.kunde_name ?? auftrag.kunde?.name}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <MultiStatusBadges auftrag={auftrag} />
          {auftrag.bezahlt && (
            <span
              className="badge-status"
              style={{ color: "#16a34a", backgroundColor: "rgba(22,163,74,0.13)" }}
            >
              Bezahlt
            </span>
          )}
        </div>
      </div>
      {umsatz != null && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold">
          <Euro className="h-3.5 w-3.5 text-muted-foreground" /> {fmtEuro(umsatz)}
        </div>
      )}

      {auftrag.wichtiginfo && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{auftrag.wichtiginfo}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {auftrag.termin_start && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {showDay && <span className="font-medium text-foreground">{fmtDay(auftrag.termin_start)}</span>}
            {fmtTime(auftrag.termin_start)} Uhr
          </span>
        )}
        {(auftrag.ort || auftrag.strasse) && (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {[fmtStrasse(auftrag), fmtOrt(auftrag)].filter(Boolean).join(", ")}
            </span>
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {ma.slice(0, 4).map((m) => (
            <span
              key={m.id}
              title={`${m.vorname} ${m.nachname}`}
              className="grid h-7 w-7 place-items-center rounded-full border-2 border-card text-[10px] font-bold text-white"
              style={{ backgroundColor: m.farbe }}
            >
              {initials(m.vorname, m.nachname)}
            </span>
          ))}
          {ma.length === 0 && (
            <span className="text-xs text-muted-foreground">Keine Zuweisung</span>
          )}
          {ma.length > 4 && (
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-bold">
              +{ma.length - 4}
            </span>
          )}
        </div>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5",
          )}
        />
      </div>
    </Link>
  );
}

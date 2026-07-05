import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Clock, Phone, Navigation, AlertTriangle, ChevronRight, Building2, Users, MapPin } from "lucide-react";
import type { AuftragRow } from "@/lib/queries";
import { fmtDay, fmtTime, fmtStrasse, fmtOrt, fmtAdresse } from "@/lib/erp";
import { useStatuses } from "@/lib/status";
import { useMobileWorkerSettings } from "@/lib/mobileSettings";
import { MultiStatusBadges } from "@/components/badges";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Primary status key = the explicit primary assignment, else the order status. */
function primaryStatusKey(a: AuftragRow): string {
  const primary = (a.status_zuweisungen ?? []).find((z) => z.is_primary);
  return primary?.status_key ?? a.status;
}

export function WorkerAuftragCard({ auftrag }: { auftrag: AuftragRow }) {
  const { get } = useStatuses();
  const settings = useMobileWorkerSettings();
  const stripeColor = get(primaryStatusKey(auftrag)).farbe;

  const tel = auftrag.kunde_telefon ?? null;
  const festnetz = auftrag.kunde_festnetz ?? null;
  const callNumber = tel ?? festnetz;
  const adresse = fmtAdresse(auftrag);

  const workers = auftrag.zuweisungen.map((z) => z.mitarbeiter).filter(Boolean);

  const openNavigation = () => {
    if (!adresse) {
      toast.error("Keine Adresse vorhanden.");
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const call = () => {
    if (!callNumber) {
      toast.error("Keine Telefonnummer vorhanden.");
      return;
    }
    window.location.href = `tel:${callNumber}`;
  };

  return (
    <div className="flex overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {/* Vertical status stripe */}
      <div className="w-1.5 shrink-0" style={{ backgroundColor: stripeColor }} aria-hidden />

      <div className="min-w-0 flex-1 p-4">
        <Link to="/meine-arbeit/$id" params={{ id: auftrag.id }} className="block">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-muted-foreground">
                {auftrag.auftragsnummer}
              </span>
              <h3 className="truncate text-base font-bold leading-tight">{auftrag.titel}</h3>
            </div>
            {settings.show_status_badges && <MultiStatusBadges auftrag={auftrag} />}
          </div>

          {auftrag.termin_start && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold">{fmtDay(auftrag.termin_start)}</span>,{" "}
              {fmtTime(auftrag.termin_start)} Uhr
            </p>
          )}

          {(auftrag.kunde_name || auftrag.kunde) && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{auftrag.kunde_name ?? auftrag.kunde?.name}</span>
            </p>
          )}

          {adresse && (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {fmtStrasse(auftrag)}
                {fmtStrasse(auftrag) && fmtOrt(auftrag) && <br />}
                {fmtOrt(auftrag)}
              </span>
            </p>
          )}

          {auftrag.wichtiginfo && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-2">{auftrag.wichtiginfo}</span>
            </div>
          )}
        </Link>

        {settings.show_worker_count && workers.length > 1 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold text-foreground active:scale-95">
                <Users className="h-3.5 w-3.5" /> {workers.length}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Zugewiesene Monteure
              </p>
              <ul className="space-y-1 text-sm">
                {workers.map((w) => (
                  <li key={w!.id} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: w!.farbe }}
                    />
                    {w!.vorname} {w!.nachname}
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={call}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-foreground active:scale-95"
          >
            <Phone className="h-4 w-4" /> Anrufen
          </button>
          <button
            type="button"
            onClick={openNavigation}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-foreground active:scale-95"
          >
            <Navigation className="h-4 w-4" /> Route
          </button>
          <Link
            to="/meine-arbeit/$id"
            params={{ id: auftrag.id }}
            className="flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95"
          >
            Details <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

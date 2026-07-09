import { Link } from "@tanstack/react-router";
import { Phone, Image, StickyNote, ExternalLink, Users, MapPin } from "lucide-react";
import type { AuftragRow } from "@/lib/queries";
import type { StatusDef } from "@/lib/queries";
import { statusStyle } from "@/lib/status";
import { fmtAdresse } from "@/lib/erp";
import { assignedIds } from "@/lib/kalender-layout";
import { cn } from "@/lib/utils";

export type GetStatus = (key: string) => StatusDef;

export function auftraggeberName(a: AuftragRow): string {
  return a.kunde?.name ?? a.kunde_name ?? "—";
}

export function auftragAddress(a: AuftragRow): string {
  return fmtAdresse(a) || a.leistungsort || "";
}

/** Small colored dots for the assigned Mitarbeiter. */
export function MitarbeiterDots({ a, max = 4 }: { a: AuftragRow; max?: number }) {
  const list = (a.zuweisungen ?? [])
    .map((z) => z.mitarbeiter)
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  if (list.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
        <Users className="h-3 w-3" /> ohne MA
      </span>
    );
  }
  const shown = list.slice(0, max);
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((m) => (
        <span
          key={m.id}
          title={`${m.vorname} ${m.nachname}`}
          className="grid h-4 w-4 place-items-center rounded-full border border-card text-[8px] font-bold text-white"
          style={{ backgroundColor: m.farbe }}
        >
          {m.vorname?.[0]}
          {m.nachname?.[0]}
        </span>
      ))}
      {list.length > max && (
        <span className="pl-2.5 text-[10px] font-semibold text-muted-foreground">
          +{list.length - max}
        </span>
      )}
    </span>
  );
}

/** Phone / photo / note availability icons. */
export function ContactIcons({
  a,
  hasFotos,
  className,
}: {
  a: AuftragRow;
  hasFotos?: boolean;
  className?: string;
}) {
  const hasPhone = Boolean(a.kunde_telefon || a.kunde_festnetz);
  const hasNotes = Boolean(a.interne_notizen || a.wichtiginfo);
  if (!hasPhone && !hasNotes && !hasFotos) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-muted-foreground", className)}>
      {hasPhone && <Phone className="h-3 w-3" />}
      {hasFotos && <Image className="h-3 w-3" />}
      {hasNotes && <StickyNote className="h-3 w-3" />}
    </span>
  );
}

export function StatusBadge({ get, statusKey }: { get: GetStatus; statusKey: string }) {
  const s = get(statusKey);
  return (
    <span className="badge-status shrink-0" style={statusStyle(s.farbe)}>
      {s.label}
    </span>
  );
}

export function OpenLink({ id, className }: { id: string; className?: string }) {
  return (
    <Link
      to="/auftraege/$id"
      params={{ id }}
      onClick={(e) => e.stopPropagation()}
      className={cn("text-muted-foreground hover:text-primary", className)}
      title="Auftrag öffnen"
    >
      <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  );
}

/** One-line address with a pin icon (used in agenda / list rows). */
export function AddressLine({ a }: { a: AuftragRow }) {
  const addr = auftragAddress(a);
  if (!addr) return null;
  return (
    <span className="inline-flex items-center gap-1 truncate">
      <MapPin className="h-3 w-3 shrink-0" />
      <span className="truncate">{addr}</span>
    </span>
  );
}

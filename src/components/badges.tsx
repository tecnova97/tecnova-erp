import { PROJEKT_STATUS_CONFIG } from "@/lib/erp";
import type { ProjektStatus } from "@/lib/erp";
import type { AuftragRow } from "@/lib/queries";
import { useStatuses, statusStyle } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({
  statusKey,
  className,
}: {
  statusKey: string;
  className?: string;
}) {
  const { get } = useStatuses();
  const s = get(statusKey);
  return (
    <span className={cn("badge-status", className)} style={statusStyle(s.farbe)}>
      {s.label}
    </span>
  );
}

/**
 * Renders every *visible* status assigned to an order (ordered), respecting the
 * multi-status model. Falls back to the primary `status` field when no visible
 * assignments are present (e.g. legacy rows or hidden statuses).
 */
export function MultiStatusBadges({
  auftrag,
  className,
}: {
  auftrag: Pick<AuftragRow, "status" | "status_zuweisungen">;
  className?: string;
}) {
  const { get } = useStatuses();
  const visible = (auftrag.status_zuweisungen ?? [])
    .filter((z) => z.sichtbar)
    .sort((a, b) => a.sort_order - b.sort_order || (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

  const keys = visible.length > 0 ? visible.map((z) => z.status_key) : [auftrag.status];

  return (
    <div className={cn("flex flex-wrap justify-end gap-1", className)}>
      {keys.map((key, i) => {
        const s = get(key);
        return (
          <span key={`${key}-${i}`} className="badge-status" style={statusStyle(s.farbe)}>
            {s.label}
          </span>
        );
      })}
    </div>
  );
}


export function ProjektStatusBadge({
  status,
  className,
}: {
  status: ProjektStatus;
  className?: string;
}) {
  const c = PROJEKT_STATUS_CONFIG[status] ?? PROJEKT_STATUS_CONFIG.aktiv;
  return <span className={cn("badge-status", c.cls, className)}>{c.label}</span>;
}

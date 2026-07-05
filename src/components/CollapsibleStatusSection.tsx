import { ChevronDown, ChevronUp } from "lucide-react";
import { useCollapsedSection } from "@/hooks/useCollapsedSection";
import { cn } from "@/lib/utils";

/**
 * Reusable collapsible status section used across status-grouped Auftrag lists
 * (Dashboard, Aufträge page, …).
 *
 * - The header (title + count + chevron) stays visible at all times.
 * - Chevron up = open, chevron down = collapsed.
 * - Collapsed/expanded state is remembered per user via localStorage, keyed by
 *   `storageKey` (e.g. `dashboard.status.<statusId>`). Default: expanded.
 */
export function CollapsibleStatusSection({
  storageKey,
  color,
  label,
  count,
  children,
  className,
  headerClassName,
}: {
  storageKey: string;
  color?: string;
  label: React.ReactNode;
  count: number;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  const { collapsed, toggle } = useCollapsedSection(storageKey);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className={cn(
          "flex w-full items-center gap-2 rounded-md text-left transition-colors hover:opacity-80",
          headerClassName,
        )}
      >
        {color && (
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        )}
        <span className="font-bold">{label}</span>
        <span className="text-sm text-muted-foreground">({count})</span>
        {collapsed ? (
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {!collapsed && <div className="mt-3">{children}</div>}
    </div>
  );
}


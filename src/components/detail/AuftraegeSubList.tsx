import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { AuftragRow } from "@/lib/queries";
import { statusDefinitionenQuery } from "@/lib/queries";
import { fmtStrasse, fmtOrt } from "@/lib/erp";
import { AuftragCard } from "@/components/AuftragCard";
import { EmptyState } from "@/components/detail/parts";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Reusable searchable/filterable list of Aufträge for detail-page tabs.
 * The parent passes an already entity-scoped list.
 */
export function AuftraegeSubList({
  auftraege,
  umsatzMap,
  header,
}: {
  auftraege: AuftragRow[];
  umsatzMap?: Record<string, number>;
  header?: React.ReactNode;
}) {
  const { data: statusDefs = [] } = useQuery(statusDefinitionenQuery());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = auftraege;
    if (status !== "all") {
      rows = rows.filter(
        (a) =>
          a.status === status ||
          (a.status_zuweisungen ?? []).some((s) => s.status_key === status),
      );
    }
    if (needle) {
      rows = rows.filter((a) =>
        [
          a.auftragsnummer,
          a.externe_auftragsnummer,
          a.titel,
          a.kunde_name ?? a.kunde?.name,
          fmtStrasse(a),
          fmtOrt(a),
          ...a.zuweisungen.map((z) => z.mitarbeiter && `${z.mitarbeiter.vorname} ${z.mitarbeiter.nachname}`),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }
    return rows;
  }, [auftraege, q, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Aufträge durchsuchen…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {statusDefs.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {header}
      </div>
      {list.length === 0 ? (
        <EmptyState>Keine Aufträge gefunden.</EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <AuftragCard key={a.id} auftrag={a} umsatz={umsatzMap?.[a.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Archive as ArchiveIcon, ChevronRight, CheckCircle2, Euro } from "lucide-react";
import { auftraegeQuery } from "@/lib/queries";
import { useStatuses } from "@/lib/status";
import { fmtDate, fmtStrasse, fmtOrt } from "@/lib/erp";
import { StatusBadge } from "@/components/badges";
import { Input } from "@/components/ui/input";
import { RequirePermission } from "@/components/PermissionGuard";
import { PERM } from "@/lib/permissions";
import { saveRouteScrollState, useRouteScrollRestoration } from "@/hooks/useRouteScrollRestoration";

export const Route = createFileRoute("/_authenticated/archiv")({
  head: () => ({ meta: [{ title: "Archiv – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.auftraegeView}>
      <ArchivPage />
    </RequirePermission>
  ),
});

function ArchivPage() {
  const { get } = useStatuses();
  const { data: auftraege = [], isLoading } = useQuery(auftraegeQuery());
  const [q, setQ] = useState("");
  const [onlyPaid, setOnlyPaid] = useState(false);

  useRouteScrollRestoration({
    ready: !isLoading,
    filters: { q, onlyPaid },
    restoreFilters: (filters) => {
      if (typeof filters.q === "string") setQ(filters.q);
      if (typeof filters.onlyPaid === "boolean") setOnlyPaid(filters.onlyPaid);
    },
  });

  const archiv = auftraege.filter((a) => {
    const done = get(a.status).ist_abschluss;
    if (!done) return false;
    if (onlyPaid && !a.bezahlt) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return [a.titel, a.auftragsnummer, a.kunde_name, a.kunde?.name, a.strasse, a.ort, a.abgeschlossen_am ? fmtDate(a.abgeschlossen_am) : ""]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(needle));
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <ArchiveIcon className="h-6 w-6 text-primary" /> Archiv
        </h2>
        <p className="text-sm text-muted-foreground">
          Abgeschlossene und bezahlte Aufträge für den langfristigen Zugriff.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, Kunde, Auftraggeber, Datum, Nummer, Adresse…"
            className="pl-9"
          />
        </div>
        <button
          onClick={() => setOnlyPaid((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${onlyPaid ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground"}`}
        >
          <Euro className="h-4 w-4" /> Nur bezahlt
        </button>
        <span className="text-sm text-muted-foreground sm:ml-auto">{archiv.length} Einträge</span>
      </div>

      {archiv.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Keine archivierten Aufträge gefunden.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <ul className="divide-y divide-border">
            {archiv.map((a) => (
              <li key={a.id}>
                <Link
                  to="/auftraege/$id"
                  params={{ id: a.id }}
                  onClick={() => saveRouteScrollState(a.id)}
                  data-route-scroll-id={a.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">{a.auftragsnummer}</span>
                      <StatusBadge statusKey={a.status} />
                      {a.bezahlt && (
                        <span className="badge-status" style={{ color: "#16a34a", backgroundColor: "rgba(22,163,74,0.13)" }}>Bezahlt</span>
                      )}
                    </div>
                    <p className="truncate font-semibold leading-tight">{a.titel}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[a.kunde_name ?? a.kunde?.name, [fmtStrasse(a), fmtOrt(a)].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                    {a.abgeschlossen_am && <p>Erledigt: {fmtDate(a.abgeschlossen_am)}</p>}
                    {a.bezahlt_am && <p>Bezahlt: {fmtDate(a.bezahlt_am)}</p>}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

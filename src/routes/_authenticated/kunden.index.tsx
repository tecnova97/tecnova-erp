import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Building2, Plus, Search, Phone, Mail, MapPin } from "lucide-react";
import { kundenQuery, projekteQuery, auftraegeQuery } from "@/lib/queries";
import { fmtAdresse } from "@/lib/erp";
import type { KundeRow } from "@/lib/module-queries";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { KundeFormDialog } from "@/components/KundeFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/kunden/")({
  head: () => ({ meta: [{ title: "Auftraggeber – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.auftraggeberView}>
      <KundenPage />
    </RequirePermission>
  ),
});

function KundenPage() {
  const { can } = useAuth();
  const canCreate = can(PERM.auftraggeberCreate);
  const { data: kunden = [], isLoading } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const [q, setQ] = useState("");
  const [showArch, setShowArch] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = (kunden as KundeRow[]).filter((k) => (showArch ? true : !k.archiviert));
    if (needle) {
      rows = rows.filter((k) =>
        [k.name, k.ansprechpartner, k.telefon, k.festnetz, k.email, fmtAdresse(k), k.ort]
          .filter(Boolean).join(" ").toLowerCase().includes(needle),
      );
    }
    return rows;
  }, [kunden, q, showArch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche Name, Ansprechpartner, Telefon, Ort …" className="pl-9" />
        </div>
        <Button variant={showArch ? "default" : "outline"} onClick={() => setShowArch((s) => !s)}>Archiv</Button>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Neuer Auftraggeber
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{list.length} Auftraggeber</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((k) => {
            const anzProj = projekte.filter((p) => p.kunde_id === k.id).length;
            const anzAuf = auftraege.filter((a) => a.kunde_id === k.id).length;
            return (
              <Link
                key={k.id}
                to="/kunden/$id"
                params={{ id: k.id }}
                className="group block rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  {k.archiviert && <span className="badge bg-muted text-muted-foreground">Archiviert</span>}
                </div>
                <h3 className="mt-3 truncate font-bold">{k.name}</h3>
                {k.ansprechpartner && <p className="truncate text-sm text-muted-foreground">{k.ansprechpartner}</p>}
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {k.telefon && <p className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {k.telefon}</p>}
                  {k.email && <p className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {k.email}</p>}
                  {fmtAdresse(k) && <p className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {fmtAdresse(k)}</p>}
                </div>
                <div className="mt-3 flex gap-3 text-xs font-medium text-muted-foreground">
                  <span>{anzProj} Projekte</span>
                  <span>{anzAuf} Aufträge</span>
                </div>
              </Link>
            );
          })}
          {list.length === 0 && <p className="text-sm text-muted-foreground">Keine Auftraggeber gefunden.</p>}
        </div>
      )}

      <KundeFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

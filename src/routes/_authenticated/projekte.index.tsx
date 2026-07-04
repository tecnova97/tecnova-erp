import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FolderKanban, Plus, Search, MapPin } from "lucide-react";
import { projekteQuery, auftraegeQuery } from "@/lib/queries";
import { PROJEKT_STATUS_CONFIG, fmtDate, fmtAdresse } from "@/lib/erp";
import type { ProjektStatus } from "@/lib/erp";
import type { ProjektRow } from "@/lib/module-queries";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { ProjektFormDialog } from "@/components/ProjektFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/projekte/")({
  head: () => ({ meta: [{ title: "Projekte – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.projekteView}>
      <ProjektePage />
    </RequirePermission>
  ),
});

function ProjektePage() {
  const { can } = useAuth();
  const canCreate = can(PERM.projekteCreate);
  const { data: projekte = [], isLoading } = useQuery(projekteQuery());
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("neu");
  const [showArch, setShowArch] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // projekt_id -> order numbers (for search)
  const auftragNummern = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of auftraege) {
      if (!a.projekt_id) continue;
      if (!m.has(a.projekt_id)) m.set(a.projekt_id, []);
      m.get(a.projekt_id)!.push(`${a.auftragsnummer} ${a.externe_auftragsnummer ?? ""}`);
    }
    return m;
  }, [auftraege]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = (projekte as ProjektRow[]).filter((p) => (showArch ? true : !p.archiviert));
    if (status !== "all") rows = rows.filter((p) => p.status === status);
    if (needle) {
      rows = rows.filter((p) => {
        const hay = [
          p.name,
          p.kunde?.name,
          fmtAdresse(p),
          p.status,
          p.nvt,
          p.esass_nr,
          p.ag_leb_nr,
          p.projektleiter,
          (auftragNummern.get(p.id) ?? []).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "alt") return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    return rows;
  }, [projekte, q, status, sort, showArch, auftragNummern]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche Name, Auftraggeber, NVT, Auftragsnr. …" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(PROJEKT_STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="neu">Neueste zuerst</SelectItem>
            <SelectItem value="alt">Älteste zuerst</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showArch ? "default" : "outline"} onClick={() => setShowArch((s) => !s)}>
          Archiv
        </Button>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Neues Projekt
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{list.length} Projekte</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const cfg = PROJEKT_STATUS_CONFIG[p.status as ProjektStatus];
            const anzahl = auftraege.filter((a) => a.projekt_id === p.id).length;
            return (
              <Link
                key={p.id}
                to="/projekte/$id"
                params={{ id: p.id }}
                className="group block rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  {cfg && <span className={cn("badge", cfg.cls)}>{cfg.label}</span>}
                </div>
                <h3 className="mt-3 truncate font-bold">{p.name}</h3>
                {p.kunde?.name && <p className="truncate text-sm text-muted-foreground">{p.kunde.name}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {fmtAdresse(p) && (
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {fmtAdresse(p)}</span>
                  )}
                  {p.start_datum && <span>Start {fmtDate(p.start_datum)}</span>}
                  <span>{anzahl} Aufträge</span>
                  {p.nvt && <span>NVT {p.nvt}</span>}
                </div>
              </Link>
            );
          })}
          {list.length === 0 && <p className="text-sm text-muted-foreground">Keine Projekte gefunden.</p>}
        </div>
      )}

      <ProjektFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

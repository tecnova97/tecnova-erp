import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, LayoutGrid, Rows3, X } from "lucide-react";
import {
  auftraegeQuery,
  mitarbeiterQuery,
  kundenQuery,
  projekteQuery,
  auftragUmsatzMapQuery,
} from "@/lib/queries";
import { useStatuses } from "@/lib/status";
import { useAuth } from "@/lib/auth";
import { AuftragCard } from "@/components/AuftragCard";
import { AuftragFormDialog } from "@/components/AuftragFormDialog";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RequirePermission } from "@/components/PermissionGuard";

export const Route = createFileRoute("/_authenticated/auftraege/")({
  head: () => ({ meta: [{ title: "Aufträge – TecNova ERP" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    neu: s.neu === true || s.neu === "true",
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  component: () => (
    <RequirePermission perm={PERM.auftraegeView}>
      <AuftraegePage />
    </RequirePermission>
  ),
});

function AuftraegePage() {
  const { neu, status: statusParam } = Route.useSearch();
  const navigate = useNavigate();
  const { can, canAny } = useAuth();
  const canCreate = can(PERM.auftraegeCreate);
  const canUmsatz = canAny([PERM.profitCard, PERM.profitDetail, PERM.umsatzView]);
  const { active: statuses, get: getStatus } = useStatuses();
  const { data: auftraege = [], isLoading } = useQuery(auftraegeQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: umsatzMap = {} } = useQuery(auftragUmsatzMapQuery(canUmsatz));

  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState(statusParam ?? "alle");
  const [fMitarbeiter, setFMitarbeiter] = useState("alle");
  const [fTermin, setFTermin] = useState("");
  const [fKunde, setFKunde] = useState("alle");
  const [fProjekt, setFProjekt] = useState("alle");
  const [grouped, setGrouped] = useState(true);

  const dialogOpen = !!neu;
  const setDialogOpen = (v: boolean) =>
    navigate({ to: "/auftraege", search: { neu: v }, replace: true });

  const filtered = auftraege.filter((a) => {
    const workerNames = a.zuweisungen
      .map((z) => (z.mitarbeiter ? `${z.mitarbeiter.vorname} ${z.mitarbeiter.nachname}` : ""))
      .join(" ");
    const matchQ =
      !q ||
      [
        a.titel,
        a.auftragsnummer,
        a.kunde_name,
        a.kunde?.name,
        a.ort,
        a.strasse,
        a.hausnummer,
        a.plz,
        a.externe_auftragsnummer,
        a.projekt?.name,
        a.kunde_telefon,
        a.kunde?.telefon,
        getStatus(a.status).label,
        workerNames,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q.toLowerCase()));
    const matchStatus = fStatus === "alle" || a.status === fStatus;
    const matchMa =
      fMitarbeiter === "alle" ||
      a.zuweisungen.some((z) => z.mitarbeiter?.id === fMitarbeiter);
    const matchTermin = !fTermin || (a.termin_start ?? "").startsWith(fTermin);
    const matchKunde = fKunde === "alle" || a.kunde_id === fKunde;
    const matchProjekt = fProjekt === "alle" || a.projekt_id === fProjekt;
    return matchQ && matchStatus && matchMa && matchTermin && matchKunde && matchProjekt;
  });

  const hasFilters =
    fStatus !== "alle" || fMitarbeiter !== "alle" || fTermin || fKunde !== "alle" || fProjekt !== "alle";
  const resetFilters = () => {
    setFStatus("alle");
    setFMitarbeiter("alle");
    setFTermin("");
    setFKunde("alle");
    setFProjekt("alle");
  };

  // group by status using status order
  const groups = statuses
    .map((s) => ({ status: s, items: filtered.filter((a) => a.status === s.key) }))
    .filter((g) => g.items.length > 0);
  const ungrouped = filtered.filter((a) => !statuses.some((s) => s.key === a.status));
  if (ungrouped.length) groups.push({ status: getStatus("unbekannt"), items: ungrouped });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Titel, Nummer, Kunde, Adresse, Telefon, Projekt, Status, Mitarbeiter…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              onClick={() => setGrouped(true)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium", grouped ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              <Rows3 className="h-4 w-4" /> Gruppiert
            </button>
            <button
              onClick={() => setGrouped(false)}
              className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium", !grouped ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              <LayoutGrid className="h-4 w-4" /> Liste
            </button>
          </div>
          {canCreate && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Neuer Auftrag
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={fStatus} onChange={setFStatus} placeholder="Status" all="Alle Status"
          options={statuses.map((s) => ({ value: s.key, label: s.label }))} />
        <FilterSelect value={fMitarbeiter} onChange={setFMitarbeiter} placeholder="Mitarbeiter" all="Alle Mitarbeiter"
          options={mitarbeiter.map((m) => ({ value: m.id, label: `${m.vorname} ${m.nachname}` }))} />
        <FilterSelect value={fKunde} onChange={setFKunde} placeholder="Auftraggeber" all="Alle Auftraggeber"
          options={kunden.map((k) => ({ value: k.id, label: k.name }))} />
        <FilterSelect value={fProjekt} onChange={setFProjekt} placeholder="Projekt" all="Alle Projekte"
          options={projekte.map((p) => ({ value: p.id, label: p.name }))} />
        <input
          type="date"
          value={fTermin}
          onChange={(e) => setFTermin(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Filter zurücksetzen
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} Aufträge</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Keine Aufträge gefunden.
        </div>
      ) : grouped ? (
        <div className="space-y-7">
          {groups.map((g) => (
            <div key={g.status.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.status.farbe }} />
                <h3 className="font-bold">{g.status.label}</h3>
                <span className="text-sm text-muted-foreground">({g.items.length})</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {g.items.map((a) => (
                  <AuftragCard key={a.id} auftrag={a} umsatz={canUmsatz ? umsatzMap[a.id] : undefined} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <AuftragCard key={a.id} auftrag={a} umsatz={canUmsatz ? umsatzMap[a.id] : undefined} />
          ))}
        </div>
      )}

      {canCreate && <AuftragFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  all,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  all: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[10rem]"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="alle">{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

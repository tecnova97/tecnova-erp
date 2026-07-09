import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Phone, Mail, UserCog, Link2 } from "lucide-react";
import { mitarbeiterQuery } from "@/lib/queries";
import { initials } from "@/lib/erp";
import type { MitarbeiterRow } from "@/lib/module-queries";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { MitarbeiterFormDialog } from "@/components/MitarbeiterFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePreserveScrollPosition } from "@/hooks/usePreserveScrollPosition";

export const Route = createFileRoute("/_authenticated/mitarbeiter/")({
  head: () => ({ meta: [{ title: "Mitarbeiter – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.mitarbeiterView}>
      <MitarbeiterPage />
    </RequirePermission>
  ),
});

function MitarbeiterPage() {
  const { can } = useAuth();
  const canCreate = can(PERM.mitarbeiterCreate);
  const { data: mitarbeiter = [], isLoading } = useQuery(mitarbeiterQuery());
  usePreserveScrollPosition("mitarbeiter", !isLoading);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("aktiv");
  const [createOpen, setCreateOpen] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = mitarbeiter as MitarbeiterRow[];
    if (statusF === "aktiv") rows = rows.filter((m) => m.aktiv);
    else if (statusF === "inaktiv") rows = rows.filter((m) => !m.aktiv);
    if (needle) {
      rows = rows.filter((m) =>
        [m.vorname, m.nachname, m.telefon, m.email, m.rolle, m.position]
          .filter(Boolean).join(" ").toLowerCase().includes(needle),
      );
    }
    return rows;
  }, [mitarbeiter, q, statusF]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche Name, Telefon, E-Mail, Rolle …" className="pl-9" />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aktiv">Aktiv</SelectItem>
            <SelectItem value="inaktiv">Inaktiv</SelectItem>
            <SelectItem value="alle">Alle</SelectItem>
          </SelectContent>
        </Select>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Neuer Mitarbeiter
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{list.length} Mitarbeiter</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => (
            <Link
              key={m.id}
              to="/mitarbeiter/$id"
              params={{ id: m.id }}
              className="group block rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-card"
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: m.farbe }}
                >
                  {initials(m.vorname, m.nachname)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold">{m.vorname} {m.nachname}</h3>
                    {!m.aktiv && <span className="badge bg-muted text-muted-foreground">Inaktiv</span>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{m.rolle || m.position || "Mitarbeiter"}</p>
                </div>
                {m.linked_user_id && (
                  <span title="Mit Benutzer verknüpft">
                    <Link2 className="h-4 w-4 text-primary" />
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {m.telefon && <p className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {m.telefon}</p>}
                {m.email && <p className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {m.email}</p>}
              </div>
            </Link>
          ))}
          {list.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><UserCog className="h-4 w-4" /> Keine Mitarbeiter gefunden.</p>
          )}
        </div>
      )}

      <MitarbeiterFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

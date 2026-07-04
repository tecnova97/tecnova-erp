import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Plus, Search, Pencil, Ban } from "lucide-react";
import {
  rechnungGruppenQuery, gruppeEventLinksQuery, setRechnungGruppeStatus,
  RG_STATUS_LABEL, RG_STATUS_TONE, RG_STATUS_ORDER, type RechnungGruppe, type RechnungGruppeStatus,
} from "@/lib/abrechnung";
import { zahlungUmsatzMapQuery } from "@/lib/zahlungen";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { fmtDate, fmtEuro } from "@/lib/erp";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RechnungGruppeDialog } from "@/components/abrechnung/RechnungGruppeDialog";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/abrechnung")({
  head: () => ({ meta: [{ title: "Abrechnung – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.abrechnungView} description="Der Bereich Abrechnung ist nur für berechtigte Rollen sichtbar.">
      <AbrechnungPage />
    </RequirePermission>
  ),
});

function AbrechnungPage() {
  const { can, canAny } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canCreate = can(PERM.abrechnungCreate);
  const canEdit = can(PERM.abrechnungEdit);
  const canDelete = can(PERM.abrechnungDelete);
  const canUmsatz = canAny([PERM.profitCard, PERM.profitDetail, PERM.umsatzView, PERM.gewinnView]);

  const { data: gruppen = [], isLoading } = useQuery(rechnungGruppenQuery());
  const { data: links = [] } = useQuery(gruppeEventLinksQuery());
  const { data: umsatzMap = {} } = useQuery(zahlungUmsatzMapQuery(canUmsatz));

  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("alle");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<RechnungGruppe | null>(null);

  const totalByGruppe = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) {
      if (!l.included) continue;
      const cur = m.get(l.rechnung_gruppe_id) ?? 0;
      m.set(l.rechnung_gruppe_id, cur + (umsatzMap[l.zahlungsereignis_id]?.umsatz ?? 0));
    }
    return m;
  }, [links, umsatzMap]);

  const countByGruppe = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.rechnung_gruppe_id, (m.get(l.rechnung_gruppe_id) ?? 0) + 1);
    return m;
  }, [links]);

  const rows = useMemo(() => {
    return gruppen.filter((g) => {
      const matchQ = !q || [g.nummer, g.name, g.auftraggeber?.name, g.projekt?.name, g.nvt, g.esass_nr, g.ag_leb_nr]
        .filter(Boolean).some((v) => v!.toLowerCase().includes(q.toLowerCase()));
      const matchS = fStatus === "alle" || g.status === fStatus;
      return matchQ && matchS;
    });
  }, [gruppen, q, fStatus]);

  const storno = async (g: RechnungGruppe) => {
    if (!confirm(`Rechnungsgruppe ${g.nummer} stornieren?`)) return;
    try {
      await setRechnungGruppeStatus(g.id, "storniert");
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppen"] });
      toast.success("Rechnungsgruppe storniert");
    } catch (e) { toast.error("Fehlgeschlagen", { description: (e as Error).message }); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Abrechnung</h1>
            <p className="text-sm text-muted-foreground">Zahlungsereignisse zu Rechnungsgruppen bündeln (NVT / eSASS / Projekt).</p>
          </div>
        </div>
        {canCreate && <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="mr-1.5 h-4 w-4" /> Neue Rechnungsgruppe</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nummer, Name, Auftraggeber, NVT, eSASS…" className="pl-9" />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {RG_STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{RG_STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} Gruppen</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">Keine Rechnungsgruppen gefunden.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Nummer</th>
                <th className="px-4 py-3 font-semibold">Auftraggeber / Projekt</th>
                <th className="px-4 py-3 font-semibold">NVT / eSASS / AG-LEB</th>
                <th className="px-4 py-3 font-semibold">Zeitraum</th>
                <th className="px-4 py-3 text-right font-semibold">Ereignisse</th>
                {canUmsatz && <th className="px-4 py-3 text-right font-semibold">Umsatz</th>}
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Erstellt</th>
                <th className="px-4 py-3 text-right font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="border-b border-border/60 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link to="/abrechnung/$id" params={{ id: g.id }} className="font-mono text-sm font-semibold hover:text-primary">{g.nummer}</Link>
                    {g.name && <div className="text-xs text-muted-foreground">{g.name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div>{g.auftraggeber?.name ?? "–"}</div>
                    <div className="text-xs text-muted-foreground">{g.projekt?.name ?? "–"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {[g.nvt && `NVT ${g.nvt}`, g.esass_nr && `eSASS ${g.esass_nr}`, g.ag_leb_nr && `LEB ${g.ag_leb_nr}`].filter(Boolean).join(" · ") || "–"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {g.leistungszeitraum_von || g.leistungszeitraum_bis
                      ? `${g.leistungszeitraum_von ? fmtDate(g.leistungszeitraum_von) : "…"} – ${g.leistungszeitraum_bis ? fmtDate(g.leistungszeitraum_bis) : "…"}`
                      : "–"}
                  </td>
                  <td className="px-4 py-3 text-right">{countByGruppe.get(g.id) ?? 0}</td>
                  {canUmsatz && <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtEuro(totalByGruppe.get(g.id) ?? 0)}</td>}
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RG_STATUS_TONE[g.status]}`}>{RG_STATUS_LABEL[g.status]}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(g.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEdit(g); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                      {canDelete && g.status !== "storniert" && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => storno(g)}><Ban className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RechnungGruppeDialog
        open={open}
        onOpenChange={setOpen}
        gruppe={edit}
        onCreated={(id) => navigate({ to: "/abrechnung/$id", params: { id } })}
      />
    </div>
  );
}

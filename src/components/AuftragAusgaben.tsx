import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Wallet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  auftragAusgabenQuery,
  ausgabenKategorienQuery,
} from "@/lib/finance";
import { fmtEuro, fmtDate } from "@/lib/erp";
import { useAuth } from "@/lib/auth";
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

/** Order-level expenses. Only rendered for users with `ausgaben.view`/`edit`. */
export function AuftragAusgaben({ auftragId }: { auftragId: string }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canView = can(PERM.ausgabenView) || can(PERM.ausgabenEdit);
  const canEdit = can(PERM.ausgabenEdit);

  const { data: ausgaben = [], isLoading } = useQuery(auftragAusgabenQuery(auftragId, canView));
  const { data: kategorien = [] } = useQuery(ausgabenKategorienQuery(canView));

  const [bezeichnung, setBezeichnung] = useState("");
  const [betrag, setBetrag] = useState("");
  const [kategorieId, setKategorieId] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  if (!canView) return null;

  const gesamt = ausgaben.reduce((sum, a) => sum + a.betrag, 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["auftrag_ausgaben", auftragId] });
    qc.invalidateQueries({ queryKey: ["auftrag_gewinn_map"] });
  };

  const add = async () => {
    if (!bezeichnung.trim() || !betrag) return toast.error("Bezeichnung und Betrag erforderlich.");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("auftrag_ausgaben").insert({
        auftrag_id: auftragId,
        bezeichnung: bezeichnung.trim(),
        betrag: Number(betrag),
        kategorie_id: kategorieId === "none" ? null : kategorieId,
        created_by: u.user?.id,
      } as never);
      if (error) throw error;
      setBezeichnung("");
      setBetrag("");
      setKategorieId("none");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Konnte Ausgabe nicht speichern.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("auftrag_ausgaben").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const katName = (id: string | null) => kategorien.find((k) => k.id === id)?.name ?? "–";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <Wallet className="h-4 w-4" /> Ausgaben
        </h3>
        {ausgaben.length > 0 && (
          <span className="text-sm font-semibold">{fmtEuro(gesamt)}</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex min-h-[6vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : ausgaben.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">Noch keine Ausgaben erfasst.</p>
      ) : (
        <ul className="divide-y divide-border">
          {ausgaben.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{a.bezeichnung}</p>
                <p className="text-xs text-muted-foreground">
                  {katName(a.kategorie_id)} · {fmtDate(a.datum)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold">{fmtEuro(a.betrag)}</span>
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Input
            value={bezeichnung}
            onChange={(e) => setBezeichnung(e.target.value)}
            placeholder="Bezeichnung"
            className="h-9 min-w-[10rem] flex-1"
          />
          <Select value={kategorieId} onValueChange={setKategorieId}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Kategorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ohne Kategorie</SelectItem>
              {kategorien.filter((k) => k.aktiv).map((k) => (
                <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={betrag}
            onChange={(e) => setBetrag(e.target.value)}
            placeholder="Betrag €"
            className="h-9 w-28"
          />
          <Button size="sm" disabled={busy} onClick={add}>
            <Plus className="mr-1.5 h-4 w-4" /> Hinzufügen
          </Button>
        </div>
      )}
    </div>
  );
}

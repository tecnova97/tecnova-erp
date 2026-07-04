import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, Upload, Camera, FileText, Loader2, Euro } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fotosForAuftragQuery,
  dokumenteForAuftragQuery,
  type AuftragRow,
} from "@/lib/queries";
import { auftragLeistungenQuery, auftragLeistungPreiseQuery, lineTotal } from "@/lib/auftragLeistungen";
import { useStatuses, statusStyle } from "@/lib/status";
import { logHistorie } from "@/lib/historie";
import { fmtEuro } from "@/lib/erp";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { AuftragLeistungen } from "@/components/AuftragLeistungen";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

function Step({ done, label, children }: { done: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
        <span className={`text-sm font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

/**
 * Guided completion flow. The order can only be finished once every required
 * step is satisfied: final status, photo(s), document(s) and priced service
 * positions. Revenue is calculated automatically.
 */
export function WorkerCompleteDialog({
  open,
  onOpenChange,
  auftrag,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  auftrag: AuftragRow;
}) {
  const qc = useQueryClient();
  const id = auftrag.id;
  const { canAny } = useAuth();
  const canPrice = canAny([
    PERM.preiseView,
    PERM.profitDetail,
    PERM.umsatzView,
    PERM.finanzenManage,
    PERM.gewinnView,
  ]);
  const { active: statuses, get } = useStatuses();
  const { data: fotos = [] } = useQuery(fotosForAuftragQuery(id));
  const { data: dokumente = [] } = useQuery(dokumenteForAuftragQuery(id));
  const { data: zeilen = [] } = useQuery(auftragLeistungenQuery(id));
  const { data: preise = {} } = useQuery(auftragLeistungPreiseQuery(id, canPrice));

  const [finalStatus, setFinalStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fotoInput = useRef<HTMLInputElement>(null);
  const dokInput = useRef<HTMLInputElement>(null);

  const finalOptions = statuses.filter((s) => s.ist_abschluss || s.worker_waehlbar);

  const umsatz = useMemo(() => {
    if (!canPrice) return null;
    return zeilen.reduce((sum, z) => sum + (lineTotal(z, preise[z.id]) ?? 0), 0);
  }, [zeilen, preise, canPrice]);

  const hasPhotos = fotos.length > 0;
  const hasDocs = dokumente.length > 0;
  const hasLeistungen = zeilen.some((z) => z.menge > 0);
  const hasStatus = !!finalStatus;
  const ready = hasPhotos && hasDocs && hasLeistungen && hasStatus;

  const upload = async (bucket: "fotos" | "dokumente", files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file);
        if (upErr) throw upErr;
        if (bucket === "fotos") {
          await supabase.from("fotos").insert({ auftrag_id: id, storage_path: path, dateiname: file.name, uploaded_by: u.user?.id });
        } else {
          await supabase.from("dokumente").insert({
            auftrag_id: id,
            storage_path: path,
            dateiname: file.name,
            dateityp: file.type,
            groesse: file.size,
            uploaded_by: u.user?.id,
          });
        }
      }
      await qc.invalidateQueries({ queryKey: [bucket, id] });
      toast.success(bucket === "fotos" ? "Fotos hochgeladen." : "Dokumente hochgeladen.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const def = get(finalStatus);
      const { error } = await supabase
        .from("auftraege")
        .update({
          status: finalStatus,
          abgeschlossen_am: new Date().toISOString(),
        } as never)
        .eq("id", id);
      if (error) throw error;
      await logHistorie(
        id,
        "Auftrag abgeschlossen",
        `Abschluss mit Status „${def.label}"${umsatz != null ? ` · Umsatz ${fmtEuro(umsatz)}` : ""}`,
        "abschluss",
      );
      toast.success("Auftrag abgeschlossen.");
      qc.invalidateQueries();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Abschluss fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Auftrag abschließen</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Step done={hasStatus} label="1. Abschlussstatus wählen">
            <div className="flex flex-wrap gap-2">
              {finalOptions.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setFinalStatus(s.key)}
                  className={`badge-status transition-all ${finalStatus === s.key ? "ring-2 ring-offset-1" : "opacity-70 hover:opacity-100"}`}
                  style={statusStyle(s.farbe)}
                >
                  {s.label}
                </button>
              ))}
              {finalOptions.length === 0 && (
                <span className="text-sm text-muted-foreground">Kein Abschlussstatus definiert.</span>
              )}
            </div>
          </Step>

          <Step done={hasPhotos} label={`2. Fotos hochladen (${fotos.length})`}>
            <input ref={fotoInput} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => upload("fotos", e.target.files)} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fotoInput.current?.click()} className="gap-2">
              <Camera className="h-4 w-4" /> Foto hinzufügen
            </Button>
          </Step>

          <Step done={hasDocs} label={`3. Dokumente hochladen (${dokumente.length})`}>
            <input ref={dokInput} type="file" multiple className="hidden" onChange={(e) => upload("dokumente", e.target.files)} />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => dokInput.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Datei hinzufügen
            </Button>
          </Step>

          <Step done={hasLeistungen} label="4. Leistungspositionen & Mengen erfassen">
            <AuftragLeistungen auftragId={id} canEditOverride />
          </Step>

          {canPrice && umsatz != null && (
            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Euro className="h-4 w-4" /> Berechneter Umsatz
              </span>
              <span className="text-lg font-extrabold">{fmtEuro(umsatz)}</span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={finish} disabled={!ready || busy} className="gap-2 bg-success text-success-foreground hover:bg-success/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Auftrag abschließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

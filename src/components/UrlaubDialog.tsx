import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { URLAUB_TYPEN, type UrlaubRow } from "@/lib/module-queries";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function UrlaubDialog({
  open,
  onOpenChange,
  mitarbeiterId,
  eintrag,
  canManage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mitarbeiterId: string;
  eintrag?: UrlaubRow | null;
  /** Whether the current user may set the status directly (approve/reject). */
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    typ: "urlaub",
    start_datum: "",
    end_datum: "",
    status: "beantragt",
    grund: "",
    notiz: "",
  });

  useEffect(() => {
    if (!open) return;
    if (eintrag) {
      setF({
        typ: eintrag.typ ?? "urlaub",
        start_datum: eintrag.start_datum ?? "",
        end_datum: eintrag.end_datum ?? "",
        status: eintrag.status ?? "beantragt",
        grund: eintrag.grund ?? "",
        notiz: eintrag.notiz ?? "",
      });
    } else {
      setF({
        typ: "urlaub",
        start_datum: "",
        end_datum: "",
        status: canManage ? "genehmigt" : "beantragt",
        grund: "",
        notiz: "",
      });
    }
  }, [open, eintrag, canManage]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.start_datum || !f.end_datum) {
      toast.error("Start- und Enddatum sind erforderlich.");
      return;
    }
    if (f.end_datum < f.start_datum) {
      toast.error("Enddatum darf nicht vor dem Startdatum liegen.");
      return;
    }
    setSaving(true);
    try {
      const decided = f.status !== "beantragt";
      const payload = {
        mitarbeiter_id: mitarbeiterId,
        typ: f.typ,
        start_datum: f.start_datum,
        end_datum: f.end_datum,
        status: f.status,
        grund: f.grund || null,
        notiz: f.notiz || null,
        entschieden_von: decided ? user?.id : null,
        entschieden_am: decided ? new Date().toISOString() : null,
      };
      if (eintrag) {
        const { error } = await supabase.from("urlaub").update(payload).eq("id", eintrag.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("urlaub").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      toast.success("Gespeichert.");
      qc.invalidateQueries();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{eintrag ? "Abwesenheit bearbeiten" : "Abwesenheit / Urlaub"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Typ</Label>
            <Select value={f.typ} onValueChange={(v) => set("typ", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {URLAUB_TYPEN.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canManage && (
            <div>
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beantragt">Beantragt</SelectItem>
                  <SelectItem value="genehmigt">Genehmigt</SelectItem>
                  <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Von *</Label>
            <DatePicker value={f.start_datum} onChange={(v) => set("start_datum", v)} />
          </div>
          <div>
            <Label>Bis *</Label>
            <DatePicker value={f.end_datum} onChange={(v) => set("end_datum", v)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Grund</Label>
            <Input value={f.grund} onChange={(e) => set("grund", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notiz</Label>
            <Textarea value={f.notiz} onChange={(e) => set("notiz", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

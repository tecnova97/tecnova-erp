import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AUSSTATTUNG_TYPEN, type AusstattungRow } from "@/lib/module-queries";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AusstattungDialog({
  open,
  onOpenChange,
  mitarbeiterId,
  eintrag,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mitarbeiterId: string;
  eintrag?: AusstattungRow | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    typ: "geraet",
    bezeichnung: "",
    kennzeichen: "",
    seriennummer: "",
    ausgabe_datum: "",
    rueckgabe_datum: "",
    notiz: "",
  });

  useEffect(() => {
    if (!open) return;
    if (eintrag) {
      setF({
        typ: eintrag.typ ?? "geraet",
        bezeichnung: eintrag.bezeichnung ?? "",
        kennzeichen: eintrag.kennzeichen ?? "",
        seriennummer: eintrag.seriennummer ?? "",
        ausgabe_datum: eintrag.ausgabe_datum ?? "",
        rueckgabe_datum: eintrag.rueckgabe_datum ?? "",
        notiz: eintrag.notiz ?? "",
      });
    } else {
      setF({ typ: "geraet", bezeichnung: "", kennzeichen: "", seriennummer: "", ausgabe_datum: "", rueckgabe_datum: "", notiz: "" });
    }
  }, [open, eintrag]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.bezeichnung.trim()) {
      toast.error("Bezeichnung ist erforderlich.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        mitarbeiter_id: mitarbeiterId,
        typ: f.typ,
        bezeichnung: f.bezeichnung.trim(),
        kennzeichen: f.kennzeichen || null,
        seriennummer: f.seriennummer || null,
        ausgabe_datum: f.ausgabe_datum || null,
        rueckgabe_datum: f.rueckgabe_datum || null,
        notiz: f.notiz || null,
      };
      if (eintrag) {
        const { error } = await supabase.from("mitarbeiter_ausstattung").update(payload).eq("id", eintrag.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mitarbeiter_ausstattung").insert({ ...payload, created_by: user?.id });
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

  const remove = async () => {
    if (!eintrag || !confirm("Ausstattung wirklich zurücknehmen/löschen?")) return;
    const { error } = await supabase.from("mitarbeiter_ausstattung").delete().eq("id", eintrag.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Zurückgenommen.");
    qc.invalidateQueries();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{eintrag ? "Ausstattung bearbeiten" : "Ausstattung zuweisen"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Typ</Label>
            <Select value={f.typ} onValueChange={(v) => set("typ", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUSSTATTUNG_TYPEN.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bezeichnung *</Label>
            <Input value={f.bezeichnung} onChange={(e) => set("bezeichnung", e.target.value)} />
          </div>
          <div>
            <Label>Kennzeichen</Label>
            <Input value={f.kennzeichen} onChange={(e) => set("kennzeichen", e.target.value)} />
          </div>
          <div>
            <Label>Seriennummer</Label>
            <Input value={f.seriennummer} onChange={(e) => set("seriennummer", e.target.value)} />
          </div>
          <div>
            <Label>Ausgabedatum</Label>
            <Input type="date" value={f.ausgabe_datum} onChange={(e) => set("ausgabe_datum", e.target.value)} />
          </div>
          <div>
            <Label>Rückgabedatum</Label>
            <Input type="date" value={f.rueckgabe_datum} onChange={(e) => set("rueckgabe_datum", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notiz</Label>
            <Textarea value={f.notiz} onChange={(e) => set("notiz", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {eintrag ? (
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              <Trash2 className="mr-2 h-4 w-4" /> Zurücknehmen
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

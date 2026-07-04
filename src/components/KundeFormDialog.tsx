import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { KundeRow } from "@/lib/module-queries";
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

export function KundeFormDialog({
  open,
  onOpenChange,
  kunde,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kunde?: KundeRow | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: "",
    ansprechpartner: "",
    telefon: "",
    festnetz: "",
    email: "",
    website: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    notizen: "",
  });

  useEffect(() => {
    if (!open) return;
    if (kunde) {
      setF({
        name: kunde.name ?? "",
        ansprechpartner: kunde.ansprechpartner ?? "",
        telefon: kunde.telefon ?? "",
        festnetz: kunde.festnetz ?? "",
        email: kunde.email ?? "",
        website: kunde.website ?? "",
        strasse: kunde.strasse ?? "",
        hausnummer: kunde.hausnummer ?? "",
        plz: kunde.plz ?? "",
        ort: kunde.ort ?? "",
        notizen: kunde.notizen ?? "",
      });
    } else {
      setF({
        name: "", ansprechpartner: "", telefon: "", festnetz: "", email: "", website: "",
        strasse: "", hausnummer: "", plz: "", ort: "", notizen: "",
      });
    }
  }, [open, kunde]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) {
      toast.error("Firmenname ist erforderlich.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: f.name.trim(),
        ansprechpartner: f.ansprechpartner || null,
        telefon: f.telefon || null,
        festnetz: f.festnetz || null,
        email: f.email || null,
        website: f.website || null,
        strasse: f.strasse || null,
        hausnummer: f.hausnummer || null,
        plz: f.plz || null,
        ort: f.ort || null,
        notizen: f.notizen || null,
      };
      if (kunde) {
        const { error } = await supabase
          .from("kunden")
          .update({ ...payload, updated_by: user?.id })
          .eq("id", kunde.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("kunden").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      toast.success(kunde ? "Auftraggeber gespeichert." : "Auftraggeber erstellt.");
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kunde ? "Auftraggeber bearbeiten" : "Neuer Auftraggeber"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Firmenname *</Label>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <Field label="Ansprechpartner" value={f.ansprechpartner} onChange={(v) => set("ansprechpartner", v)} />
          <Field label="E-Mail" value={f.email} onChange={(v) => set("email", v)} />
          <Field label="Telefon (mobil)" value={f.telefon} onChange={(v) => set("telefon", v)} />
          <Field label="Festnetz" value={f.festnetz} onChange={(v) => set("festnetz", v)} />
          <Field label="Website" value={f.website} onChange={(v) => set("website", v)} />
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <div className="col-span-2">
              <Label>Straße</Label>
              <Input value={f.strasse} onChange={(e) => set("strasse", e.target.value)} />
            </div>
            <div>
              <Label>Nr.</Label>
              <Input value={f.hausnummer} onChange={(e) => set("hausnummer", e.target.value)} />
            </div>
          </div>
          <Field label="PLZ" value={f.plz} onChange={(v) => set("plz", v)} />
          <Field label="Ort" value={f.ort} onChange={(v) => set("ort", v)} />
          <div className="sm:col-span-2">
            <Label>Notizen</Label>
            <Textarea value={f.notizen} onChange={(e) => set("notizen", e.target.value)} rows={3} />
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

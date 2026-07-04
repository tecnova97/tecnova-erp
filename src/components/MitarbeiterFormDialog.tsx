import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { MitarbeiterRow } from "@/lib/module-queries";
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
import { Switch } from "@/components/ui/switch";

export function MitarbeiterFormDialog({
  open,
  onOpenChange,
  mitarbeiter,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mitarbeiter?: MitarbeiterRow | null;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    vorname: "",
    nachname: "",
    email: "",
    telefon: "",
    rolle: "",
    position: "",
    farbe: "#2563eb",
    aktiv: true,
    notizen: "",
  });

  useEffect(() => {
    if (!open) return;
    if (mitarbeiter) {
      setF({
        vorname: mitarbeiter.vorname ?? "",
        nachname: mitarbeiter.nachname ?? "",
        email: mitarbeiter.email ?? "",
        telefon: mitarbeiter.telefon ?? "",
        rolle: mitarbeiter.rolle ?? "",
        position: mitarbeiter.position ?? "",
        farbe: mitarbeiter.farbe ?? "#2563eb",
        aktiv: mitarbeiter.aktiv ?? true,
        notizen: mitarbeiter.notizen ?? "",
      });
    } else {
      setF({
        vorname: "", nachname: "", email: "", telefon: "", rolle: "",
        position: "", farbe: "#2563eb", aktiv: true, notizen: "",
      });
    }
  }, [open, mitarbeiter]);

  const save = async () => {
    if (!f.vorname.trim() || !f.nachname.trim()) {
      toast.error("Vor- und Nachname sind erforderlich.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vorname: f.vorname.trim(),
        nachname: f.nachname.trim(),
        email: f.email || null,
        telefon: f.telefon || null,
        rolle: f.rolle || null,
        position: f.position || null,
        farbe: f.farbe,
        aktiv: f.aktiv,
        notizen: f.notizen || null,
      };
      if (mitarbeiter) {
        const { error } = await supabase
          .from("mitarbeiter")
          .update({ ...payload, updated_by: user?.id })
          .eq("id", mitarbeiter.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mitarbeiter").insert(payload);
        if (error) throw error;
      }
      toast.success(mitarbeiter ? "Mitarbeiter gespeichert." : "Mitarbeiter erstellt.");
      qc.invalidateQueries();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mitarbeiter ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Vorname *</Label>
            <Input value={f.vorname} onChange={(e) => set("vorname", e.target.value)} />
          </div>
          <div>
            <Label>Nachname *</Label>
            <Input value={f.nachname} onChange={(e) => set("nachname", e.target.value)} />
          </div>
          <div>
            <Label>E-Mail</Label>
            <Input value={f.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={f.telefon} onChange={(e) => set("telefon", e.target.value)} />
          </div>
          <div>
            <Label>Rolle</Label>
            <Input value={f.rolle} onChange={(e) => set("rolle", e.target.value)} placeholder="z. B. Monteur" />
          </div>
          <div>
            <Label>Position</Label>
            <Input value={f.position} onChange={(e) => set("position", e.target.value)} />
          </div>
          <div>
            <Label>Farbe</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={f.farbe}
                onChange={(e) => set("farbe", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border bg-background"
              />
              <Input value={f.farbe} onChange={(e) => set("farbe", e.target.value)} className="flex-1" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3">
            <Label className="cursor-pointer">Aktiv</Label>
            <Switch checked={f.aktiv} onCheckedChange={(v) => set("aktiv", v)} />
          </div>
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

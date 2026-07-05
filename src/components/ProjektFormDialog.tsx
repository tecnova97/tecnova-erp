import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { kundenQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import type { ProjektRow } from "@/lib/module-queries";
import type { Database } from "@/integrations/supabase/types";
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
import { customFieldDefsQuery, type CustomData } from "@/lib/customFields";
import { CustomFieldsForm } from "@/components/custom/CustomFields";

type ProjektStatus = Database["public"]["Enums"]["projekt_status"];

const STATUS_OPTS: { value: ProjektStatus; label: string }[] = [
  { value: "aktiv", label: "Aktiv" },
  { value: "pausiert", label: "Pausiert" },
  { value: "abgeschlossen", label: "Abgeschlossen" },
  { value: "archiviert", label: "Archiviert" },
];

export function ProjektFormDialog({
  open,
  onOpenChange,
  projekt,
  defaultKundeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projekt?: ProjektRow | null;
  defaultKundeId?: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: customDefs = [] } = useQuery(customFieldDefsQuery("projekt"));
  const [customData, setCustomData] = useState<CustomData>({});
  const [saving, setSaving] = useState(false);

  const [f, setF] = useState({
    name: "",
    kunde_id: "",
    status: "aktiv" as ProjektStatus,
    nvt: "",
    esass_nr: "",
    ag_bestell_nr: "",
    ag_leb_nr: "",
    leistung_von: "",
    leistung_bis: "",
    kostenstelle: "",
    projektleiter: "",
    ag_sm_nr: "",
    ag_vertrags_nr: "",
    leistungsort: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    start_datum: "",
    beschreibung: "",
    notizen: "",
  });

  useEffect(() => {
    if (!open) return;
    if (projekt) {
      setF({
        name: projekt.name ?? "",
        kunde_id: projekt.kunde_id ?? "",
        status: (projekt.status as ProjektStatus) ?? "aktiv",
        nvt: projekt.nvt ?? "",
        esass_nr: projekt.esass_nr ?? "",
        ag_bestell_nr: projekt.ag_bestell_nr ?? "",
        ag_leb_nr: projekt.ag_leb_nr ?? "",
        leistung_von: projekt.leistung_von ?? "",
        leistung_bis: projekt.leistung_bis ?? "",
        kostenstelle: projekt.kostenstelle ?? "",
        projektleiter: projekt.projektleiter ?? "",
        ag_sm_nr: projekt.ag_sm_nr ?? "",
        ag_vertrags_nr: projekt.ag_vertrags_nr ?? "",
        leistungsort: projekt.leistungsort ?? "",
        strasse: projekt.strasse ?? "",
        hausnummer: projekt.hausnummer ?? "",
        plz: projekt.plz ?? "",
        ort: projekt.ort ?? "",
        start_datum: projekt.start_datum ?? "",
        beschreibung: projekt.beschreibung ?? "",
        notizen: projekt.notizen ?? "",
      });
      setCustomData(((projekt as { custom_data?: CustomData }).custom_data ?? {}) as CustomData);
    } else {
      setF((p) => ({ ...p, name: "", kunde_id: defaultKundeId ?? "", status: "aktiv" }));
      setCustomData({});
    }
  }, [open, projekt, defaultKundeId]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) {
      toast.error("Projektname ist erforderlich.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: f.name.trim(),
        kunde_id: f.kunde_id || null,
        status: f.status,
        nvt: f.nvt || null,
        esass_nr: f.esass_nr || null,
        ag_bestell_nr: f.ag_bestell_nr || null,
        ag_leb_nr: f.ag_leb_nr || null,
        leistung_von: f.leistung_von || null,
        leistung_bis: f.leistung_bis || null,
        kostenstelle: f.kostenstelle || null,
        projektleiter: f.projektleiter || null,
        ag_sm_nr: f.ag_sm_nr || null,
        ag_vertrags_nr: f.ag_vertrags_nr || null,
        leistungsort: f.leistungsort || null,
        strasse: f.strasse || null,
        hausnummer: f.hausnummer || null,
        plz: f.plz || null,
        ort: f.ort || null,
        start_datum: f.start_datum || null,
        beschreibung: f.beschreibung || null,
        notizen: f.notizen || null,
        custom_data: customData as never,
      };
      if (projekt) {
        const { error } = await supabase
          .from("projekte")
          .update({ ...payload, updated_by: user?.id })
          .eq("id", projekt.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projekte")
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      toast.success(projekt ? "Projekt gespeichert." : "Projekt erstellt.");
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
          <DialogTitle>{projekt ? "Projekt bearbeiten" : "Neues Projekt"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Projektname *</Label>
            <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>Auftraggeber</Label>
            <Select value={f.kunde_id || "none"} onValueChange={(v) => set("kunde_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">– Kein –</SelectItem>
                {(kunden as { id: string; name: string }[]).map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="NVT" value={f.nvt} onChange={(v) => set("nvt", v)} />
          <Field label="eSASS-Nr." value={f.esass_nr} onChange={(v) => set("esass_nr", v)} />
          <Field label="AG-Bestell-Nr." value={f.ag_bestell_nr} onChange={(v) => set("ag_bestell_nr", v)} />
          <Field label="AG-LEB-Nr." value={f.ag_leb_nr} onChange={(v) => set("ag_leb_nr", v)} />
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <div>
              <Label>Leistungszeitraum – Von</Label>
              <DatePicker value={f.leistung_von} onChange={(v) => set("leistung_von", v)} />
            </div>
            <div>
              <Label>Leistungszeitraum – Bis</Label>
              <DatePicker value={f.leistung_bis} onChange={(v) => set("leistung_bis", v)} />
            </div>
          </div>
          <Field label="Kostenstelle" value={f.kostenstelle} onChange={(v) => set("kostenstelle", v)} />
          <Field label="Projektleiter" value={f.projektleiter} onChange={(v) => set("projektleiter", v)} />
          <Field label="AG SM-Nr." value={f.ag_sm_nr} onChange={(v) => set("ag_sm_nr", v)} />
          <Field label="AG Vertrags-Nr." value={f.ag_vertrags_nr} onChange={(v) => set("ag_vertrags_nr", v)} />
          <Field label="Leistungsort" value={f.leistungsort} onChange={(v) => set("leistungsort", v)} />
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
          <div>
            <Label>Startdatum</Label>
            <DatePicker value={f.start_datum} onChange={(v) => set("start_datum", v)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Beschreibung</Label>
            <Textarea value={f.beschreibung} onChange={(e) => set("beschreibung", e.target.value)} rows={2} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notizen</Label>
            <Textarea value={f.notizen} onChange={(e) => set("notizen", e.target.value)} rows={2} />
          </div>
          {customDefs.filter((d) => d.sichtbar).length > 0 && (
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weitere Felder</p>
              <CustomFieldsForm defs={customDefs} values={customData} onChange={setCustomData} />
            </div>
          )}
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

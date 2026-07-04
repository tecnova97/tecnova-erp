import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import {
  createRechnungGruppe,
  updateRechnungGruppe,
  type RechnungGruppe,
} from "@/lib/abrechnung";
import { kundenQuery, projekteQuery } from "@/lib/queries";
import { customFieldDefsQuery, type CustomData } from "@/lib/customFields";
import { CustomFieldsForm } from "@/components/custom/CustomFields";

const NONE = "__none__";

export function RechnungGruppeDialog({
  open,
  onOpenChange,
  gruppe,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gruppe?: RechnungGruppe | null;
  onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: customDefs = [] } = useQuery(customFieldDefsQuery("rechnung_gruppe"));
  const [customData, setCustomData] = useState<CustomData>({});

  const [f, setF] = useState({
    name: "",
    auftraggeber_id: NONE,
    projekt_id: NONE,
    nvt: "",
    esass_nr: "",
    ag_bestell_nr: "",
    ag_leb_nr: "",
    sm_nr: "",
    kostenstelle: "",
    projektleiter: "",
    leistungsort: "",
    leistungszeitraum_von: "",
    leistungszeitraum_bis: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({
      name: gruppe?.name ?? "",
      auftraggeber_id: gruppe?.auftraggeber_id ?? NONE,
      projekt_id: gruppe?.projekt_id ?? NONE,
      nvt: gruppe?.nvt ?? "",
      esass_nr: gruppe?.esass_nr ?? "",
      ag_bestell_nr: gruppe?.ag_bestell_nr ?? "",
      ag_leb_nr: gruppe?.ag_leb_nr ?? "",
      sm_nr: gruppe?.sm_nr ?? "",
      kostenstelle: gruppe?.kostenstelle ?? "",
      projektleiter: gruppe?.projektleiter ?? "",
      leistungsort: gruppe?.leistungsort ?? "",
      leistungszeitraum_von: gruppe?.leistungszeitraum_von ?? "",
      leistungszeitraum_bis: gruppe?.leistungszeitraum_bis ?? "",
      notes: gruppe?.notes ?? "",
    });
    setCustomData((gruppe?.custom_data ?? {}) as CustomData);
  }, [open, gruppe]);

  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const input = {
        name: f.name.trim() || null,
        auftraggeber_id: f.auftraggeber_id === NONE ? null : f.auftraggeber_id,
        projekt_id: f.projekt_id === NONE ? null : f.projekt_id,
        nvt: f.nvt.trim() || null,
        esass_nr: f.esass_nr.trim() || null,
        ag_bestell_nr: f.ag_bestell_nr.trim() || null,
        ag_leb_nr: f.ag_leb_nr.trim() || null,
        sm_nr: f.sm_nr.trim() || null,
        kostenstelle: f.kostenstelle.trim() || null,
        projektleiter: f.projektleiter.trim() || null,
        leistungsort: f.leistungsort.trim() || null,
        leistungszeitraum_von: f.leistungszeitraum_von || null,
        leistungszeitraum_bis: f.leistungszeitraum_bis || null,
        notes: f.notes.trim() || null,
        custom_data: customData as never,
      };
      if (gruppe) {
        await updateRechnungGruppe(gruppe.id, input);
        await qc.invalidateQueries({ queryKey: ["rechnung_gruppe", gruppe.id] });
        toast.success("Rechnungsgruppe aktualisiert");
      } else {
        const res = await createRechnungGruppe(input);
        toast.success("Rechnungsgruppe angelegt");
        onCreated?.(res.id);
      }
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppen"] });
      onOpenChange(false);
    } catch (e) {
      toast.error("Speichern fehlgeschlagen", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{gruppe ? "Rechnungsgruppe bearbeiten" : "Neue Rechnungsgruppe"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field className="col-span-2" label="Name / Bezeichnung" value={f.name} onChange={set("name")} placeholder="z. B. NVT Musterstraße KW 12" />
          <div className="space-y-1.5">
            <Label>Auftraggeber</Label>
            <Select value={f.auftraggeber_id} onValueChange={set("auftraggeber_id")}>
              <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>–</SelectItem>
                {kunden.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Projekt</Label>
            <Select value={f.projekt_id} onValueChange={set("projekt_id")}>
              <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>–</SelectItem>
                {projekte.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Field label="NVT" value={f.nvt} onChange={set("nvt")} />
          <Field label="eSASS-Nr." value={f.esass_nr} onChange={set("esass_nr")} />
          <Field label="AG-Bestell-Nr." value={f.ag_bestell_nr} onChange={set("ag_bestell_nr")} />
          <Field label="AG-LEB-Nr." value={f.ag_leb_nr} onChange={set("ag_leb_nr")} />
          <Field label="SM-Nr." value={f.sm_nr} onChange={set("sm_nr")} />
          <Field label="Kostenstelle" value={f.kostenstelle} onChange={set("kostenstelle")} />
          <Field label="Projektleiter" value={f.projektleiter} onChange={set("projektleiter")} />
          <Field label="Leistungsort" value={f.leistungsort} onChange={set("leistungsort")} />
          <div className="space-y-1.5">
            <Label>Leistungszeitraum von</Label>
            <Input type="date" value={f.leistungszeitraum_von} onChange={(e) => set("leistungszeitraum_von")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Leistungszeitraum bis</Label>
            <Input type="date" value={f.leistungszeitraum_bis} onChange={(e) => set("leistungszeitraum_bis")(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notiz</Label>
            <Textarea value={f.notes} onChange={(e) => set("notes")(e.target.value)} rows={2} />
          </div>
          {customDefs.filter((d) => d.sichtbar).length > 0 && (
            <div className="col-span-2 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weitere Felder</p>
              <CustomFieldsForm defs={customDefs} values={customData} onChange={setCustomData} className="grid grid-cols-2 gap-3" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

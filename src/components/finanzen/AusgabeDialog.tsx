import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
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
import {
  AUSGABEN_KATEGORIEN,
  type Betriebsausgabe,
  createAusgabe,
  updateAusgabe,
  uploadBeleg,
} from "@/lib/finanzen";
import { auftraegeQuery, kundenQuery, projekteQuery, mitarbeiterQuery } from "@/lib/queries";

const NONE = "__none__";

export function AusgabeDialog({
  open,
  onOpenChange,
  ausgabe,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ausgabe?: Betriebsausgabe | null;
}) {
  const qc = useQueryClient();
  const { data: auftraege = [] } = useQuery(auftraegeQuery());
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());

  const [bezeichnung, setBezeichnung] = useState("");
  const [kategorie, setKategorie] = useState("material");
  const [betrag, setBetrag] = useState("");
  const [mwst, setMwst] = useState("19");
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [auftragId, setAuftragId] = useState(NONE);
  const [projektId, setProjektId] = useState(NONE);
  const [mitarbeiterId, setMitarbeiterId] = useState(NONE);
  const [auftraggeberId, setAuftraggeberId] = useState(NONE);
  const [notiz, setNotiz] = useState("");
  const [belegUrl, setBelegUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBezeichnung(ausgabe?.bezeichnung ?? "");
    setKategorie(ausgabe?.kategorie ?? "material");
    setBetrag(ausgabe ? String(ausgabe.betrag) : "");
    setMwst(ausgabe ? String(ausgabe.mwst_satz) : "19");
    setDatum(ausgabe?.datum ?? new Date().toISOString().slice(0, 10));
    setAuftragId(ausgabe?.auftrag_id ?? NONE);
    setProjektId(ausgabe?.projekt_id ?? NONE);
    setMitarbeiterId(ausgabe?.mitarbeiter_id ?? NONE);
    setAuftraggeberId(ausgabe?.auftraggeber_id ?? NONE);
    setNotiz(ausgabe?.notiz ?? "");
    setBelegUrl(ausgabe?.beleg_url ?? null);
  }, [open, ausgabe]);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      const path = await uploadBeleg(f);
      setBelegUrl(path);
      toast.success("Beleg hochgeladen");
    } catch (e) {
      toast.error("Upload fehlgeschlagen", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!bezeichnung.trim()) return toast.error("Bezeichnung erforderlich");
    setSaving(true);
    try {
      const input = {
        bezeichnung: bezeichnung.trim(),
        kategorie,
        betrag: Number(betrag) || 0,
        mwst_satz: Number(mwst) || 0,
        datum,
        auftrag_id: auftragId === NONE ? null : auftragId,
        projekt_id: projektId === NONE ? null : projektId,
        mitarbeiter_id: mitarbeiterId === NONE ? null : mitarbeiterId,
        auftraggeber_id: auftraggeberId === NONE ? null : auftraggeberId,
        notiz: notiz.trim() || null,
        beleg_url: belegUrl,
      };
      if (ausgabe) await updateAusgabe(ausgabe.id, input);
      else await createAusgabe(input);
      await qc.invalidateQueries({ queryKey: ["betriebsausgaben"] });
      toast.success(ausgabe ? "Ausgabe aktualisiert" : "Ausgabe erfasst");
      onOpenChange(false);
    } catch (e) {
      toast.error("Speichern fehlgeschlagen", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ausgabe ? "Ausgabe bearbeiten" : "Neue Ausgabe"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Bezeichnung</Label>
            <Input value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} placeholder="z. B. Tankfüllung Transporter" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select value={kategorie} onValueChange={setKategorie}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUSGABEN_KATEGORIEN.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Betrag (€)</Label>
              <Input type="number" step="0.01" value={betrag} onChange={(e) => setBetrag(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>MwSt %</Label>
              <Input type="number" step="0.1" value={mwst} onChange={(e) => setMwst(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Datum</Label>
            <DatePicker value={datum} onChange={setDatum} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RefSelect label="Auftrag" value={auftragId} onChange={setAuftragId}
              options={auftraege.map((a) => ({ value: a.id, label: a.titel }))} />
            <RefSelect label="Projekt" value={projektId} onChange={setProjektId}
              options={projekte.map((p) => ({ value: p.id, label: p.name }))} />
            <RefSelect label="Mitarbeiter" value={mitarbeiterId} onChange={setMitarbeiterId}
              options={mitarbeiter.map((m) => ({ value: m.id, label: `${m.vorname} ${m.nachname}` }))} />
            <RefSelect label="Auftraggeber" value={auftraggeberId} onChange={setAuftraggeberId}
              options={kunden.map((k) => ({ value: k.id, label: k.name }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Notiz</Label>
            <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Beleg</Label>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Datei wählen
                <input type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              </label>
              {belegUrl && <span className="text-xs text-success">Beleg gespeichert</span>}
            </div>
          </div>
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

function RefSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>–</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

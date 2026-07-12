import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PAYMENT_TYPES,
  type PaymentType,
  createZahlung,
  type ZahlungLeistungRef,
} from "@/lib/zahlungen";
import { auftragLeistungenQuery } from "@/lib/auftragLeistungen";

/**
 * Records a single, independent payment event (Zahlungsereignis) with a
 * MANUALLY entered amount. The Auftrag workflow status is never changed.
 * Only finance users / owners can open this dialog.
 */
export function ZahlungErfassenDialog({
  open,
  onOpenChange,
  auftragId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  auftragId: string;
}) {
  const qc = useQueryClient();

  const { data: leistungen = [] } = useQuery(auftragLeistungenQuery(auftragId));

  const [paymentType, setPaymentType] = useState<PaymentType>("erledigt_bezahlt");
  const [betrag, setBetrag] = useState("");
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [notiz, setNotiz] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPaymentType("erledigt_bezahlt");
    setBetrag("");
    setDatum(new Date().toISOString().slice(0, 10));
    setNotiz("");
    setSelected(new Set());
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const typeFarbe = useMemo(
    () => PAYMENT_TYPES.find((t) => t.value === paymentType)?.farbe ?? "#64748b",
    [paymentType],
  );

  const save = async () => {
    const amount = Number(betrag.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Bitte einen gültigen Betrag eingeben.");
      return;
    }
    if (!datum) {
      toast.error("Bitte ein Zahlungsdatum wählen.");
      return;
    }
    setSaving(true);
    try {
      const chosen = leistungen.filter((l) => selected.has(l.id));
      const leistungenSnap: ZahlungLeistungRef[] = chosen.map((l) => ({
        code: l.code,
        name: l.name,
        berechnungsart: l.berechnungsart,
        einheit: l.einheit,
        menge: l.menge,
        mitarbeiter_anzahl: l.mitarbeiter_anzahl,
      }));
      // The amount is entered manually, so we do NOT store priced position
      // snapshots (their totals would not match the manual sum). We keep only a
      // price-free reference to the selected positions.

      await createZahlung({
        auftragId,
        paymentType,
        betrag: amount,
        datum: new Date(`${datum}T12:00:00`).toISOString(),
        notiz: notiz.trim() || null,
        leistungen: leistungenSnap,
      });

      await qc.invalidateQueries({ queryKey: ["zahlungsereignisse"] });
      await qc.invalidateQueries({ queryKey: ["zahlungsereignisse", auftragId] });
      await qc.invalidateQueries({ queryKey: ["zahlung_umsatz_map"] });
      await qc.invalidateQueries({ queryKey: ["auftrag_umsatz_map"] });
      await qc.invalidateQueries({ queryKey: ["auftrag_gewinn_map"] });
      await qc.invalidateQueries({ queryKey: ["auftraege"] });
      await qc.invalidateQueries({ queryKey: ["auftrag", auftragId] });

      toast.success("Zahlung erfasst.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Zahlung erfassen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Zahlungstyp</Label>
            <Select value={paymentType} onValueChange={(v) => setPaymentType(v as PaymentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: t.farbe }}
                      />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentType !== "erledigt_bezahlt" && (
              <p className="text-xs text-muted-foreground">
                Der Auftrag bleibt geöffnet und wird nicht als vollständig bezahlt markiert.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Betrag (€)</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Nur der in diesem Ereignis erhaltene Betrag – nicht die Gesamtsumme.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Zahlungsdatum</Label>
              <DatePicker value={datum} onChange={setDatum} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notiz (optional)</Label>
            <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} />
          </div>

          {leistungen.length > 0 && (
            <div className="space-y-2">
              <Label>Leistungspositionen (optional)</Label>
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border p-2">
                {leistungen.map((l) => (
                  <label
                    key={l.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
                  >
                    <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                    <span className="text-sm font-medium">{l.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.code} · {l.menge} {l.einheit}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div
            className="rounded-xl border p-3 text-sm"
            style={{ borderColor: typeFarbe, backgroundColor: `${typeFarbe}14` }}
          >
            Es wird ein <strong>separates</strong> Zahlungsereignis angelegt. Vorhandene Zahlungen
            dieses Auftrags bleiben unverändert.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Zahlung speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

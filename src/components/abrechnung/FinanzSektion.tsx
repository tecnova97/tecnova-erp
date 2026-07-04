import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Calculator } from "lucide-react";
import {
  gruppePositionenQuery, addGruppePosition, updateGruppePosition, deleteGruppePosition,
  updateRechnungGruppe, computeGruppeFinance, RG_POS_TYPES,
  type RechnungGruppe, type RechnungGruppePosition,
} from "@/lib/abrechnung";
import { fmtEuro } from "@/lib/erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function FinanzSektion({
  gruppe,
  eventsSum,
  hasEvents,
  canEdit,
  canUmsatz,
}: {
  gruppe: RechnungGruppe;
  eventsSum: number;
  hasEvents: boolean;
  canEdit: boolean;
  canUmsatz: boolean;
}) {
  const qc = useQueryClient();
  const { data: positionen = [] } = useQuery(gruppePositionenQuery(gruppe.id));

  const [ust, setUst] = useState(String(gruppe.ust_prozent ?? 19));
  const [nettoManuell, setNettoManuell] = useState(gruppe.netto_manuell != null ? String(gruppe.netto_manuell) : "");
  const [anpassung, setAnpassung] = useState(String(gruppe.manuelle_anpassung ?? 0));
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    setUst(String(gruppe.ust_prozent ?? 19));
    setNettoManuell(gruppe.netto_manuell != null ? String(gruppe.netto_manuell) : "");
    setAnpassung(String(gruppe.manuelle_anpassung ?? 0));
  }, [gruppe.id, gruppe.ust_prozent, gruppe.netto_manuell, gruppe.manuelle_anpassung]);

  const metaDirty =
    ust !== String(gruppe.ust_prozent ?? 19) ||
    nettoManuell !== (gruppe.netto_manuell != null ? String(gruppe.netto_manuell) : "") ||
    anpassung !== String(gruppe.manuelle_anpassung ?? 0);

  const fin = computeGruppeFinance({
    eventsSum,
    hasEvents,
    positionen,
    netto_manuell: nettoManuell === "" ? null : Number(nettoManuell),
    manuelle_anpassung: Number(anpassung || 0),
    ust_prozent: Number(ust || 0),
  });

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      await updateRechnungGruppe(gruppe.id, {
        ust_prozent: Number(ust || 0),
        netto_manuell: nettoManuell === "" ? null : Number(nettoManuell),
        manuelle_anpassung: Number(anpassung || 0),
      } as never);
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppe", gruppe.id] });
      toast.success("Gespeichert");
    } catch (e) {
      toast.error("Fehlgeschlagen", { description: (e as Error).message });
    } finally {
      setSavingMeta(false);
    }
  };

  const addPos = async (typ: string) => {
    try {
      await addGruppePosition(gruppe.id, {
        bezeichnung: RG_POS_TYPES.find((t) => t.value === typ)?.label ?? "Position",
        typ,
        menge: 1,
        einzelpreis: 0,
        betrag: 0,
        notiz: null,
        sort_order: positionen.length,
      });
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_positionen", gruppe.id] });
      toast.success("Gespeichert");
    } catch (e) {
      toast.error("Fehlgeschlagen", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-5">
      {!canUmsatz && (
        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
          Finanzwerte sind ausgeblendet – dir fehlt die Finanzberechtigung.
        </p>
      )}

      {/* Manual line items */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Manuelle Positionen & Anpassungen</h3>
          {canEdit && (
            <div className="flex flex-wrap gap-1.5">
              {RG_POS_TYPES.map((t) => (
                <Button key={t.value} size="sm" variant="outline" onClick={() => addPos(t.value)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> {t.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        {positionen.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Keine manuellen Positionen. {hasEvents ? "Der Zwischensumme werden zugeordnete Zahlungsereignisse zugrunde gelegt." : "Trage einen manuellen Betrag ein oder füge Positionen hinzu."}
          </p>
        ) : (
          <div className="space-y-2">
            {positionen.map((p) => (
              <PositionRow key={p.id} pos={p} gruppeId={gruppe.id} canEdit={canEdit} />
            ))}
          </div>
        )}
      </div>

      {/* Financial summary */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="mb-3 font-bold">Rechnungsbetrag</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {!hasEvents && (
              <div className="space-y-1.5">
                <Label>Netto-Betrag (manuell)</Label>
                <Input type="number" step="0.01" value={nettoManuell} disabled={!canEdit}
                  onChange={(e) => setNettoManuell(e.target.value)} placeholder="0,00" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Umsatzsteuer %</Label>
              <Input type="number" step="0.1" value={ust} disabled={!canEdit}
                onChange={(e) => setUst(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Manuelle Anpassung (±)</Label>
              <Input type="number" step="0.01" value={anpassung} disabled={!canEdit}
                onChange={(e) => setAnpassung(e.target.value)} />
            </div>
          </div>
          {canEdit && metaDirty && (
            <Button size="sm" className="mt-4" onClick={saveMeta} disabled={savingMeta}>
              {savingMeta ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Speichern
            </Button>
          )}
        </div>

        {canUmsatz && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <h3 className="font-bold">Summe</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label={hasEvents ? "Zahlungsereignisse" : "Netto (manuell)"} value={fmtEuro(fin.basis)} />
              <Row label="Manuelle Positionen" value={fmtEuro(fin.positionenSum)} />
              <Row label="Anpassung" value={fmtEuro(Number(anpassung || 0))} />
              <div className="my-2 border-t border-border" />
              <Row label="Netto gesamt" value={fmtEuro(fin.netto)} strong />
              <Row label={`USt (${ust || 0}%)`} value={fmtEuro(fin.ust)} />
              <div className="my-2 border-t border-border" />
              <Row label="Brutto (Endbetrag)" value={fmtEuro(fin.brutto)} strong />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-extrabold" : ""}`}>{value}</dd>
    </div>
  );
}

function PositionRow({
  pos, gruppeId, canEdit,
}: {
  pos: RechnungGruppePosition;
  gruppeId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [bezeichnung, setBezeichnung] = useState(pos.bezeichnung);
  const [typ, setTyp] = useState(pos.typ);
  const [menge, setMenge] = useState(String(pos.menge));
  const [einzelpreis, setEinzelpreis] = useState(String(pos.einzelpreis));
  const [betrag, setBetrag] = useState(String(pos.betrag));
  const [busy, setBusy] = useState(false);

  const dirty =
    bezeichnung !== pos.bezeichnung || typ !== pos.typ ||
    menge !== String(pos.menge) || einzelpreis !== String(pos.einzelpreis) ||
    betrag !== String(pos.betrag);

  const recalc = (m: string, e: string) => {
    const auto = Number(m || 0) * Number(e || 0);
    setBetrag(String(auto));
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateGruppePosition(pos.id, {
        bezeichnung: bezeichnung.trim() || pos.bezeichnung,
        typ,
        menge: Number(menge || 0),
        einzelpreis: Number(einzelpreis || 0),
        betrag: Number(betrag || 0),
      });
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_positionen", gruppeId] });
      toast.success("Gespeichert");
    } catch (err) {
      toast.error("Fehlgeschlagen", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await deleteGruppePosition(pos.id);
      await qc.invalidateQueries({ queryKey: ["rechnung_gruppe_positionen", gruppeId] });
      toast.success("Gespeichert");
    } catch (err) {
      toast.error("Fehlgeschlagen", { description: (err as Error).message });
    }
  };

  if (!canEdit) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm">
        <span className="badge bg-muted text-muted-foreground">{RG_POS_TYPES.find((t) => t.value === pos.typ)?.label ?? pos.typ}</span>
        <span className="min-w-0 flex-1 truncate">{pos.bezeichnung}</span>
        <span className="tabular-nums font-semibold">{fmtEuro(Number(pos.betrag))}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={typ} onValueChange={setTyp}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RG_POS_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={bezeichnung} onChange={(e) => setBezeichnung(e.target.value)} placeholder="Bezeichnung" className="h-9 min-w-[10rem] flex-1" />
        <Button size="sm" variant="ghost" className="h-9 text-destructive" onClick={remove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <Num label="Menge" value={menge} onChange={(v) => { setMenge(v); recalc(v, einzelpreis); }} />
        <Num label="Einzelpreis €" value={einzelpreis} onChange={(v) => { setEinzelpreis(v); recalc(menge, v); }} />
        <Num label="Betrag € (± möglich)" value={betrag} onChange={setBetrag} wide />
        {dirty && (
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Speichern
          </Button>
        )}
      </div>
    </div>
  );
}

function Num({ label, value, onChange, wide }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className={`h-8 ${wide ? "w-40" : "w-28"}`} />
    </div>
  );
}

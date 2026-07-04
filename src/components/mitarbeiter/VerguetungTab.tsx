import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Euro, Plus, Trash2, Save, Loader2, Calculator, Award, MessageSquarePlus, TrendingUp, Info,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { fmtDate, fmtEuro } from "@/lib/erp";
import { cn } from "@/lib/utils";
import type { AuftragRow } from "@/lib/queries";
import {
  verguetungBaseQuery, verguetungEintraegeQuery, leistungsnotizenQuery,
  upsertVerguetungBase, addVerguetungEintrag, deleteVerguetungEintrag, addLeistungsnotiz,
  BESCHAEFTIGUNGSARTEN, EINTRAG_TYPEN, NOTIZ_TYPEN, eintragTyp, notizTyp,
  currentMonth, monthLabel, type VerguetungEintrag,
} from "@/lib/verguetung";
import { Section, StatCard, EmptyState } from "@/components/detail/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const toneCls: Record<string, string> = {
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
  muted: "bg-muted text-muted-foreground",
};

export function VerguetungTab({
  mitarbeiterId,
  auftraege,
  umsatzMap,
  canViewPerf,
}: {
  mitarbeiterId: string;
  auftraege: AuftragRow[];
  umsatzMap: Record<string, number>;
  canViewPerf: boolean;
}) {
  const { user, can } = useAuth();
  const qc = useQueryClient();

  const canEditBase = can(PERM.gehaltEdit);
  const canEditVerg = can(PERM.verguetungEdit) || can(PERM.verguetungBonus) || can(PERM.verguetungAbzuege);

  const { data: base } = useQuery(verguetungBaseQuery(mitarbeiterId, true));
  const { data: eintraege = [] } = useQuery(verguetungEintraegeQuery(mitarbeiterId, true));
  const { data: notizen = [] } = useQuery(leistungsnotizenQuery(mitarbeiterId, canViewPerf));

  // ---- base data form ----
  const [grundlohn, setGrundlohn] = useState<string>("");
  const [stundenlohn, setStundenlohn] = useState<string>("");
  const [sollstunden, setSollstunden] = useState<string>("");
  const [eintritt, setEintritt] = useState<string>("");
  const [art, setArt] = useState<string>("");
  const [steuerNotiz, setSteuerNotiz] = useState<string>("");
  const [interneNotiz, setInterneNotiz] = useState<string>("");
  const [eigeneSichtbar, setEigeneSichtbar] = useState<boolean>(false);
  const [savingBase, setSavingBase] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // hydrate form once base loads
  if (base && loadedFor !== base.id) {
    setGrundlohn(base.grundlohn?.toString() ?? "");
    setStundenlohn(base.stundenlohn?.toString() ?? "");
    setSollstunden(base.sollstunden?.toString() ?? "");
    setEintritt(base.eintrittsdatum ?? "");
    setArt(base.beschaeftigungsart ?? "");
    setSteuerNotiz(base.steuer_notizen ?? "");
    setInterneNotiz(base.interne_notizen ?? "");
    setEigeneSichtbar(base.eigene_sichtbar);
    setLoadedFor(base.id);
  }

  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  const saveBase = async () => {
    setSavingBase(true);
    try {
      await upsertVerguetungBase(mitarbeiterId, {
        grundlohn: num(grundlohn),
        stundenlohn: num(stundenlohn),
        sollstunden: num(sollstunden),
        eintrittsdatum: eintritt || null,
        beschaeftigungsart: art || null,
        steuer_notizen: steuerNotiz || null,
        interne_notizen: interneNotiz || null,
        eigene_sichtbar: eigeneSichtbar,
      });
      await qc.invalidateQueries({ queryKey: ["verguetung_base", mitarbeiterId] });
      toast.success("Gespeichert.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht gespeichert werden.");
    } finally {
      setSavingBase(false);
    }
  };

  // ---- monthly summary ----
  const [monat, setMonat] = useState<string>(currentMonth());
  const monthsAvailable = useMemo(() => {
    const set = new Set<string>([currentMonth()]);
    eintraege.forEach((e) => set.add(e.monat));
    return Array.from(set).sort().reverse();
  }, [eintraege]);

  const summary = useMemo(() => {
    const monthEntries = eintraege.filter((e) => e.monat === monat);
    const grund = base?.grundlohn ?? 0;
    let plus = 0;
    let minus = 0;
    monthEntries.forEach((e) => {
      const t = eintragTyp(e.typ);
      if (t.sign >= 0) plus += Number(e.betrag);
      else minus += Number(e.betrag);
    });
    return { grund, plus, minus, total: grund + plus - minus, count: monthEntries.length };
  }, [eintraege, monat, base]);

  // ---- entries dialog ----
  const [entryOpen, setEntryOpen] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<VerguetungEintrag | null>(null);

  // ---- performance ----
  const perf = useMemo(() => {
    const done = auftraege.filter((a) => a.abgeschlossen_am);
    const open = auftraege.filter((a) => !a.abgeschlossen_am);
    const umsatz = auftraege.reduce((s, a) => s + (umsatzMap[a.id] ?? 0), 0);
    const paidEvents = auftraege.filter((a) => a.bezahlt).length;
    const projects = new Set(auftraege.map((a) => a.projekt_id).filter(Boolean)).size;
    const workedDays = new Set(
      done.filter((a) => a.abgeschlossen_am).map((a) => new Date(a.abgeschlossen_am!).toDateString()),
    ).size;
    const total = done.length + open.length;
    return {
      done: done.length,
      open: open.length,
      umsatz,
      paidEvents,
      projects,
      workedDays,
      avgPerAuftrag: done.length ? umsatz / done.length : 0,
      avgPerDay: workedDays ? umsatz / workedDays : 0,
      completionRate: total ? Math.round((done.length / total) * 100) : 0,
    };
  }, [auftraege, umsatzMap]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mr-1.5 inline h-3.5 w-3.5" />
        Interne Vergütungsübersicht – dient nur der Einschätzung und ersetzt keine Lohnabrechnung (z. B. Lexware).
      </div>

      {/* Base data */}
      <Section
        title="Grunddaten"
        icon={Euro}
        action={canEditBase ? (
          <Button size="sm" onClick={saveBase} disabled={savingBase}>
            {savingBase ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Speichern
          </Button>
        ) : undefined}
      >
        <fieldset disabled={!canEditBase} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium">Grundlohn (Brutto) / Monat</span>
            <Input value={grundlohn} onChange={(e) => setGrundlohn(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Stundenlohn (optional)</span>
            <Input value={stundenlohn} onChange={(e) => setStundenlohn(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Sollstunden / Monat</span>
            <Input value={sollstunden} onChange={(e) => setSollstunden(e.target.value)} placeholder="0" inputMode="decimal" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Eintrittsdatum</span>
            <Input type="date" value={eintritt} onChange={(e) => setEintritt(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Beschäftigungsart</span>
            <Select value={art || undefined} onValueChange={setArt}>
              <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
              <SelectContent>
                {BESCHAEFTIGUNGSARTEN.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-3">
            <span className="text-sm font-medium">Steuerliche Notizen</span>
            <Textarea value={steuerNotiz} onChange={(e) => setSteuerNotiz(e.target.value)} rows={2} />
          </label>
          <label className="space-y-1 sm:col-span-2 lg:col-span-3">
            <span className="text-sm font-medium">Interne Notizen</span>
            <Textarea value={interneNotiz} onChange={(e) => setInterneNotiz(e.target.value)} rows={2} />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <Switch checked={eigeneSichtbar} onCheckedChange={setEigeneSichtbar} id="eigene" />
            <label htmlFor="eigene" className="text-sm">Mitarbeiter darf eigene Vergütung sehen</label>
          </div>
        </fieldset>
      </Section>

      {/* Variable entries */}
      <Section
        title="Variable Vergütung"
        icon={Calculator}
        action={canEditVerg ? (
          <Button size="sm" onClick={() => setEntryOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Eintrag</Button>
        ) : undefined}
      >
        {eintraege.length === 0 ? (
          <EmptyState>Keine variablen Vergütungseinträge.</EmptyState>
        ) : (
          <div className="divide-y divide-border">
            {eintraege.map((e) => {
              const t = eintragTyp(e.typ);
              return (
                <div key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="badge bg-muted text-foreground">{t.label}</span>
                  <span className="min-w-0 flex-1 truncate">{e.beschreibung || "—"}</span>
                  <span className="text-xs text-muted-foreground">{monthLabel(e.monat)}</span>
                  <span className={cn("font-semibold tabular-nums", t.sign >= 0 ? "text-success" : "text-destructive")}>
                    {t.sign >= 0 ? "+" : "−"}{fmtEuro(Number(e.betrag))}
                  </span>
                  {canEditVerg && (
                    <button onClick={() => setDeleteEntry(e)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Monthly summary */}
      <Section
        title="Monatsübersicht"
        icon={Calculator}
        action={
          <Select value={monat} onValueChange={setMonat}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthsAvailable.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      >
        <div className="space-y-1.5 text-sm">
          <Row label="Grundlohn" value={fmtEuro(summary.grund)} />
          <Row label="Boni / Prämien / Spesen / Erstattungen" value={`+ ${fmtEuro(summary.plus)}`} tone="success" />
          <Row label="Abzüge / Vorschüsse / Abschläge" value={`− ${fmtEuro(summary.minus)}`} tone="destructive" />
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
            <span className="font-bold">Geschätzte interne Auszahlung</span>
            <span className="text-lg font-extrabold text-primary tabular-nums">{fmtEuro(summary.total)}</span>
          </div>
          <p className="pt-1 text-[11px] text-muted-foreground">Nur interne Schätzung – keine verbindliche Lohnabrechnung.</p>
        </div>
      </Section>

      {/* Performance */}
      {canViewPerf && (
        <>
          <Section title="Leistungsübersicht" icon={TrendingUp}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Erledigte Aufträge" value={perf.done} tone="success" />
              <StatCard label="Offene Aufträge" value={perf.open} tone="warning" />
              <StatCard label="Umsatz generiert" value={fmtEuro(perf.umsatz)} tone="primary" />
              <StatCard label="Zahlungsereignisse" value={perf.paidEvents} />
              <StatCard label="Projekte" value={perf.projects} />
              <StatCard label="Arbeitstage" value={perf.workedDays} />
              <StatCard label="Ø Umsatz / Auftrag" value={fmtEuro(perf.avgPerAuftrag)} />
              <StatCard label="Ø Umsatz / Tag" value={fmtEuro(perf.avgPerDay)} />
              <StatCard label="Abschlussquote" value={`${perf.completionRate} %`} tone="primary" />
            </div>
          </Section>

          {/* Bonus / penalty notes */}
          <Section
            title="Bewertung & Notizen"
            icon={Award}
            action={canEditVerg ? <AddNotizButton mitarbeiterId={mitarbeiterId} userId={user?.id ?? null} onDone={() => qc.invalidateQueries({ queryKey: ["leistungsnotizen", mitarbeiterId] })} /> : undefined}
          >
            {notizen.length === 0 ? (
              <EmptyState>Noch keine Notizen erfasst.</EmptyState>
            ) : (
              <div className="space-y-2.5">
                {notizen.map((n) => {
                  const t = notizTyp(n.typ);
                  return (
                    <div key={n.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={cn("badge", toneCls[t.tone])}>{t.label}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(n.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{n.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}

      {/* Add entry dialog */}
      <EntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        mitarbeiterId={mitarbeiterId}
        userId={user?.id ?? null}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["verguetung_eintraege", mitarbeiterId] });
        }}
      />

      <AlertDialog open={!!deleteEntry} onOpenChange={(o) => !o && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteEntry) return;
                try {
                  await deleteVerguetungEintrag(deleteEntry.id);
                  toast.success("Gelöscht.");
                  qc.invalidateQueries({ queryKey: ["verguetung_eintraege", mitarbeiterId] });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Fehler");
                }
                setDeleteEntry(null);
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", tone === "success" && "text-success", tone === "destructive" && "text-destructive")}>{value}</span>
    </div>
  );
}

function EntryDialog({
  open, onOpenChange, mitarbeiterId, userId, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mitarbeiterId: string;
  userId: string | null;
  onDone: () => void;
}) {
  const [typ, setTyp] = useState<string>("bonus");
  const [betrag, setBetrag] = useState<string>("");
  const [monat, setMonat] = useState<string>(currentMonth());
  const [datum, setDatum] = useState<string>(new Date().toISOString().slice(0, 10));
  const [beschreibung, setBeschreibung] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const b = Number(betrag.replace(",", "."));
    if (!b || b <= 0) return toast.error("Bitte einen gültigen Betrag eingeben.");
    setBusy(true);
    try {
      await addVerguetungEintrag(
        { mitarbeiter_id: mitarbeiterId, typ, betrag: b, monat, datum, beschreibung: beschreibung || null },
        userId,
      );
      toast.success("Gespeichert.");
      onDone();
      onOpenChange(false);
      setBetrag(""); setBeschreibung(""); setTyp("bonus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vergütungseintrag</DialogTitle>
          <DialogDescription>Bonus, Prämie, Abzug, Vorschuss und weitere Positionen.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Typ</span>
            <Select value={typ} onValueChange={setTyp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EINTRAG_TYPEN.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Betrag (€)</span>
            <Input value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Monat</span>
            <Input type="month" value={monat} onChange={(e) => setMonat(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Datum</span>
            <Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">Beschreibung</span>
            <Textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={2} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddNotizButton({
  mitarbeiterId, userId, onDone,
}: {
  mitarbeiterId: string;
  userId: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [typ, setTyp] = useState<string>("positiv");
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) return toast.error("Bitte einen Text eingeben.");
    setBusy(true);
    try {
      await addLeistungsnotiz(mitarbeiterId, typ, text.trim(), userId);
      toast.success("Gespeichert.");
      onDone();
      setOpen(false);
      setText(""); setTyp("positiv");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><MessageSquarePlus className="mr-1.5 h-4 w-4" /> Notiz</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bewertung / Notiz</DialogTitle>
            <DialogDescription>Positive/negative Bewertung, Bonus-Empfehlung oder Abzugsgrund. Bleibt dauerhaft gespeichert.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="space-y-1">
              <span className="text-sm font-medium">Typ</span>
              <Select value={typ} onValueChange={setTyp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTIZ_TYPEN.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Text</span>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

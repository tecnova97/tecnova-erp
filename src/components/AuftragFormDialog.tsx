import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { kundenQuery, projekteQuery, mitarbeiterQuery, type AuftragRow } from "@/lib/queries";
import { useStatuses } from "@/lib/status";
import { logHistorie } from "@/lib/historie";
import { initials } from "@/lib/erp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function AuftragFormDialog({
  open,
  onOpenChange,
  auftrag,
  defaultTerminStart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  auftrag?: AuftragRow | null;
  defaultTerminStart?: string;
}) {
  const qc = useQueryClient();
  const { data: kunden = [] } = useQuery(kundenQuery());
  const { data: projekte = [] } = useQuery(projekteQuery());
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const { active: statuses } = useStatuses();
  const editing = !!auftrag;

  const [form, setForm] = useState({
    titel: "",
    beschreibung: "",
    status: "neu",
    kunde_id: "",
    projekt_id: "",
    kunde_name: "",
    kunde_telefon: "",
    kunde_festnetz: "",
    kunde_email: "",
    wichtiginfo: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    termin_start: "",
    termin_ende: "",
    interne_notizen: "",
  });
  const [assigned, setAssigned] = useState<string[]>([]);
  const [workerSearch, setWorkerSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        titel: auftrag?.titel ?? "",
        beschreibung: auftrag?.beschreibung ?? "",
        status: auftrag?.status ?? statuses[0]?.key ?? "neu",
        kunde_id: auftrag?.kunde_id ?? "",
        projekt_id: auftrag?.projekt_id ?? "",
        kunde_name: auftrag?.kunde_name ?? "",
        kunde_telefon: auftrag?.kunde_telefon ?? "",
        kunde_festnetz: auftrag?.kunde_festnetz ?? "",
        kunde_email: auftrag?.kunde_email ?? "",
        wichtiginfo: auftrag?.wichtiginfo ?? "",
        strasse: auftrag?.strasse ?? "",
        hausnummer: auftrag?.hausnummer ?? "",
        plz: auftrag?.plz ?? "",
        ort: auftrag?.ort ?? "",
        termin_start: toLocalInput(auftrag?.termin_start ?? defaultTerminStart),
        termin_ende: toLocalInput(auftrag?.termin_ende),
        interne_notizen: auftrag?.interne_notizen ?? "",
      });
      setAssigned(
        (auftrag?.zuweisungen ?? [])
          .map((z) => z.mitarbeiter?.id)
          .filter(Boolean) as string[],
      );
      setWorkerSearch("");
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, auftrag]);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  // Only active workers are assignable; already-assigned inactive ones stay visible.
  const assignableWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    return mitarbeiter
      .filter((m) => m.aktiv !== false || assigned.includes(m.id))
      .filter((m) =>
        !q ? true : `${m.vorname} ${m.nachname} ${m.position ?? ""}`.toLowerCase().includes(q),
      );
  }, [mitarbeiter, workerSearch, assigned]);

  const handleSubmit = async () => {
    if (!form.titel.trim()) {
      toast.error("Bitte einen Titel eingeben.");
      return;
    }
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const payload = {
        titel: form.titel.trim(),
        beschreibung: form.beschreibung || null,
        status: form.status,
        kunde_id: form.kunde_id || null,
        projekt_id: form.projekt_id || null,
        kunde_name: form.kunde_name || null,
        kunde_telefon: form.kunde_telefon || null,
        kunde_festnetz: form.kunde_festnetz || null,
        kunde_email: form.kunde_email || null,
        wichtiginfo: form.wichtiginfo || null,
        strasse: form.strasse || null,
        hausnummer: form.hausnummer || null,
        plz: form.plz || null,
        ort: form.ort || null,
        termin_start: form.termin_start ? new Date(form.termin_start).toISOString() : null,
        termin_ende: form.termin_ende ? new Date(form.termin_ende).toISOString() : null,
        interne_notizen: form.interne_notizen || null,
      };

      let auftragId = auftrag?.id;
      if (editing && auftragId) {
        const { error } = await supabase
          .from("auftraege")
          .update(payload as never)
          .eq("id", auftragId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("auftraege")
          .insert({ ...payload, created_by: uid } as never)
          .select("id")
          .single();
        if (error) throw error;
        auftragId = (data as { id: string }).id;
      }

      if (auftragId) {
        await supabase.from("auftrag_mitarbeiter").delete().eq("auftrag_id", auftragId);
        if (assigned.length) {
          const { error: amErr } = await supabase
            .from("auftrag_mitarbeiter")
            .insert(assigned.map((m) => ({ auftrag_id: auftragId!, mitarbeiter_id: m })));
          if (amErr) throw amErr;
        }
        await logHistorie(
          auftragId,
          editing ? "Auftrag bearbeitet" : "Auftrag erstellt",
          editing ? "Auftragsdaten aktualisiert" : "Auftrag im System angelegt",
          editing ? "sonstiges" : "erstellt",
        );
      }

      toast.success("Gespeichert");
      setDirty(false);
      qc.invalidateQueries();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? `Speichern fehlgeschlagen: ${err.message}` : "Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Auftrag bearbeiten" : "Neuer Auftrag"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Auftrag ${auftrag?.auftragsnummer} bearbeiten.`
              : "Erfasse einen neuen Auftrag für das Team."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titel *</Label>
            <Input value={form.titel} onChange={(e) => set("titel", e.target.value)} placeholder="z. B. Hausanschluss Glasfaser" />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.farbe }} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Auftraggeber</Label>
              <Select value={form.kunde_id || "none"} onValueChange={(v) => set("kunde_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Auftraggeber wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Kein Auftraggeber —</SelectItem>
                  {kunden.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Projekt</Label>
              <Select value={form.projekt_id || "none"} onValueChange={(v) => set("projekt_id", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Kein Projekt —</SelectItem>
                  {projekte.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kunde</Label>
              <Input value={form.kunde_name} onChange={(e) => set("kunde_name", e.target.value)} placeholder="z. B. Fam. Müller" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon (mobil)</Label>
              <Input value={form.kunde_telefon} onChange={(e) => set("kunde_telefon", e.target.value)} placeholder="+49 …" />
            </div>
            <div className="space-y-1.5">
              <Label>Festnetz</Label>
              <Input value={form.kunde_festnetz} onChange={(e) => set("kunde_festnetz", e.target.value)} placeholder="z. B. 0221 …" />
            </div>
            <div className="space-y-1.5">
              <Label>E-Mail</Label>
              <Input value={form.kunde_email} onChange={(e) => set("kunde_email", e.target.value)} placeholder="kunde@…" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[3fr_1fr]">
            <div className="space-y-1.5">
              <Label>Straße</Label>
              <Input value={form.strasse} onChange={(e) => set("strasse", e.target.value)} placeholder="z. B. Hauptstraße" />
            </div>
            <div className="space-y-1.5">
              <Label>Hausnummer</Label>
              <Input value={form.hausnummer} onChange={(e) => set("hausnummer", e.target.value)} placeholder="z. B. 12a" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_3fr]">
            <div className="space-y-1.5">
              <Label>PLZ</Label>
              <Input value={form.plz} onChange={(e) => set("plz", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ort</Label>
              <Input value={form.ort} onChange={(e) => set("ort", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Termin Beginn</Label>
              <DateTimePicker value={form.termin_start} onChange={(v) => set("termin_start", v)} />
            </div>
            <div className="space-y-1.5">
              <Label>Termin Ende</Label>
              <DateTimePicker value={form.termin_ende} onChange={(v) => set("termin_ende", v)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Wichtiginfo</Label>
            <Textarea value={form.wichtiginfo} onChange={(e) => set("wichtiginfo", e.target.value)} rows={2} placeholder="Hinweise, die das Team unbedingt beachten muss (z. B. Hund, Schlüssel beim Nachbarn)" />
          </div>

          <div className="space-y-1.5">
            <Label>Beschreibung</Label>
            <Textarea value={form.beschreibung} onChange={(e) => set("beschreibung", e.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Zugewiesene Mitarbeiter</Label>
              {assigned.length > 0 && (
                <span className="text-xs text-muted-foreground">{assigned.length} ausgewählt</span>
              )}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                placeholder="Mitarbeiter suchen…"
                className="pl-8"
              />
            </div>
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {assignableWorkers.map((m) => {
                const on = assigned.includes(m.id);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => {
                      setAssigned((a) => (on ? a.filter((x) => x !== m.id) : [...a, m.id]));
                      setDirty(true);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm font-medium transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span
                      className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: m.farbe }}
                    >
                      {initials(m.vorname, m.nachname)}
                    </span>
                    {m.vorname} {m.nachname}
                    {m.aktiv === false && <span className="text-[10px] text-muted-foreground">(inaktiv)</span>}
                  </button>
                );
              })}
              {assignableWorkers.length === 0 && (
                <span className="text-sm text-muted-foreground">Keine aktiven Mitarbeiter gefunden.</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Interne Notizen</Label>
            <Textarea value={form.interne_notizen} onChange={(e) => set("interne_notizen", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className={cn("text-sm font-medium", dirty ? "text-warning" : "text-transparent")}>
            {dirty ? "Nicht gespeicherte Änderungen" : "Alle Änderungen gespeichert"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={busy || (editing && !dirty)}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? "Speichern…" : editing ? "Speichern" : "Auftrag erstellen"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

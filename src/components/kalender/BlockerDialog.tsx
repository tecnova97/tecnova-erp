import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { mitarbeiterQuery } from "@/lib/queries";
import {
  BLOCKER_TYPEN,
  blockerTyp,
  createBlocker,
  updateBlocker,
  deleteBlocker,
  type BlockerRow,
} from "@/lib/blocker";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-picker";
import { ColorPicker } from "@/components/settings/ColorPicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Create/edit a Blocker (Sperrzeit). When `existing` is provided the dialog
 * edits, otherwise it creates a new blocker for the given defaults.
 */
export function BlockerDialog({
  open,
  onOpenChange,
  existing,
  defaultMitarbeiterId,
  defaultStart,
  defaultEnd,
  defaultTyp,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing?: BlockerRow | null;
  defaultMitarbeiterId?: string;
  defaultStart?: Date;
  defaultEnd?: Date;
  defaultTyp?: string;
}) {
  const qc = useQueryClient();
  const { can, role } = useAuth();
  const { data: mitarbeiter = [] } = useQuery(mitarbeiterQuery());
  const canDelete = role === "owner" || can(PERM.kalenderBlockerDelete);

  const [mitarbeiterId, setMitarbeiterId] = useState("");
  const [typ, setTyp] = useState("privat");
  const [titel, setTitel] = useState("");
  const [grund, setGrund] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [farbe, setFarbe] = useState("#64748b");
  const [notiz, setNotiz] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setMitarbeiterId(existing.mitarbeiter_id);
      setTyp(existing.typ);
      setTitel(existing.titel);
      setGrund(existing.grund ?? "");
      setStart(toLocalInput(existing.start_zeit));
      setEnd(toLocalInput(existing.end_zeit));
      setFarbe(existing.farbe);
      setNotiz(existing.notiz ?? "");
    } else {
      const t = defaultTyp ?? "privat";
      setMitarbeiterId(defaultMitarbeiterId ?? mitarbeiter[0]?.id ?? "");
      setTyp(t);
      setTitel(blockerTyp(t).label);
      setGrund("");
      setStart(defaultStart ? format(defaultStart, "yyyy-MM-dd'T'HH:mm") : "");
      setEnd(defaultEnd ? format(defaultEnd, "yyyy-MM-dd'T'HH:mm") : "");
      setFarbe(blockerTyp(t).farbe);
      setNotiz("");
    }
  }, [open, existing, defaultMitarbeiterId, defaultStart, defaultEnd, defaultTyp, mitarbeiter]);

  const onTypChange = (key: string) => {
    setTyp(key);
    const t = blockerTyp(key);
    setFarbe(t.farbe);
    if (!titel || BLOCKER_TYPEN.some((b) => b.label === titel)) setTitel(t.label);
  };

  const save = async () => {
    if (!mitarbeiterId || !titel || !start || !end) {
      toast.error("Bitte Mitarbeiter, Titel, Start und Ende angeben.");
      return;
    }
    if (new Date(end) <= new Date(start)) {
      toast.error("Das Ende muss nach dem Start liegen.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        mitarbeiter_id: mitarbeiterId,
        titel,
        typ,
        grund: grund || null,
        start_zeit: new Date(start).toISOString(),
        end_zeit: new Date(end).toISOString(),
        farbe,
        notiz: notiz || null,
      };
      if (existing) await updateBlocker(existing.id, payload);
      else await createBlocker(payload);
      await qc.invalidateQueries({ queryKey: ["blocker"] });
      toast.success("Gespeichert");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setSaving(true);
    try {
      await deleteBlocker(existing.id);
      await qc.invalidateQueries({ queryKey: ["blocker"] });
      toast.success("Blocker gelöscht");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Blocker bearbeiten" : "Blocker hinzufügen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Mitarbeiter">
            <select
              value={mitarbeiterId}
              onChange={(e) => setMitarbeiterId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="">Mitarbeiter wählen…</option>
              {mitarbeiter.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.vorname} {m.nachname}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Typ">
            <div className="flex flex-wrap gap-1.5">
              {BLOCKER_TYPEN.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onTypChange(t.key)}
                  className="rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors"
                  style={
                    typ === t.key
                      ? { backgroundColor: t.farbe, color: "#fff", borderColor: t.farbe }
                      : { color: t.farbe, borderColor: `${t.farbe}55` }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Titel">
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            />
          </Field>

          <Field label="Grund (optional)">
            <input
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <DateTimePicker value={start} onChange={setStart} />
            </Field>
            <Field label="Ende">
              <DateTimePicker value={end} onChange={setEnd} />
            </Field>
          </div>

          <Field label="Farbe">
            <ColorPicker value={farbe} onChange={setFarbe} />
          </Field>

          <Field label="Notiz (optional)">
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
            />
          </Field>
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          {existing && canDelete ? (
            <Button variant="ghost" className="text-destructive" onClick={remove} disabled={saving}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Löschen
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

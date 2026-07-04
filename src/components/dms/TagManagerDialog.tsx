import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Check } from "lucide-react";
import { dokumentTagsQuery, createTag, updateTag, deleteTag } from "@/lib/dms";
import { toast } from "sonner";

const PRESET_COLORS = ["#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#e11d48", "#64748b"];

export function TagManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: tags = [] } = useQuery(dokumentTagsQuery());
  const [name, setName] = useState("");
  const [farbe, setFarbe] = useState(PRESET_COLORS[5]);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["dokument_tags"] });

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createTag(name, farbe);
      setName("");
      await refresh();
      toast.success("Tag erstellt");
    } catch (e) { toast.error("Fehlgeschlagen", { description: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Tag löschen? Zuweisungen werden entfernt.")) return;
    try { await deleteTag(id); await refresh(); toast.success("Tag gelöscht"); }
    catch (e) { toast.error("Fehlgeschlagen", { description: (e as Error).message }); }
  };

  const recolor = async (id: string, color: string) => {
    try { await updateTag(id, { farbe: color }); await refresh(); }
    catch (e) { toast.error("Fehlgeschlagen", { description: (e as Error).message }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tags verwalten</DialogTitle>
          <DialogDescription>Eigene Tags anlegen und farblich kennzeichnen (z. B. Rechnung, Aufmaß, eSASS).</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neuer Tag-Name" onKeyDown={(e) => e.key === "Enter" && add()} />
            <Button onClick={add} disabled={busy}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => setFarbe(c)} className="grid h-6 w-6 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-background"
                style={{ backgroundColor: c, boxShadow: farbe === c ? `0 0 0 2px ${c}` : "none" }} title={c}>
                {farbe === c && <Check className="h-3 w-3 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <ul className="max-h-72 space-y-1.5 overflow-y-auto">
          {tags.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: t.farbe }}>{t.name}</span>
              <div className="ml-auto flex items-center gap-1">
                {PRESET_COLORS.map((c) => (
                  <button key={c} onClick={() => recolor(t.id, c)} className="h-4 w-4 rounded-full" style={{ backgroundColor: c }} title="Farbe ändern" />
                ))}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </li>
          ))}
          {tags.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Noch keine Tags.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

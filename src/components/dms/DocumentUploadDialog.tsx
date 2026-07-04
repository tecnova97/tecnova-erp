import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Paperclip } from "lucide-react";
import {
  createDocument, dokumentTagsQuery, ENTITY_LABEL, type DocEntityType,
} from "@/lib/dms";
import { useDmsEntities } from "./useDmsEntities";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { fmtBytes } from "@/lib/erp";
import { toast } from "sonner";

const LINKABLE: DocEntityType[] = ["auftrag", "projekt", "auftraggeber", "mitarbeiter", "rechnung_gruppe", "company"];

export function DocumentUploadDialog({
  open,
  onOpenChange,
  presetLink,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  presetLink?: { entity_type: DocEntityType; entity_id: string | null };
}) {
  const qc = useQueryClient();
  const { can, canAny } = useAuth();
  const { options } = useDmsEntities();
  const { data: tags = [] } = useQuery(dokumentTagsQuery());
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [notiz, setNotiz] = useState("");
  const [vertraulich, setVertraulich] = useState(false);
  const [workerSichtbar, setWorkerSichtbar] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [links, setLinks] = useState<{ entity_type: DocEntityType; entity_id: string | null }[]>(
    presetLink ? [presetLink] : [],
  );
  const [entityType, setEntityType] = useState<DocEntityType>("auftrag");
  const [entityId, setEntityId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const canConfidential = canAny([PERM.dokumenteConfidential]) || can("owner");

  const reset = () => {
    setFile(null); setName(""); setNotiz(""); setVertraulich(false); setWorkerSichtbar(false);
    setTagIds([]); setLinks(presetLink ? [presetLink] : []); setEntityId("");
  };

  const pick = (f: File | null) => {
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const addLink = () => {
    if (entityType !== "company" && !entityId) return;
    const id = entityType === "company" ? "company" : entityId;
    if (links.some((l) => l.entity_type === entityType && l.entity_id === id)) return;
    setLinks((p) => [...p, { entity_type: entityType, entity_id: id }]);
    setEntityId("");
  };

  const submit = async () => {
    if (!file) { toast.error("Bitte eine Datei auswählen"); return; }
    setBusy(true);
    try {
      await createDocument({
        name: name.trim() || file.name,
        notiz, vertraulich, worker_sichtbar: workerSichtbar,
        file, links, tagIds,
      });
      await qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Dokument hochgeladen");
      reset();
      onOpenChange(false);
    } catch (e) { toast.error("Upload fehlgeschlagen", { description: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const labelFor = (l: { entity_type: DocEntityType; entity_id: string | null }) => {
    const opt = options[l.entity_type]?.find((o) => o.id === l.entity_id);
    return `${ENTITY_LABEL[l.entity_type]}: ${opt?.label ?? (l.entity_type === "company" ? "TecNova" : "—")}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dokument hochladen</DialogTitle>
          <DialogDescription>Datei hochladen, verknüpfen und verschlagworten.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">{fmtBytes(file.size)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFile(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" /> Datei auswählen
              </Button>
            )}
          </div>

          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dokumentname" />
          </div>

          <div>
            <Label>Notiz</Label>
            <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} placeholder="Optionale Notiz" />
          </div>

          {/* Links */}
          <div>
            <Label>Verknüpfungen</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {links.map((l, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {labelFor(l)}
                  <button onClick={() => setLinks((p) => p.filter((_, x) => x !== i))}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Select value={entityType} onValueChange={(v) => { setEntityType(v as DocEntityType); setEntityId(""); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{LINKABLE.map((t) => <SelectItem key={t} value={t}>{ENTITY_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
              {entityType !== "company" && (
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Auswählen…" /></SelectTrigger>
                  <SelectContent>
                    {(options[entityType] ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" onClick={addLink}>Hinzufügen</Button>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <Label>Tags</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {tags.map((t) => {
                  const active = tagIds.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => setTagIds((p) => active ? p.filter((x) => x !== t.id) : [...p, t.id])}
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium transition"
                      style={{ backgroundColor: active ? t.farbe : "transparent", color: active ? "#fff" : t.farbe, border: `1px solid ${t.farbe}` }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="ws" checked={workerSichtbar} onCheckedChange={(v) => setWorkerSichtbar(Boolean(v))} />
            <Label htmlFor="ws" className="font-normal">Für zugewiesene Monteure sichtbar</Label>
          </div>
          {canConfidential && (
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="vt" className="font-normal">Vertraulich</Label>
              <Switch id="vt" checked={vertraulich} onCheckedChange={setVertraulich} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={busy || !file}>{busy ? "Lädt…" : "Hochladen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

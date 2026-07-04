import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Eye, Upload, Trash2, Archive, ArchiveRestore, Save, History, Lock, HardHat, Loader2,
} from "lucide-react";
import {
  type Dokument, dokumentTagsQuery, currentVersion, fileCategory, FILE_CATEGORY_LABEL,
  updateDocument, deleteDocument, uploadNewVersion, setDocumentTags, type DocVersion,
} from "@/lib/dms";
import { profilesQuery } from "@/lib/queries";
import { useDmsEntities } from "./useDmsEntities";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";
import { fmtBytes, fmtDateTime } from "@/lib/erp";
import { ENTITY_LABEL } from "@/lib/dms";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { toast } from "sonner";

export function DocumentDetailSheet({
  doc, open, onOpenChange,
}: { doc: Dokument | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { can, canAny } = useAuth();
  const { nameOf } = useDmsEntities();
  const { data: tags = [] } = useQuery(dokumentTagsQuery());
  const { data: profiles = [] } = useQuery(profilesQuery());
  const verRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [notiz, setNotiz] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [vertraulich, setVertraulich] = useState(false);
  const [workerSichtbar, setWorkerSichtbar] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<DocVersion | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner = can("owner");
  const canRename = canAny([PERM.dokumenteRename]) || isOwner;
  const canNotes = canAny([PERM.dokumenteNotes]) || isOwner;
  const canUpload = canAny([PERM.dokumenteUpload]) || isOwner;
  const canDelete = canAny([PERM.dokumenteDelete]) || isOwner;
  const canDownload = canAny([PERM.dokumenteDownload]) || isOwner;
  const canConfidential = canAny([PERM.dokumenteConfidential]) || isOwner;
  const canTags = canAny([PERM.dokumenteTagsManage]) || isOwner;

  useEffect(() => {
    if (doc) {
      setName(doc.name); setNotiz(doc.notiz ?? "");
      setTagIds(doc.tagIds); setVertraulich(doc.vertraulich); setWorkerSichtbar(doc.worker_sichtbar);
    }
  }, [doc]);

  if (!doc) return null;

  const uploaderName = (uid: string | null) => {
    if (!uid) return "—";
    const p = profiles.find((x) => x.id === uid);
    if (!p) return "Unbekannt";
    return `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "Unbekannt";
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["documents"] });

  const save = async () => {
    setBusy(true);
    try {
      await updateDocument(doc.id, {
        name: name.trim() || doc.name,
        notiz: notiz.trim() || null,
        vertraulich, worker_sichtbar: workerSichtbar,
      });
      if (canTags) await setDocumentTags(doc.id, tagIds, doc.tagIds);
      await refresh();
      toast.success("Gespeichert");
    } catch (e) { toast.error("Fehlgeschlagen", { description: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const onNewVersion = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      const max = Math.max(...doc.versions.map((v) => v.version), 0);
      await uploadNewVersion(doc.id, max, f);
      await refresh();
      toast.success(`Version ${max + 1} hochgeladen`);
    } catch (e) { toast.error("Fehlgeschlagen", { description: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const toggleArchive = async () => {
    try { await updateDocument(doc.id, { archiviert: !doc.archiviert }); await refresh(); toast.success(doc.archiviert ? "Wiederhergestellt" : "Archiviert"); }
    catch (e) { toast.error("Fehlgeschlagen", { description: (e as Error).message }); }
  };

  const del = async () => {
    if (!confirm("Dokument endgültig löschen? Alle Versionen werden entfernt.")) return;
    try { await deleteDocument(doc); await refresh(); toast.success("Gelöscht"); onOpenChange(false); }
    catch (e) { toast.error("Fehlgeschlagen", { description: (e as Error).message }); }
  };

  const versionsSorted = [...doc.versions].sort((a, b) => b.version - a.version);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 pr-6 text-left">
              <span className="truncate">{doc.name}</span>
              {doc.vertraulich && <Lock className="h-4 w-4 shrink-0 text-destructive" />}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 py-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canRename} />
            </div>

            <div>
              <Label>Notiz</Label>
              <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={3} disabled={!canNotes} />
            </div>

            {/* Tags */}
            <div>
              <Label>Tags</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {tags.map((t) => {
                  const active = tagIds.includes(t.id);
                  return (
                    <button key={t.id} disabled={!canTags}
                      onClick={() => setTagIds((p) => active ? p.filter((x) => x !== t.id) : [...p, t.id])}
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium disabled:opacity-60"
                      style={{ backgroundColor: active ? t.farbe : "transparent", color: active ? "#fff" : t.farbe, border: `1px solid ${t.farbe}` }}>
                      {t.name}
                    </button>
                  );
                })}
                {tags.length === 0 && <span className="text-xs text-muted-foreground">Keine Tags vorhanden.</span>}
              </div>
            </div>

            {/* Links */}
            <div>
              <Label>Verknüpfungen</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {doc.links.map((l) => (
                  <Badge key={l.id} variant="secondary" className="font-normal">
                    {ENTITY_LABEL[l.entity_type]}: {nameOf(l.entity_type, l.entity_id)}
                  </Badge>
                ))}
                {doc.links.length === 0 && <span className="text-xs text-muted-foreground">Keine Verknüpfungen.</span>}
              </div>
            </div>

            {/* Visibility */}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="ws" className="flex items-center gap-1.5 font-normal"><HardHat className="h-4 w-4" /> Monteure sichtbar</Label>
                <Switch id="ws" checked={workerSichtbar} onCheckedChange={setWorkerSichtbar} />
              </div>
              {canConfidential && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="vt" className="flex items-center gap-1.5 font-normal"><Lock className="h-4 w-4" /> Vertraulich</Label>
                  <Switch id="vt" checked={vertraulich} onCheckedChange={setVertraulich} />
                </div>
              )}
            </div>

            <Button onClick={save} disabled={busy} className="w-full">
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Speichern
            </Button>

            <Separator />

            {/* Versions */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><History className="h-4 w-4" /> Versionen</Label>
                {canUpload && (
                  <>
                    <input ref={verRef} type="file" className="hidden" onChange={(e) => onNewVersion(e.target.files?.[0] ?? null)} />
                    <Button variant="outline" size="sm" onClick={() => verRef.current?.click()} disabled={busy}>
                      <Upload className="mr-1 h-3.5 w-3.5" /> Neue Version
                    </Button>
                  </>
                )}
              </div>
              <ul className="space-y-1.5">
                {versionsSorted.map((v) => {
                  const cat = fileCategory(v.extension, v.mime_type);
                  return (
                    <li key={v.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <Badge variant={v.version === doc.aktuelle_version ? "default" : "outline"}>V{v.version}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{v.original_dateiname}</p>
                        <p className="text-xs text-muted-foreground">
                          {FILE_CATEGORY_LABEL[cat]} · {fmtBytes(v.groesse)} · {fmtDateTime(v.created_at)} · {uploaderName(v.uploaded_by)}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewVersion(v)}><Eye className="h-4 w-4" /></Button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={toggleArchive}>
                {doc.archiviert ? <><ArchiveRestore className="mr-1 h-4 w-4" /> Wiederherstellen</> : <><Archive className="mr-1 h-4 w-4" /> Archivieren</>}
              </Button>
              {canDelete && (
                <Button variant="outline" size="sm" className="flex-1 text-destructive" onClick={del}>
                  <Trash2 className="mr-1 h-4 w-4" /> Löschen
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Erstellt {fmtDateTime(doc.created_at)} · {uploaderName(doc.created_by)}
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <DocumentPreviewDialog
        version={previewVersion}
        open={Boolean(previewVersion)}
        onOpenChange={(v) => !v && setPreviewVersion(null)}
        canDownload={canDownload}
      />
    </>
  );
}

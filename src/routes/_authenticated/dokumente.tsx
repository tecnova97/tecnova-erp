import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RequirePermission } from "@/components/PermissionGuard";
import { PERM } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import {
  documentsQuery, dokumentTagsQuery, currentVersion, fileCategory, FILE_CATEGORY_LABEL,
  ENTITY_LABEL, type Dokument, type DocEntityType, type FileCategory,
} from "@/lib/dms";
import { profilesQuery } from "@/lib/queries";
import { useDmsEntities } from "@/components/dms/useDmsEntities";
import { DocumentUploadDialog } from "@/components/dms/DocumentUploadDialog";
import { DocumentDetailSheet } from "@/components/dms/DocumentDetailSheet";
import { TagManagerDialog } from "@/components/dms/TagManagerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtBytes, fmtDateTime } from "@/lib/erp";
import {
  FileText, FileSpreadsheet, FileImage, FileArchive, File as FileIcon,
  Upload, Tags, Search, Lock, HardHat,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dokumente")({
  head: () => ({ meta: [{ title: "Dokumente – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.dokumenteView}>
      <DokumentePage />
    </RequirePermission>
  ),
});

type TabKey = "alle" | "auftrag" | "projekt" | "auftraggeber" | "mitarbeiter" | "rechnung_gruppe" | "import" | "archiv";

const TABS: { key: TabKey; label: string }[] = [
  { key: "alle", label: "Alle Dokumente" },
  { key: "auftrag", label: "Aufträge" },
  { key: "projekt", label: "Projekte" },
  { key: "auftraggeber", label: "Auftraggeber" },
  { key: "mitarbeiter", label: "Mitarbeiter" },
  { key: "rechnung_gruppe", label: "Abrechnung" },
  { key: "import", label: "Import" },
  { key: "archiv", label: "Archiv" },
];

const CAT_ICON: Record<FileCategory, typeof FileText> = {
  pdf: FileText, image: FileImage, excel: FileSpreadsheet, word: FileText, zip: FileArchive, other: FileIcon,
};

function DokumentePage() {
  const { canAny, can } = useAuth();
  const { data: docs = [], isLoading } = useQuery(documentsQuery());
  const { data: tags = [] } = useQuery(dokumentTagsQuery());
  const { data: profiles = [] } = useQuery(profilesQuery());
  const { nameOf } = useDmsEntities();

  const [tab, setTab] = useState<TabKey>("alle");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tagMgrOpen, setTagMgrOpen] = useState(false);
  const [selected, setSelected] = useState<Dokument | null>(null);

  const canUpload = canAny([PERM.dokumenteUpload]) || can("owner");
  const canManageTags = canAny([PERM.dokumenteTagsManage]) || can("owner");

  const uploaderName = (uid: string | null) => {
    if (!uid) return "";
    const p = profiles.find((x) => x.id === uid);
    if (!p) return "";
    return `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      // tab
      if (tab === "archiv") { if (!d.archiviert) return false; }
      else {
        if (d.archiviert) return false;
        if (tab !== "alle" && !d.links.some((l) => l.entity_type === (tab as DocEntityType))) return false;
      }
      // category
      const cv = currentVersion(d);
      const cat = cv ? fileCategory(cv.extension, cv.mime_type) : "other";
      if (catFilter !== "all" && cat !== catFilter) return false;
      // tag
      if (tagFilter !== "all" && !d.tagIds.includes(tagFilter)) return false;
      // user
      if (userFilter !== "all" && d.created_by !== userFilter) return false;
      // search
      if (q) {
        const hay = [
          d.name, d.notiz ?? "",
          cv?.original_dateiname ?? "", cv?.extension ?? "",
          uploaderName(d.created_by),
          ...d.tagIds.map((id) => tags.find((t) => t.id === id)?.name ?? ""),
          ...d.links.map((l) => `${ENTITY_LABEL[l.entity_type]} ${nameOf(l.entity_type, l.entity_id)}`),
          cv ? fmtDateTime(cv.created_at) : "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, tab, search, catFilter, tagFilter, userFilter, tags, nameOf]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dokumente</h1>
          <p className="text-sm text-muted-foreground">Zentrale Dokumentenverwaltung für alle Bereiche.</p>
        </div>
        <div className="flex gap-2">
          {canManageTags && (
            <Button variant="outline" onClick={() => setTagMgrOpen(true)}><Tags className="mr-1.5 h-4 w-4" /> Tags</Button>
          )}
          {canUpload && (
            <Button onClick={() => setUploadOpen(true)}><Upload className="mr-1.5 h-4 w-4" /> Dokument hochladen</Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="flex-wrap">
          {TABS.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {/* Search & filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche: Name, Tag, Verknüpfung, Uploader…" className="pl-8" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Dateityp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {(Object.keys(FILE_CATEGORY_LABEL) as FileCategory[]).map((c) => <SelectItem key={c} value={c}>{FILE_CATEGORY_LABEL[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Tags</SelectItem>
            {tags.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Benutzer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Benutzer</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{`${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || p.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Lädt…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Keine Dokumente gefunden.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="hidden md:table-cell">Verknüpfungen</TableHead>
                <TableHead className="hidden lg:table-cell">Tags</TableHead>
                <TableHead className="hidden sm:table-cell">Version</TableHead>
                <TableHead className="hidden lg:table-cell">Größe</TableHead>
                <TableHead className="hidden md:table-cell">Hochgeladen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const cv = currentVersion(d);
                const cat = cv ? fileCategory(cv.extension, cv.mime_type) : "other";
                const Icon = CAT_ICON[cat];
                return (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => setSelected(d)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{d.name}</span>
                        {d.vertraulich && <Lock className="h-3.5 w-3.5 text-destructive" />}
                        {d.worker_sichtbar && <HardHat className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell><span className="text-xs uppercase text-muted-foreground">{cv?.extension || FILE_CATEGORY_LABEL[cat]}</span></TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {d.links.slice(0, 2).map((l) => (
                          <Badge key={l.id} variant="secondary" className="font-normal">{nameOf(l.entity_type, l.entity_id)}</Badge>
                        ))}
                        {d.links.length > 2 && <Badge variant="outline">+{d.links.length - 2}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {d.tagIds.map((id) => {
                          const t = tags.find((x) => x.id === id);
                          return t ? <span key={id} className="rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: t.farbe }}>{t.name}</span> : null;
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant="outline">V{d.aktuelle_version}</Badge></TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{fmtBytes(cv?.groesse)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{cv ? fmtDateTime(cv.created_at) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <TagManagerDialog open={tagMgrOpen} onOpenChange={setTagMgrOpen} />
      <DocumentDetailSheet doc={selected} open={Boolean(selected)} onOpenChange={(v) => !v && setSelected(null)} />
    </div>
  );
}

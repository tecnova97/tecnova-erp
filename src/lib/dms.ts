import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ----------------------------------------------------------------------------
// Document Management System – types
// ----------------------------------------------------------------------------
export type DocEntityType =
  | "auftrag" | "projekt" | "auftraggeber" | "mitarbeiter"
  | "rechnung_gruppe" | "company" | "import" | "vehicle" | "equipment";

export const ENTITY_LABEL: Record<DocEntityType, string> = {
  auftrag: "Auftrag",
  projekt: "Projekt",
  auftraggeber: "Auftraggeber",
  mitarbeiter: "Mitarbeiter",
  rechnung_gruppe: "Rechnungsgruppe",
  company: "Firma",
  import: "Import",
  vehicle: "Fahrzeug",
  equipment: "Ausstattung",
};

export interface DocVersion {
  id: string;
  document_id: string;
  version: number;
  storage_path: string;
  original_dateiname: string;
  extension: string | null;
  mime_type: string | null;
  groesse: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DocLink {
  id: string;
  entity_type: DocEntityType;
  entity_id: string | null;
}

export interface Dokument {
  id: string;
  name: string;
  notiz: string | null;
  vertraulich: boolean;
  worker_sichtbar: boolean;
  aktuelle_version: number;
  archiviert: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  versions: DocVersion[];
  links: DocLink[];
  tagIds: string[];
}

export interface DokumentTag {
  id: string;
  name: string;
  farbe: string;
  sort_order: number;
}

// ----------------------------------------------------------------------------
// File-type categorisation
// ----------------------------------------------------------------------------
export type FileCategory = "pdf" | "image" | "excel" | "word" | "zip" | "other";

export const FILE_CATEGORY_LABEL: Record<FileCategory, string> = {
  pdf: "PDF",
  image: "Bilder",
  excel: "Excel",
  word: "Word",
  zip: "ZIP / Archiv",
  other: "Sonstige",
};

export function extOf(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename);
  return m ? m[1].toLowerCase() : "";
}

export function fileCategory(ext: string | null, mime?: string | null): FileCategory {
  const e = (ext ?? "").toLowerCase();
  const m = (mime ?? "").toLowerCase();
  if (e === "pdf" || m.includes("pdf")) return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic"].includes(e) || m.startsWith("image/")) return "image";
  if (["xls", "xlsx", "csv", "ods"].includes(e) || m.includes("spreadsheet") || m.includes("excel")) return "excel";
  if (["doc", "docx", "odt", "rtf"].includes(e) || m.includes("word") || m.includes("document")) return "word";
  if (["zip", "rar", "7z", "tar", "gz"].includes(e) || m.includes("zip") || m.includes("compressed")) return "zip";
  return "other";
}

export function currentVersion(d: Dokument): DocVersion | undefined {
  return d.versions.find((v) => v.version === d.aktuelle_version)
    ?? [...d.versions].sort((a, b) => b.version - a.version)[0];
}

// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------
export const documentsQuery = () =>
  queryOptions({
    queryKey: ["documents"],
    queryFn: async (): Promise<Dokument[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          id,name,notiz,vertraulich,worker_sichtbar,aktuelle_version,archiviert,created_by,created_at,updated_at,
          versions:document_versions(id,document_id,version,storage_path,original_dateiname,extension,mime_type,groesse,uploaded_by,created_at),
          links:document_links(id,entity_type,entity_id),
          tag_links:document_tag_links(tag_id)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as (Record<string, unknown> & {
        versions: DocVersion[]; links: DocLink[]; tag_links: { tag_id: string }[];
      })[]).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        notiz: (r.notiz as string) ?? null,
        vertraulich: Boolean(r.vertraulich),
        worker_sichtbar: Boolean(r.worker_sichtbar),
        aktuelle_version: Number(r.aktuelle_version),
        archiviert: Boolean(r.archiviert),
        created_by: (r.created_by as string) ?? null,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
        versions: r.versions ?? [],
        links: r.links ?? [],
        tagIds: (r.tag_links ?? []).map((t) => t.tag_id),
      }));
    },
  });

export const dokumentTagsQuery = () =>
  queryOptions({
    queryKey: ["dokument_tags"],
    queryFn: async (): Promise<DokumentTag[]> => {
      const { data, error } = await supabase
        .from("dokument_tags")
        .select("id,name,farbe,sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DokumentTag[];
    },
  });

// ----------------------------------------------------------------------------
// Mutations
// ----------------------------------------------------------------------------
export interface CreateDocumentInput {
  name: string;
  notiz?: string | null;
  vertraulich?: boolean;
  worker_sichtbar?: boolean;
  file: File;
  links?: { entity_type: DocEntityType; entity_id: string | null }[];
  tagIds?: string[];
}

export async function createDocument(input: CreateDocumentInput): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id ?? null;

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({
      name: input.name.trim() || input.file.name,
      notiz: input.notiz?.trim() || null,
      vertraulich: input.vertraulich ?? false,
      worker_sichtbar: input.worker_sichtbar ?? false,
      aktuelle_version: 1,
      created_by: uid,
    } as never)
    .select("id")
    .single();
  if (docErr) throw docErr;
  const docId = (doc as { id: string }).id;

  await uploadVersionFile(docId, 1, input.file, uid);

  if (input.links?.length) {
    const rows = input.links
      .filter((l) => l.entity_id)
      .map((l) => ({ document_id: docId, entity_type: l.entity_type, entity_id: l.entity_id }));
    if (rows.length) {
      const { error } = await supabase.from("document_links").insert(rows as never);
      if (error) throw error;
    }
  }
  if (input.tagIds?.length) {
    const rows = input.tagIds.map((tag_id) => ({ document_id: docId, tag_id }));
    const { error } = await supabase.from("document_tag_links").insert(rows as never);
    if (error) throw error;
  }
  return docId;
}

async function uploadVersionFile(docId: string, version: number, file: File, uid: string | null) {
  const ext = extOf(file.name);
  const path = `${docId}/v${version}-${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("dms").upload(path, file);
  if (upErr) throw upErr;
  const { error } = await supabase.from("document_versions").insert({
    document_id: docId,
    version,
    storage_path: path,
    original_dateiname: file.name,
    extension: ext || null,
    mime_type: file.type || null,
    groesse: file.size,
    uploaded_by: uid,
  } as never);
  if (error) throw error;
}

export async function uploadNewVersion(docId: string, currentMax: number, file: File) {
  const { data: u } = await supabase.auth.getUser();
  const next = currentMax + 1;
  await uploadVersionFile(docId, next, file, u.user?.id ?? null);
  const { error } = await supabase
    .from("documents")
    .update({ aktuelle_version: next } as never)
    .eq("id", docId);
  if (error) throw error;
}

export async function updateDocument(
  id: string,
  patch: Partial<Pick<Dokument, "name" | "notiz" | "vertraulich" | "worker_sichtbar" | "archiviert" | "aktuelle_version">>,
) {
  const { error } = await supabase.from("documents").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteDocument(doc: Dokument) {
  const paths = doc.versions.map((v) => v.storage_path);
  if (paths.length) await supabase.storage.from("dms").remove(paths);
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw error;
}

export async function addDocLink(docId: string, entity_type: DocEntityType, entity_id: string | null) {
  const { error } = await supabase
    .from("document_links")
    .insert({ document_id: docId, entity_type, entity_id } as never);
  if (error) throw error;
}

export async function removeDocLink(linkId: string) {
  const { error } = await supabase.from("document_links").delete().eq("id", linkId);
  if (error) throw error;
}

export async function setDocumentTags(docId: string, tagIds: string[], current: string[]) {
  const toAdd = tagIds.filter((t) => !current.includes(t));
  const toRemove = current.filter((t) => !tagIds.includes(t));
  if (toAdd.length) {
    const { error } = await supabase
      .from("document_tag_links")
      .insert(toAdd.map((tag_id) => ({ document_id: docId, tag_id })) as never);
    if (error) throw error;
  }
  for (const tag_id of toRemove) {
    const { error } = await supabase
      .from("document_tag_links")
      .delete()
      .eq("document_id", docId)
      .eq("tag_id", tag_id);
    if (error) throw error;
  }
}

export async function createTag(name: string, farbe: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("dokument_tags")
    .insert({ name: name.trim(), farbe, created_by: u.user?.id ?? null } as never);
  if (error) throw error;
}

export async function updateTag(id: string, patch: Partial<Pick<DokumentTag, "name" | "farbe" | "sort_order">>) {
  const { error } = await supabase.from("dokument_tags").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteTag(id: string) {
  const { error } = await supabase.from("dokument_tags").delete().eq("id", id);
  if (error) throw error;
}

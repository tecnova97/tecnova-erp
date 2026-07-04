import { queryOptions } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Import Center — types, parsing, mapping, validation and confirmation logic.
// Fully client-side (static SPA). Original files & raw data are never destroyed.
// ---------------------------------------------------------------------------

export type ImportSourceType = "csv" | "excel" | "clickup" | "esass" | "pdf" | "email" | "other";

export const SOURCE_LABEL: Record<ImportSourceType, string> = {
  csv: "CSV",
  excel: "Excel",
  clickup: "ClickUp Export",
  esass: "eSASS / E-Mail",
  pdf: "PDF",
  email: "E-Mail",
  other: "Sonstige",
};

export type BatchStatus =
  | "draft"
  | "parsed"
  | "needs_review"
  | "confirmed"
  | "failed"
  | "ignored";

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  draft: "Entwurf",
  parsed: "Eingelesen",
  needs_review: "Prüfung nötig",
  confirmed: "Bestätigt",
  failed: "Fehlgeschlagen",
  ignored: "Ignoriert",
};

export const BATCH_STATUS_CLS: Record<BatchStatus, string> = {
  draft: "st-neu",
  parsed: "st-geplant",
  needs_review: "st-warten",
  confirmed: "st-abgeschlossen",
  failed: "st-storniert",
  ignored: "st-neu",
};

export type ValidationStatus = "ok" | "warning" | "error";

export interface ImportBatch {
  id: string;
  source_type: string;
  source_name: string | null;
  uploaded_file_url: string | null;
  original_filename: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  status: string;
  row_count: number;
  created_auftrag_count: number;
  error_count: number;
  notes: string | null;
  created_at: string;
}

export interface ImportRow {
  id: string;
  import_batch_id: string;
  row_number: number;
  raw_data_json: Record<string, string>;
  parsed_data_json: ParsedRow;
  validation_status: ValidationStatus;
  error_messages: string | null;
  duplicate_candidate_id: string | null;
  selected: boolean;
  created_auftrag_id: string | null;
  edited_by: string | null;
  edited_at: string | null;
}

/** Normalized, editable representation of one Auftrag to be created. */
export interface ParsedRow {
  // Auftrag
  titel: string;
  auftragsnummer: string;
  externe_auftragsnummer: string;
  beschreibung: string;
  wichtiginfo: string;
  status: string;
  termin_start: string;
  _termin_text?: string;
  termin_ende: string;
  _termin_ende_text?: string;
  // Kontakt
  kunde_name: string;
  ansprechpartner: string;
  kunde_telefon: string;
  kunde_festnetz: string;
  kunde_email: string;
  // Adresse
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  // Projekt
  auftraggeber_id: string;
  _auftraggeber_text?: string;
  projekt_id: string;
  _projekt_text?: string;
  projektnummer: string;
  projektleiter: string;
  kostenstelle: string;
  // Glasfaser
  nvt: string;
  onkz: string;
  asb: string;
  kls_id: string;
  esass_nr: string;
  ag_bestell_nr: string;
  ag_leb_nr: string;
  sm_nr: string;
  leistungsort: string;
  // Mitarbeiter
  mitarbeiter_ids: string[];
  _mitarbeiter_text?: string;
  team: string;
  disponent: string;
  // Custom
  custom_1: string;
  custom_2: string;
  custom_3: string;
  custom_4: string;
  custom_5: string;
  custom_6: string;
  custom_7: string;
  custom_8: string;
  custom_9: string;
  custom_10: string;
}

export type FieldKind =
  | "text"
  | "textarea"
  | "kunde"
  | "projekt"
  | "status"
  | "mitarbeiter"
  | "datetime";

export type FieldGroup =
  | "auftrag"
  | "kontakt"
  | "adresse"
  | "projekt"
  | "glasfaser"
  | "mitarbeiter"
  | "custom";

export const GROUP_LABEL: Record<FieldGroup, string> = {
  auftrag: "Auftrag",
  kontakt: "Kontakt",
  adresse: "Adresse",
  projekt: "Projekt",
  glasfaser: "Glasfaser",
  mitarbeiter: "Mitarbeiter",
  custom: "Benutzerdefiniert",
};

export const GROUP_ORDER: FieldGroup[] = [
  "auftrag",
  "kontakt",
  "adresse",
  "projekt",
  "glasfaser",
  "mitarbeiter",
  "custom",
];

export interface ImportField {
  key: keyof ParsedRow;
  label: string;
  kind: FieldKind;
  group: FieldGroup;
  required?: boolean;
  synonyms: string[];
}

/** The full field catalog supported by the Import Center. */
export const IMPORT_FIELDS: ImportField[] = [
  // --- Auftrag ---
  { key: "titel", label: "Titel", kind: "text", group: "auftrag", required: true, synonyms: ["titel", "title", "task name", "aufgabe", "auftrag", "bezeichnung", "name"] },
  { key: "auftragsnummer", label: "Auftragsnummer", kind: "text", group: "auftrag", synonyms: ["auftragsnummer", "auftrag nr", "auftrag-nr", "order number", "order no"] },
  { key: "externe_auftragsnummer", label: "Externe Auftragsnummer", kind: "text", group: "auftrag", synonyms: ["externe auftragsnummer", "externe nr", "external order", "fremdnummer", "ext auftragsnummer"] },
  { key: "beschreibung", label: "Beschreibung", kind: "textarea", group: "auftrag", synonyms: ["beschreibung", "description", "beschr", "details", "notes", "kommentar"] },
  { key: "wichtiginfo", label: "Wichtiginfo", kind: "textarea", group: "auftrag", synonyms: ["wichtiginfo", "wichtig", "hinweis", "important", "info"] },
  { key: "status", label: "Status", kind: "status", group: "auftrag", synonyms: ["status", "state", "zustand"] },
  { key: "termin_start", label: "Termin Beginn", kind: "datetime", group: "auftrag", synonyms: ["termin", "datum", "date", "due date", "start date", "termin start", "termin beginn", "appointment"] },
  { key: "termin_ende", label: "Termin Ende", kind: "datetime", group: "auftrag", synonyms: ["termin ende", "end date", "enddatum", "bis"] },
  // --- Kontakt ---
  { key: "kunde_name", label: "Kunde", kind: "text", group: "kontakt", synonyms: ["kunde", "kundenname", "customer", "endkunde", "name kunde"] },
  { key: "ansprechpartner", label: "Ansprechpartner", kind: "text", group: "kontakt", synonyms: ["ansprechpartner", "contact", "kontaktperson", "contact person"] },
  { key: "kunde_telefon", label: "Telefon mobil", kind: "text", group: "kontakt", synonyms: ["telefon", "mobil", "handy", "phone", "tel", "mobile", "telefonnummer", "telefon mobil"] },
  { key: "kunde_festnetz", label: "Festnetz", kind: "text", group: "kontakt", synonyms: ["festnetz", "landline", "festnetznummer"] },
  { key: "kunde_email", label: "E-Mail", kind: "text", group: "kontakt", synonyms: ["email", "e-mail", "mail", "e mail"] },
  // --- Adresse ---
  { key: "strasse", label: "Straße", kind: "text", group: "adresse", synonyms: ["strasse", "straße", "street", "anschrift", "adresse", "address"] },
  { key: "hausnummer", label: "Hausnummer", kind: "text", group: "adresse", synonyms: ["hausnummer", "haus nr", "hausnr", "nr", "house number", "no"] },
  { key: "plz", label: "PLZ", kind: "text", group: "adresse", synonyms: ["plz", "postleitzahl", "zip", "postal code"] },
  { key: "ort", label: "Ort", kind: "text", group: "adresse", synonyms: ["ort", "stadt", "city", "town"] },
  // --- Projekt ---
  { key: "auftraggeber_id", label: "Auftraggeber", kind: "kunde", group: "projekt", synonyms: ["auftraggeber", "ag", "kunde firma", "firma", "company", "client"] },
  { key: "projekt_id", label: "Projekt", kind: "projekt", group: "projekt", synonyms: ["projekt", "project", "list", "liste"] },
  { key: "projektnummer", label: "Projektnummer", kind: "text", group: "projekt", synonyms: ["projektnummer", "projekt nr", "project number", "proj nr"] },
  { key: "projektleiter", label: "Projektleiter", kind: "text", group: "projekt", synonyms: ["projektleiter", "project lead", "pl", "leiter"] },
  { key: "kostenstelle", label: "Kostenstelle", kind: "text", group: "projekt", synonyms: ["kostenstelle", "cost center", "kst"] },
  // --- Glasfaser ---
  { key: "nvt", label: "NVT", kind: "text", group: "glasfaser", synonyms: ["nvt", "netzverteiler"] },
  { key: "onkz", label: "ONKz", kind: "text", group: "glasfaser", synonyms: ["onkz", "on kz", "ortsnetzkennzahl"] },
  { key: "asb", label: "ASB", kind: "text", group: "glasfaser", synonyms: ["asb"] },
  { key: "kls_id", label: "KLS ID", kind: "text", group: "glasfaser", synonyms: ["kls id", "kls-id", "klsid", "kls"] },
  { key: "esass_nr", label: "eSASS-Nr.", kind: "text", group: "glasfaser", synonyms: ["esass", "esass-nr", "esass nr", "esassnr"] },
  { key: "ag_bestell_nr", label: "AG-Bestell-Nr.", kind: "text", group: "glasfaser", synonyms: ["ag-bestell-nr", "ag bestell nr", "bestellnummer", "bestell-nr", "po", "purchase order"] },
  { key: "ag_leb_nr", label: "AG-LEB-Nr.", kind: "text", group: "glasfaser", synonyms: ["ag-leb-nr", "ag leb nr", "leb-nr", "leb nr", "leb"] },
  { key: "sm_nr", label: "SM-Nr.", kind: "text", group: "glasfaser", synonyms: ["sm-nr", "sm nr", "smnr", "sm"] },
  { key: "leistungsort", label: "Leistungsort", kind: "text", group: "glasfaser", synonyms: ["leistungsort", "einsatzort", "location", "standort"] },
  // --- Mitarbeiter ---
  { key: "mitarbeiter_ids", label: "Mitarbeiter", kind: "mitarbeiter", group: "mitarbeiter", synonyms: ["mitarbeiter", "monteur", "techniker", "assignee", "assigned", "worker"] },
  { key: "team", label: "Team", kind: "text", group: "mitarbeiter", synonyms: ["team", "kolonne", "crew"] },
  { key: "disponent", label: "Disponent", kind: "text", group: "mitarbeiter", synonyms: ["disponent", "dispatcher", "dispo"] },
  // --- Custom ---
  { key: "custom_1", label: "Benutzerdefiniertes Feld 1", kind: "text", group: "custom", synonyms: [] },
  { key: "custom_2", label: "Benutzerdefiniertes Feld 2", kind: "text", group: "custom", synonyms: [] },
  { key: "custom_3", label: "Benutzerdefiniertes Feld 3", kind: "text", group: "custom", synonyms: [] },
  { key: "custom_4", label: "Benutzerdefiniertes Feld 4", kind: "text", group: "custom", synonyms: [] },
  { key: "custom_5", label: "Benutzerdefiniertes Feld 5", kind: "text", group: "custom", synonyms: [] },
  { key: "custom_6", label: "Benutzerdefiniertes Feld 6", kind: "text", group: "custom", synonyms: [] },
  { key: "custom_7", label: "Benutzerdefiniertes Feld 7", kind: "text", group: "custom", synonyms: [] },
  { key: "custom_8", label: "Benutzerdefiniertes Feld 8", kind: "text", group: "custom", synonyms: [] },
  { key: "custom_9", label: "Benutzerdefiniertes Feld 9", kind: "text", group: "custom", synonyms: [] },
  { key: "custom_10", label: "Benutzerdefiniertes Feld 10", kind: "text", group: "custom", synonyms: [] },
];

export type ColumnMapping = Record<string, keyof ParsedRow | "">;

export interface ReferenceData {
  kunden: { id: string; name: string }[];
  projekte: { id: string; name: string }[];
  mitarbeiter: { id: string; vorname: string; nachname: string }[];
  statuses: { key: string; label: string }[];
}

// ---------------------------------------------------------------------------
// Empty parsed row factory
// ---------------------------------------------------------------------------
export function emptyParsedRow(): ParsedRow {
  return {
    titel: "",
    auftragsnummer: "",
    externe_auftragsnummer: "",
    beschreibung: "",
    wichtiginfo: "",
    status: "",
    termin_start: "",
    termin_ende: "",
    kunde_name: "",
    ansprechpartner: "",
    kunde_telefon: "",
    kunde_festnetz: "",
    kunde_email: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    auftraggeber_id: "",
    projekt_id: "",
    projektnummer: "",
    projektleiter: "",
    kostenstelle: "",
    nvt: "",
    onkz: "",
    asb: "",
    kls_id: "",
    esass_nr: "",
    ag_bestell_nr: "",
    ag_leb_nr: "",
    sm_nr: "",
    leistungsort: "",
    mitarbeiter_ids: [],
    team: "",
    disponent: "",
    custom_1: "",
    custom_2: "",
    custom_3: "",
    custom_4: "",
    custom_5: "",
    custom_6: "",
    custom_7: "",
    custom_8: "",
    custom_9: "",
    custom_10: "",
  };
}

// ---------------------------------------------------------------------------
// File parsing (CSV + Excel) → array of header + rows
// ---------------------------------------------------------------------------
export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

function detectDelimiter(line: string): string {
  const counts = [";", ",", "\t", "|"].map((d) => ({ d, n: line.split(d).length }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 1 ? counts[0].d : ",";
}

/** Robust CSV parser (handles quotes, embedded newlines, ; or , delimiters). */
export function parseCsv(text: string): ParsedFile {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = clean.split("\n").find((l) => l.trim().length > 0) ?? "";
  const delim = detectDelimiter(firstLine);

  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      if (row.some((v) => v.trim() !== "")) records.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((v) => v.trim() !== "")) records.push(row); }

  if (!records.length) return { headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
  return { headers, rows };
}

export function parseExcel(data: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  if (!json.length) return { headers: [], rows: [] };
  const headers = Object.keys(json[0]).map((h) => h.trim());
  const rows = json.map((r) => {
    const obj: Record<string, string> = {};
    for (const h of Object.keys(r)) obj[h.trim()] = String(r[h] ?? "").trim();
    return obj;
  });
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Auto mapping
// ---------------------------------------------------------------------------
function norm(s: string): string {
  return s.toLowerCase().replace(/[._\-/]/g, " ").replace(/\s+/g, " ").trim();
}

export function autoMap(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const h of headers) {
    const nh = norm(h);
    let best: keyof ParsedRow | "" = "";
    for (const f of IMPORT_FIELDS) {
      if (used.has(f.key)) continue;
      if (f.synonyms.some((s) => nh === s) || nh === norm(f.label)) { best = f.key; break; }
    }
    if (!best) {
      for (const f of IMPORT_FIELDS) {
        if (used.has(f.key)) continue;
        if (f.synonyms.some((s) => nh.includes(s) || s.includes(nh))) { best = f.key; break; }
      }
    }
    mapping[h] = best;
    if (best) used.add(best);
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// German date parsing (dd.MM.yyyy [HH:mm]) + ISO fallback → local ISO string
// ---------------------------------------------------------------------------
export function parseGermanDate(value: string): string {
  const v = value.trim();
  if (!v) return "";
  // Excel already gave us ISO-ish (cellDates → toString) or user typed ISO
  const iso = Date.parse(v);
  const m = v.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, d, mo, y, h, mi] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(year, Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  if (!Number.isNaN(iso)) return new Date(iso).toISOString();
  return "";
}

// ---------------------------------------------------------------------------
// Build a ParsedRow from a raw record using the mapping + reference data
// ---------------------------------------------------------------------------
export function buildParsedRow(
  raw: Record<string, string>,
  mapping: ColumnMapping,
  refs: ReferenceData,
  defaults: { status?: string; auftraggeber_id?: string; projekt_id?: string },
): ParsedRow {
  const p = emptyParsedRow();
  const text: Partial<Record<keyof ParsedRow, string>> = {};
  for (const [header, key] of Object.entries(mapping)) {
    if (!key) continue;
    const val = (raw[header] ?? "").trim();
    if (val) text[key] = val;
  }

  // Copy all plain text/textarea fields generically.
  for (const f of IMPORT_FIELDS) {
    if (f.kind === "text" || f.kind === "textarea") {
      (p as unknown as Record<string, unknown>)[f.key] = text[f.key] ?? "";
    }
  }

  // Termin Beginn
  const terminText = text.termin_start ?? "";
  p._termin_text = terminText;
  p.termin_start = terminText ? parseGermanDate(terminText) : "";

  // Termin Ende
  const terminEndeText = text.termin_ende ?? "";
  p._termin_ende_text = terminEndeText;
  p.termin_ende = terminEndeText ? parseGermanDate(terminEndeText) : "";

  // Auftraggeber
  const agText = (text.auftraggeber_id ?? "").trim();
  p._auftraggeber_text = agText;
  const agMatch = agText
    ? refs.kunden.find((k) => k.name.toLowerCase() === agText.toLowerCase())
    : undefined;
  p.auftraggeber_id = agMatch?.id ?? defaults.auftraggeber_id ?? "";

  // Projekt
  const prText = (text.projekt_id ?? "").trim();
  p._projekt_text = prText;
  const prMatch = prText
    ? refs.projekte.find((k) => k.name.toLowerCase() === prText.toLowerCase())
    : undefined;
  p.projekt_id = prMatch?.id ?? defaults.projekt_id ?? "";

  // Status
  const stText = (text.status ?? "").trim();
  const stMatch = stText
    ? refs.statuses.find(
        (s) => s.label.toLowerCase() === stText.toLowerCase() || s.key.toLowerCase() === stText.toLowerCase(),
      )
    : undefined;
  p.status = stMatch?.key ?? defaults.status ?? "";

  // Mitarbeiter (comma / semicolon separated)
  const maText = (text.mitarbeiter_ids ?? "").trim();
  p._mitarbeiter_text = maText;
  if (maText) {
    const parts = maText.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    const ids: string[] = [];
    for (const part of parts) {
      const low = part.toLowerCase();
      const m = refs.mitarbeiter.find(
        (x) =>
          `${x.vorname} ${x.nachname}`.toLowerCase() === low ||
          `${x.nachname} ${x.vorname}`.toLowerCase() === low ||
          x.nachname.toLowerCase() === low,
      );
      if (m) ids.push(m.id);
    }
    p.mitarbeiter_ids = ids;
  }

  return p;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export interface ValidationResult {
  status: ValidationStatus;
  messages: string[];
}

export function validateRow(p: ParsedRow, refs: ReferenceData): ValidationResult {
  const messages: string[] = [];
  let status: ValidationStatus = "ok";

  if (!p.titel.trim()) {
    messages.push("Titel fehlt (Pflichtfeld).");
    status = "error";
  }

  const hasContact = !!(p.kunde_name || p.kunde_telefon || p.kunde_festnetz || p.kunde_email);
  const hasAddress = !!(p.strasse || p.plz || p.ort);
  if (!hasContact && !hasAddress) {
    messages.push("Keine Kontakt- oder Adressdaten erkannt.");
    if (status !== "error") status = "warning";
  }

  if (p._auftraggeber_text && !p.auftraggeber_id) {
    messages.push(`Auftraggeber „${p._auftraggeber_text}" nicht zugeordnet.`);
    if (status !== "error") status = "warning";
  }
  if (p._projekt_text && !p.projekt_id) {
    messages.push(`Projekt „${p._projekt_text}" nicht zugeordnet.`);
    if (status !== "error") status = "warning";
  }
  if (p._termin_text && !p.termin_start) {
    messages.push(`Termin „${p._termin_text}" nicht erkannt.`);
    if (status !== "error") status = "warning";
  }
  if (p.kunde_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.kunde_email)) {
    messages.push("E-Mail-Adresse ungültig.");
    if (status !== "error") status = "warning";
  }

  return { status, messages };
}

/** Detects a probable duplicate among existing Aufträge (by title+contact). */
export function findDuplicate(
  p: ParsedRow,
  existing: { id: string; titel: string; kunde_name: string | null; kunde_telefon: string | null }[],
): string | null {
  const t = p.titel.trim().toLowerCase();
  const tel = p.kunde_telefon.replace(/\D/g, "");
  const found = existing.find((a) => {
    const at = (a.titel ?? "").trim().toLowerCase();
    const atel = (a.kunde_telefon ?? "").replace(/\D/g, "");
    return (t && at === t) || (tel.length >= 6 && atel === tel);
  });
  return found?.id ?? null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export const importBatchesQuery = () =>
  queryOptions({
    queryKey: ["import_batches"],
    queryFn: async (): Promise<ImportBatch[]> => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ImportBatch[];
    },
  });

export const importRowsQuery = (batchId: string) =>
  queryOptions({
    queryKey: ["import_rows", batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<ImportRow[]> => {
      const { data, error } = await supabase
        .from("import_rows")
        .select("*")
        .eq("import_batch_id", batchId)
        .order("row_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ImportRow[];
    },
  });

export const mappingProfilesQuery = () =>
  queryOptions({
    queryKey: ["import_mapping_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_mapping_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const importConfirmationsQuery = () =>
  queryOptions({
    queryKey: ["import_confirmations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_confirmations")
        .select("*")
        .order("confirmed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

// ---------------------------------------------------------------------------
// Confirmation → creates Aufträge from selected, non-error rows
// ---------------------------------------------------------------------------
const DEFAULT_IMPORT_STATUS = "neue_auftraege";

export async function confirmImport(
  batch: ImportBatch,
  rows: ImportRow[],
  notes: string,
): Promise<{ created: number; skipped: number }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const toImport = rows.filter((r) => r.selected && r.validation_status !== "error" && !r.created_auftrag_id);
  const createdIds: string[] = [];
  let skipped = rows.filter((r) => r.selected && r.validation_status === "error").length;

  for (const row of toImport) {
    const p = row.parsed_data_json;
    const customFelder: Record<string, string> = {};
    for (let i = 1; i <= 10; i++) {
      const v = (p as unknown as Record<string, string>)[`custom_${i}`];
      if (v) customFelder[`custom_${i}`] = v;
    }
    const payload = {
      titel: p.titel.trim() || "Importierter Auftrag",
      auftragsnummer: p.auftragsnummer || undefined,
      externe_auftragsnummer: p.externe_auftragsnummer || null,
      beschreibung: p.beschreibung || null,
      status: p.status || DEFAULT_IMPORT_STATUS,
      kunde_id: p.auftraggeber_id || null,
      projekt_id: p.projekt_id || null,
      kunde_name: p.kunde_name || null,
      ansprechpartner: p.ansprechpartner || null,
      kunde_telefon: p.kunde_telefon || null,
      kunde_festnetz: p.kunde_festnetz || null,
      kunde_email: p.kunde_email || null,
      wichtiginfo: p.wichtiginfo || null,
      strasse: p.strasse || null,
      hausnummer: p.hausnummer || null,
      plz: p.plz || null,
      ort: p.ort || null,
      termin_start: p.termin_start || null,
      termin_ende: p.termin_ende || null,
      projektnummer: p.projektnummer || null,
      projektleiter: p.projektleiter || null,
      kostenstelle: p.kostenstelle || null,
      nvt: p.nvt || null,
      onkz: p.onkz || null,
      asb: p.asb || null,
      kls_id: p.kls_id || null,
      esass_nr: p.esass_nr || null,
      ag_bestell_nr: p.ag_bestell_nr || null,
      ag_leb_nr: p.ag_leb_nr || null,
      sm_nr: p.sm_nr || null,
      leistungsort: p.leistungsort || null,
      team: p.team || null,
      disponent: p.disponent || null,
      custom_felder: customFelder,
      import_batch_id: batch.id,
      created_by: uid,
    };
    if (!payload.auftragsnummer) delete (payload as { auftragsnummer?: string }).auftragsnummer;

    const { data, error } = await supabase
      .from("auftraege")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) { skipped++; continue; }
    const auftragId = (data as { id: string }).id;
    createdIds.push(auftragId);

    if (p.mitarbeiter_ids.length) {
      await supabase
        .from("auftrag_mitarbeiter")
        .insert(p.mitarbeiter_ids.map((m) => ({ auftrag_id: auftragId, mitarbeiter_id: m })) as never);
    }

    await supabase
      .from("import_rows")
      .update({ created_auftrag_id: auftragId } as never)
      .eq("id", row.id);
  }

  // Update batch
  await supabase
    .from("import_batches")
    .update({
      status: "confirmed",
      created_auftrag_count: (batch.created_auftrag_count ?? 0) + createdIds.length,
    } as never)
    .eq("id", batch.id);

  // Audit trail
  await supabase.from("import_confirmations").insert({
    import_batch_id: batch.id,
    confirmed_by: uid,
    created_auftrag_ids: createdIds,
    notes: notes || null,
  } as never);

  // Activity log
  await supabase.rpc("log_activity", {
    _action: "import.confirmed",
    _entity_type: "import",
    _entity_id: batch.id,
    _entity_name: batch.original_filename ?? batch.source_name ?? "Import",
    _before: null,
    _after: { created: createdIds.length, source: batch.source_type } as never,
  });

  return { created: createdIds.length, skipped };
}

export async function deleteBatch(batchId: string, fileUrl: string | null): Promise<void> {
  if (fileUrl) {
    await supabase.storage.from("importe").remove([fileUrl]).catch(() => {});
  }
  const { error } = await supabase.from("import_batches").delete().eq("id", batchId);
  if (error) throw error;
}

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Abrechnung – Rechnungsgruppen bündeln viele Zahlungsereignisse zu einer
// Abrechnungseinheit (NVT / eSASS / Projekt / AG-LEB). Quelle der Wahrheit
// bleiben die Zahlungsereignisse; hier werden sie nur gruppiert.
// ---------------------------------------------------------------------------

export type RechnungGruppeStatus =
  | "draft"
  | "geprueft"
  | "freigegeben"
  | "abgerechnet"
  | "storniert";

export const RG_STATUS_LABEL: Record<RechnungGruppeStatus, string> = {
  draft: "Entwurf",
  geprueft: "Geprüft",
  freigegeben: "Freigegeben",
  abgerechnet: "Abgerechnet",
  storniert: "Storniert",
};

export const RG_STATUS_TONE: Record<RechnungGruppeStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  geprueft: "bg-warning/15 text-warning",
  freigegeben: "bg-primary/10 text-primary",
  abgerechnet: "bg-success/15 text-success",
  storniert: "bg-destructive/15 text-destructive",
};

export const RG_STATUS_ORDER: RechnungGruppeStatus[] = [
  "draft",
  "geprueft",
  "freigegeben",
  "abgerechnet",
  "storniert",
];

export const RG_DOK_TYPES = [
  { value: "rechnung", label: "Rechnung" },
  { value: "rechnungsanlage", label: "Rechnungsanlage" },
  { value: "aufmass", label: "Aufmaß" },
  { value: "pdf", label: "PDF" },
  { value: "excel", label: "Excel" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export interface RechnungGruppe {
  id: string;
  nummer: string;
  name: string | null;
  auftraggeber_id: string | null;
  projekt_id: string | null;
  nvt: string | null;
  esass_nr: string | null;
  ag_bestell_nr: string | null;
  ag_leb_nr: string | null;
  sm_nr: string | null;
  kostenstelle: string | null;
  projektleiter: string | null;
  leistungsort: string | null;
  leistungszeitraum_von: string | null;
  leistungszeitraum_bis: string | null;
  status: RechnungGruppeStatus;
  notes: string | null;
  ust_prozent: number;
  netto_manuell: number | null;
  manuelle_anpassung: number;
  custom_data: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  auftraggeber?: { id: string; name: string } | null;
  projekt?: { id: string; name: string } | null;
}

// Manual / adjustment line item types for a billing group
export const RG_POS_TYPES = [
  { value: "position", label: "Position" },
  { value: "rabatt", label: "Rabatt" },
  { value: "korrektur", label: "Korrektur" },
  { value: "abzug", label: "Abzug" },
  { value: "ausgleich", label: "Ausgleich" },
  { value: "storno", label: "Storno" },
] as const;

export const rgPosTypLabel = (v: string) =>
  RG_POS_TYPES.find((t) => t.value === v)?.label ?? v;

export interface RechnungGruppePosition {
  id: string;
  rechnung_gruppe_id: string;
  bezeichnung: string;
  typ: string;
  menge: number;
  einzelpreis: number;
  betrag: number;
  notiz: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RechnungGruppeEventLink {
  id: string;
  rechnung_gruppe_id: string;
  zahlungsereignis_id: string;
  sort_order: number;
  included: boolean;
  notes: string | null;
  created_at: string;
}

export interface RechnungGruppeDokument {
  id: string;
  rechnung_gruppe_id: string;
  titel: string;
  typ: string;
  datei_pfad: string;
  datei_name: string | null;
  mime_type: string | null;
  groesse: number | null;
  created_by: string | null;
  created_at: string;
}

const RG_SELECT =
  "*, auftraggeber:kunden(id,name), projekt:projekte(id,name)";

export const rechnungGruppenQuery = () =>
  queryOptions({
    queryKey: ["rechnung_gruppen"],
    queryFn: async (): Promise<RechnungGruppe[]> => {
      const { data, error } = await supabase
        .from("rechnung_gruppen")
        .select(RG_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RechnungGruppe[];
    },
  });

export const rechnungGruppeQuery = (id: string) =>
  queryOptions({
    queryKey: ["rechnung_gruppe", id],
    queryFn: async (): Promise<RechnungGruppe> => {
      const { data, error } = await supabase
        .from("rechnung_gruppen")
        .select(RG_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as RechnungGruppe;
    },
  });

/** All event->group links (for showing the linked group on payment events). */
export const gruppeEventLinksQuery = () =>
  queryOptions({
    queryKey: ["rechnung_gruppe_event_links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rechnung_gruppe_events")
        .select("id,rechnung_gruppe_id,zahlungsereignis_id,sort_order,included,notes,created_at, gruppe:rechnung_gruppen(id,nummer,name,status)");
      if (error) throw error;
      return (data ?? []) as unknown as (RechnungGruppeEventLink & {
        gruppe: { id: string; nummer: string; name: string | null; status: string } | null;
      })[];
    },
  });

export const gruppeEventsForGruppeQuery = (gruppeId: string) =>
  queryOptions({
    queryKey: ["rechnung_gruppe_events", gruppeId],
    queryFn: async (): Promise<RechnungGruppeEventLink[]> => {
      const { data, error } = await supabase
        .from("rechnung_gruppe_events")
        .select("*")
        .eq("rechnung_gruppe_id", gruppeId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RechnungGruppeEventLink[];
    },
  });

export const gruppeDokumenteQuery = (gruppeId: string) =>
  queryOptions({
    queryKey: ["rechnung_gruppe_dokumente", gruppeId],
    queryFn: async (): Promise<RechnungGruppeDokument[]> => {
      const { data, error } = await supabase
        .from("rechnung_gruppe_dokumente")
        .select("*")
        .eq("rechnung_gruppe_id", gruppeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RechnungGruppeDokument[];
    },
  });

export type RechnungGruppeInput = Partial<Omit<RechnungGruppe, "id" | "created_at" | "updated_at" | "auftraggeber" | "projekt" | "nummer">>;

export async function createRechnungGruppe(input: RechnungGruppeInput) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("rechnung_gruppen")
    .insert({ ...input, created_by: u.user?.id } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function updateRechnungGruppe(id: string, input: RechnungGruppeInput) {
  const { error } = await supabase
    .from("rechnung_gruppen")
    .update(input as never)
    .eq("id", id);
  if (error) throw error;
}

export async function setRechnungGruppeStatus(id: string, status: RechnungGruppeStatus) {
  const { error } = await supabase
    .from("rechnung_gruppen")
    .update({ status } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRechnungGruppe(id: string) {
  const { error } = await supabase.from("rechnung_gruppen").delete().eq("id", id);
  if (error) throw error;
}

export async function addEventsToGruppe(gruppeId: string, eventIds: string[], startOrder = 0) {
  if (eventIds.length === 0) return;
  const rows = eventIds.map((zid, i) => ({
    rechnung_gruppe_id: gruppeId,
    zahlungsereignis_id: zid,
    sort_order: startOrder + i,
    included: true,
  }));
  const { error } = await supabase
    .from("rechnung_gruppe_events")
    .upsert(rows as never, { onConflict: "rechnung_gruppe_id,zahlungsereignis_id" });
  if (error) throw error;
}

export async function removeEventFromGruppe(linkId: string) {
  const { error } = await supabase.from("rechnung_gruppe_events").delete().eq("id", linkId);
  if (error) throw error;
}

export async function updateEventLink(
  linkId: string,
  patch: Partial<Pick<RechnungGruppeEventLink, "included" | "sort_order" | "notes">>,
) {
  const { error } = await supabase
    .from("rechnung_gruppe_events")
    .update(patch as never)
    .eq("id", linkId);
  if (error) throw error;
}

export async function uploadGruppeDokument(
  gruppeId: string,
  file: File,
  typ: string,
  titel?: string,
) {
  const { data: u } = await supabase.auth.getUser();
  const path = `${gruppeId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("abrechnung").upload(path, file);
  if (upErr) throw upErr;
  const { error } = await supabase.from("rechnung_gruppe_dokumente").insert({
    rechnung_gruppe_id: gruppeId,
    titel: titel?.trim() || file.name,
    typ,
    datei_pfad: path,
    datei_name: file.name,
    mime_type: file.type,
    groesse: file.size,
    created_by: u.user?.id,
  } as never);
  if (error) throw error;
}

export async function deleteGruppeDokument(id: string, path: string) {
  await supabase.storage.from("abrechnung").remove([path]);
  const { error } = await supabase.from("rechnung_gruppe_dokumente").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Manual line items / adjustments for a billing group
// ---------------------------------------------------------------------------

export const gruppePositionenQuery = (gruppeId: string) =>
  queryOptions({
    queryKey: ["rechnung_gruppe_positionen", gruppeId],
    queryFn: async (): Promise<RechnungGruppePosition[]> => {
      const { data, error } = await supabase
        .from("rechnung_gruppe_positionen")
        .select("*")
        .eq("rechnung_gruppe_id", gruppeId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RechnungGruppePosition[];
    },
  });

export type RechnungGruppePositionInput = {
  bezeichnung: string;
  typ: string;
  menge: number;
  einzelpreis: number;
  betrag: number;
  notiz: string | null;
  sort_order: number;
};

export async function addGruppePosition(gruppeId: string, input: RechnungGruppePositionInput) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("rechnung_gruppe_positionen")
    .insert({ ...input, rechnung_gruppe_id: gruppeId, created_by: u.user?.id } as never);
  if (error) throw error;
}

export async function updateGruppePosition(id: string, patch: Partial<RechnungGruppePositionInput>) {
  const { error } = await supabase
    .from("rechnung_gruppe_positionen")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteGruppePosition(id: string) {
  const { error } = await supabase.from("rechnung_gruppe_positionen").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Compute the financial summary for a billing group.
 * - eventsSum: subtotal from linked (active) payment events
 * - positionenSum: sum of manual line items (may be negative)
 * - netto: eventsSum + positionenSum, OR the manual netto override when no
 *   events are linked and a manual amount is set
 * - anpassung: manual adjustment (± Euro)
 * - final netto → USt → brutto
 */
export function computeGruppeFinance(opts: {
  eventsSum: number;
  hasEvents: boolean;
  positionen: RechnungGruppePosition[];
  netto_manuell: number | null;
  manuelle_anpassung: number;
  ust_prozent: number;
}) {
  const positionenSum = opts.positionen.reduce((s, p) => s + Number(p.betrag), 0);
  const basis = opts.hasEvents
    ? opts.eventsSum
    : opts.netto_manuell != null
      ? Number(opts.netto_manuell)
      : 0;
  const netto = basis + positionenSum + Number(opts.manuelle_anpassung || 0);
  const ust = netto * (Number(opts.ust_prozent || 0) / 100);
  const brutto = netto + ust;
  return { eventsSum: opts.eventsSum, positionenSum, basis, netto, ust, brutto };
}

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/auth";

// ----------------------------------------------------------------------------
// Permission keys (mirror of the seeded catalog in the database).
// These are stable identifiers used across the UI for gating.
// The authoritative, editable list lives in the `permissions` table.
// ----------------------------------------------------------------------------
export const PERM = {
  dashboardView: "dashboard.view",
  dashboardEdit: "dashboard.edit",
  dashboardWidgets: "dashboard.widgets",
  auftraegeView: "auftraege.view",
  auftraegeCreate: "auftraege.create",
  auftraegeEdit: "auftraege.edit",
  auftraegeDelete: "auftraege.delete",
  auftraegeAssign: "auftraege.assign",
  auftraegeStatus: "auftraege.status",
  auftraegeComplete: "auftraege.complete",
  projekteView: "projekte.view",
  projekteCreate: "projekte.create",
  projekteEdit: "projekte.edit",
  projekteDelete: "projekte.delete",
  projekteFinanzen: "projekte.finanzen",
  auftraggeberView: "auftraggeber.view",
  auftraggeberCreate: "auftraggeber.create",
  auftraggeberEdit: "auftraggeber.edit",
  auftraggeberDelete: "auftraggeber.delete",
  auftraggeberFinanzen: "auftraggeber.finanzen",
  kalenderView: "kalender.view",
  kalenderEdit: "kalender.edit",
  kalenderPlan: "kalender.plan",
  kalenderMove: "kalender.move",
  kalenderBlockerCreate: "kalender.blocker.create",
  kalenderBlockerEdit: "kalender.blocker.edit",
  kalenderBlockerDelete: "kalender.blocker.delete",
  kalenderAbwesenheit: "kalender.abwesenheit",
  kalenderAlleMitarbeiter: "kalender.alle_mitarbeiter",
  mitarbeiterManage: "mitarbeiter.manage",
  mitarbeiterView: "mitarbeiter.view",
  mitarbeiterCreate: "mitarbeiter.create",
  mitarbeiterEdit: "mitarbeiter.edit",
  mitarbeiterDelete: "mitarbeiter.delete",
  mitarbeiterGehalt: "mitarbeiter.gehalt",
  mitarbeiterLeistung: "mitarbeiter.leistung",
  mitarbeiterAusstattungView: "mitarbeiter.ausstattung.view",
  mitarbeiterAusstattungAssign: "mitarbeiter.ausstattung.assign",
  mitarbeiterUrlaubManage: "mitarbeiter.urlaub.manage",
  gehaltView: "gehalt.view",
  umsatzView: "umsatz.view",
  gewinnView: "gewinn.view",
  finanzenManage: "finanzen.manage",
  // Phase 4 – granular financial permissions (never owner-only in code)
  preiseView: "auftrag.preise.view",
  preiseEdit: "auftrag.preise.edit",
  profitCard: "auftrag.profit.card",
  profitDetail: "auftrag.profit.detail",
  bezahltView: "bezahlt.view",
  zahlungsereignisseView: "zahlungsereignisse.view",
  zahlungsereignisseEdit: "zahlungsereignisse.edit",
  // Abrechnung / Rechnungsgruppen
  abrechnungView: "abrechnung.view",
  abrechnungCreate: "abrechnung.create",
  abrechnungEdit: "abrechnung.edit",
  abrechnungDelete: "abrechnung.delete",
  abrechnungEvents: "abrechnung.events",
  abrechnungUpload: "abrechnung.upload",
  abrechnungExport: "abrechnung.export",
  ausgabenView: "ausgaben.view",
  ausgabenEdit: "ausgaben.edit",
  finanzenExport: "finanzen.export",
  // Import Center
  importeView: "importe.view",
  importeUpload: "importe.upload",
  importeReview: "importe.review",
  importeEdit: "importe.edit",
  importeConfirm: "importe.confirm",
  importeDelete: "importe.delete",
  importeMapping: "importe.mapping",
  importeHistory: "importe.history",
  statusManage: "status.manage",
  leistungenManage: "leistungen.manage",
  einstellungenManage: "einstellungen.manage",
  usersManage: "users.manage",
  rolesManage: "roles.manage",
  firmenprofilManage: "firmenprofil.manage",
  dokumenteView: "dokumente.view",
  dokumenteUpload: "dokumente.upload",
  dokumenteDownload: "dokumente.download",
  dokumenteDelete: "dokumente.delete",
  dokumenteRename: "dokumente.rename",
  dokumenteNotes: "dokumente.notes",
  dokumenteTagsManage: "dokumente.tags",
  dokumenteConfidential: "dokumente.confidential",
  brandingView: "branding.view",
  brandingEdit: "branding.edit",
  brandingLogos: "branding.logos",
  brandingTheme: "branding.theme",
  brandingCompanyTheme: "branding.company_theme",
  gehaltEdit: "gehalt.edit",
  verguetungEdit: "verguetung.edit",
  verguetungBonus: "verguetung.bonus",
  verguetungAbzuege: "verguetung.abzuege",
} as const;

export type PermissionKey = (typeof PERM)[keyof typeof PERM];

export interface PermissionDef {
  key: string;
  label: string;
  kategorie: string;
  beschreibung: string | null;
  sort_order: number;
}

export interface RoleRow {
  id: string;
  key: string;
  name: string;
  beschreibung: string | null;
  base_role: AppRole;
  is_system: boolean;
  farbe: string;
  sort_order: number;
}

export interface RolePermissionRow {
  id: string;
  role_id: string;
  permission_key: string;
}

export const permissionsQuery = () =>
  queryOptions({
    queryKey: ["permissions"],
    queryFn: async (): Promise<PermissionDef[]> => {
      const { data, error } = await supabase
        .from("permissions")
        .select("key,label,kategorie,beschreibung,sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PermissionDef[];
    },
  });

export const rolesQuery = () =>
  queryOptions({
    queryKey: ["roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase
        .from("roles")
        .select("id,key,name,beschreibung,base_role,is_system,farbe,sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

export const rolePermissionsQuery = () =>
  queryOptions({
    queryKey: ["role_permissions"],
    queryFn: async (): Promise<RolePermissionRow[]> => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("id,role_id,permission_key");
      if (error) throw error;
      return (data ?? []) as RolePermissionRow[];
    },
  });

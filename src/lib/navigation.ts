import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Building2,
  HardHat,
  CalendarDays,
  Euro,
  BadgeEuro,
  FileText,
  Settings,
  Activity,
  Inbox,
} from "lucide-react";
import { appSettingsQuery } from "@/lib/settings";
import { PERM } from "@/lib/permissions";

export interface NavPage {
  key: string;
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm?: string;
}

/**
 * Canonical navigation registry. New modules are added here once; ordering and
 * visibility are then user-configurable via Einstellungen → Seiten.
 */
export const NAV_PAGES: NavPage[] = [
  { key: "dashboard", to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: PERM.dashboardView },
  { key: "projekte", to: "/projekte", label: "Projekte", icon: FolderKanban, perm: PERM.projekteView },
  { key: "auftraege", to: "/auftraege", label: "Aufträge", icon: ClipboardList, perm: PERM.auftraegeView },
  { key: "importe", to: "/importe", label: "Importe", icon: Inbox, perm: PERM.importeView },
  { key: "kalender", to: "/kalender", label: "Kalender", icon: CalendarDays, perm: PERM.kalenderView },
  { key: "auftraggeber", to: "/kunden", label: "Auftraggeber", icon: Building2, perm: PERM.auftraggeberView },
  { key: "mitarbeiter", to: "/mitarbeiter", label: "Mitarbeiter", icon: HardHat, perm: PERM.mitarbeiterView },
  { key: "aktivitaet", to: "/aktivitaet", label: "Aktivität", icon: Activity, perm: "aktivitaet.view" },
  { key: "umsatz", to: "/umsatz", label: "Umsatz/Gewinn", icon: Euro, perm: PERM.umsatzView },
  { key: "abrechnung", to: "/abrechnung", label: "Abrechnung", icon: FileText, perm: PERM.abrechnungView },
  { key: "bezahlt", to: "/bezahlt", label: "Bezahlte Aufträge", icon: BadgeEuro, perm: PERM.bezahltView },
  { key: "einstellungen", to: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export interface NavConfig {
  order: string[];
  hidden: string[];
}

export const NAV_DEFAULT: NavConfig = {
  order: NAV_PAGES.map((p) => p.key),
  hidden: [],
};

export const navConfigQuery = () => appSettingsQuery<NavConfig>("navigation", NAV_DEFAULT);

/**
 * Returns the ordered, permission-filtered nav pages honoring the saved config.
 * Unknown/new pages are appended so newly added modules always show up.
 * `einstellungen` can never be hidden (safety valve for owners).
 */
export function useNavPages(can: (p: string) => boolean) {
  const { data: cfg = NAV_DEFAULT } = useQuery(navConfigQuery());

  const ordered = [
    ...cfg.order.filter((k) => NAV_PAGES.some((p) => p.key === k)),
    ...NAV_PAGES.map((p) => p.key).filter((k) => !cfg.order.includes(k)),
  ];

  return ordered
    .map((key) => NAV_PAGES.find((p) => p.key === key)!)
    .filter((p) => p.key === "einstellungen" || !cfg.hidden.includes(p.key))
    .filter((p) => !p.perm || can(p.perm));
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutGrid, Loader2, Info } from "lucide-react";
import { saveAppSetting } from "@/lib/settings";
import { NAV_PAGES, NAV_DEFAULT, navConfigQuery, type NavConfig } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RequirePermission } from "@/components/PermissionGuard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SortableList } from "@/components/dnd/SortableList";
import { RoleDashboardSettings } from "@/components/dashboard/RoleDashboardSettings";

export const Route = createFileRoute("/_authenticated/einstellungen/seiten")({
  component: () => (
    <RequirePermission perm="seiten.manage">
      <SeitenPage />
    </RequirePermission>
  ),
});

function SeitenPage() {
  const qc = useQueryClient();
  const { data: loaded, isLoading } = useQuery(navConfigQuery());
  const [draft, setDraft] = useState<NavConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const cfg = draft ?? loaded ?? NAV_DEFAULT;
  // All known pages present, new pages appended at the end.
  const order = [
    ...cfg.order.filter((k) => NAV_PAGES.some((p) => p.key === k)),
    ...NAV_PAGES.map((p) => p.key).filter((k) => !cfg.order.includes(k)),
  ];

  const items = order.map((key) => ({ id: key, ...NAV_PAGES.find((p) => p.key === key)! }));

  const dirty = draft !== null;

  const toggleHidden = (key: string) => {
    const hidden = cfg.hidden.includes(key)
      ? cfg.hidden.filter((k) => k !== key)
      : [...cfg.hidden, key];
    setDraft({ order, hidden });
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveAppSetting("navigation", { order, hidden: cfg.hidden });
      await qc.invalidateQueries({ queryKey: ["app_settings", "navigation"] });
      setDraft(null);
      toast.success("Navigation gespeichert.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SettingsSection
        title="Seitenreihenfolge & Sichtbarkeit"
        icon={<LayoutGrid className="h-4 w-4 text-primary" />}
        description="Ziehen zum Sortieren der Navigation. Seiten unternehmensweit ein- oder ausblenden. Einstellungen bleibt immer sichtbar."
        actions={
          <Button size="sm" onClick={save} disabled={busy || !dirty}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Speichern
          </Button>
        }
      >
        <SortableList
          items={items}
          onReorder={(next) => setDraft({ order: next.map((i) => i.id), hidden: cfg.hidden })}
          renderItem={(page, handle) => {
            const hidden = cfg.hidden.includes(page.key);
            const locked = page.key === "einstellungen";
            return (
              <div
                className={`flex items-center gap-3 rounded-xl border border-border bg-background p-3 ${hidden ? "opacity-60" : ""}`}
              >
                {handle}
                <page.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{page.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sichtbar</span>
                  <Switch
                    checked={!hidden}
                    disabled={locked}
                    onCheckedChange={() => toggleHidden(page.key)}
                  />
                </div>
              </div>
            );
          }}
        />
      </SettingsSection>

      <SettingsSection
        title="Standard-Dashboard pro Rolle"
        icon={<LayoutGrid className="h-4 w-4 text-primary" />}
        description="Lege das Standard-Layout, Widget-Sichtbarkeit, Größe und Reihenfolge pro Rolle fest. Bestimme außerdem, ob Benutzer dieser Rolle ihr Dashboard selbst anpassen dürfen."
      >
        <RoleDashboardSettings />
      </SettingsSection>

      <SettingsSection title="Eigene Seiten & Widgets" icon={<Info className="h-4 w-4 text-primary" />}>
        <p className="text-sm text-muted-foreground">
          Das Dashboard ist widget-basiert. Benutzer mit Anpassungsrecht können das Dashboard über
          „Bearbeiten" selbst konfigurieren (Widgets hinzufügen, verschieben, Größe/Höhe anpassen
          oder ausblenden). Die Anordnung wird pro Benutzer gespeichert.
        </p>
      </SettingsSection>
    </>
  );
}

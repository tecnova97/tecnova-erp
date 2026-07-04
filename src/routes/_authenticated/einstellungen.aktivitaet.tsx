import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Loader2, Info } from "lucide-react";
import { appSettingsQuery, saveAppSetting } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RequirePermission } from "@/components/PermissionGuard";
import { SettingsSection, Field } from "@/components/settings/SettingsSection";

export const Route = createFileRoute("/_authenticated/einstellungen/aktivitaet")({
  component: () => (
    <RequirePermission perm="aktivitaet.view">
      <AktivitaetPage />
    </RequirePermission>
  ),
});

interface ActivityConfig {
  retention_days: number;
  owner_only: boolean;
  log_data_changes: boolean;
  enable_rollback: boolean;
}

const DEFAULTS: ActivityConfig = {
  retention_days: 365,
  owner_only: true,
  log_data_changes: true,
  enable_rollback: false,
};

function AktivitaetPage() {
  const { data: loaded, isLoading } = useQuery(appSettingsQuery<ActivityConfig>("activity", DEFAULTS));
  const [draft, setDraft] = useState<ActivityConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const cfg = draft ?? loaded ?? DEFAULTS;
  const set = <K extends keyof ActivityConfig>(k: K, v: ActivityConfig[K]) => setDraft({ ...cfg, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      await saveAppSetting("activity", cfg);
      toast.success("Aktivitätseinstellungen gespeichert.");
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
        title="Aktivität & Audit"
        icon={<Activity className="h-4 w-4 text-primary" />}
        description="Aufbewahrung, Sichtbarkeit und Grundlagen für die Nachverfolgung von Änderungen."
        actions={
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Speichern
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Aufbewahrungsdauer (Tage)">
            <Input
              type="number"
              min="30"
              max="3650"
              value={cfg.retention_days}
              onChange={(e) => set("retention_days", Number(e.target.value))}
              className="max-w-[12rem]"
            />
          </Field>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3">
            <span className="text-sm">
              <span className="font-medium">Nur für Inhaber sichtbar</span>
              <span className="block text-xs text-muted-foreground">
                Audit-Protokoll ausschließlich für Inhaber zugänglich.
              </span>
            </span>
            <Switch checked={cfg.owner_only} onCheckedChange={(v) => set("owner_only", v)} />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3">
            <span className="text-sm">
              <span className="font-medium">Datenänderungen protokollieren</span>
              <span className="block text-xs text-muted-foreground">
                Erstellen, Bearbeiten und Löschen von Datensätzen aufzeichnen.
              </span>
            </span>
            <Switch checked={cfg.log_data_changes} onCheckedChange={(v) => set("log_data_changes", v)} />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3">
            <span className="text-sm">
              <span className="font-medium">Rollback vorbereiten</span>
              <span className="block text-xs text-muted-foreground">
                Snapshots für spätere Wiederherstellung vorhalten (Vorbereitung).
              </span>
            </span>
            <Switch checked={cfg.enable_rollback} onCheckedChange={(v) => set("enable_rollback", v)} />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title="Hinweis" icon={<Info className="h-4 w-4 text-primary" />}>
        <p className="text-sm text-muted-foreground">
          Diese Einstellungen legen die Grundlage für ein vollständiges Audit-Log mit
          Änderungsverlauf und Wiederherstellung. Die Ereignisaufzeichnung wird in einer späteren
          Ausbaustufe an diese Konfiguration angebunden.
        </p>
      </SettingsSection>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Smartphone, Save, Loader2 } from "lucide-react";
import {
  mobileWorkerSettingsQuery,
  MOBILE_WORKER_DEFAULT,
  type MobileWorkerSettings,
} from "@/lib/mobileSettings";
import { saveAppSetting } from "@/lib/settings";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { RequirePermission } from "@/components/PermissionGuard";
import { SettingsSection } from "@/components/settings/SettingsSection";

export const Route = createFileRoute("/_authenticated/einstellungen/mobile")({
  head: () => ({ meta: [{ title: "Mobile Worker – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.einstellungenManage}>
      <MobilePage />
    </RequirePermission>
  ),
});

function MobilePage() {
  const qc = useQueryClient();
  const { data } = useQuery(mobileWorkerSettingsQuery());
  const [cfg, setCfg] = useState<MobileWorkerSettings>(MOBILE_WORKER_DEFAULT);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setCfg({ ...MOBILE_WORKER_DEFAULT, ...data });
  }, [data]);

  const set = <K extends keyof MobileWorkerSettings>(key: K, value: MobileWorkerSettings[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      await saveAppSetting("mobile_worker", cfg);
      await qc.invalidateQueries({ queryKey: ["app_settings", "mobile_worker"] });
      toast.success("Mobile-Einstellungen gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Sichtbare Tage"
        description="Steuere, wie weit Monteure in die Zukunft planen können."
        icon={<Smartphone className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <ToggleRow
            label="Morgen anzeigen"
            hint="Erlaubt den Wechsel auf zukünftige Tage."
            checked={cfg.allow_tomorrow}
            onChange={(v) => set("allow_tomorrow", v)}
          />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Zukünftige Tage</p>
              <p className="text-xs text-muted-foreground">
                Anzahl Tage nach heute (0 = nur Heute), z. B. 2 = Heute/Morgen/Übermorgen.
              </p>
            </div>
            <Input
              type="number"
              min={0}
              max={30}
              value={cfg.future_days}
              onChange={(e) => set("future_days", Math.max(0, Math.min(30, Number(e.target.value))))}
              className="h-10 w-20 text-center"
              disabled={!cfg.allow_tomorrow}
            />
          </div>
          <ToggleRow
            label="Abgeschlossene Aufträge anzeigen"
            checked={cfg.allow_completed}
            onChange={(v) => set("allow_completed", v)}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Uploads" description="Was Monteure hochladen dürfen.">
        <div className="space-y-4">
          <ToggleRow label="Fotos hochladen erlauben" checked={cfg.allow_upload_photos} onChange={(v) => set("allow_upload_photos", v)} />
          <ToggleRow label="Dokumente hochladen erlauben" checked={cfg.allow_upload_documents} onChange={(v) => set("allow_upload_documents", v)} />
        </div>
      </SettingsSection>

      <SettingsSection title="Abschluss-Pflichtfelder" description="Bedingungen, bevor ein Auftrag abgeschlossen werden kann.">
        <div className="space-y-4">
          <ToggleRow label="Fotos vor Abschluss erforderlich" checked={cfg.require_photos} onChange={(v) => set("require_photos", v)} />
          <ToggleRow label="Dokumente vor Abschluss erforderlich" checked={cfg.require_documents} onChange={(v) => set("require_documents", v)} />
          <ToggleRow label="Notiz vor Abschluss erforderlich" checked={cfg.require_note} onChange={(v) => set("require_note", v)} />
        </div>
      </SettingsSection>

      <SettingsSection title="Karten & Anzeige" description="Darstellung in der Monteur-Ansicht.">
        <div className="space-y-4">
          <ToggleRow label="Monteur-Anzahl auf Karten anzeigen" checked={cfg.show_worker_count} onChange={(v) => set("show_worker_count", v)} />
          <ToggleRow label="Status-Badges auf Karten anzeigen" checked={cfg.show_status_badges} onChange={(v) => set("show_status_badges", v)} />
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Speichern
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

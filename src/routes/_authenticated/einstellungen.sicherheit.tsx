import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Lock,
  Loader2,
  ShieldCheck,
  Smartphone,
  History,
  Timer,
} from "lucide-react";
import { appSettingsQuery, saveAppSetting } from "@/lib/settings";
import { fetchSecurityEvents, type SecurityEvent } from "@/lib/security";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RequirePermission } from "@/components/PermissionGuard";
import { SettingsSection, Field } from "@/components/settings/SettingsSection";
import { MfaManager } from "@/components/settings/MfaManager";
import { TrustedDevicesManager } from "@/components/settings/TrustedDevicesManager";

export const Route = createFileRoute("/_authenticated/einstellungen/sicherheit")({
  component: () => (
    <RequirePermission perm={PERM.einstellungenManage}>
      <SicherheitPage />
    </RequirePermission>
  ),
});

interface SecuritySettings {
  persistent_sessions: boolean;
  lock_threshold: number;
  lock_window_minutes: number;
}

const DEFAULTS: SecuritySettings = {
  persistent_sessions: true,
  lock_threshold: 5,
  lock_window_minutes: 15,
};

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  login_failed: { label: "Anmeldung fehlgeschlagen", className: "bg-destructive/15 text-destructive" },
  login_locked: { label: "Gesperrt", className: "bg-warning/15 text-warning" },
  login_success: { label: "Anmeldung erfolgreich", className: "bg-success/15 text-success" },
  logout: { label: "Abmeldung", className: "bg-muted text-muted-foreground" },
  logout_all_devices: { label: "Überall abgemeldet", className: "bg-warning/15 text-warning" },
  password_changed: { label: "Passwort geändert", className: "bg-primary/15 text-primary" },
  mfa_setup: { label: "MFA eingerichtet", className: "bg-success/15 text-success" },
  mfa_removed: { label: "MFA entfernt", className: "bg-warning/15 text-warning" },
  mfa_failed: { label: "MFA fehlgeschlagen", className: "bg-destructive/15 text-destructive" },
  trusted_device_added: { label: "Gerät vertraut", className: "bg-primary/15 text-primary" },
  trusted_device_removed: { label: "Gerät entfernt", className: "bg-muted text-muted-foreground" },
  account_disabled: { label: "Konto deaktiviert", className: "bg-destructive/15 text-destructive" },
  account_enabled: { label: "Konto aktiviert", className: "bg-success/15 text-success" },
};

function SicherheitPage() {
  const { data: loaded, isLoading } = useQuery(appSettingsQuery<SecuritySettings>("security", DEFAULTS));
  const [draft, setDraft] = useState<SecuritySettings | null>(null);
  const [busy, setBusy] = useState(false);

  const cfg = draft ?? loaded ?? DEFAULTS;
  const set = <K extends keyof SecuritySettings>(k: K, v: SecuritySettings[K]) =>
    setDraft({ ...cfg, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      await saveAppSetting("security", cfg);
      toast.success("Sicherheitseinstellungen gespeichert.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const { data: events = [] } = useQuery({
    queryKey: ["security_events"],
    queryFn: () => fetchSecurityEvents(80),
  });

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
        title="Sitzungen"
        icon={<Timer className="h-4 w-4 text-primary" />}
        description="Anmeldungen bleiben dauerhaft aktiv und werden automatisch verlängert. Nutzer werden nicht nach kurzer Inaktivität abgemeldet – nur bei manueller Abmeldung, deaktiviertem Konto oder erzwungener Abmeldung."
        actions={
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Speichern
          </Button>
        }
      >
        <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3">
          <span className="text-sm">
            <span className="font-medium">Dauerhafte Sitzungen</span>
            <span className="block text-xs text-muted-foreground">
              Angemeldet bleiben, bis man sich aktiv abmeldet (Refresh-Token).
            </span>
          </span>
          <Switch checked={cfg.persistent_sessions} onCheckedChange={(v) => set("persistent_sessions", v)} />
        </label>
      </SettingsSection>

      <SettingsSection
        title="Zwei-Faktor-Authentifizierung (mein Konto)"
        icon={<ShieldCheck className="h-4 w-4 text-primary" />}
        description="Richte deine eigene Authenticator-App ein. Jeder Nutzer verwaltet seine Faktoren selbst."
      >
        <MfaManager />
      </SettingsSection>

      <SettingsSection
        title="Vertrauenswürdige Geräte (alle Nutzer)"
        icon={<Smartphone className="h-4 w-4 text-primary" />}
        description="Übersicht aller gemerkten Geräte. Entziehe im Verdachtsfall das Vertrauen – die nächste Anmeldung erfordert dann wieder MFA."
      >
        <TrustedDevicesManager />
      </SettingsSection>

      <SettingsSection
        title="Kontosperre"
        icon={<Lock className="h-4 w-4 text-primary" />}
        description="Schutz vor unbefugten Anmeldeversuchen."
        actions={
          <Button size="sm" onClick={save} disabled={busy}>
            Speichern
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fehlversuche bis zur Sperre">
            <Input
              type="number"
              min="3"
              max="10"
              value={cfg.lock_threshold}
              onChange={(e) => set("lock_threshold", Number(e.target.value))}
            />
          </Field>
          <Field label="Sperrdauer (Minuten)">
            <Input
              type="number"
              min="5"
              max="120"
              value={cfg.lock_window_minutes}
              onChange={(e) => set("lock_window_minutes", Number(e.target.value))}
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Sicherheitsprotokoll"
        icon={<History className="h-4 w-4 text-primary" />}
        description="Anmeldeversuche und sicherheitsrelevante Ereignisse."
      >
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Ereignisse aufgezeichnet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Zeitpunkt</th>
                  <th className="py-2 pr-3 font-semibold">E-Mail</th>
                  <th className="py-2 pr-3 font-semibold">Aktion</th>
                  <th className="py-2 pr-3 font-semibold">IP-Adresse</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e: SecurityEvent) => {
                  const meta = ACTION_LABELS[e.action] ?? { label: e.action, className: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={e.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("de-DE")}
                      </td>
                      <td className="py-2 pr-3">{e.email ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.className}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{e.ip_address ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ServerCog,
  Trash2,
  Loader2,
  FlaskConical,
  Rocket,
  CheckCircle2,
  XCircle,
  Building2,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { KeinZugriff } from "@/components/PermissionGuard";
import { SettingsSection, Field } from "@/components/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Link } from "@tanstack/react-router";
import {
  pilotConfigQuery,
  feedbackQuery,
  cleanupTestData,
  CLEANUP_CONFIRM_PHRASE,
  CLEANUP_LABELS,
  readDeploymentEnv,
  PRODUCTION_DOMAIN,
  type CleanupResult,
} from "@/lib/system";
import { saveAppSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/einstellungen/system")({
  head: () => ({ meta: [{ title: "System – TecNova ERP" }] }),
  component: SystemPage,
});

function SystemPage() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (role !== "owner") {
    return (
      <KeinZugriff
        title="Nur für den Inhaber"
        description="Die Systemwerkzeuge (Testdaten, Deployment, Pilotbetrieb) sind ausschließlich dem Inhaber vorbehalten."
      />
    );
  }

  return (
    <>
      <OwnerSetupSection />
      <DeploymentCheckSection />
      <PilotSection />
      <FeedbackSection />
      <CleanupSection />
    </>
  );
}

// ---------------------------------------------------------------------------
// Owner / company setup pointer
// ---------------------------------------------------------------------------
function OwnerSetupSection() {
  return (
    <SettingsSection
      title="Inhaber & Firmendaten"
      icon={<Building2 className="h-4 w-4 text-primary" />}
      description="Trage vor dem Echtbetrieb die endgültigen Inhaber- und Firmendaten ein. Diese lassen sich jederzeit im Firmenprofil aktualisieren."
    >
      <ul className="mb-4 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
        <li>• Inhaber, E-Mail, Telefon</li>
        <li>• Firmenname & Adresse</li>
        <li>• Steuernummer & USt-IdNr.</li>
        <li>• Bankdaten (IBAN / BIC)</li>
        <li>• Logos & Favicon</li>
        <li>• Theme & Farben</li>
      </ul>
      <Button asChild size="sm">
        <Link to="/einstellungen/firmenprofil">Firmenprofil bearbeiten</Link>
      </Button>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Deployment check
// ---------------------------------------------------------------------------
function CheckRow({ ok, label, hint }: { ok: boolean | null; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
      {ok === null ? (
        <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/40" />
      ) : ok ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="break-words text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function DeploymentCheckSection() {
  const env = readDeploymentEnv();
  const domainReady = env.origin.includes(PRODUCTION_DOMAIN);

  return (
    <SettingsSection
      title="Deployment Check"
      icon={<Rocket className="h-4 w-4 text-primary" />}
      description="Prüfliste für den produktiven Betrieb auf statischem Hosting (Cloudflare Pages) mit Lovable-Cloud-Backend."
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <CheckRow ok={env.hasSupabaseUrl} label="Backend-URL konfiguriert" hint={env.supabaseUrl || "VITE_SUPABASE_URL fehlt"} />
        <CheckRow ok={env.hasAnonKey} label="Backend-Schlüssel (anon) konfiguriert" hint="VITE_SUPABASE_PUBLISHABLE_KEY" />
        <CheckRow ok={domainReady} label={`Domain: ${PRODUCTION_DOMAIN}`} hint={domainReady ? "Läuft bereits auf der Produktionsdomain." : `Aktuell: ${env.origin || "unbekannt"}`} />
        <CheckRow ok={null} label="Auth Redirect-URLs eingetragen" hint={`Site-URL + https://${PRODUCTION_DOMAIN} in der Backend-Auth-Konfiguration`} />
        <CheckRow ok={null} label="Build-Befehl dokumentiert" hint="npm run build" />
        <CheckRow ok={null} label="Ausgabeordner dokumentiert" hint="dist/" />
        <CheckRow ok={true} label="PWA-Manifest vorhanden" hint="/manifest.webmanifest" />
        <CheckRow ok={null} label="Umgebungsvariablen dokumentiert" hint="siehe DEPLOYMENT.md" />
        <CheckRow ok={null} label="Security-Scan geprüft" hint="Vor dem Livegang durchführen." />
        <CheckRow ok={null} label="Testdaten bereinigt" hint="siehe Abschnitt unten" />
        <CheckRow ok={null} label="Backup-Erinnerung bestätigt" hint="Regelmäßige Datensicherung einrichten." />
      </div>
      <p className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Offene (graue) Punkte müssen manuell außerhalb der App geprüft werden. Details stehen in den
        Dateien <span className="font-mono">DEPLOYMENT.md</span> und{" "}
        <span className="font-mono">ANDROID_BUILD.md</span> im Projektverzeichnis.
      </p>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Pilot mode
// ---------------------------------------------------------------------------
function PilotSection() {
  const qc = useQueryClient();
  const { data } = useQuery(pilotConfigQuery());
  const [busy, setBusy] = useState(false);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      await saveAppSetting("pilot", { enabled });
      await qc.invalidateQueries({ queryKey: ["app_settings", "pilot"] });
      toast.success("Gespeichert");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      title="Pilotbetrieb"
      icon={<FlaskConical className="h-4 w-4 text-primary" />}
      description="Im Pilotbetrieb sehen alle Benutzer ein Kennzeichen „Pilotbetrieb“ und können direkt Feedback senden."
    >
      <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3">
        <span className="text-sm">
          <span className="font-medium">Pilotbetrieb aktivieren</span>
          <span className="block text-xs text-muted-foreground">
            Zeigt das Pilot-Kennzeichen und den Feedback-Button in der App.
          </span>
        </span>
        <Switch checked={!!data?.enabled} onCheckedChange={toggle} disabled={busy} />
      </label>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Feedback list (owner)
// ---------------------------------------------------------------------------
function FeedbackSection() {
  const { data: pilot } = useQuery(pilotConfigQuery());
  const { data: rows, isLoading } = useQuery(feedbackQuery(true));

  return (
    <SettingsSection
      title="Feedback"
      icon={<MessageSquare className="h-4 w-4 text-primary" />}
      description="Rückmeldungen aus dem Pilotbetrieb."
    >
      {!pilot?.enabled && (
        <p className="mb-3 text-xs text-muted-foreground">
          Pilotbetrieb ist derzeit deaktiviert – Benutzer sehen den Feedback-Button nicht.
        </p>
      )}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch kein Feedback vorhanden.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-background p-3">
              <p className="whitespace-pre-wrap text-sm">{r.message}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {r.page ?? "—"} · {new Date(r.created_at).toLocaleString("de-DE")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Test data cleanup (destructive, owner-only)
// ---------------------------------------------------------------------------
function CleanupSection() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);

  const canRun = confirm.trim() === CLEANUP_CONFIRM_PHRASE;

  const run = async () => {
    if (!canRun) return;
    setBusy(true);
    try {
      const res = await cleanupTestData();
      setResult(res);
      setConfirm("");
      await qc.invalidateQueries();
      toast.success("Testdaten wurden bereinigt.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bereinigung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-soft sm:p-6">
      <div className="flex items-start gap-2">
        <ServerCog className="mt-0.5 h-4 w-4 text-destructive" />
        <div>
          <h2 className="text-base font-bold text-destructive">Testdaten bereinigen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Entfernt dauerhaft alle operativen Testdaten (Aufträge, Projekte, Auftraggeber,
            Test-Mitarbeiter ohne Login, Zahlungen, Rechnungsgruppen, Dokumente, Importe,
            Kalender-Blocker, Ausgaben, Aktivitätsprotokolle und Feedback).
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-background p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p className="text-sm font-medium">
          Diese Aktion löscht Testdaten dauerhaft. Systemeinstellungen bleiben erhalten.
        </p>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Bleibt erhalten:</span> Inhaber-Konto, Rollen,
        Berechtigungen, Statusverwaltung, Leistungspositionen, Branding/Logos, Theme, Firmenprofil,
        Sicherheitseinstellungen, Metadaten-Felder, Import-Mappings, Dashboard-Konfiguration.
      </p>

      <div className="mt-4 max-w-sm">
        <Field label={`Zur Bestätigung „${CLEANUP_CONFIRM_PHRASE}“ eingeben`}>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CLEANUP_CONFIRM_PHRASE}
            autoComplete="off"
          />
        </Field>
      </div>

      <Button
        variant="destructive"
        className="mt-4"
        disabled={!canRun || busy}
        onClick={run}
      >
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
        Testdaten endgültig löschen
      </Button>

      {result && (
        <div className="mt-5 rounded-xl border border-border bg-background p-4">
          <p className="mb-2 text-sm font-semibold text-success">Bereinigung abgeschlossen</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {Object.entries(result.counts).map(([key, value]) => (
              <li key={key} className={cn("flex justify-between gap-2", value === 0 && "text-muted-foreground")}>
                <span>{CLEANUP_LABELS[key] ?? key}</span>
                <span className="font-semibold tabular-nums">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

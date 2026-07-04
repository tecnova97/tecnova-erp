import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User2, KeyRound, Loader2, ShieldCheck, Smartphone, LogOut, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { passwordError } from "@/lib/password";
import { logSecurityEvent } from "@/lib/security";
import { PasswordField } from "@/components/PasswordField";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { MfaManager } from "@/components/settings/MfaManager";
import { TrustedDevicesManager } from "@/components/settings/TrustedDevicesManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/settings/SettingsSection";

const ROLE_LABELS: Record<string, string> = {
  owner: "Inhaber",
  disponent: "Disponent",
  worker: "Monteur",
};

export const Route = createFileRoute("/_authenticated/einstellungen/")({
  component: MeinKontoPage,
});

function MeinKontoPage() {
  const { profile, role, user } = useAuth();

  return (
    <>
      <ProfileCard />

      <SettingsSection title="Konto" icon={<User2 className="h-4 w-4 text-primary" />}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label="E-Mail" value={profile?.email ?? "—"} />
          <Row label="Rolle" value={role ? ROLE_LABELS[role] ?? role : "—"} />
          <Row
            label="Letzte Anmeldung"
            value={profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString("de-DE") : "—"}
          />
        </dl>
      </SettingsSection>

      <ChangePasswordCard />

      <SettingsSection
        title="Zwei-Faktor-Authentifizierung"
        icon={<ShieldCheck className="h-4 w-4 text-primary" />}
        description="Sichere dein Konto mit einer Authenticator-App (TOTP)."
      >
        <MfaManager />
      </SettingsSection>

      <SettingsSection
        title="Vertrauenswürdige Geräte"
        icon={<Smartphone className="h-4 w-4 text-primary" />}
        description="Geräte, auf denen die Zwei-Faktor-Abfrage 30 Tage übersprungen wird."
      >
        {user && <TrustedDevicesManager userId={user.id} />}
      </SettingsSection>

      <SessionsCard />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-background p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function ProfileCard() {
  const { profile, user, refresh } = useAuth();
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [telefon, setTelefon] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVorname(profile?.vorname ?? "");
    setNachname(profile?.nachname ?? "");
    setTelefon(profile?.telefon ?? "");
  }, [profile?.vorname, profile?.nachname, profile?.telefon]);

  const dirty =
    vorname !== (profile?.vorname ?? "") ||
    nachname !== (profile?.nachname ?? "") ||
    telefon !== (profile?.telefon ?? "");

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ vorname, nachname, telefon } as never)
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Profil gespeichert.");
  };

  return (
    <SettingsSection
      title="Persönliche Daten"
      icon={<User2 className="h-4 w-4 text-primary" />}
      actions={
        <Button size="sm" onClick={save} disabled={busy || !dirty}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Speichern
        </Button>
      }
    >
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pv">Vorname</Label>
          <Input id="pv" value={vorname} onChange={(e) => setVorname(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn">Nachname</Label>
          <Input id="pn" value={nachname} onChange={(e) => setNachname(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pt">Telefon</Label>
          <Input id="pt" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
        </div>
      </div>
    </SettingsSection>
  );
}

function ChangePasswordCard() {
  const { refresh, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const policyError = passwordError(password);
    if (policyError) return toast.error(policyError);
    if (password !== confirm) return toast.error("Die Passwörter stimmen nicht überein.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error && user) {
      await supabase.from("profiles").update({ force_password_change: false } as never).eq("id", user.id);
      await logSecurityEvent("password_changed");
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    setPassword("");
    setConfirm("");
    await refresh();
    toast.success("Passwort erfolgreich geändert.");
  };

  return (
    <SettingsSection title="Passwort ändern" icon={<KeyRound className="h-4 w-4 text-primary" />}>
      <form onSubmit={submit} className="max-w-sm space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="new-pw">
            Neues Passwort
          </label>
          <PasswordField id="new-pw" autoComplete="new-password" value={password} onChange={setPassword} required />
        </div>
        {password.length > 0 && <PasswordRequirements value={password} />}
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="confirm-pw">
            Passwort bestätigen
          </label>
          <PasswordField id="confirm-pw" autoComplete="new-password" value={confirm} onChange={setConfirm} required />
        </div>
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Passwort speichern
        </Button>
      </form>
    </SettingsSection>
  );
}

function SessionsCard() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const logoutEverywhere = async () => {
    setBusy(true);
    try {
      await logSecurityEvent("logout_all_devices");
      await supabase.auth.signOut({ scope: "global" });
      toast.success("Von allen Geräten abgemeldet.");
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      title="Sitzungen"
      icon={<LogOut className="h-4 w-4 text-primary" />}
      description="Du bleibst dauerhaft angemeldet, bis du dich abmeldest. Bei Verdacht kannst du dich überall abmelden."
    >
      <Button variant="outline" onClick={logoutEverywhere} disabled={busy} className="text-destructive">
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}
        Von allen Geräten abmelden
      </Button>
    </SettingsSection>
  );
}

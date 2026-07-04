import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { passwordError } from "@/lib/password";
import { logSecurityEvent } from "@/lib/security";
import { Logo } from "@/components/Logo";
import { PasswordField } from "@/components/PasswordField";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { MfaManager } from "@/components/settings/MfaManager";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MFA_SEEN_KEY = "tecnova.mfa_prompt_seen";

/**
 * Blocks the app on first login until the temporary password is changed,
 * then offers MFA setup (skippable to avoid lockouts).
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { profile, user, refresh } = useAuth();
  const forcePw = profile?.force_password_change === true;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [mfaDismissed, setMfaDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(MFA_SEEN_KEY) === (user?.id ?? ""),
  );

  // --- Step 1: forced password change -------------------------------------
  if (forcePw) {
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      const err = passwordError(password);
      if (err) return toast.error(err);
      if (password !== confirm) return toast.error("Die Passwörter stimmen nicht überein.");
      setBusy(true);
      try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        if (user) {
          await supabase.from("profiles").update({ force_password_change: false } as never).eq("id", user.id);
        }
        await logSecurityEvent("password_changed");
        await refresh();
        setPwDone(true);
        toast.success("Passwort gesetzt.");
      } catch (e2) {
        toast.error(e2 instanceof Error ? e2.message : "Fehler beim Speichern");
      } finally {
        setBusy(false);
      }
    };

    return (
      <GateShell
        icon={<KeyRound className="h-3.5 w-3.5" />}
        badge="Passwort festlegen"
        title="Neues Passwort erforderlich"
        subtitle="Dein Konto nutzt ein temporäres Passwort. Bitte lege jetzt ein persönliches Passwort fest."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="onb-pw">Neues Passwort</Label>
            <PasswordField id="onb-pw" autoComplete="new-password" value={password} onChange={setPassword} required />
          </div>
          {password.length > 0 && <PasswordRequirements value={password} />}
          <div className="space-y-1.5">
            <Label htmlFor="onb-pw2">Passwort bestätigen</Label>
            <PasswordField id="onb-pw2" autoComplete="new-password" value={confirm} onChange={setConfirm} required />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Passwort speichern"}
          </Button>
        </form>
      </GateShell>
    );
  }

  // --- Step 2: MFA setup (only right after a forced password change) -------
  if (pwDone && !mfaDismissed) {
    const dismiss = () => {
      if (user) localStorage.setItem(MFA_SEEN_KEY, user.id);
      setMfaDismissed(true);
    };
    return (
      <GateShell
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        badge="Sicherheit"
        title="Zwei-Faktor-Authentifizierung"
        subtitle="Sichere dein Konto zusätzlich mit einer Authenticator-App. Du kannst das auch später in den Einstellungen tun."
      >
        <MfaManager onVerified={dismiss} />
        <Button variant="ghost" className="mt-4 w-full" onClick={dismiss}>
          Später einrichten
        </Button>
      </GateShell>
    );
  }

  return <>{children}</>;
}

function GateShell({
  icon,
  badge,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  badge: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo location="login" />
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {icon} {badge}
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">{children}</div>
      </div>
    </div>
  );
}

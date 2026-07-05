import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getPendingInvitation,
  acceptSelfInvitation,
  appBaseUrl,
  type PendingInvitation,
} from "@/lib/invitations";
import { Logo } from "@/components/Logo";
import { PasswordField } from "@/components/PasswordField";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordError } from "@/lib/password";

type RegisterSearch = { email?: string };

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Registrieren – TecNova ERP" }] }),
  validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { email: emailParam } = Route.useSearch();
  const email = (emailParam ?? "").trim().toLowerCase();

  const [checking, setChecking] = useState(true);
  const [invitation, setInvitation] = useState<PendingInvitation | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!email) {
        if (active) setChecking(false);
        return;
      }
      try {
        const inv = await getPendingInvitation(email);
        if (active) setInvitation(inv);
      } catch {
        if (active) setInvitation(null);
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const policyError = passwordError(password);
    if (policyError) return toast.error(policyError);
    if (password !== confirm) return toast.error("Die Passwörter stimmen nicht überein.");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${appBaseUrl()}/auth`,
          data: {
            vorname: invitation?.vorname ?? "",
            nachname: invitation?.nachname ?? "",
          },
        },
      });
      if (error) throw error;

      // If e-mail confirmation is required, there is no session yet.
      if (!data.session) {
        toast.success(
          "Konto erstellt. Bitte bestätige deine E-Mail-Adresse, um die Anmeldung abzuschließen.",
        );
        navigate({ to: "/auth", replace: true });
        return;
      }

      // Session exists: claim the invitation (profile + roles) and route by role.
      const result = await acceptSelfInvitation();
      toast.success("Konto erstellt.");
      const dest = result.base_role === "worker" ? "/meine-arbeit" : "/dashboard";
      navigate({ to: dest, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registrierung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo location="login" />
        </div>

        {checking ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !email || !invitation || !invitation.valid ? (
          <>
            <h2 className="text-2xl font-extrabold tracking-tight">Keine gültige Einladung</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keine gültige Einladung gefunden. Bitte wende dich an deinen Administrator, um eine
              neue Einladung zu erhalten.
            </p>
            <Button className="mt-6 w-full" size="lg" onClick={() => navigate({ to: "/auth" })}>
              Zur Anmeldung
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-extrabold tracking-tight">Konto erstellen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege dein Passwort fest, um die Registrierung abzuschließen.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-Mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" className="pl-9" value={email} readOnly />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Passwort</Label>
                <PasswordField
                  id="pw"
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                  required
                />
              </div>
              {password.length > 0 && <PasswordRequirements value={password} />}
              <div className="space-y-1.5">
                <Label htmlFor="pw2">Passwort bestätigen</Label>
                <PasswordField
                  id="pw2"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={setConfirm}
                  required
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Konto erstellen"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

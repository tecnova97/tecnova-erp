import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { PasswordField } from "@/components/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  checkLoginLock,
  recordLoginAttempt,
  lockMessage,
  trustDevice,
  untrustDevice,
  isDeviceTrusted,
  registerTrustedDevice,
  MAX_LOGIN_ATTEMPTS,
} from "@/lib/security";

import authBg from "@/assets/auth-bg.jpg";

const REMEMBER_EMAIL_KEY = "tecnova.remember_email";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Anmelden – TecNova ERP" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "" : "",
  );
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() =>
    typeof window !== "undefined" ? isDeviceTrusted() : false,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [session, loading, navigate]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // 1) Refuse login while the account is temporarily locked.
      const preLock = await checkLoginLock(email);
      if (preLock.locked) {
        await recordLoginAttempt(email, "login_locked");
        toast.error(lockMessage(preLock.seconds_remaining));
        return;
      }

      // 2) Attempt sign-in.
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        await recordLoginAttempt(email, "login_failed");
        const postLock = await checkLoginLock(email);
        if (postLock.locked) {
          await recordLoginAttempt(email, "login_locked");
          toast.error(lockMessage(postLock.seconds_remaining));
          return;
        }
        const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - postLock.failed_count);
        const isCreds = error.message.includes("Invalid login");
        toast.error(
          isCreds
            ? `E-Mail oder Passwort ist falsch.${
                remaining > 0 && remaining <= 3
                  ? ` Noch ${remaining} Versuch${remaining === 1 ? "" : "e"}, danach wird die Anmeldung gesperrt.`
                  : ""
              }`
            : error.message.includes("Email not confirmed")
              ? "Dieses Konto ist noch nicht bestätigt."
              : error.message,
        );
        return;
      }

      // 3) Success.
      await recordLoginAttempt(email, "login_success");
      localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      if (remember) {
        trustDevice();
        const { data: u } = await supabase.auth.getUser();
        if (u.user) await registerTrustedDevice(u.user.id);
      } else {
        untrustDevice();
      }
      toast.success("Anmeldung erfolgreich.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Falls ein Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.");
      setMode("login");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ein Fehler ist aufgetreten";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-sidebar lg:block">
        <img
          src={authBg}
          alt=""
          width={1024}
          height={1280}
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo location="login" showText={false} />
          <div className="max-w-md">
            <h1 className="text-4xl font-extrabold leading-tight text-white">
              Das digitale Betriebssystem für den Glasfaserbau.
            </h1>
            <p className="mt-4 text-base text-white/70">
              Aufträge, Projekte, Kunden, Mitarbeiter und Field Service – alles an einem Ort.
              Schnell, übersichtlich und für jedes Gerät gemacht.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Glasfaser Einblasen", "Montage", "Field Service", "Telekommunikation"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/40">© {new Date().getFullYear()} TecNova GmbH</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Logo location="full" />
          </div>

          {mode === "login" ? (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight">Anmelden</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Melde dich mit deinen Zugangsdaten an.
              </p>

              <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-Mail</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className="pl-9"
                      placeholder="name@tec-nova.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Passwort</Label>
                  <PasswordField
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={setPassword}
                    required
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(v) => setRemember(v === true)}
                    />
                    Dieses Gerät 30 Tage merken
                  </label>
                  <button
                    type="button"
                    className="text-sm font-semibold text-primary hover:underline"
                    onClick={() => setMode("forgot")}
                  >
                    Passwort vergessen?
                  </button>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Anmelden"}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                Kein Zugang? Konten werden ausschließlich vom Inhaber angelegt.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Zurück zur Anmeldung
              </button>
              <h2 className="text-2xl font-extrabold tracking-tight">Passwort zurücksetzen</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Wir senden dir einen Link zum Zurücksetzen deines Passworts.
              </p>

              <form onSubmit={handleForgot} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="femail">E-Mail</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="femail"
                      type="email"
                      autoComplete="email"
                      className="pl-9"
                      placeholder="name@tec-nova.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link senden"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

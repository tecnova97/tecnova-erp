import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Building2, User2, Mail, Phone, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { systemNeedsSetup, runInitialSetup } from "@/lib/setup";
import { passwordError } from "@/lib/password";
import { Logo } from "@/components/Logo";
import { PasswordField } from "@/components/PasswordField";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Ersteinrichtung – TecNova ERP" }] }),
  component: SetupWizard,
});

function SetupWizard() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firmenname: "",
    vorname: "",
    nachname: "",
    email: "",
    telefon: "",
    password: "",
    confirm: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    systemNeedsSetup().then((needs) => {
      if (!needs) {
        navigate({ to: "/auth", replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwErr = passwordError(form.password);
    if (pwErr) return toast.error(pwErr);
    if (form.password !== form.confirm) return toast.error("Die Passwörter stimmen nicht überein.");
    setBusy(true);
    try {
      await runInitialSetup(form);
      await refresh();
      toast.success("Willkommen! Die Ersteinrichtung ist abgeschlossen.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Einrichtung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo location="login" />
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Ersteinrichtung
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Willkommen bei TecNova ERP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lege dein Unternehmen und dein Inhaber-Konto an. Das passiert nur einmal.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="space-y-1.5">
            <Label htmlFor="firmenname">Firmenname</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="firmenname" className="pl-9" value={form.firmenname} onChange={(e) => set("firmenname", e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vorname">Vorname</Label>
              <div className="relative">
                <User2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="vorname" className="pl-9" value={form.vorname} onChange={(e) => set("vorname", e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nachname">Nachname</Label>
              <Input id="nachname" value={form.nachname} onChange={(e) => set("nachname", e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" className="pl-9" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefon">Telefon</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="telefon" className="pl-9" value={form.telefon} onChange={(e) => set("telefon", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Passwort</Label>
            <PasswordField id="password" autoComplete="new-password" value={form.password} onChange={(v) => set("password", v)} required />
          </div>
          {form.password.length > 0 && <PasswordRequirements value={form.password} />}
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Passwort bestätigen</Label>
            <PasswordField id="confirm" autoComplete="new-password" value={form.confirm} onChange={(v) => set("confirm", v)} required />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Einrichtung abschließen"}
          </Button>
        </form>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { PasswordField } from "@/components/PasswordField";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { passwordError } from "@/lib/password";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Neues Passwort – TecNova ERP" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase sets a recovery session from the URL hash on load.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const policyError = passwordError(password);
    if (policyError) return toast.error(policyError);
    if (password !== confirm) return toast.error("Die Passwörter stimmen nicht überein.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Clear any forced-change flag now that a personal password exists.
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (uid) {
        await supabase
          .from("profiles")
          .update({ force_password_change: false } as never)
          .eq("id", uid);
      }

      // Route by role: owner/disponent -> dashboard, worker -> mobile worker area.
      let role: string | null = null;
      if (uid) {
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
        const list = (roles ?? []).map((r) => r.role as string);
        role = list.includes("owner")
          ? "owner"
          : list.includes("disponent")
            ? "disponent"
            : list[0] ?? "worker";
      }
      toast.success("Passwort gespeichert.");
      const dest = role === "worker" ? "/meine-arbeit" : "/dashboard";
      navigate({ to: dest, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
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
        <h2 className="text-2xl font-extrabold tracking-tight">Neues Passwort festlegen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready
            ? "Wähle ein sicheres neues Passwort."
            : "Öffne diesen Link aus der E-Mail zum Zurücksetzen deines Passworts."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw">Neues Passwort</Label>
            <PasswordField
              id="pw"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              disabled={!ready}
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
              disabled={!ready}
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy || !ready}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Passwort speichern"}
          </Button>
        </form>
      </div>
    </div>
  );
}

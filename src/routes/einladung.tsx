import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, AlertTriangle, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  lookupInvitation,
  acceptInvitation,
  derivePassword,
  type InvitationLookup,
} from "@/lib/invitations";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/einladung")({
  head: () => ({ meta: [{ title: "Einladung – TecNova ERP" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: EinladungPage,
});

function EinladungPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InvitationLookup | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    lookupInvitation(token)
      .then(setInvite)
      .catch(() => setInvite(null))
      .finally(() => setLoading(false));
  }, [token]);

  const activate = async () => {
    if (!invite) return;
    setBusy(true);
    try {
      // Start from a clean session so we sign up / in as the invited user.
      await supabase.auth.signOut();

      const email = invite.email.toLowerCase();
      // One-time password derived from the token in the link (never stored).
      const password = derivePassword(token);

      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError && !/already registered|already exists/i.test(signUpError.message)) {
        throw signUpError;
      }

      // Ensure an active session (existing account or no auto-session).
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }

      await acceptInvitation(token);
      await refresh();
      toast.success("Konto aktiviert. Bitte lege jetzt dein persönliches Passwort fest.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Aktivierung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo location="login" />
        </div>

        {loading ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        ) : !invite || !invite.valid ? (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
            <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
            <h1 className="mt-4 text-xl font-bold">Einladung ungültig</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Diese Einladung ist abgelaufen, wurde bereits verwendet oder widerrufen. Bitte wende
              dich an deinen Administrator.
            </p>
            <Button className="mt-6" variant="outline" onClick={() => navigate({ to: "/auth" })}>
              Zur Anmeldung
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Einladung
            </div>
            <h1 className="mt-3 text-xl font-bold">
              Hallo{invite.vorname ? ` ${invite.vorname}` : ""}, willkommen!
            </h1>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <MailCheck className="h-4 w-4" /> {invite.email}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Aktiviere dein Konto. Danach wirst du aufgefordert, ein eigenes Passwort zu vergeben.
            </p>
            <Button className="mt-6 w-full" size="lg" onClick={activate} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Konto aktivieren"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

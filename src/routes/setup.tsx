import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "TecNova ERP" }] }),
  component: SetupRedirect,
});

/**
 * The first-install setup wizard has been retired – the app is provisioned.
 * Any visit to /setup is redirected: authenticated users to the dashboard,
 * everyone else to the sign-in screen.
 */
function SetupRedirect() {
  const navigate = useNavigate();
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/dashboard" : "/auth", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

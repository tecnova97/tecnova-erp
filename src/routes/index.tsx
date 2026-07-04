import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { systemNeedsSetup } from "@/lib/setup";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (session) {
      // Wait until the role is resolved so workers land on the mobile app.
      if (!role) return;
      navigate({ to: role === "worker" ? "/meine-arbeit" : "/dashboard", replace: true });
      return;
    }
    systemNeedsSetup().then((needs) => {
      navigate({ to: needs ? "/setup" : "/auth", replace: true });
    });
  }, [loading, session, role, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">TecNova ERP wird geladen…</p>
      </div>
    </div>
  );
}

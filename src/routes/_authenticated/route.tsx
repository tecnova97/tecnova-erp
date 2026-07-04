import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { WorkerShell } from "@/components/layout/WorkerShell";
import { OnboardingGate } from "@/components/OnboardingGate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (role === "worker") {
    return (
      <OnboardingGate>
        <WorkerShell>
          <Outlet />
        </WorkerShell>
      </OnboardingGate>
    );
  }

  return (
    <OnboardingGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </OnboardingGate>
  );
}

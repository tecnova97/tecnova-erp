import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  // The shell is chosen by area (user choice / route), never by screen size.
  // Workers only ever have access to the mobile worker area, so they always
  // land in the WorkerShell; owner/disponent switch between areas via the menu.
  const inWorkerArea =
    role === "worker" ||
    pathname === "/meine-arbeit" ||
    pathname.startsWith("/meine-arbeit/");

  if (inWorkerArea) {
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


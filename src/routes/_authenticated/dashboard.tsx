import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { RequirePermission } from "@/components/PermissionGuard";
import { PERM } from "@/lib/permissions";
import { OperationsDashboard } from "@/components/dashboard/OperationsDashboard";
import { useRouteScrollRestoration } from "@/hooks/useRouteScrollRestoration";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.dashboardView}>
      <DashboardPage />
    </RequirePermission>
  ),
});

function DashboardPage() {
  const { role } = useAuth();
  useRouteScrollRestoration({ ready: true });
  // Worker/Monteur users use the dedicated mobile "Meine Arbeit" experience.
  if (role === "worker") return <Navigate to="/meine-arbeit" replace />;
  return <OperationsDashboard />;
}

import { createFileRoute } from "@tanstack/react-router";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { RolesPermissionsManager } from "@/components/settings/RolesPermissionsManager";

export const Route = createFileRoute("/_authenticated/einstellungen/rollen")({
  component: () => (
    <RequirePermission perm={PERM.rolesManage}>
      <RolesPermissionsManager />
    </RequirePermission>
  ),
});

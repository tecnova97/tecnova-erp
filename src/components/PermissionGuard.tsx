import { type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * Full-page "Kein Zugriff" screen. Shown whenever a user reaches a route or
 * area for which they lack the required permission.
 */
export function KeinZugriff({
  title = "Kein Zugriff",
  description = "Für diesen Bereich fehlt dir die nötige Berechtigung. Wende dich an den Inhaber, wenn du Zugriff benötigst.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * Route/section guard. Renders children only when the user holds AT LEAST ONE
 * of the given permissions. Owners always pass (never lock the owner out).
 * While auth is still loading, renders nothing to avoid a flash of the
 * "Kein Zugriff" screen.
 */
export function RequirePermission({
  perm,
  children,
  title,
  description,
}: {
  perm: string | string[];
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const { loading, canAny } = useAuth();
  const perms = Array.isArray(perm) ? perm : [perm];

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!canAny(perms)) {
    return <KeinZugriff title={title} description={description} />;
  }

  return <>{children}</>;
}

import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  User2,
  Building2,
  Users,
  ShieldCheck,
  Palette,
  ListChecks,
  SlidersHorizontal,
  LayoutGrid,
  Lock,
  Activity,
  Smartphone,
  ServerCog,

} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({ meta: [{ title: "Einstellungen – TecNova ERP" }] }),
  component: SettingsLayout,
});

interface NavItem {
  to: string;
  label: string;
  icon: typeof User2;
  perm?: string;
}

const NAV: NavItem[] = [
  { to: "/einstellungen", label: "Mein Konto", icon: User2 },
  { to: "/einstellungen/firmenprofil", label: "Firmenprofil", icon: Building2, perm: PERM.firmenprofilManage },
  { to: "/einstellungen/benutzer", label: "Benutzer", icon: Users, perm: PERM.usersManage },
  { to: "/einstellungen/rollen", label: "Rollen & Berechtigungen", icon: ShieldCheck, perm: PERM.rolesManage },
  { to: "/einstellungen/status", label: "Statusverwaltung", icon: Palette, perm: PERM.statusManage },
  { to: "/einstellungen/leistungen", label: "Leistungspositionen", icon: ListChecks, perm: PERM.leistungenManage },
  { to: "/einstellungen/felder", label: "Felder / Metadaten", icon: SlidersHorizontal, perm: PERM.einstellungenManage },
  { to: "/einstellungen/seiten", label: "Dashboard & Seiten", icon: LayoutGrid, perm: "seiten.manage" },
  { to: "/einstellungen/mobile", label: "Mobile Worker", icon: Smartphone, perm: PERM.einstellungenManage },
  { to: "/einstellungen/sicherheit", label: "Sicherheit", icon: Lock, perm: PERM.einstellungenManage },
  { to: "/einstellungen/aktivitaet", label: "Aktivität", icon: Activity, perm: "aktivitaet.view" },
  { to: "/einstellungen/system", label: "System", icon: ServerCog, perm: PERM.einstellungenManage },

];

function SettingsLayout() {
  const { can } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((i) => !i.perm || can(i.perm));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">
          Verwalte dein Konto, das Unternehmen und die Systemkonfiguration.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-soft lg:flex-col lg:overflow-visible">
            {items.map((item) => {
              const active =
                item.to === "/einstellungen"
                  ? pathname === "/einstellungen"
                  : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-5">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

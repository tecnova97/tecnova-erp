import { type ReactNode, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Settings,
  Menu,
  LogOut,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNavPages } from "@/lib/navigation";
import { initials } from "@/lib/erp";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { PilotBadge, FeedbackButton } from "@/components/system/PilotFeedback";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  disponent: "Disponent",
  worker: "Mitarbeiter",
};

function NavLinks({
  onNavigate,
  can,
}: {
  onNavigate?: () => void;
  can: (p: string) => boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useNavPages(can);

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  onNavigate,
  can,
}: {
  onNavigate?: () => void;
  can: (p: string) => boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar py-5">
      <div className="px-5 pb-5">
        <Logo location="sidebar" onDark />
      </div>
      <NavLinks onNavigate={onNavigate} can={can} />
    </div>
  );
}

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projekte": "Projekte",
  "/auftraege": "Aufträge",
  "/kunden": "Auftraggeber",
  "/mitarbeiter": "Mitarbeiter",
  "/kalender": "Kalender",
  "/aktivitaet": "Aktivität",
  "/umsatz": "Umsatz / Gewinn",
  "/abrechnung": "Abrechnung",
  "/bezahlt": "Bezahlte Aufträge",
  "/dokumente": "Dokumente",
  "/fotos": "Fotos",
  "/einstellungen": "Einstellungen",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, can, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const title =
    Object.entries(TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? "TecNova ERP";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent can={can} />
      </aside>

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-header/80 px-4 backdrop-blur-md lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent can={can} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <h1 className="text-lg font-bold tracking-tight">{title}</h1>

          <div className="ml-auto flex items-center gap-2">
            <PilotBadge className="hidden sm:inline-flex" />
            <FeedbackButton variant="icon" />

            <span
              className={cn(
                "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex",
                role === "owner"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : role === "disponent"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
              )}
              title="Aktuelle Rolle"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {ROLE_LABEL[role ?? ""] ?? "—"}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-muted">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {initials(profile?.vorname, profile?.nachname)}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-sm font-semibold">
                      {profile?.vorname} {profile?.nachname}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {ROLE_LABEL[role ?? ""] ?? ""}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-semibold">
                    {profile?.vorname} {profile?.nachname}
                  </div>
                  <div className="text-xs font-normal text-muted-foreground">{profile?.email}</div>
                  <div className="mt-1 text-xs font-semibold text-primary">
                    Rolle: {ROLE_LABEL[role ?? ""] ?? "—"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/profil" })}>
                  <UserCircle className="mr-2 h-4 w-4" /> Mein Profil
                </DropdownMenuItem>
                {role === "owner" && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/einstellungen" })}>
                    <Settings className="mr-2 h-4 w-4" /> Einstellungen
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

import { type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, User, WifiOff, Monitor } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/erp";
import { Logo } from "@/components/Logo";
import { useOnline, OFFLINE_MESSAGE } from "@/lib/mobileSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PilotBadge, FeedbackButton } from "@/components/system/PilotFeedback";

/**
 * Mobile-first shell for Worker/Monteur users. No bottom navigation and no
 * swipe gestures — navigation happens through cards and back buttons. A slim,
 * sticky app bar carries the TecNova logo and the account menu.
 */
export function WorkerShell({ children }: { children: ReactNode }) {
  const { profile, isStaff, signOut } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col bg-background shadow-card">
        <header
          className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <Link to="/meine-arbeit" className="flex items-center">
            <Logo location="mobile" />
          </Link>
          <div className="flex items-center gap-2">
            <PilotBadge />
            <FeedbackButton variant="icon" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground active:scale-95">
                {initials(profile?.vorname, profile?.nachname)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex items-center gap-1.5 font-semibold">
                  <User className="h-3.5 w-3.5" />
                  {profile?.vorname} {profile?.nachname}
                </div>
                <div className="text-xs font-normal text-muted-foreground">{profile?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isStaff && (
                <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
                  <Monitor className="mr-2 h-4 w-4" /> Zur Desktop-Ansicht
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>

        </header>

        {!online && (
          <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs font-medium text-warning">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>{OFFLINE_MESSAGE}</span>
          </div>
        )}

        <main
          className="flex-1 px-4 py-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

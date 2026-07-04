import { cn } from "@/lib/utils";
import { useBranding, type LogoSlot } from "@/lib/branding";
import { useIsDark } from "@/lib/theme";
import roundLogo from "@/assets/brand/tecnova-round.png";
import fullLogo from "@/assets/brand/tecnova-full.png";

export type LogoLocation = "login" | "sidebar" | "header" | "mobile" | "full";

/**
 * Brand logo. Every location has its own independent upload slot (light/dark)
 * configured in Firmenprofil, with a graceful fallback chain:
 *   configured slot → full logo → round logo → bundled asset → text.
 *
 * Logos always render with object-contain (never stretched/cropped) and keep
 * their alpha transparency (no background is drawn behind them).
 */
export function Logo({
  className,
  showText = true,
  location = "sidebar",
  onDark,
}: {
  className?: string;
  showText?: boolean;
  location?: LogoLocation;
  /** Force dark-surface variant (e.g. the sidebar is always dark). */
  onDark?: boolean;
}) {
  const branding = useBranding();
  const isDark = useIsDark();
  const name = branding?.firmenname || "TecNova";
  const dark = onDark ?? isDark;
  const logos = branding?.logos;

  const pick = (light: LogoSlot, darkSlot: LogoSlot): string | null => {
    if (!logos) return null;
    const primary = dark ? logos[darkSlot] : logos[light];
    const secondary = dark ? logos[light] : logos[darkSlot];
    return primary || secondary || null;
  };

  // Fallback logo used when the specific slot is empty.
  const fallbackFull = logos?.full_logo_light || logos?.full_logo_dark || logos?.logo_full_url || null;
  const fallbackRound = logos?.round_logo_light || logos?.round_logo_dark || logos?.logo_round_url || null;

  if (location === "full") {
    const src = pick("full_logo_light", "full_logo_dark") || fallbackFull || fullLogo;
    return <img src={src} alt={`${name} ERP`} className={cn("h-11 w-auto object-contain", className)} />;
  }

  if (location === "login") {
    const src = pick("login_logo_light", "login_logo_dark") || fallbackFull || fullLogo;
    return <img src={src} alt={`${name} ERP`} className={cn("h-14 w-auto object-contain", className)} />;
  }

  // sidebar / header / mobile → round mark + optional wordmark
  const roundSrc =
    location === "mobile"
      ? pick("mobile_logo_light", "mobile_logo_dark")
      : pick("round_logo_light", "round_logo_dark");
  const src = roundSrc || fallbackRound || roundLogo;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid h-9 w-9 shrink-0 place-items-center">
        <img src={src} alt={name} className="h-9 w-9 object-contain" />
      </div>
      {showText && (
        <div className="leading-none">
          <span className={cn("block text-lg font-extrabold tracking-tight", dark ? "text-white" : "text-foreground")}>
            {name}
          </span>
          <span
            className={cn(
              "block text-[10px] font-semibold uppercase tracking-[0.2em]",
              dark ? "text-white/60" : "text-muted-foreground",
            )}
          >
            ERP
          </span>
        </div>
      )}
    </div>
  );
}

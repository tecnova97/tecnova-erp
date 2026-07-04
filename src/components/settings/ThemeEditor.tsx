import { Monitor, Moon, Sun, Palette } from "lucide-react";
import {
  CUSTOM_THEME_FIELDS, DEFAULT_CUSTOM_THEME, THEME_MODE_LABEL,
  type CustomTheme, type CustomThemeKey, type ThemeMode,
} from "@/lib/theme";
import { ColorPicker } from "@/components/settings/ColorPicker";
import { cn } from "@/lib/utils";

const MODES: { key: ThemeMode; icon: typeof Sun }[] = [
  { key: "hell", icon: Sun },
  { key: "dunkel", icon: Moon },
  { key: "system", icon: Monitor },
  { key: "benutzerdefiniert", icon: Palette },
];

/** Small live mock that reflects the custom palette instantly (inline styles). */
function ThemePreview({ theme }: { theme: CustomTheme }) {
  const t = { ...DEFAULT_CUSTOM_THEME, ...theme };
  return (
    <div className="overflow-hidden rounded-xl border border-border shadow-soft">
      <div className="flex h-44">
        <div className="flex w-24 flex-col gap-2 p-3" style={{ background: t.sidebar }}>
          <div className="h-2 w-full rounded" style={{ background: t.primary }} />
          <div className="h-2 w-4/5 rounded" style={{ background: "rgba(255,255,255,0.25)" }} />
          <div className="h-2 w-3/5 rounded" style={{ background: "rgba(255,255,255,0.25)" }} />
        </div>
        <div className="flex flex-1 flex-col" style={{ background: t.background, color: t.text }}>
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ background: t.header, borderColor: t.border }}>
            <div className="h-2 w-16 rounded" style={{ background: t.text, opacity: 0.6 }} />
            <div className="h-5 w-5 rounded-full" style={{ background: t.accent }} />
          </div>
          <div className="flex flex-1 gap-2 p-3">
            <div className="flex-1 rounded-lg border p-2" style={{ background: t.card, borderColor: t.border }}>
              <div className="h-2 w-2/3 rounded" style={{ background: t.text, opacity: 0.7 }} />
              <div className="mt-2 h-2 w-1/2 rounded" style={{ background: t.link }} />
              <button className="mt-3 rounded-md px-2 py-1 text-[10px] font-semibold text-white" style={{ background: t.button }}>
                Aktion
              </button>
            </div>
            <div className="w-16 rounded-lg border p-2" style={{ background: t.widget, borderColor: t.border }}>
              <div className="h-full w-full rounded" style={{ background: t.secondary }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemeEditor({
  mode,
  custom,
  onModeChange,
  onCustomChange,
  canCustom = true,
}: {
  mode: ThemeMode;
  custom: CustomTheme;
  onModeChange: (m: ThemeMode) => void;
  onCustomChange: (c: CustomTheme) => void;
  canCustom?: boolean;
}) {
  const setColor = (key: CustomThemeKey, value: string) =>
    onCustomChange({ ...custom, [key]: value });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map(({ key, icon: Icon }) => {
          const disabled = key === "benutzerdefiniert" && !canCustom;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onModeChange(key)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
                mode === key ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <Icon className="h-5 w-5" />
              {THEME_MODE_LABEL[key]}
            </button>
          );
        })}
      </div>

      {mode === "benutzerdefiniert" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {CUSTOM_THEME_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <span className="text-xs font-medium">{f.label}</span>
                <ColorPicker
                  value={custom[f.key] ?? DEFAULT_CUSTOM_THEME[f.key] ?? "#000000"}
                  onChange={(v) => setColor(f.key, v)}
                />
                <span className="block text-[10px] text-muted-foreground">{f.hint}</span>
              </div>
            ))}
          </div>
          <div className="lg:sticky lg:top-20 lg:self-start">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live-Vorschau</p>
            <ThemePreview theme={custom} />
          </div>
        </div>
      )}
    </div>
  );
}

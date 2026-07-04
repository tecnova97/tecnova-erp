import { cn } from "@/lib/utils";

/** Full color picker with a native color wheel and a HEX text field. */
export function ColorPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}) {
  const normalized = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : "#3b82f6";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        type="color"
        value={normalized}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        title="Farbe wählen"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          let v = e.target.value.trim();
          if (v && !v.startsWith("#")) v = `#${v}`;
          onChange(v);
        }}
        placeholder="#RRGGBB"
        className="h-9 w-28 rounded-md border border-input bg-background px-2 font-mono text-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        maxLength={7}
      />
    </div>
  );
}

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  type CustomFieldDef, type CustomData, formatCustomValue,
} from "@/lib/customFields";

const NONE = "__none__";

/** Editable custom-field inputs bound to a `custom_data` object. */
export function CustomFieldsForm({
  defs,
  values,
  onChange,
  className,
}: {
  defs: CustomFieldDef[];
  values: CustomData;
  onChange: (next: CustomData) => void;
  className?: string;
}) {
  const visible = defs.filter((d) => d.sichtbar);
  if (visible.length === 0) return null;

  const set = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  return (
    <div className={className ?? "grid gap-4 sm:grid-cols-2"}>
      {visible.map((d) => {
        const val = values[d.field_key];
        if (d.feldtyp === "boolean") {
          return (
            <label key={d.id} className="flex cursor-pointer items-center gap-2 pt-6 text-sm">
              <Checkbox checked={Boolean(val)} onCheckedChange={(v) => set(d.field_key, v === true)} />
              {d.label}{d.erforderlich && <span className="text-destructive"> *</span>}
            </label>
          );
        }
        return (
          <div key={d.id} className="space-y-1.5">
            <Label>
              {d.label}
              {d.erforderlich && <span className="text-destructive"> *</span>}
            </Label>
            {d.feldtyp === "select" ? (
              <Select
                value={(val as string) || NONE}
                onValueChange={(v) => set(d.field_key, v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>–</SelectItem>
                  {d.optionen.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={d.feldtyp === "number" ? "number" : d.feldtyp === "date" ? "date" : d.feldtyp === "url" ? "url" : "text"}
                value={(val as string | number | undefined) ?? ""}
                onChange={(e) => set(d.field_key, e.target.value)}
                placeholder={d.feldtyp === "file" ? "Datei-Verweis / Pfad" : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Read-only display of custom fields with values. */
export function CustomFieldsView({
  defs,
  values,
}: {
  defs: CustomFieldDef[];
  values: CustomData;
}) {
  const visible = defs.filter((d) => d.sichtbar);
  if (visible.length === 0) return null;
  return (
    <>
      {visible.map((d) => {
        const raw = values?.[d.field_key];
        if (d.feldtyp === "url" && raw) {
          const href = String(raw).startsWith("http") ? String(raw) : `https://${raw}`;
          return (
            <div key={d.id}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d.label}</p>
              <a href={href} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">{String(raw)}</a>
            </div>
          );
        }
        return (
          <div key={d.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d.label}</p>
            <p className="text-sm">{formatCustomValue(d, raw)}</p>
          </div>
        );
      })}
    </>
  );
}

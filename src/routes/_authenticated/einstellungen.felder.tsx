import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SlidersHorizontal, Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  customFieldDefsQuery, createCustomFieldDef, updateCustomFieldDef, deleteCustomFieldDef,
  slugifyKey, FIELD_TYPES, CUSTOM_ENTITY_LABEL,
  type CustomEntityType, type CustomFieldDef, type CustomFieldTyp,
} from "@/lib/customFields";

export const Route = createFileRoute("/_authenticated/einstellungen/felder")({
  head: () => ({ meta: [{ title: "Felder / Metadaten – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm={PERM.einstellungenManage}>
      <FelderPage />
    </RequirePermission>
  ),
});

function FelderPage() {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Lege flexible Metadaten-Felder an. Die Standardfelder (NVT, eSASS-Nr. …) bleiben erhalten –
        hier definierst du zusätzliche Felder, die pro Eintrag frei ausgefüllt werden. Neue Einträge
        starten leer; kein Feld ist erzwungen, außer du markierst es als erforderlich.
      </p>
      <EntitySection entity="projekt" />
      <EntitySection entity="rechnung_gruppe" />
      <EntitySection entity="auftrag" prepared />
    </div>
  );
}

function EntitySection({ entity, prepared }: { entity: CustomEntityType; prepared?: boolean }) {
  const qc = useQueryClient();
  const { data: defs = [], isLoading } = useQuery(customFieldDefsQuery(entity));
  const [busy, setBusy] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["custom_field_defs"] });

  const add = async () => {
    setBusy(true);
    try {
      const label = "Neues Feld";
      await createCustomFieldDef({
        entity_type: entity,
        field_key: `${slugifyKey(label)}_${Date.now().toString(36)}`,
        label,
        feldtyp: "text",
        optionen: [],
        sichtbar: true,
        erforderlich: false,
        sort_order: defs.length,
      });
      await invalidate();
      toast.success("Gespeichert");
    } catch (e) {
      toast.error("Fehlgeschlagen", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      title={CUSTOM_ENTITY_LABEL[entity]}
      icon={<SlidersHorizontal className="h-4 w-4 text-primary" />}
      description={
        prepared
          ? "Vorbereitet – Auftrag-Felder werden im Auftragsformular in einem nächsten Schritt aktiviert."
          : "Zusätzliche Felder für dieses Modul. Umbenennen, ausblenden, Typ ändern oder löschen."
      }
      actions={
        <Button size="sm" onClick={add} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
          Feld hinzufügen
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : defs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {prepared ? "Dieses Modul ist vorbereitet und wird später erweitert." : "Noch keine eigenen Felder definiert."}
        </p>
      ) : (
        <div className="space-y-2">
          {defs.map((d) => <FieldRow key={d.id} def={d} onChanged={invalidate} />)}
        </div>
      )}
    </SettingsSection>
  );
}

function FieldRow({ def, onChanged }: { def: CustomFieldDef; onChanged: () => void }) {
  const [label, setLabel] = useState(def.label);
  const [feldtyp, setFeldtyp] = useState<CustomFieldTyp>(def.feldtyp);
  const [optionen, setOptionen] = useState(def.optionen.join(", "));
  const [busy, setBusy] = useState(false);

  const dirty =
    label !== def.label ||
    feldtyp !== def.feldtyp ||
    optionen !== def.optionen.join(", ");

  const save = async () => {
    setBusy(true);
    try {
      await updateCustomFieldDef(def.id, {
        label: label.trim() || def.label,
        feldtyp,
        optionen: optionen.split(",").map((o) => o.trim()).filter(Boolean),
      });
      onChanged();
      toast.success("Gespeichert");
    } catch (e) {
      toast.error("Fehlgeschlagen", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (patch: Partial<CustomFieldDef>) => {
    try {
      await updateCustomFieldDef(def.id, patch);
      onChanged();
      toast.success("Gespeichert");
    } catch (e) {
      toast.error("Fehlgeschlagen", { description: (e as Error).message });
    }
  };

  const remove = async () => {
    if (!confirm(`Feld „${def.label}" löschen? Bereits erfasste Werte bleiben im Datensatz erhalten.`)) return;
    try {
      await deleteCustomFieldDef(def.id);
      onChanged();
      toast.success("Gespeichert");
    } catch (e) {
      toast.error("Fehlgeschlagen", { description: (e as Error).message });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Feldname" className="h-9 min-w-[12rem] flex-1" />
        <Select value={feldtyp} onValueChange={(v) => setFeldtyp(v as CustomFieldTyp)}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {dirty && (
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Speichern
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={remove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-6">
        {feldtyp === "select" && (
          <div className="flex flex-1 items-center gap-2">
            <span className="text-xs text-muted-foreground">Optionen</span>
            <Input value={optionen} onChange={(e) => setOptionen(e.target.value)} placeholder="Option 1, Option 2, …" className="h-8" />
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={def.sichtbar} onCheckedChange={(v) => toggle({ sichtbar: v === true })} /> Sichtbar
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={def.erforderlich} onCheckedChange={(v) => toggle({ erforderlich: v === true })} /> Erforderlich
        </label>
        <span className="font-mono text-xs text-muted-foreground">{def.field_key}</span>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, Loader2, LayoutGrid } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  roleLayoutQuery,
  saveRoleLayout,
  WIDGET_REGISTRY,
  widgetDef,
  DASHBOARD_DEFAULT,
  SIZE_LABEL,
  HEIGHT_LABEL,
  type AppRole,
  type DashboardConfig,
  type WidgetInstance,
  type WidgetSize,
  type WidgetHeight,
} from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableList } from "@/components/dnd/SortableList";
import { cn } from "@/lib/utils";

const ROLES: { value: AppRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "disponent", label: "Disponent" },
  { value: "worker", label: "Worker" },
];

export function RoleDashboardSettings() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [role, setRole] = useState<AppRole>("disponent");
  const { data: loaded, isLoading } = useQuery(roleLayoutQuery(role));

  const [draft, setDraft] = useState<DashboardConfig | null>(null);
  const [allowCustomize, setAllowCustomize] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset local state whenever the loaded layout (or role) changes.
  useEffect(() => {
    if (loaded) {
      setDraft(loaded.config);
      setAllowCustomize(loaded.allow_customize);
      setDirty(false);
    }
  }, [loaded, role]);

  const cfg = draft ?? loaded?.config ?? DASHBOARD_DEFAULT;
  const widgets = cfg.widgets.filter((w) => widgetDef(w.type));

  const update = (next: WidgetInstance[]) => {
    setDraft({ widgets: next });
    setDirty(true);
  };
  const setSize = (id: string, size: WidgetSize) =>
    update(widgets.map((w) => (w.id === id ? { ...w, size } : w)));
  const setHeight = (id: string, height: WidgetHeight) =>
    update(widgets.map((w) => (w.id === id ? { ...w, height } : w)));
  const toggleHidden = (id: string) =>
    update(widgets.map((w) => (w.id === id ? { ...w, hidden: !w.hidden } : w)));
  const remove = (id: string) => update(widgets.filter((w) => w.id !== id));
  const add = (type: string) => {
    const def = widgetDef(type);
    update([
      ...widgets,
      {
        id: `w-${Date.now()}`,
        type,
        size: def?.defaultSize ?? "md",
        height: def?.defaultHeight ?? "auto",
      },
    ]);
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveRoleLayout(role, { widgets }, allowCustomize, profile?.id ?? null);
      await qc.invalidateQueries({ queryKey: ["dashboard_role_layout", role] });
      setDirty(false);
      toast.success("Standard-Dashboard gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Rolle</span>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1.5 h-4 w-4" /> Widget hinzufügen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {WIDGET_REGISTRY.map((w) => (
                <DropdownMenuItem key={w.type} onClick={() => add(w.type)}>
                  <div>
                    <p className="font-medium">{w.title}</p>
                    <p className="text-xs text-muted-foreground">{w.description}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={save} disabled={busy || !dirty}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Speichern
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
        <div>
          <p className="text-sm font-medium">Eigene Anpassung erlauben</p>
          <p className="text-xs text-muted-foreground">
            Wenn deaktiviert, sehen alle Benutzer dieser Rolle nur dieses Standard-Layout.
          </p>
        </div>
        <Switch
          checked={allowCustomize}
          onCheckedChange={(v) => {
            setAllowCustomize(v);
            setDirty(true);
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : widgets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <LayoutGrid className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Keine Widgets. Füge ein Widget hinzu.</p>
        </div>
      ) : (
        <SortableList
          items={widgets}
          onReorder={(next) => update(next)}
          renderItem={(w, handle) => {
            const def = widgetDef(w.type);
            return (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3",
                  w.hidden && "opacity-60",
                )}
              >
                {handle}
                <span className="flex-1 text-sm font-semibold">{def?.title ?? w.type}</span>
                <Select value={w.size} onValueChange={(v) => setSize(w.id, v as WidgetSize)}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["sm", "md", "lg"] as WidgetSize[]).map((s) => (
                      <SelectItem key={s} value={s}>{SIZE_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={w.height ?? "auto"}
                  onValueChange={(v) => setHeight(w.id, v as WidgetHeight)}
                >
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["auto", "compact", "tall"] as WidgetHeight[]).map((h) => (
                      <SelectItem key={h} value={h}>{HEIGHT_LABEL[h]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => toggleHidden(w.id)}
                  className="text-muted-foreground hover:text-foreground"
                  title={w.hidden ? "Einblenden" : "Ausblenden"}
                >
                  {w.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => remove(w.id)}
                  className="text-destructive hover:opacity-80"
                  title="Entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}

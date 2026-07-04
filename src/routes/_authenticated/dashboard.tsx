import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isToday, isTomorrow, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ClipboardList,
  Sun,
  LayoutGrid,
  Plus,
  Trash2,
  EyeOff,
  Eye,
  Save,
  X,
  Check,
} from "lucide-react";
import { auftraegeQuery } from "@/lib/queries";
import { useStatuses } from "@/lib/status";
import { useAuth } from "@/lib/auth";
import { WorkerAuftragCard } from "@/components/WorkerAuftragCard";
import { WidgetBody, QuickAccessBar } from "@/components/dashboard/DashboardWidgets";
import {
  dashboardConfigQuery,
  saveDashboardConfig,
  roleLayoutQuery,
  WIDGET_REGISTRY,
  widgetDef,
  canSeeWidget,
  DASHBOARD_DEFAULT,
  SIZE_CLASS,
  SIZE_LABEL,
  HEIGHT_CLASS,
  HEIGHT_LABEL,
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
import { RequirePermission } from "@/components/PermissionGuard";
import { PERM } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard – TecNova ERP" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (typeof s.tab === "string" ? s.tab : "heute") as string,
  }),
  component: () => (
    <RequirePermission perm={PERM.dashboardView}>
      <DashboardPage />
    </RequirePermission>
  ),
});

function DashboardPage() {
  const { role } = useAuth();
  // Worker/Monteur users use the dedicated mobile "Meine Arbeit" experience.
  if (role === "worker") return <Navigate to="/meine-arbeit" replace />;
  return <StaffDashboard />;
}

/* ================================================================== */
function StaffDashboard() {
  const qc = useQueryClient();
  const { profile, role, can } = useAuth();
  const userId = profile?.id;

  const { data: roleLayout } = useQuery(roleLayoutQuery(role ?? undefined));
  const { data: userConfig } = useQuery(dashboardConfigQuery(userId));

  const allowCustomize = roleLayout?.allow_customize ?? true;
  // Effective config: user custom layout (if allowed & present) else the role default.
  const effective: DashboardConfig =
    (allowCustomize && userConfig) || roleLayout?.config || DASHBOARD_DEFAULT;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DashboardConfig>(effective);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(effective);
  }, [effective, editing]);

  // Legacy widget types that were removed from the dashboard.
  const REMOVED = new Set(["schnellzugriff", "letzte-aktivitaet"]);
  const widgets = (editing ? draft.widgets : effective.widgets)
    .filter((w) => !REMOVED.has(w.type))
    // Only keep widgets that still exist in the registry AND the user may see.
    .filter((w) => widgetDef(w.type) && canSeeWidget(w.type, can));

  const update = (next: WidgetInstance[]) => setDraft({ widgets: next });

  const setSize = (id: string, size: WidgetSize) =>
    update(draft.widgets.map((w) => (w.id === id ? { ...w, size } : w)));
  const setHeight = (id: string, height: WidgetHeight) =>
    update(draft.widgets.map((w) => (w.id === id ? { ...w, height } : w)));
  const toggleHidden = (id: string) =>
    update(draft.widgets.map((w) => (w.id === id ? { ...w, hidden: !w.hidden } : w)));
  const remove = (id: string) => update(draft.widgets.filter((w) => w.id !== id));
  const add = (type: string) => {
    const def = widgetDef(type);
    update([
      ...draft.widgets,
      {
        id: `w-${Date.now()}`,
        type,
        size: def?.defaultSize ?? "md",
        height: def?.defaultHeight ?? "auto",
      },
    ]);
  };

  const save = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await saveDashboardConfig(userId, draft);
      await qc.invalidateQueries({ queryKey: ["dashboard_config", userId] });
      setEditing(false);
      toast.success("Dashboard gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setDraft(effective);
    setEditing(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight">Dashboard</h2>
          {!editing && <QuickAccessBar />}
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>
              <X className="mr-1.5 h-4 w-4" /> Abbrechen
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              <Save className="mr-1.5 h-4 w-4" /> Speichern
            </Button>
          </div>
        ) : (
          allowCustomize && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <LayoutGrid className="mr-1.5 h-4 w-4" /> Bearbeiten
            </Button>
          )
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">
              Ziehen zum Sortieren. Breite &amp; Höhe wählen, ein-/ausblenden oder entfernen.
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 h-4 w-4" /> Widget hinzufügen
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {WIDGET_REGISTRY.filter((w) => canSeeWidget(w.type, can)).map((w) => (
                  <DropdownMenuItem key={w.type} onClick={() => add(w.type)}>
                    <div>
                      <p className="font-medium">{w.title}</p>
                      <p className="text-xs text-muted-foreground">{w.description}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <SortableList
            items={widgets}
            onReorder={(next) => update(next)}
            renderItem={(w, handle) => {
              const def = widgetDef(w.type);
              return (
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3",
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
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {widgets.filter((w) => !w.hidden).map((w) => {
            const def = widgetDef(w.type);
            return (
              <div key={w.id} className={cn("rounded-2xl border border-border bg-card p-5 shadow-soft", SIZE_CLASS[w.size])}>
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {def?.title ?? w.type}
                </h3>
                <div className={HEIGHT_CLASS[w.height ?? "auto"]}>
                  <WidgetBody type={w.type} />
                </div>
              </div>
            );
          })}
          {widgets.filter((w) => !w.hidden).length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-12 text-center">
              <LayoutGrid className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Keine Widgets sichtbar.{allowCustomize ? " Klicke auf „Bearbeiten“." : ""}</p>
              {allowCustomize && (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Check className="mr-1.5 h-4 w-4" /> Widgets konfigurieren
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
function EmptyHint({ icon: Icon, text }: { icon: typeof ClipboardList; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 py-10 text-center">
      <Icon className="h-7 w-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

const WORKER_TAB_TITLES: Record<string, string> = {
  heute: "Heute",
  morgen: "Morgen",
  offen: "Offene Aufträge",
  erledigt: "Erledigt",
};

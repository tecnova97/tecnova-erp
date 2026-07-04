import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Trash2,
  Loader2,
  Lock,
  Save,
  X,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  permissionsQuery,
  rolesQuery,
  rolePermissionsQuery,
  type RoleRow,
} from "@/lib/permissions";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const BASE_ROLE_LABELS: Record<AppRole, string> = {
  owner: "Inhaber-Ebene",
  disponent: "Disponent-Ebene",
  worker: "Mitarbeiter-Ebene",
};

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `rolle-${Date.now()}`
  );
}

export function RolesPermissionsManager() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const { data: permissions = [] } = useQuery(permissionsQuery());
  const { data: roles = [] } = useQuery(rolesQuery());
  const { data: rolePerms = [] } = useQuery(rolePermissionsQuery());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBase, setNewBase] = useState<AppRole>("worker");

  // Default selection: first role.
  useEffect(() => {
    if (!selectedId && roles.length) setSelectedId(roles[0].id);
  }, [roles, selectedId]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  const savedForRole = useMemo(
    () =>
      new Set(
        rolePerms.filter((rp) => rp.role_id === selectedId).map((rp) => rp.permission_key),
      ),
    [rolePerms, selectedId],
  );

  // Reset draft when the selected role or its saved permissions change.
  useEffect(() => {
    setDraft(new Set(savedForRole));
  }, [selectedId, rolePerms]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    if (draft.size !== savedForRole.size) return true;
    for (const k of draft) if (!savedForRole.has(k)) return true;
    return false;
  }, [draft, savedForRole]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof permissions>();
    for (const p of permissions) {
      if (!map.has(p.kategorie)) map.set(p.kategorie, []);
      map.get(p.kategorie)!.push(p);
    }
    return Array.from(map.entries());
  }, [permissions]);

  const toggle = (key: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (keys: string[], on: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const toAdd = [...draft].filter((k) => !savedForRole.has(k));
      const toRemove = [...savedForRole].filter((k) => !draft.has(k));
      if (toAdd.length) {
        const { error } = await supabase
          .from("role_permissions")
          .insert(toAdd.map((permission_key) => ({ role_id: selected.id, permission_key })));
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", selected.id)
          .in("permission_key", toRemove);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["role_permissions"] });
      // Reload the current user's effective permissions so enforcement
      // (sidebar, routes, buttons, actions) updates immediately without a
      // logout/login cycle.
      await refresh();
      toast.success(`Rechte für „${selected.name}“ gespeichert.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    const name = newName.trim();
    if (!name) return toast.error("Bitte einen Rollennamen eingeben.");
    setCreating(true);
    try {
      let key = slugify(name);
      if (roles.some((r) => r.key === key)) key = `${key}-${Date.now().toString(36)}`;
      const maxSort = Math.max(0, ...roles.map((r) => r.sort_order));
      const { data, error } = await supabase
        .from("roles")
        .insert({ key, name, base_role: newBase, is_system: false, sort_order: maxSort + 10 })
        .select("id")
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["roles"] });
      setSelectedId(data.id);
      setNewName("");
      setNewBase("worker");
      toast.success(`Rolle „${name}“ erstellt.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rolle konnte nicht erstellt werden");
    } finally {
      setCreating(false);
    }
  };

  const deleteRole = async (r: RoleRow) => {
    if (r.is_system) return;
    if (!confirm(`Rolle „${r.name}“ wirklich löschen?`)) return;
    try {
      const { error } = await supabase.from("roles").delete().eq("id", r.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["roles"] });
      if (selectedId === r.id) setSelectedId(roles[0]?.id ?? null);
      toast.success("Rolle gelöscht.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold">
          <Shield className="h-4 w-4 text-primary" /> Rollen & Berechtigungen
        </h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Jede Berechtigung ist einzeln pro Rolle konfigurierbar. System-Rollen können nicht
        gelöscht werden.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr]">
        {/* Role list */}
        <div className="space-y-2">
          {roles.map((r) => {
            const count = rolePerms.filter((rp) => rp.role_id === r.id).length;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                  selectedId === r.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.farbe }}
                    />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {BASE_ROLE_LABELS[r.base_role]} · {count} Rechte
                  </span>
                </span>
                {r.is_system ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Trash2
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRole(r);
                    }}
                  />
                )}
              </button>
            );
          })}

          {/* Create role */}
          <div className="rounded-xl border border-dashed border-border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Neue Rolle</p>
            <Input
              placeholder="Name, z. B. Bauleiter"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-9"
            />
            <select
              value={newBase}
              onChange={(e) => setNewBase(e.target.value as AppRole)}
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="worker">Mitarbeiter-Ebene</option>
              <option value="disponent">Disponent-Ebene</option>
              <option value="owner">Inhaber-Ebene</option>
            </select>
            <Button
              size="sm"
              className="mt-2 w-full gap-1.5"
              onClick={createRole}
              disabled={creating}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Rolle anlegen
            </Button>
          </div>
        </div>

        {/* Permission matrix */}
        <div className="min-w-0">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <p className="font-semibold">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {BASE_ROLE_LABELS[selected.base_role]}
                    {selected.is_system && " · System-Rolle"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {dirty && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5"
                      onClick={() => setDraft(new Set(savedForRole))}
                      disabled={saving}
                    >
                      <X className="h-3.5 w-3.5" /> Verwerfen
                    </Button>
                  )}
                  <Button size="sm" className="gap-1.5" onClick={save} disabled={!dirty || saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Speichern
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-4">
                {grouped.map(([kategorie, perms]) => {
                  const keys = perms.map((p) => p.key);
                  const allOn = keys.every((k) => draft.has(k));
                  return (
                    <div key={kategorie}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          {kategorie}
                        </p>
                        <button
                          className="text-xs font-semibold text-primary hover:underline"
                          onClick={() => toggleCategory(keys, !allOn)}
                        >
                          {allOn ? "Alle abwählen" : "Alle auswählen"}
                        </button>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {perms.map((p) => {
                          const on = draft.has(p.key);
                          return (
                            <button
                              key={p.key}
                              onClick={() => toggle(p.key)}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                on
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-border hover:bg-muted",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                  on
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input",
                                )}
                              >
                                {on && <Check className="h-3 w-3" />}
                              </span>
                              <span className="truncate">{p.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Rolle ausgewählt.</p>
          )}
        </div>
      </div>
    </div>
  );
}

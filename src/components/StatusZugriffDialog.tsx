import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Plus, Trash2, Loader2, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { statusZugriffQuery } from "@/lib/multiStatus";
import { rolesQuery } from "@/lib/permissions";
import { profilesQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Owner UI to manage per-status access grants. Grants target either a role or an
 * individual user, and control view / assign / remove permissions. When no grant
 * exists for a status, the app falls back to the global order permissions.
 */
export function StatusZugriffDialog({
  statusKey,
  statusLabel,
  open,
  onOpenChange,
}: {
  statusKey: string;
  statusLabel: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: zugriff = [] } = useQuery(statusZugriffQuery());
  const { data: roles = [] } = useQuery(rolesQuery());
  const { data: profiles = [] } = useQuery(profilesQuery());

  const [ziel, setZiel] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const rows = zugriff.filter((z) => z.status_key === statusKey);

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "Rolle";
  const userName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "Benutzer" : "Benutzer";
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["status_zugriff"] });

  const addGrant = async () => {
    if (!ziel) return;
    setBusy(true);
    try {
      const [typ, id] = ziel.split(":");
      const { error } = await supabase.from("status_zugriff").insert({
        status_key: statusKey,
        role_id: typ === "role" ? id : null,
        user_id: typ === "user" ? id : null,
        can_view: true,
        can_assign: true,
        can_remove: false,
      } as never);
      if (error) throw error;
      setZiel("");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Konnte Zugriff nicht anlegen.");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, p: Partial<{ can_view: boolean; can_assign: boolean; can_remove: boolean }>) => {
    const { error } = await supabase.from("status_zugriff").update(p as never).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("status_zugriff").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  // Targets not yet granted for this status
  const takenRoles = new Set(rows.filter((r) => r.role_id).map((r) => r.role_id));
  const takenUsers = new Set(rows.filter((r) => r.user_id).map((r) => r.user_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Zugriff · {statusLabel}
          </DialogTitle>
          <DialogDescription>
            Lege fest, welche Rollen oder Benutzer diesen Status sehen, zuweisen oder entfernen dürfen.
            Ohne Eintrag gelten die allgemeinen Auftragsberechtigungen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              Keine spezifischen Berechtigungen – Standardregeln aktiv.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    {r.role_id ? <Users className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-accent-foreground" />}
                    <span className="text-sm font-semibold">
                      {r.role_id ? roleName(r.role_id) : userName(r.user_id!)}
                    </span>
                    <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 text-destructive" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 pl-6">
                    {(["can_view", "can_assign", "can_remove"] as const).map((k) => (
                      <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={r[k]} onCheckedChange={(v) => patch(r.id, { [k]: v === true })} />
                        {k === "can_view" ? "Ansehen" : k === "can_assign" ? "Zuweisen" : "Entfernen"}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Select value={ziel} onValueChange={setZiel}>
              <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Rolle oder Benutzer wählen" /></SelectTrigger>
              <SelectContent>
                {roles.filter((r) => !takenRoles.has(r.id)).map((r) => (
                  <SelectItem key={`role:${r.id}`} value={`role:${r.id}`}>Rolle · {r.name}</SelectItem>
                ))}
                {profiles.filter((p) => !takenUsers.has(p.id)).map((p) => (
                  <SelectItem key={`user:${p.id}`} value={`user:${p.id}`}>
                    Benutzer · {`${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addGrant} disabled={busy || !ziel}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Hinzufügen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

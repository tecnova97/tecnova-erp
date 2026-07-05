import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Loader2,
  Mail,
  KeyRound,
  Power,
  Send,
  Ban,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usersQuery, userMembershipsQuery, type UserRow } from "@/lib/settings";
import { rolesQuery } from "@/lib/permissions";
import {
  invitationsQuery,
  revokeInvitation,
  deleteInvitation,
  type Invitation,
} from "@/lib/invitations";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirePermission } from "@/components/PermissionGuard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { InviteUserDialog } from "@/components/settings/InviteUserDialog";
import { deactivateUserAccount } from "@/lib/settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/einstellungen/benutzer")({
  component: () => (
    <RequirePermission perm={PERM.usersManage}>
      <BenutzerPage />
    </RequirePermission>
  ),
});

function BenutzerPage() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const { data: users = [], isLoading } = useQuery(usersQuery());
  const { data: roles = [] } = useQuery(rolesQuery());
  const { data: memberships = [] } = useQuery(userMembershipsQuery());
  const { data: invitations = [] } = useQuery(invitationsQuery());
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const roleName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of roles) m[r.id] = r.name;
    return m;
  }, [roles]);

  const roleByUser = useMemo(() => {
    const m: Record<string, string> = {};
    for (const row of memberships) m[row.user_id] = row.role_id;
    return m;
  }, [memberships]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["benutzer"] });
    qc.invalidateQueries({ queryKey: ["user_role_memberships"] });
  };

  const pendingInvites = invitations.filter((i) => i.status === "pending");


  const handleRevoke = async (i: Invitation) => {
    try {
      await revokeInvitation(i.id);
      qc.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Einladung widerrufen.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  };

  const handleDeleteInvite = async (i: Invitation) => {
    try {
      await deleteInvitation(i.id);
      qc.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Einladung gelöscht.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  };

  const setRole = async (userId: string, roleId: string) => {
    const { error: delErr } = await supabase.from("user_role_memberships").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error } = await supabase
      .from("user_role_memberships")
      .insert({ user_id: userId, role_id: roleId } as never);
    if (error) return toast.error(error.message);
    // Keep the legacy user_roles base role in sync for shell selection.
    const base = roles.find((r) => r.id === roleId)?.base_role;
    if (base) {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: base } as never);
    }
    toast.success("Rolle aktualisiert.");
    refresh();
  };

  const toggleDisabled = async (u: UserRow) => {
    const { error } = await supabase
      .from("profiles")
      .update({ disabled: !u.disabled } as never)
      .eq("id", u.id);
    if (error) return toast.error(error.message);
    await supabase.rpc("record_login_attempt", {
      _email: u.email,
      _action: u.disabled ? "account_enabled" : "account_disabled",
    } as never);
    toast.success(u.disabled ? "Konto aktiviert." : "Konto deaktiviert.");
    refresh();
  };

  const toggleForcePw = async (u: UserRow) => {
    const { error } = await supabase
      .from("profiles")
      .update({ force_password_change: !u.force_password_change } as never)
      .eq("id", u.id);
    if (error) return toast.error(error.message);
    toast.success("Einstellung gespeichert.");
    refresh();
  };

  const resetPassword = async (u: UserRow) => {
    if (!u.email) return toast.error("Kein E-Mail-Adresse hinterlegt.");
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Zurücksetzen-Link an ${u.email} gesendet.`);
  };



  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deactivateUserAccount(deleteTarget.id, deleteTarget.email);
      toast.success("Benutzer deaktiviert. Rollen und offene Einladungen wurden entfernt.");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["invitations"] });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SettingsSection
        title="Benutzer"
        icon={<Users className="h-4 w-4 text-primary" />}
        description="Konten, Rollen und Zugriffsstatus verwalten. Passwörter sind niemals einsehbar."
        actions={<InviteUserDialog roles={roles} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Rolle</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 font-semibold">Letzte Anmeldung</th>
                <th className="py-2 pr-3 font-semibold">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="border-b border-border/60 align-middle">
                    <td className="py-3 pr-3">
                      <div className="font-medium">
                        {[u.vorname, u.nachname].filter(Boolean).join(" ") || "—"}
                        {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(du)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <Select value={roleByUser[u.id] ?? ""} onValueChange={(v) => setRole(u.id, v)}>
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue placeholder="Rolle wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 pr-3">
                      {u.disabled ? (
                        <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">
                          Deaktiviert
                        </span>
                      ) : (
                        <span className="rounded bg-success/15 px-1.5 py-0.5 text-[11px] font-semibold text-success">
                          Aktiv
                        </span>
                      )}
                      {u.force_password_change && (
                        <span className="ml-1 rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning">
                          PW-Wechsel
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-muted-foreground">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString("de-DE") : "nie"}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button size="sm" variant="outline" className="h-8" onClick={() => resetPassword(u)}>
                          <Mail className="mr-1 h-3.5 w-3.5" /> Reset
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => toggleForcePw(u)}
                          title="Passwortwechsel bei nächster Anmeldung erzwingen"
                        >
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          {u.force_password_change ? "PW-Wechsel aus" : "PW-Wechsel"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-8 ${u.disabled ? "" : "text-destructive"}`}
                          disabled={isSelf}
                          onClick={() => toggleDisabled(u)}
                        >
                          <Power className="mr-1 h-3.5 w-3.5" />
                          {u.disabled ? "Aktivieren" : "Deaktivieren"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive"
                          disabled={isSelf}
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Entfernen
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Offene Einladungen"
        icon={<Send className="h-4 w-4 text-primary" />}
        description="Offizielle Einladungen per E-Mail. Solange nicht angenommen, können sie widerrufen werden."
      >
        {pendingInvites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine offenen Einladungen.</p>
        ) : (
          <div className="space-y-2">
            {pendingInvites.map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {[i.vorname, i.nachname].filter(Boolean).join(" ") || i.email}
                    <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning">
                      Ausstehend
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i.email} · {i.role_id ? roleName[i.role_id] ?? "Rolle" : "—"} · gültig bis{" "}
                    {new Date(i.expires_at).toLocaleDateString("de-DE")}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => handleRevoke(i)}>
                    <Ban className="mr-1 h-3.5 w-3.5" /> Widerrufen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      {invitations.some((i) => i.status !== "pending") && (
        <SettingsSection title="Erledigte Einladungen" icon={<Mail className="h-4 w-4 text-primary" />}>
          <div className="space-y-2">
            {invitations
              .filter((i) => i.status !== "pending")
              .map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background p-3 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {i.email}{" "}
                    <span
                      className={`ml-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                        i.status === "accepted"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i.status === "accepted" ? "Angenommen" : "Widerrufen"}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => handleDeleteInvite(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
          </div>
        </SettingsSection>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer deaktivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Das Konto von ${
                    [deleteTarget.vorname, deleteTarget.nachname].filter(Boolean).join(" ") ||
                    deleteTarget.email
                  } wird deaktiviert. Alle Rollen und offenen Einladungen werden entfernt und der Zugriff wird gesperrt. Der eigentliche Login kann aus Sicherheitsgründen nicht clientseitig gelöscht werden.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Deaktivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>
    </>
  );
}

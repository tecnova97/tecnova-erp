import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity as ActivityIcon,
  Search,
  Loader2,
  
  EyeOff,
  ExternalLink,
  History,
  ShieldAlert,
} from "lucide-react";
import {
  activityLogQuery,
  userRolesMapQuery,
  actionLabel,
  entityLabel,
  entityLink,
  roleLabel,
  setActivityHidden,
  setActivityNote,
  ACTION_LABEL,
  ENTITY_LABEL,
  type ActivityRow,
} from "@/lib/activity";
import { profilesQuery } from "@/lib/queries";
import { fmtDate, fmtTime, fmtDateTime } from "@/lib/erp";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { RequirePermission } from "@/components/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/aktivitaet")({
  head: () => ({ meta: [{ title: "Aktivität – TecNova ERP" }] }),
  component: () => (
    <RequirePermission perm="aktivitaet.view">
      <AktivitaetPage />
    </RequirePermission>
  ),
});

const ALL = "__all__";

function AktivitaetPage() {
  const { role } = useAuth();
  const isOwner = role === "owner";
  const { data: rows = [], isLoading } = useQuery(activityLogQuery(isOwner));
  const { data: profiles = [] } = useQuery(profilesQuery());
  const { data: roleMap = {} } = useQuery(userRolesMapQuery());

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of profiles) {
      m[p.id] = [p.vorname, p.nachname].filter(Boolean).join(" ") || p.email || "Unbekannt";
    }
    return m;
  }, [profiles]);

  const userName = (id: string | null) => (id ? nameMap[id] ?? "Unbekannt" : "System");

  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState(ALL);
  const [actionFilter, setActionFilter] = useState(ALL);
  const [entityFilter, setEntityFilter] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<ActivityRow | null>(null);

  const usersInLog = useMemo(() => {
    const ids = new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]);
    return [...ids].map((id) => ({ id, name: userName(id) })).sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, nameMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (userFilter !== ALL && r.user_id !== userFilter) return false;
      if (actionFilter !== ALL && r.action !== actionFilter) return false;
      if (entityFilter !== ALL && r.entity_type !== entityFilter) return false;
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to && new Date(r.created_at) > new Date(`${to}T23:59:59`)) return false;
      if (q) {
        const hay = [
          r.entity_name,
          actionLabel(r.action),
          entityLabel(r.entity_type),
          userName(r.user_id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, userFilter, actionFilter, entityFilter, from, to, nameMap]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <ActivityIcon className="h-6 w-6 text-primary" /> Aktivität
          </h2>
          <p className="text-sm text-muted-foreground">
            Systemweites Protokoll aller Änderungen. Einträge werden nie gelöscht.
          </p>
        </div>
        {isOwner && <RollbackDialog users={usersInLog} />}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="relative lg:col-span-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche nach Name, Auftrag, Auftraggeber, Projekt…"
              className="pl-9"
            />
          </div>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger><SelectValue placeholder="Benutzer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Benutzer</SelectItem>
              {usersInLog.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><SelectValue placeholder="Aktion" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Aktionen</SelectItem>
              {Object.keys(ACTION_LABEL).map((a) => (
                <SelectItem key={a} value={a}>{ACTION_LABEL[a]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger><SelectValue placeholder="Typ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle Typen</SelectItem>
              {Object.keys(ENTITY_LABEL).map((e) => (
                <SelectItem key={e} value={e}>{ENTITY_LABEL[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <DatePicker value={from} onChange={setFrom} placeholder="Von" />
            <span className="text-muted-foreground">–</span>
            <DatePicker value={to} onChange={setTo} placeholder="Bis" />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} Einträge</p>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Zeitpunkt</th>
              <th className="px-4 py-3 font-semibold">Benutzer</th>
              <th className="px-4 py-3 font-semibold">Aktion</th>
              <th className="px-4 py-3 font-semibold">Objekt</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Keine Aktivität gefunden.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40 ${r.hidden_from_ui ? "opacity-50" : ""}`}
                onClick={() => setSelected(r)}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-medium">{fmtDate(r.created_at)}</div>
                  <div className="text-xs text-muted-foreground">{fmtTime(r.created_at)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{userName(r.user_id)}</div>
                  <div className="text-xs text-muted-foreground">{roleLabel(roleMap[r.user_id ?? ""])}</div>
                </td>
                <td className="px-4 py-3">{actionLabel(r.action)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-muted-foreground">{entityLabel(r.entity_type)}</span>
                  <div className="max-w-[22rem] truncate">{r.entity_name || "–"}</div>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {r.hidden_from_ui && <EyeOff className="ml-auto h-4 w-4" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActivityDetail
        row={selected}
        onClose={() => setSelected(null)}
        userName={userName}
        role={selected ? roleLabel(roleMap[selected.user_id ?? ""]) : ""}
        isOwner={isOwner}
      />
    </div>
  );
}

function JsonBlock({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) {
    return <p className="text-sm text-muted-foreground">–</p>;
  }
  return (
    <dl className="space-y-1 text-sm">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="min-w-[8rem] font-medium text-muted-foreground">{k}</dt>
          <dd className="break-all">{v === null ? "–" : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActivityDetail({
  row,
  onClose,
  userName,
  role,
  isOwner,
}: {
  row: ActivityRow | null;
  onClose: () => void;
  userName: (id: string | null) => string;
  role: string;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const link = row ? entityLink(row) : null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["activity_log"] });

  const toggleHidden = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await setActivityHidden(row.id, !row.hidden_from_ui);
      await refresh();
      toast.success(row.hidden_from_ui ? "Eintrag wieder sichtbar." : "Eintrag ausgeblendet.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await setActivityNote(row.id, note);
      await refresh();
      toast.success("Notiz gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle>{actionLabel(row.action)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Wer">{userName(row.user_id)} · {role}</Info>
                <Info label="Wann">{fmtDateTime(row.created_at)}</Info>
                <Info label="Typ">{entityLabel(row.entity_type)}</Info>
                <Info label="Objekt">{row.entity_name || "–"}</Info>
              </div>

              {link && (
                <Button asChild variant="outline" size="sm">
                  <Link to={link}>
                    <ExternalLink className="mr-1.5 h-4 w-4" /> Zum Objekt
                  </Link>
                </Button>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vorher</p>
                  <JsonBlock value={row.before_value} />
                </div>
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nachher</p>
                  <JsonBlock value={row.after_value} />
                </div>
              </div>

              {row.admin_note && !isOwner && (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">Admin-Notiz</p>
                  {row.admin_note}
                </div>
              )}

              {isOwner && (
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Aus der Ansicht ausblenden</span>
                    <Switch checked={row.hidden_from_ui} onCheckedChange={toggleHidden} disabled={busy} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Admin-Notiz</label>
                    <Textarea
                      defaultValue={row.admin_note ?? ""}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Interne Notiz zu diesem Eintrag…"
                      rows={2}
                    />
                    <Button size="sm" className="mt-2" onClick={saveNote} disabled={busy}>
                      Notiz speichern
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{children}</p>
    </div>
  );
}

function RollbackDialog({ users }: { users: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [entity, setEntity] = useState(ALL);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <History className="mr-1.5 h-4 w-4" /> Änderungen rückgängig machen
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Änderungen rückgängig machen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>Rollback wird vorbereitet und muss vor Ausführung geprüft werden.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Benutzer</label>
            <Select value={user} onValueChange={setUser}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Benutzer</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Von</label>
              <DatePicker value={from} onChange={setFrom} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bis</label>
              <DatePicker value={to} onChange={setTo} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Objekttyp</label>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Typen</SelectItem>
                {Object.keys(ENTITY_LABEL).map((e) => (
                  <SelectItem key={e} value={e}>{ENTITY_LABEL[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled title="Vorschau wird in einer späteren Version aktiviert">
            Betroffene Änderungen anzeigen (in Vorbereitung)
          </Button>
          <p className="text-xs text-muted-foreground">
            Diese Funktion befindet sich in Vorbereitung. Aus Sicherheitsgründen werden aktuell keine
            automatischen Rollbacks ausgeführt.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

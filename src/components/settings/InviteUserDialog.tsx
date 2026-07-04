import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Copy, Check, Link2, UserPlus } from "lucide-react";
import { createInvitation, type CreatedInvitation } from "@/lib/invitations";
import type { RoleRow } from "@/lib/permissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InviteUserDialog({ roles }: { roles: RoleRow[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(CreatedInvitation & { email: string }) | null>(null);
  const [form, setForm] = useState({ vorname: "", nachname: "", email: "", telefon: "", role_id: "" });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm({ vorname: "", nachname: "", email: "", telefon: "", role_id: "" });
    setResult(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role_id) return toast.error("Bitte eine Rolle wählen.");
    setBusy(true);
    try {
      const created = await createInvitation(form);
      setResult({ ...created, email: form.email.trim().toLowerCase() });
      qc.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Einladung erstellt.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Erstellen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1.5 h-4 w-4" /> Benutzer einladen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!result ? (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Benutzer einladen</DialogTitle>
              <DialogDescription>
                Es wird ein sicherer Einmal-Einladungslink erstellt. Der Link ist nur einmal gültig
                und läuft ab. Der Nutzer aktiviert damit sein Konto und legt beim ersten Login sein
                eigenes Passwort fest.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="iv">Vorname</Label>
                  <Input id="iv" value={form.vorname} onChange={(e) => set("vorname", e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="in">Nachname</Label>
                  <Input id="in" value={form.nachname} onChange={(e) => set("nachname", e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ie">E-Mail</Label>
                <Input id="ie" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="it">Telefon (optional)</Label>
                <Input id="it" value={form.telefon} onChange={(e) => set("telefon", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Rolle</Label>
                <Select value={form.role_id} onValueChange={(v) => set("role_id", v)}>
                  <SelectTrigger>
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
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Einladung erstellen
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Einladung erstellt</DialogTitle>
              <DialogDescription>
                Teile diesen Einmal-Link mit {result.email}. Er wird nur jetzt angezeigt, ist nur bis
                zur ersten Anmeldung gültig und läuft danach ab.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <CopyRow label="Einladungslink" value={result.link} icon={<Link2 className="h-4 w-4" />} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Weitere Einladung
              </Button>
              <Button onClick={() => setOpen(false)}>Fertig</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CopyRow({
  label,
  value,
  mono,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
        {icon}
        <span className={`flex-1 truncate text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
        <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

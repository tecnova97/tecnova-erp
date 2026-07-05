import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UserPlus, Copy, Check } from "lucide-react";
import { createInvitation, productionRegistrationLink } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/invitations.functions";
import { useAuth } from "@/lib/auth";
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
  const { role } = useAuth();
  const isPrivileged = role === "owner" || role === "disponent";
  const sendEmail = useServerFn(sendInvitationEmail);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ vorname: "", nachname: "", email: "", telefon: "", role_id: "" });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm({ vorname: "", nachname: "", email: "", telefon: "", role_id: "" });
    setLink(null);
    setCopied(false);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Registrierungslink kopiert.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopieren nicht möglich.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role_id) return toast.error("Bitte eine Rolle wählen.");
    setBusy(true);
    try {
      // 1. Create the pending invitation row first.
      await createInvitation(form);
      qc.invalidateQueries({ queryKey: ["invitations"] });

      // 2. Build the production registration link.
      const email = form.email.trim().toLowerCase();
      const registerUrl = productionRegistrationLink(email);

      // 3. Try to send the invitation e-mail via SMTP (server-side).
      try {
        await sendEmail({
          data: {
            email,
            vorname: form.vorname.trim(),
            nachname: form.nachname.trim(),
            registerUrl,
          },
        });
        toast.success("Einladung wurde per E-Mail gesendet.");
        setOpen(false);
        reset();
      } catch (emailErr) {
        // E-mail failed: keep the invitation, show the copyable link as fallback.
        setLink(registerUrl);
        const detail = emailErr instanceof Error ? emailErr.message : "";
        // Show the exact SMTP error only to privileged users (owner/disponent).
        if (isPrivileged && detail) {
          toast.error(
            detail.startsWith("SMTP Fehler:") ? detail : `SMTP Fehler: ${detail}`,
            {
              description:
                "Einladung wurde erstellt. Bitte kopieren Sie den Registrierungslink als Fallback.",
            },
          );
        } else {
          toast.warning(
            "Einladung wurde erstellt, E-Mail konnte aber nicht gesendet werden. Bitte kopieren Sie den Registrierungslink.",
          );
        }
      }
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
        {link ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>E-Mail konnte nicht gesendet werden</DialogTitle>
              <DialogDescription>
                Die Einladung wurde erstellt, aber der E-Mail-Versand ist fehlgeschlagen. Bitte
                teilen Sie den Registrierungslink manuell mit dem neuen Benutzer. Über diesen Link
                legt er sein eigenes Passwort fest und schließt die Registrierung ab.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>Registrierungslink</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="outline" size="icon" onClick={copy}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                Weitere Einladung
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Fertig
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Benutzer einladen</DialogTitle>
              <DialogDescription>
                Es wird eine offene Einladung erstellt. Der Nutzer legt über den Registrierungslink
                selbst sein Passwort fest – kein temporäres Passwort erforderlich.
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
        )}
      </DialogContent>
    </Dialog>
  );
}

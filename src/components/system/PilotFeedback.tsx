import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { MessageSquarePlus, Loader2, FlaskConical } from "lucide-react";
import { pilotConfigQuery, submitFeedback } from "@/lib/system";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Small "Pilotbetrieb" badge shown in app headers while pilot mode is active. */
export function PilotBadge({ className }: { className?: string }) {
  const { data } = useQuery(pilotConfigQuery());
  if (!data?.enabled) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600",
        className,
      )}
      title="Diese Installation befindet sich im Pilotbetrieb."
    >
      <FlaskConical className="h-3.5 w-3.5" />
      Pilotbetrieb
    </span>
  );
}

/** Feedback button + dialog. Only rendered while pilot mode is active. */
export function FeedbackButton({
  variant = "icon",
}: {
  variant?: "icon" | "full";
}) {
  const { data } = useQuery(pilotConfigQuery());
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data?.enabled) return null;

  const send = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await submitFeedback(message.trim(), pathname);
      toast.success("Danke! Dein Feedback wurde gespeichert.");
      setMessage("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Feedback konnte nicht gesendet werden.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button variant="outline" size="icon" title="Feedback geben">
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Feedback geben</DialogTitle>
          <DialogDescription>
            Beschreibe kurz, was gut funktioniert oder was verbessert werden sollte. Aktuelle Seite
            und Zeitpunkt werden automatisch mitgesendet.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Deine Rückmeldung …"
          rows={5}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">Seite: {pathname}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={send} disabled={busy || !message.trim()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

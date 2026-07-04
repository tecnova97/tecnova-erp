import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, KeyRound, Trash2, Smartphone, Mail } from "lucide-react";
import {
  listFactors,
  enrollTotp,
  verifyTotpEnrollment,
  unenrollFactor,
  type EnrollResult,
  type MfaFactor,
} from "@/lib/mfa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MfaManager({ onVerified }: { onVerified?: () => void }) {
  const qc = useQueryClient();
  const { data: factors = [], isLoading } = useQuery({
    queryKey: ["mfa_factors"],
    queryFn: listFactors,
  });
  const [enroll, setEnroll] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const verified = factors.filter((f) => f.status === "verified");

  const refresh = () => qc.invalidateQueries({ queryKey: ["mfa_factors"] });

  const startEnroll = async () => {
    setBusy(true);
    try {
      const res = await enrollTotp("Authenticator");
      setEnroll(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Einrichtung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async () => {
    if (!enroll) return;
    setBusy(true);
    try {
      await verifyTotpEnrollment(enroll.factorId, code);
      toast.success("Zwei-Faktor-Authentifizierung aktiviert.");
      setEnroll(null);
      setCode("");
      refresh();
      onVerified?.();
    } catch {
      toast.error("Code ungültig. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    if (enroll) {
      try {
        await unenrollFactor(enroll.factorId);
      } catch {
        /* ignore */
      }
    }
    setEnroll(null);
    setCode("");
    refresh();
  };

  const remove = async (f: MfaFactor) => {
    setBusy(true);
    try {
      await unenrollFactor(f.id);
      toast.success("Faktor entfernt.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Entfernen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  }

  return (
    <div className="space-y-4">
      {verified.length > 0 && (
        <div className="space-y-2">
          {verified.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-success" />
                {f.friendly_name || "Authenticator-App"}{" "}
                <span className="rounded bg-success/15 px-1.5 py-0.5 text-[11px] font-semibold text-success">
                  Aktiv
                </span>
              </span>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(f)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!enroll ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="h-4 w-4 text-muted-foreground" /> Authenticator-App (TOTP)
            </span>
            <Button size="sm" onClick={startEnroll} disabled={busy}>
              <KeyRound className="mr-1.5 h-4 w-4" /> Einrichten
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 p-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" /> E-Mail-Einmalcode (OTP)
            </span>
            <span className="text-xs text-muted-foreground">Bald verfügbar</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-background p-4">
          <p className="text-sm font-medium">Scanne den Code mit deiner Authenticator-App:</p>
          {enroll.qrSvg.trim().startsWith("<") ? (
            <div
              className="mx-auto w-fit rounded-lg bg-white p-3"
              dangerouslySetInnerHTML={{ __html: enroll.qrSvg }}
            />
          ) : (
            <img src={enroll.qrSvg} alt="QR-Code" className="mx-auto w-44 rounded-lg bg-white p-3" />
          )}
          <p className="break-all text-center text-xs text-muted-foreground">
            Manuell: <span className="font-mono">{enroll.secret}</span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="mfa-code">6-stelliger Code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={confirmEnroll} disabled={busy || code.length < 6} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aktivieren"}
            </Button>
            <Button variant="outline" onClick={cancelEnroll} disabled={busy}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

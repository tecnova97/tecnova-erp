import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Smartphone, Trash2, ShieldCheck } from "lucide-react";
import {
  trustedDevicesQuery,
  removeTrustedDevice,
  getDeviceId,
  type TrustedDeviceRow,
} from "@/lib/security";
import { Button } from "@/components/ui/button";

/**
 * Lists trusted devices. When `userId` is given, only that user's devices are
 * shown (self-service). Owners omit it to see/revoke across all users.
 */
export function TrustedDevicesManager({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { data: devices = [], isLoading } = useQuery(trustedDevicesQuery(userId));
  const thisDevice = typeof window !== "undefined" ? getDeviceId() : "";

  const remove = async (d: TrustedDeviceRow) => {
    try {
      await removeTrustedDevice(d.id, d.device_id);
      qc.invalidateQueries({ queryKey: ["trusted_devices"] });
      toast.success("Gerät entfernt.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    }
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;

  if (devices.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine vertrauenswürdigen Geräte.</p>;
  }

  return (
    <div className="space-y-2">
      {devices.map((d) => {
        const current = d.device_id === thisDevice;
        return (
          <div
            key={d.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                {d.label || "Unbekanntes Gerät"}
                {current && (
                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                    <ShieldCheck className="h-3 w-3" /> Dieses Gerät
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Zuletzt aktiv {new Date(d.last_seen_at).toLocaleString("de-DE")} · gültig bis{" "}
                {new Date(d.expires_at).toLocaleDateString("de-DE")}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(d)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

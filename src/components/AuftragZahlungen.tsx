import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeEuro, Euro, StickyNote, Pencil, Check, X, Loader2, Plus, Ban } from "lucide-react";
import {
  zahlungsereignisseForAuftragQuery,
  zahlungUmsatzMapQuery,
  updateZahlungNotiz,
  stornoZahlung,
  paymentTypeLabel,
  paymentTypeFarbe,
} from "@/lib/zahlungen";
import { profilesQuery } from "@/lib/queries";
import { fmtDate, fmtEuro } from "@/lib/erp";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ZahlungErfassenDialog } from "@/components/ZahlungErfassenDialog";

/**
 * Payment-event (Zahlungsereignis) history for a single Auftrag. Each event is
 * an independent financial record with a manually entered amount and a payment
 * type. Events are never merged; the same Auftrag can have many of them. The
 * amount is finance-gated; everyone who can see the Auftrag still sees that a
 * payment exists (type + date).
 */
export function AuftragZahlungen({ auftragId }: { auftragId: string }) {
  const qc = useQueryClient();
  const { canAny, can } = useAuth();
  const canUmsatz = canAny([PERM.profitCard, PERM.profitDetail, PERM.umsatzView, PERM.gewinnView]);
  const canManage = can(PERM.finanzenManage);
  const { data: events = [] } = useQuery(zahlungsereignisseForAuftragQuery(auftragId));
  const { data: umsatzMap = {} } = useQuery(zahlungUmsatzMapQuery(canUmsatz));
  const { data: profiles = [] } = useQuery(profilesQuery());

  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stornoBusy, setStornoBusy] = useState<string | null>(null);

  const userName = (uid: string | null) => {
    if (!uid) return "System";
    const p = profiles.find((x) => x.id === uid);
    return p ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || p.email || "Unbekannt" : "Unbekannt";
  };

  const gesamt = useMemo(
    () =>
      events
        .filter((e) => !e.storniert)
        .reduce((s, e) => s + (umsatzMap[e.id]?.umsatz ?? 0), 0),
    [events, umsatzMap],
  );

  const saveNote = async (id: string) => {
    setBusy(true);
    try {
      await updateZahlungNotiz(id, draft.trim());
      await qc.invalidateQueries({ queryKey: ["zahlungsereignisse", auftragId] });
      setEditId(null);
      toast.success("Notiz gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const storno = async (id: string) => {
    if (!window.confirm("Diese Zahlung stornieren? Andere Zahlungen bleiben unverändert.")) return;
    setStornoBusy(id);
    try {
      await stornoZahlung(id);
      await qc.invalidateQueries({ queryKey: ["zahlungsereignisse", auftragId] });
      await qc.invalidateQueries({ queryKey: ["zahlungsereignisse"] });
      await qc.invalidateQueries({ queryKey: ["zahlung_umsatz_map"] });
      await qc.invalidateQueries({ queryKey: ["auftrag_umsatz_map"] });
      await qc.invalidateQueries({ queryKey: ["auftrag_gewinn_map"] });
      await qc.invalidateQueries({ queryKey: ["auftraege"] });
      await qc.invalidateQueries({ queryKey: ["auftrag", auftragId] });
      toast.success("Zahlung storniert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stornieren fehlgeschlagen.");
    } finally {
      setStornoBusy(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <BadgeEuro className="h-4 w-4" /> Zahlungsereignisse
        </h3>
        <div className="flex items-center gap-2">
          {canUmsatz && events.some((e) => !e.storniert) && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
              style={{ color: "#16a34a", backgroundColor: "rgba(22,163,74,0.13)" }}
            >
              <Euro className="h-4 w-4" /> Gesamt bezahlt {fmtEuro(gesamt)}
            </span>
          )}
          {canManage && (
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Zahlung erfassen
            </Button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Noch keine Zahlungen erfasst.
          {canManage && " Über „Zahlung erfassen“ wird eine Zahlung angelegt."}
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const priced = umsatzMap[e.id];
            const positionen = canUmsatz ? (priced?.positionen?.length ? priced.positionen : e.leistungen ?? []) : e.leistungen ?? [];
            const editing = editId === e.id;
            return (
              <div
                key={e.id}
                className={`rounded-xl border border-border bg-background p-3 ${e.storniert ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="badge-status"
                    style={{
                      color: paymentTypeFarbe(e.payment_type),
                      backgroundColor: `${paymentTypeFarbe(e.payment_type)}1f`,
                    }}
                  >
                    {paymentTypeLabel(e.payment_type)}
                  </span>
                  {e.storniert && (
                    <span className="badge-status" style={{ color: "#dc2626", backgroundColor: "rgba(220,38,38,0.12)" }}>
                      Storniert
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{fmtDate(e.datum)}</span>
                  <span className="text-xs text-muted-foreground">· {userName(e.created_by)}</span>
                  {canUmsatz && (
                    <span className={`ml-auto text-sm font-extrabold ${e.storniert ? "line-through" : ""}`}>
                      {fmtEuro(priced?.umsatz ?? 0)}
                    </span>
                  )}
                </div>

                {positionen.length > 0 && (
                  <table className="mt-2.5 w-full text-xs">
                    <tbody>
                      {positionen.map((p, i) => (
                        <tr key={i} className="border-b border-border/40 last:border-0">
                          <td className="py-1 pr-3 font-medium">{p.name}</td>
                          <td className="py-1 pr-3 text-muted-foreground">{p.code}</td>
                          <td className="py-1 pr-3 text-right">
                            {p.menge} {p.einheit}
                          </td>
                          {canUmsatz && "total" in p && (
                            <td className="py-1 text-right font-semibold">
                              {fmtEuro((p as { total: number }).total)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="mt-2.5">
                  {editing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={draft}
                        onChange={(ev) => setDraft(ev.target.value)}
                        rows={2}
                        placeholder="Notiz zu dieser Zahlung…"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busy} onClick={() => saveNote(e.id)} className="gap-1.5">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Speichern
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditId(null)} className="gap-1.5">
                          <X className="h-3.5 w-3.5" /> Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      {e.notiz ? (
                        <span className="inline-flex items-start gap-1.5 text-sm text-muted-foreground">
                          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e.notiz}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Keine Notiz</span>
                      )}
                      {canManage && (
                        <div className="ml-auto flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Notiz bearbeiten"
                            onClick={() => {
                              setEditId(e.id);
                              setDraft(e.notiz ?? "");
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!e.storniert && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              title="Zahlung stornieren"
                              disabled={stornoBusy === e.id}
                              onClick={() => storno(e.id)}
                            >
                              {stornoBusy === e.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canManage && (
        <ZahlungErfassenDialog open={dialogOpen} onOpenChange={setDialogOpen} auftragId={auftragId} />
      )}
    </div>
  );
}

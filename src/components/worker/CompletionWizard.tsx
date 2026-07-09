import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  FileText,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Loader2,
  ListChecks,
  Image as ImageIcon,
  StickyNote,
  Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  auftragLeistungenQuery,
  auftragLeistungPreiseQuery,
  lineTotal,
  type AuftragLeistung,
} from "@/lib/auftragLeistungen";
import { leistungenQuery, type Leistungsposition } from "@/lib/settings";
import {
  fotosForAuftragQuery,
  dokumenteForAuftragQuery,
  type AuftragRow,
} from "@/lib/queries";
import { useStatuses, statusStyle } from "@/lib/status";
import { useStatusAccess } from "@/lib/multiStatus";
import { logHistorie } from "@/lib/historie";
import { fmtEuro, fmtNum } from "@/lib/erp";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { appendCompletionToBeschreibung } from "@/lib/completion";
import { PERM } from "@/lib/permissions";
import { useMobileWorkerSettings, useOnline, OFFLINE_MESSAGE } from "@/lib/mobileSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface StagedFile {
  file: File;
  url: string;
}

const STEPS = ["Leistungen", "Fotos & Dateien", "Notiz", "Status"] as const;

export function CompletionWizard({
  auftrag,
  onClose,
}: {
  auftrag: AuftragRow;
  onClose: () => void;
}) {
  const id = auftrag.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const online = useOnline();
  const settings = useMobileWorkerSettings();
  const { canAny, profile } = useAuth();
  const employeeName = [profile?.vorname, profile?.nachname].filter(Boolean).join(" ").trim();
  const canPrice = canAny([
    PERM.preiseView,
    PERM.profitDetail,
    PERM.umsatzView,
    PERM.finanzenManage,
    PERM.gewinnView,
  ]);
  const { active: statuses, get } = useStatuses();
  const { canAssign } = useStatusAccess();

  const { data: zeilen = [] } = useQuery(auftragLeistungenQuery(id));
  const { data: preise = {} } = useQuery(auftragLeistungPreiseQuery(id, canPrice));
  const { data: katalog = [] } = useQuery(leistungenQuery());
  const { data: existingFotos = [] } = useQuery(fotosForAuftragQuery(id));
  const { data: existingDoks = [] } = useQuery(dokumenteForAuftragQuery(id));

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState(false);

  const [stagedFotos, setStagedFotos] = useState<StagedFile[]>([]);
  const [stagedDoks, setStagedDoks] = useState<StagedFile[]>([]);
  const [note, setNote] = useState(auftrag.abschluss_notizen ?? "");
  const [finalStatus, setFinalStatus] = useState<string>("");
  const [addingLeistung, setAddingLeistung] = useState(false);

  const fotoInput = useRef<HTMLInputElement>(null);
  const kameraInput = useRef<HTMLInputElement>(null);
  const dokInput = useRef<HTMLInputElement>(null);

  // Lock body scroll while the fullscreen wizard is mounted so nothing behind
  // it can scroll or be interacted with.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const statusOptions = statuses.filter((s) => canAssign(s.key));


  const summary = useMemo(
    () => ({
      photos: stagedFotos.length,
      docs: stagedDoks.length,
      leistungen: zeilen.filter((z) => z.menge > 0).length,
      hasNote: note.trim().length > 0,
    }),
    [stagedFotos, stagedDoks, zeilen, note],
  );

  const gesamt = useMemo(() => {
    if (!canPrice) return null;
    return zeilen.reduce((sum, z) => sum + (lineTotal(z, preise[z.id]) ?? 0), 0);
  }, [zeilen, preise, canPrice]);

  // -- Leistungen (persist immediately, consistent with staff behaviour) -----
  const invalidateLeistungen = () =>
    qc.invalidateQueries({ queryKey: ["auftrag_leistungen", id] }).then(() =>
      qc.invalidateQueries({ queryKey: ["auftrag_leistung_preise", id] }),
    );

  const addLeistung = async (l: Leistungsposition) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("auftrag_leistungen").insert({
        auftrag_id: id,
        leistung_id: l.id,
        code: l.code,
        name: l.name,
        berechnungsart: l.berechnungsart,
        einheit: l.einheit,
        menge: 1,
        mitarbeiter_anzahl: 1,
        sort_order: zeilen.length,
      } as never);
      if (error) throw error;
      await invalidateLeistungen();
      setAddingLeistung(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hinzufügen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const patchLeistung = async (rowId: string, p: Partial<AuftragLeistung>) => {
    const { error } = await supabase.from("auftrag_leistungen").update(p as never).eq("id", rowId);
    if (error) toast.error(error.message);
    else await invalidateLeistungen();
  };

  const removeLeistung = async (rowId: string) => {
    const { error } = await supabase.from("auftrag_leistungen").delete().eq("id", rowId);
    if (error) toast.error(error.message);
    else await invalidateLeistungen();
  };

  // -- File staging ----------------------------------------------------------
  const stage = (kind: "foto" | "dok", files: FileList | null) => {
    if (!files?.length) return;
    const mapped = Array.from(files).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    if (kind === "foto") setStagedFotos((prev) => [...prev, ...mapped]);
    else setStagedDoks((prev) => [...prev, ...mapped]);
  };

  const unstage = (kind: "foto" | "dok", index: number) => {
    if (kind === "foto") {
      setStagedFotos((prev) => {
        URL.revokeObjectURL(prev[index]?.url ?? "");
        return prev.filter((_, i) => i !== index);
      });
    } else {
      setStagedDoks((prev) => {
        URL.revokeObjectURL(prev[index]?.url ?? "");
        return prev.filter((_, i) => i !== index);
      });
    }
  };

  // -- Final submit ----------------------------------------------------------
  const uploadFile = async (
    bucket: "fotos" | "dokumente",
    file: File,
    userId: string | undefined,
  ) => {
    const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file);
    if (upErr) throw upErr;
    if (bucket === "fotos") {
      await supabase
        .from("fotos")
        .insert({ auftrag_id: id, storage_path: path, dateiname: file.name, uploaded_by: userId } as never);
    } else {
      await supabase.from("dokumente").insert({
        auftrag_id: id,
        storage_path: path,
        dateiname: file.name,
        dateityp: file.type,
        groesse: file.size,
        uploaded_by: userId,
      } as never);
    }
  };

  const validate = (): string | null => {
    if (settings.require_photos && existingFotos.length + stagedFotos.length === 0)
      return "Bitte mindestens ein Foto hinzufügen.";
    if (settings.require_documents && existingDoks.length + stagedDoks.length === 0)
      return "Bitte mindestens ein Dokument hinzufügen.";
    if (settings.require_note && note.trim().length === 0)
      return "Bitte eine Notiz eingeben.";
    if (!finalStatus) return "Bitte einen Status wählen.";
    return null;
  };

  const finish = async () => {
    if (!online) {
      toast.error(OFFLINE_MESSAGE);
      return;
    }
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;

      const total = stagedFotos.length + stagedDoks.length;
      if (total > 0) setProgress({ done: 0, total });
      let count = 0;
      for (const f of stagedFotos) {
        await uploadFile("fotos", f.file, uid);
        count++;
        setProgress({ done: count, total });
      }
      for (const f of stagedDoks) {
        await uploadFile("dokumente", f.file, uid);
        count++;
        setProgress({ done: count, total });
      }

      // Save note
      if (note.trim() !== (auftrag.abschluss_notizen ?? "").trim()) {
        const { error: noteErr } = await supabase
          .from("auftraege")
          .update({ abschluss_notizen: note.trim() || null } as never)
          .eq("id", id);
        if (noteErr) throw noteErr;
        if (note.trim()) {
          await logHistorie(id, "Notiz gespeichert", note.trim(), "notiz");
          // Also append the completion text to the Auftrag Beschreibung.
          await appendCompletionToBeschreibung({
            auftragId: id,
            text: note.trim(),
            employeeName,
            existingBeschreibung: auftrag.beschreibung,
          });
        }
      }


      // Apply final status (DB triggers set the primary status assignment and
      // create a Zahlungsereignis when the status is configured as paid).
      const def = get(finalStatus);
      const { error: statusErr } = await supabase
        .from("auftraege")
        .update({
          status: finalStatus,
          abgeschlossen_am: def.ist_abschluss ? new Date().toISOString() : null,
        } as never)
        .eq("id", id);
      if (statusErr) throw statusErr;

      await logHistorie(
        id,
        "Auftrag abgeschlossen",
        `Abschluss mit Status „${def.label}"${gesamt != null ? ` · Umsatz ${fmtEuro(gesamt)}` : ""}`,
        "abschluss",
      );

      await qc.invalidateQueries();
      setProgress(null);
      setDone(true);
    } catch (e) {
      setProgress(null);
      toast.error(e instanceof Error ? `Abschluss fehlgeschlagen: ${e.message}` : "Abschluss fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const backToList = () => {
    stagedFotos.forEach((f) => URL.revokeObjectURL(f.url));
    stagedDoks.forEach((f) => URL.revokeObjectURL(f.url));
    navigate({ to: "/meine-arbeit" });
  };

  // ==========================================================================
  // Success screen (Module 5)
  // ==========================================================================
  if (done) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex flex-col bg-background">
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-11 w-11" />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
            Auftrag erfolgreich abgeschlossen
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{auftrag.titel}</p>

          <div className="mt-6 w-full max-w-sm space-y-2 rounded-2xl border border-border bg-card p-4 text-left">
            <SummaryRow
              icon={<Layers className="h-4 w-4" />}
              label="Status"
              value={
                <span className="badge-status" style={statusStyle(get(finalStatus).farbe)}>
                  {get(finalStatus).label}
                </span>
              }
            />
            <SummaryRow icon={<ImageIcon className="h-4 w-4" />} label="Fotos hochgeladen" value={summary.photos} />
            <SummaryRow icon={<FileText className="h-4 w-4" />} label="Dokumente hochgeladen" value={summary.docs} />
            <SummaryRow icon={<ListChecks className="h-4 w-4" />} label="Leistungspositionen" value={summary.leistungen} />
            <SummaryRow
              icon={<StickyNote className="h-4 w-4" />}
              label="Notiz"
              value={summary.hasNote ? "Vorhanden" : "Keine"}
            />
          </div>
        </div>
        <div
          className="border-t border-border bg-background px-4 py-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <Button className="h-12 w-full text-base" onClick={backToList}>
            Zurück zur Liste
          </Button>
        </div>
      </div>,
      document.body,
    );
  }

  // ==========================================================================
  // Wizard
  // ==========================================================================
  const isLast = step === STEPS.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-muted">
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b border-border bg-background px-4 pb-3 pt-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">
              Schritt {step + 1} von {STEPS.length}
            </p>
            <h2 className="truncate text-lg font-extrabold tracking-tight">{STEPS[step]}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background active:scale-95 disabled:opacity-50"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {step === 0 && (
          <div className="space-y-3">
            {zeilen.length === 0 && !addingLeistung && (
              <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
                Noch keine Leistungspositionen erfasst.
              </p>
            )}

            {zeilen.map((z) => (
              <div key={z.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">{z.code || "–"}</span>
                    <p className="font-semibold leading-tight">{z.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLeistung(z.id)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-destructive active:scale-95"
                    aria-label="Position entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => patchLeistung(z.id, { menge: Math.max(0, z.menge - 1) })}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background active:scale-95"
                      aria-label="Weniger"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={z.menge}
                      onChange={(e) => patchLeistung(z.id, { menge: Number(e.target.value) })}
                      className="h-10 w-20 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => patchLeistung(z.id, { menge: z.menge + 1 })}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background active:scale-95"
                      aria-label="Mehr"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-sm text-muted-foreground">{z.einheit}</span>
                  {z.berechnungsart === "stunde_mitarbeiter" && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={z.mitarbeiter_anzahl}
                        onChange={(e) => patchLeistung(z.id, { mitarbeiter_anzahl: Number(e.target.value) })}
                        className="h-10 w-16 text-center"
                        title="Anzahl Monteure"
                      />
                      <span className="text-xs text-muted-foreground">MA</span>
                    </div>
                  )}
                </div>

                <Input
                  placeholder="Kommentar (optional)"
                  defaultValue={z.notiz ?? ""}
                  onBlur={(e) => {
                    if ((e.target.value || "") !== (z.notiz ?? "")) {
                      patchLeistung(z.id, { notiz: e.target.value || null });
                    }
                  }}
                  className="mt-3 h-10"
                />

                {canPrice && (
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-sm">
                    <span className="text-muted-foreground">{fmtEuro(preise[z.id])} / {z.einheit}</span>
                    <span className="font-bold">{fmtEuro(lineTotal(z, preise[z.id]))}</span>
                  </div>
                )}
              </div>
            ))}

            {canPrice && zeilen.length > 0 && (
              <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
                <span className="text-sm font-semibold">Gesamtbetrag</span>
                <span className="text-lg font-extrabold">{fmtEuro(gesamt)}</span>
              </div>
            )}

            {addingLeistung ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Aus Katalog wählen</p>
                <div className="flex flex-wrap gap-2">
                  {katalog.filter((k) => k.aktiv).map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      disabled={busy}
                      onClick={() => addLeistung(k)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-sm active:scale-95 disabled:opacity-50"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{k.code}</span> {k.name}
                    </button>
                  ))}
                  {katalog.length === 0 && (
                    <span className="text-sm text-muted-foreground">Keine Leistungen im Katalog.</span>
                  )}
                </div>
              </div>
            ) : (
              <Button variant="outline" className="h-12 w-full" onClick={() => setAddingLeistung(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Position hinzufügen
              </Button>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            {settings.allow_upload_photos && (
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => kameraInput.current?.click()}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card text-sm font-semibold active:scale-[0.99]"
                  >
                    <Camera className="h-5 w-5" /> Foto aufnehmen
                  </button>
                  <button
                    type="button"
                    onClick={() => fotoInput.current?.click()}
                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card text-sm font-semibold active:scale-[0.99]"
                  >
                    <ImageIcon className="h-5 w-5" /> Aus Galerie/Dateien
                  </button>
                </div>
                {/* Camera capture (explicit) */}
                <input
                  ref={kameraInput}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    stage("foto", e.target.files);
                    e.target.value = "";
                  }}
                />
                {/* Gallery / file picker (no capture) */}
                <input
                  ref={fotoInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    stage("foto", e.target.files);
                    e.target.value = "";
                  }}
                />
                {stagedFotos.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {stagedFotos.map((f, i) => (
                      <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-border">
                        <img src={f.url} alt={f.file.name} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => unstage("foto", i)}
                          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-destructive"
                          aria-label="Entfernen"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {settings.allow_upload_documents && (
              <div>
                <button
                  type="button"
                  onClick={() => dokInput.current?.click()}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card text-sm font-semibold active:scale-[0.99]"
                >
                  <FileText className="h-5 w-5" /> Dateien hinzufügen
                </button>
                <input
                  ref={dokInput}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    stage("dok", e.target.files);
                    e.target.value = "";
                  }}
                />
                {stagedDoks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {stagedDoks.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm">{f.file.name}</span>
                        <button
                          type="button"
                          onClick={() => unstage("dok", i)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-destructive active:scale-95"
                          aria-label="Entfernen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(existingFotos.length > 0 || existingDoks.length > 0) && (
              <p className="text-xs text-muted-foreground">
                Bereits vorhanden: {existingFotos.length} Foto(s), {existingDoks.length} Dokument(e).
              </p>
            )}
            {!settings.allow_upload_photos && !settings.allow_upload_documents && (
              <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
                Uploads sind für Monteure derzeit deaktiviert.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Notiz / Beschreibung
              {settings.require_note && <span className="text-destructive"> *</span>}
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Was wurde gemacht? Besonderheiten vor Ort?"
              className="min-h-[180px] text-base"
            />
            {!settings.require_note && (
              <p className="text-xs text-muted-foreground">Optional – du kannst auch ohne Notiz fortfahren.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Wähle den Abschlussstatus für diesen Auftrag.</p>
            <div className="grid gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setFinalStatus(s.key)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                    finalStatus === s.key ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card",
                  )}
                >
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: s.farbe }} />
                  <span className="flex-1 font-semibold">{s.label}</span>
                  {canPrice && s.ist_bezahlt && (
                    <span className="rounded-md bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      Zahlung
                    </span>
                  )}
                  {finalStatus === s.key && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </button>
              ))}
              {statusOptions.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-sm text-muted-foreground">
                  Dir wurden keine wählbaren Status zugewiesen.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom actions */}
      <div
        className="border-t border-border bg-background px-4 py-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        {progress && (
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
            Lade {progress.done} von {progress.total} Dateien hoch…
          </p>
        )}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="h-12 flex-1 text-base"
            disabled={busy || step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Zurück
          </Button>
          {isLast ? (
            <Button className="h-12 flex-1 text-base" disabled={busy} onClick={finish}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              Abschließen
            </Button>
          ) : (
            <Button
              className="h-12 flex-1 text-base"
              disabled={busy}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              Weiter <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

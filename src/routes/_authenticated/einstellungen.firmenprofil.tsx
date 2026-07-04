import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Loader2, Save, RotateCcw, Image, Landmark, Palette, LogIn, PanelLeft, Smartphone, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { firmenprofilQuery, type Firmenprofil } from "@/lib/settings";
import { PERM } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { DEFAULT_CUSTOM_THEME, type CustomTheme, type ThemeMode } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequirePermission } from "@/components/PermissionGuard";
import { SettingsSection, Field } from "@/components/settings/SettingsSection";
import { LogoUploader } from "@/components/settings/LogoUploader";
import { ColorPicker } from "@/components/settings/ColorPicker";
import { ThemeEditor } from "@/components/settings/ThemeEditor";

export const Route = createFileRoute("/_authenticated/einstellungen/firmenprofil")({
  component: () => (
    <RequirePermission perm={PERM.firmenprofilManage}>
      <FirmenprofilPage />
    </RequirePermission>
  ),
});

type Draft = Partial<Firmenprofil>;

function FirmenprofilPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { data, isLoading } = useQuery(firmenprofilQuery());
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(false);

  const canCompanyTheme = can(PERM.brandingCompanyTheme) || can(PERM.firmenprofilManage);
  // Banking/tax data is only visible & editable to the owner or finance users.
  const canFinance = can(PERM.finanzenManage);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const set = <K extends keyof Firmenprofil>(key: K, value: Firmenprofil[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (!data?.id) return;
    setBusy(true);
    const payload: Record<string, unknown> = {
      firmenname: draft.firmenname ?? "",
      login_logo_light: draft.login_logo_light ?? null,
      login_logo_dark: draft.login_logo_dark ?? null,
      round_logo_light: draft.round_logo_light ?? null,
      round_logo_dark: draft.round_logo_dark ?? null,
      full_logo_light: draft.full_logo_light ?? null,
      full_logo_dark: draft.full_logo_dark ?? null,
      favicon_light: draft.favicon_light ?? null,
      favicon_dark: draft.favicon_dark ?? null,
      mobile_logo_light: draft.mobile_logo_light ?? null,
      mobile_logo_dark: draft.mobile_logo_dark ?? null,
      pdf_logo: draft.pdf_logo ?? null,
      email_logo: draft.email_logo ?? null,
      invoice_logo: draft.invoice_logo ?? null,
      strasse: draft.strasse ?? null,
      plz: draft.plz ?? null,
      ort: draft.ort ?? null,
      telefon: draft.telefon ?? null,
      email: draft.email ?? null,
      website: draft.website ?? null,
      steuernummer: draft.steuernummer ?? null,
      ust_idnr: draft.ust_idnr ?? null,
      iban: draft.iban ?? null,
      bic: draft.bic ?? null,
      bank: draft.bank ?? null,
      farbe_primary: draft.farbe_primary ?? "#3b82f6",
      farbe_secondary: draft.farbe_secondary ?? "#0f172a",
      default_theme_mode: draft.default_theme_mode ?? "system",
      default_theme: (draft.default_theme as never) ?? null,
    };
    const { error } = await supabase.from("firmenprofil").update(payload as never).eq("id", data.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["firmenprofil"] });
    await qc.invalidateQueries({ queryKey: ["branding"] });
    toast.success("Gespeichert.");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const saveBtn = (
    <Button size="sm" onClick={save} disabled={busy}>
      {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
      Speichern
    </Button>
  );

  const companyTheme: CustomTheme = { ...DEFAULT_CUSTOM_THEME, ...(draft.default_theme ?? {}) };

  return (
    <>
      <SettingsSection
        title="Firmenprofil"
        icon={<Building2 className="h-4 w-4 text-primary" />}
        description="Stammdaten des Unternehmens. Diese Angaben erscheinen in Berichten, E-Mails und im gesamten System."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => data && setDraft(data)} disabled={busy}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Zurücksetzen
            </Button>
            {saveBtn}
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Firmenname" htmlFor="firmenname">
            <Input id="firmenname" value={draft.firmenname ?? ""} onChange={(e) => set("firmenname", e.target.value)} />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" value={draft.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Telefon" htmlFor="telefon">
            <Input id="telefon" value={draft.telefon ?? ""} onChange={(e) => set("telefon", e.target.value)} />
          </Field>
          <Field label="E-Mail" htmlFor="email">
            <Input id="email" type="email" value={draft.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Straße & Nr." htmlFor="strasse">
            <Input id="strasse" value={draft.strasse ?? ""} onChange={(e) => set("strasse", e.target.value)} />
          </Field>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <Field label="PLZ" htmlFor="plz">
              <Input id="plz" value={draft.plz ?? ""} onChange={(e) => set("plz", e.target.value)} />
            </Field>
            <Field label="Ort" htmlFor="ort">
              <Input id="ort" value={draft.ort ?? ""} onChange={(e) => set("ort", e.target.value)} />
            </Field>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Login-Seite"
        icon={<LogIn className="h-4 w-4 text-primary" />}
        description="Logo auf der Anmeldeseite. Jede Variante hat einen eigenen Upload-Slot."
        actions={saveBtn}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <LogoUploader label="Login-Logo (Hell)" field="login_light" path={draft.login_logo_light ?? null} onChange={(p) => set("login_logo_light", p)} />
          <LogoUploader label="Login-Logo (Dunkel)" field="login_dark" path={draft.login_logo_dark ?? null} onChange={(p) => set("login_logo_dark", p)} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="App-Header & Seitenleiste"
        icon={<PanelLeft className="h-4 w-4 text-primary" />}
        description="Rundes Logo für Seitenleiste und Kopfbereich."
        actions={saveBtn}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <LogoUploader label="Rundes Logo (Hell)" field="round_light" path={draft.round_logo_light ?? null} onChange={(p) => set("round_logo_light", p)} />
          <LogoUploader label="Rundes Logo (Dunkel)" field="round_dark" path={draft.round_logo_dark ?? null} onChange={(p) => set("round_logo_dark", p)} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Vollständiges Firmenlogo"
        icon={<Image className="h-4 w-4 text-primary" />}
        description="Horizontales Logo für Berichte, PDF und E-Mails."
        actions={saveBtn}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <LogoUploader label="Volllogo (Hell)" field="full_light" path={draft.full_logo_light ?? null} onChange={(p) => set("full_logo_light", p)} />
          <LogoUploader label="Volllogo (Dunkel)" field="full_dark" path={draft.full_logo_dark ?? null} onChange={(p) => set("full_logo_dark", p)} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Favicon"
        icon={<Image className="h-4 w-4 text-primary" />}
        description="Browser-Symbol. Das dunkle Favicon wird von unterstützenden Browsern automatisch verwendet."
        actions={saveBtn}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <LogoUploader label="Favicon (Hell)" field="favicon_light" path={draft.favicon_light ?? null} onChange={(p) => set("favicon_light", p)} />
          <LogoUploader label="Favicon (Dunkel)" field="favicon_dark" path={draft.favicon_dark ?? null} onChange={(p) => set("favicon_dark", p)} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Mobile App"
        icon={<Smartphone className="h-4 w-4 text-primary" />}
        description="Logo für die mobile Ansicht (Monteure)."
        actions={saveBtn}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <LogoUploader label="Mobile-Logo (Hell)" field="mobile_light" path={draft.mobile_logo_light ?? null} onChange={(p) => set("mobile_logo_light", p)} />
          <LogoUploader label="Mobile-Logo (Dunkel)" field="mobile_dark" path={draft.mobile_logo_dark ?? null} onChange={(p) => set("mobile_logo_dark", p)} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Dokumente (vorbereitet)"
        icon={<FileText className="h-4 w-4 text-primary" />}
        description="Logos für PDF, E-Mail und Rechnungen. Dieses Modul ist vorbereitet und wird später erweitert."
        actions={saveBtn}
      >
        <div className="grid gap-6 sm:grid-cols-3">
          <LogoUploader label="PDF-Logo" field="pdf_logo" path={draft.pdf_logo ?? null} onChange={(p) => set("pdf_logo", p)} />
          <LogoUploader label="E-Mail-Logo" field="email_logo" path={draft.email_logo ?? null} onChange={(p) => set("email_logo", p)} />
          <LogoUploader label="Rechnungslogo" field="invoice_logo" path={draft.invoice_logo ?? null} onChange={(p) => set("invoice_logo", p)} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Unternehmensfarben"
        icon={<Palette className="h-4 w-4 text-primary" />}
        description="Corporate-Farben für Akzente in Berichten und im Erscheinungsbild."
        actions={saveBtn}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primärfarbe">
            <ColorPicker value={draft.farbe_primary ?? "#3b82f6"} onChange={(v) => set("farbe_primary", v)} />
          </Field>
          <Field label="Sekundärfarbe">
            <ColorPicker value={draft.farbe_secondary ?? "#0f172a"} onChange={(v) => set("farbe_secondary", v)} />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Company-Standardtheme"
        icon={<Palette className="h-4 w-4 text-primary" />}
        description="Standard-Erscheinungsbild für alle Benutzer, die keine eigene Auswahl getroffen haben."
        actions={saveBtn}
      >
        <ThemeEditor
          mode={(draft.default_theme_mode as ThemeMode) ?? "system"}
          custom={companyTheme}
          canCustom={canCompanyTheme}
          onModeChange={(m) => set("default_theme_mode", m)}
          onCustomChange={(c) => set("default_theme", c)}
        />
      </SettingsSection>

      {canFinance && (
        <SettingsSection
          title="Steuer & Bankverbindung"
          icon={<Landmark className="h-4 w-4 text-primary" />}
          description="Vertrauliche Finanzdaten. Nur für Inhaber und Finanzberechtigte sichtbar."
          actions={saveBtn}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Steuernummer" htmlFor="steuernummer">
              <Input id="steuernummer" value={draft.steuernummer ?? ""} onChange={(e) => set("steuernummer", e.target.value)} />
            </Field>
            <Field label="USt-IdNr." htmlFor="ustidnr">
              <Input id="ustidnr" value={draft.ust_idnr ?? ""} onChange={(e) => set("ust_idnr", e.target.value)} />
            </Field>
            <Field label="IBAN" htmlFor="iban">
              <Input id="iban" value={draft.iban ?? ""} onChange={(e) => set("iban", e.target.value)} className="font-mono" />
            </Field>
            <Field label="BIC" htmlFor="bic">
              <Input id="bic" value={draft.bic ?? ""} onChange={(e) => set("bic", e.target.value)} className="font-mono" />
            </Field>
            <Field label="Bank" htmlFor="bank">
              <Input id="bank" value={draft.bank ?? ""} onChange={(e) => set("bank", e.target.value)} />
            </Field>
          </div>
        </SettingsSection>
      )}
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, UserCircle, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PERM } from "@/lib/permissions";
import {
  applyTheme, saveUserTheme, DEFAULT_CUSTOM_THEME,
  type CustomTheme, type ThemeMode,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsSection, Field } from "@/components/settings/SettingsSection";
import { ThemeEditor } from "@/components/settings/ThemeEditor";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ title: "Mein Profil – TecNova ERP" }] }),
  component: ProfilPage,
});

function ProfilPage() {
  const { user, profile, can, refresh } = useAuth();
  const qc = useQueryClient();

  const canCustom = can(PERM.brandingTheme);

  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [telefon, setTelefon] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [mode, setMode] = useState<ThemeMode>("system");
  const [custom, setCustom] = useState<CustomTheme>(DEFAULT_CUSTOM_THEME);
  const [savingTheme, setSavingTheme] = useState(false);

  // Load current profile values (incl. stored theme).
  useEffect(() => {
    setVorname(profile?.vorname ?? "");
    setNachname(profile?.nachname ?? "");
    setTelefon(profile?.telefon ?? "");
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("profiles")
      .select("theme_mode, theme_custom")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setMode(((data.theme_mode as ThemeMode) ?? "system"));
        setCustom({ ...DEFAULT_CUSTOM_THEME, ...((data.theme_custom as CustomTheme) ?? {}) });
      });
    return () => { active = false; };
  }, [user]);

  // Apply live so changes are visible immediately.
  useEffect(() => {
    applyTheme(mode, mode === "benutzerdefiniert" ? custom : null);
  }, [mode, custom]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ vorname, nachname, telefon })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Gespeichert.");
  };

  const saveTheme = async () => {
    if (!user) return;
    setSavingTheme(true);
    try {
      await saveUserTheme(user.id, mode, mode === "benutzerdefiniert" ? custom : null);
      await qc.invalidateQueries({ queryKey: ["branding"] });
      toast.success("Gespeichert.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konnte nicht gespeichert werden.");
    } finally {
      setSavingTheme(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
          {(profile?.vorname?.[0] ?? "") + (profile?.nachname?.[0] ?? "") || "?"}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Mein Profil</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>
      </div>

      <SettingsSection
        title="Persönliche Daten"
        icon={<UserCircle className="h-4 w-4 text-primary" />}
        description="Ihre Kontaktdaten im System."
        actions={
          <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Speichern
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vorname" htmlFor="vorname">
            <Input id="vorname" value={vorname} onChange={(e) => setVorname(e.target.value)} />
          </Field>
          <Field label="Nachname" htmlFor="nachname">
            <Input id="nachname" value={nachname} onChange={(e) => setNachname(e.target.value)} />
          </Field>
          <Field label="Telefon" htmlFor="telefon">
            <Input id="telefon" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Darstellung"
        icon={<Palette className="h-4 w-4 text-primary" />}
        description={
          canCustom
            ? "Wählen Sie Ihr Erscheinungsbild. Änderungen werden sofort angewendet."
            : "Wählen Sie Hell, Dunkel oder System. Änderungen werden sofort angewendet."
        }
        actions={
          <Button size="sm" onClick={saveTheme} disabled={savingTheme}>
            {savingTheme ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Speichern
          </Button>
        }
      >
        <ThemeEditor
          mode={mode}
          custom={custom}
          canCustom={canCustom}
          onModeChange={setMode}
          onCustomChange={setCustom}
        />
      </SettingsSection>
    </div>
  );
}

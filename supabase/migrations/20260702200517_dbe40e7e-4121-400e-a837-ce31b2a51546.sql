-- ============================================================
-- 1. FIRMENPROFIL: independent logo slots + company theme
-- ============================================================
ALTER TABLE public.firmenprofil
  ADD COLUMN IF NOT EXISTS login_logo_light  text,
  ADD COLUMN IF NOT EXISTS login_logo_dark   text,
  ADD COLUMN IF NOT EXISTS round_logo_light  text,
  ADD COLUMN IF NOT EXISTS round_logo_dark   text,
  ADD COLUMN IF NOT EXISTS full_logo_light   text,
  ADD COLUMN IF NOT EXISTS full_logo_dark    text,
  ADD COLUMN IF NOT EXISTS favicon_light     text,
  ADD COLUMN IF NOT EXISTS favicon_dark      text,
  ADD COLUMN IF NOT EXISTS mobile_logo_light text,
  ADD COLUMN IF NOT EXISTS mobile_logo_dark  text,
  ADD COLUMN IF NOT EXISTS pdf_logo          text,
  ADD COLUMN IF NOT EXISTS email_logo        text,
  ADD COLUMN IF NOT EXISTS invoice_logo      text,
  ADD COLUMN IF NOT EXISTS default_theme_mode text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS default_theme      jsonb;

-- ============================================================
-- 2. PROFILES: per-user theme preference
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_mode   text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS theme_custom jsonb;

-- ============================================================
-- 3. get_branding(): expose logos + company theme (anon read for login)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_branding();
CREATE OR REPLACE FUNCTION public.get_branding()
 RETURNS TABLE(
   firmenname text,
   logo_full_url text, logo_round_url text, logo_white_url text, favicon_url text,
   login_logo_light text, login_logo_dark text,
   round_logo_light text, round_logo_dark text,
   full_logo_light text, full_logo_dark text,
   favicon_light text, favicon_dark text,
   mobile_logo_light text, mobile_logo_dark text,
   pdf_logo text, email_logo text, invoice_logo text,
   farbe_primary text, farbe_secondary text,
   default_theme_mode text, default_theme jsonb
 )
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT firmenname,
         logo_full_url, logo_round_url, logo_white_url, favicon_url,
         login_logo_light, login_logo_dark,
         round_logo_light, round_logo_dark,
         full_logo_light, full_logo_dark,
         favicon_light, favicon_dark,
         mobile_logo_light, mobile_logo_dark,
         pdf_logo, email_logo, invoice_logo,
         farbe_primary, farbe_secondary,
         default_theme_mode, default_theme
  FROM public.firmenprofil ORDER BY created_at LIMIT 1;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_branding() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS firmenprofil_write ON public.firmenprofil;
CREATE POLICY firmenprofil_write ON public.firmenprofil
  TO authenticated
  USING (public.has_role(auth.uid(),'owner')
      OR public.has_permission(auth.uid(),'firmenprofil.manage')
      OR public.has_permission(auth.uid(),'branding.edit')
      OR public.has_permission(auth.uid(),'branding.company_theme'))
  WITH CHECK (public.has_role(auth.uid(),'owner')
      OR public.has_permission(auth.uid(),'firmenprofil.manage')
      OR public.has_permission(auth.uid(),'branding.edit')
      OR public.has_permission(auth.uid(),'branding.company_theme'));

DROP POLICY IF EXISTS firmenprofil_read ON public.firmenprofil;
CREATE POLICY firmenprofil_read ON public.firmenprofil
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner')
      OR public.has_permission(auth.uid(),'firmenprofil.manage')
      OR public.has_permission(auth.uid(),'branding.view')
      OR public.has_permission(auth.uid(),'finanzen.manage'));

-- ============================================================
-- 4. can_edit_verguetung (no table dependency)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_edit_verguetung()
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(),'owner')
      OR public.has_permission(auth.uid(),'gehalt.edit')
      OR public.has_permission(auth.uid(),'verguetung.edit')
      OR public.has_permission(auth.uid(),'verguetung.bonus')
      OR public.has_permission(auth.uid(),'verguetung.abzuege');
$function$;
REVOKE EXECUTE ON FUNCTION public.can_edit_verguetung() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_verguetung() TO authenticated, service_role;

-- ============================================================
-- 5. compensation tables
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mitarbeiter_verguetung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id uuid NOT NULL UNIQUE REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  grundlohn numeric,
  stundenlohn numeric,
  sollstunden numeric,
  eintrittsdatum date,
  beschaeftigungsart text,
  steuer_notizen text,
  interne_notizen text,
  eigene_sichtbar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mitarbeiter_verguetung TO authenticated;
GRANT ALL ON public.mitarbeiter_verguetung TO service_role;
ALTER TABLE public.mitarbeiter_verguetung ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.mitarbeiter_verguetung_eintraege (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id uuid NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  typ text NOT NULL,
  betrag numeric NOT NULL DEFAULT 0,
  monat text NOT NULL,
  datum date NOT NULL DEFAULT current_date,
  beschreibung text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mitarbeiter_verguetung_eintraege TO authenticated;
GRANT ALL ON public.mitarbeiter_verguetung_eintraege TO service_role;
ALTER TABLE public.mitarbeiter_verguetung_eintraege ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_verge_mid ON public.mitarbeiter_verguetung_eintraege(mitarbeiter_id);

CREATE TABLE IF NOT EXISTS public.mitarbeiter_leistungsnotizen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mitarbeiter_id uuid NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  typ text NOT NULL DEFAULT 'kommentar',
  text text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mitarbeiter_leistungsnotizen TO authenticated;
GRANT ALL ON public.mitarbeiter_leistungsnotizen TO service_role;
ALTER TABLE public.mitarbeiter_leistungsnotizen ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_leistn_mid ON public.mitarbeiter_leistungsnotizen(mitarbeiter_id);

-- ============================================================
-- 6. can_view_verguetung (references table, created now)
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_view_verguetung(_mitarbeiter_id uuid)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(),'owner')
      OR public.has_permission(auth.uid(),'gehalt.view')
      OR EXISTS (
        SELECT 1 FROM public.mitarbeiter m
        LEFT JOIN public.mitarbeiter_verguetung v ON v.mitarbeiter_id = m.id
        WHERE m.id = _mitarbeiter_id
          AND m.linked_user_id = auth.uid()
          AND COALESCE(v.eigene_sichtbar, false)
      );
$function$;
REVOKE EXECUTE ON FUNCTION public.can_view_verguetung(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_verguetung(uuid) TO authenticated, service_role;

-- ============================================================
-- 7. policies
-- ============================================================
CREATE POLICY verg_select ON public.mitarbeiter_verguetung
  FOR SELECT TO authenticated USING (public.can_view_verguetung(mitarbeiter_id));
CREATE POLICY verg_insert ON public.mitarbeiter_verguetung
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_verguetung());
CREATE POLICY verg_update ON public.mitarbeiter_verguetung
  FOR UPDATE TO authenticated USING (public.can_edit_verguetung()) WITH CHECK (public.can_edit_verguetung());
CREATE POLICY verg_delete ON public.mitarbeiter_verguetung
  FOR DELETE TO authenticated USING (public.can_edit_verguetung());

CREATE POLICY verge_select ON public.mitarbeiter_verguetung_eintraege
  FOR SELECT TO authenticated USING (public.can_view_verguetung(mitarbeiter_id));
CREATE POLICY verge_insert ON public.mitarbeiter_verguetung_eintraege
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_verguetung());
CREATE POLICY verge_update ON public.mitarbeiter_verguetung_eintraege
  FOR UPDATE TO authenticated USING (public.can_edit_verguetung()) WITH CHECK (public.can_edit_verguetung());
CREATE POLICY verge_delete ON public.mitarbeiter_verguetung_eintraege
  FOR DELETE TO authenticated USING (public.can_edit_verguetung());

CREATE POLICY leistn_select ON public.mitarbeiter_leistungsnotizen
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner')
      OR public.has_permission(auth.uid(),'gehalt.view')
      OR public.has_permission(auth.uid(),'mitarbeiter.leistung'));
CREATE POLICY leistn_insert ON public.mitarbeiter_leistungsnotizen
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_verguetung());
CREATE POLICY leistn_delete ON public.mitarbeiter_leistungsnotizen
  FOR DELETE TO authenticated USING (public.can_edit_verguetung());

-- ============================================================
-- 8. triggers
-- ============================================================
CREATE TRIGGER trg_verg_updated BEFORE UPDATE ON public.mitarbeiter_verguetung
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.trg_log_verguetung()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _name text;
BEGIN
  SELECT vorname || ' ' || nachname INTO _name FROM public.mitarbeiter WHERE id = NEW.mitarbeiter_id;
  PERFORM public.log_activity('gehalt.updated','mitarbeiter',NEW.mitarbeiter_id,_name,NULL,NULL);
  RETURN NEW;
END; $function$;
CREATE TRIGGER trg_log_verguetung AFTER INSERT OR UPDATE ON public.mitarbeiter_verguetung
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_verguetung();

CREATE OR REPLACE FUNCTION public.trg_log_verg_eintrag()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _name text; _mid uuid; _act text;
BEGIN
  IF TG_OP = 'DELETE' THEN _mid := OLD.mitarbeiter_id; ELSE _mid := NEW.mitarbeiter_id; END IF;
  SELECT vorname || ' ' || nachname INTO _name FROM public.mitarbeiter WHERE id = _mid;
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity('verguetung.deleted','mitarbeiter',_mid,_name,jsonb_build_object('typ',OLD.typ,'betrag',OLD.betrag),NULL);
    RETURN OLD;
  END IF;
  _act := CASE NEW.typ
            WHEN 'bonus' THEN 'verguetung.bonus'
            WHEN 'praemie' THEN 'verguetung.praemie'
            WHEN 'vorschuss' THEN 'verguetung.vorschuss'
            WHEN 'abschlag' THEN 'verguetung.abschlag'
            WHEN 'abzug' THEN 'verguetung.abzug'
            ELSE 'verguetung.eintrag' END;
  PERFORM public.log_activity(_act,'mitarbeiter',NEW.mitarbeiter_id,_name,NULL,jsonb_build_object('typ',NEW.typ,'betrag',NEW.betrag,'monat',NEW.monat));
  RETURN NEW;
END; $function$;
CREATE TRIGGER trg_log_verg_eintrag AFTER INSERT OR DELETE ON public.mitarbeiter_verguetung_eintraege
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_verg_eintrag();

CREATE OR REPLACE FUNCTION public.trg_log_leistungsnotiz()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _name text;
BEGIN
  SELECT vorname || ' ' || nachname INTO _name FROM public.mitarbeiter WHERE id = NEW.mitarbeiter_id;
  PERFORM public.log_activity('leistung.notiz','mitarbeiter',NEW.mitarbeiter_id,_name,NULL,jsonb_build_object('typ',NEW.typ));
  RETURN NEW;
END; $function$;
CREATE TRIGGER trg_log_leistungsnotiz AFTER INSERT ON public.mitarbeiter_leistungsnotizen
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_leistungsnotiz();
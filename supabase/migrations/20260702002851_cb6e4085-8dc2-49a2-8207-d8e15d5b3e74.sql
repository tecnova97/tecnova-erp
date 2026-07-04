-- =========================================================================
-- TecNova ERP Hotfix Pack — Foundation migration
-- Address model, priority removal, worker<->mitarbeiter linking,
-- expanded import fields. Fully backward compatible; no data loss.
-- =========================================================================

-- --- 1. ADDRESS MODEL: add hausnummer, backfill by splitting strasse -------
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS hausnummer text;
ALTER TABLE public.kunden    ADD COLUMN IF NOT EXISTS hausnummer text;

-- Split trailing house number from combined "Straße & Nr." into hausnummer.
UPDATE public.auftraege
SET hausnummer = trim((regexp_match(strasse, '(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)\s*$'))[1]),
    strasse    = trim(regexp_replace(strasse, '\s*(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)\s*$', ''))
WHERE strasse IS NOT NULL
  AND strasse ~ '\d+\s*[a-zA-Z]?\s*$'
  AND (hausnummer IS NULL OR hausnummer = '');

UPDATE public.kunden
SET hausnummer = trim((regexp_match(strasse, '(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)\s*$'))[1]),
    strasse    = trim(regexp_replace(strasse, '\s*(\d+\s*[a-zA-Z]?(?:\s*[-/]\s*\d+\s*[a-zA-Z]?)?)\s*$', ''))
WHERE strasse IS NOT NULL
  AND strasse ~ '\d+\s*[a-zA-Z]?\s*$'
  AND (hausnummer IS NULL OR hausnummer = '');

-- --- 2. EXPANDED IMPORT / AUFTRAG FIELDS -----------------------------------
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS externe_auftragsnummer text;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS ansprechpartner text;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS nvt text;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS onkz text;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS asb text;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS kls_id text;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS projektnummer text;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS team text;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS disponent text;
ALTER TABLE public.auftraege ADD COLUMN IF NOT EXISTS custom_felder jsonb NOT NULL DEFAULT '{}'::jsonb;

-- --- 3. REMOVE PRIORITAET ---------------------------------------------------
-- Recreate the audit trigger without the prioritaet reference first.
CREATE OR REPLACE FUNCTION public.trg_log_auftraege()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('auftrag.created', 'auftrag', NEW.id, NEW.titel, NULL,
      jsonb_build_object('status', NEW.status, 'titel', NEW.titel));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity('auftrag.status', 'auftrag', NEW.id, NEW.titel,
        jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));
    END IF;
    IF NEW.termin_start IS DISTINCT FROM OLD.termin_start OR NEW.termin_ende IS DISTINCT FROM OLD.termin_ende THEN
      PERFORM public.log_activity('auftrag.termin', 'auftrag', NEW.id, NEW.titel,
        jsonb_build_object('termin_start', OLD.termin_start, 'termin_ende', OLD.termin_ende),
        jsonb_build_object('termin_start', NEW.termin_start, 'termin_ende', NEW.termin_ende));
    END IF;
    IF NEW.bezahlt IS DISTINCT FROM OLD.bezahlt THEN
      PERFORM public.log_activity('auftrag.bezahlt', 'auftrag', NEW.id, NEW.titel,
        jsonb_build_object('bezahlt', OLD.bezahlt), jsonb_build_object('bezahlt', NEW.bezahlt));
    END IF;
    IF NEW.titel IS DISTINCT FROM OLD.titel OR NEW.beschreibung IS DISTINCT FROM OLD.beschreibung
       OR NEW.strasse IS DISTINCT FROM OLD.strasse OR NEW.hausnummer IS DISTINCT FROM OLD.hausnummer
       OR NEW.ort IS DISTINCT FROM OLD.ort THEN
      PERFORM public.log_activity('auftrag.edited', 'auftrag', NEW.id, NEW.titel, NULL, NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.auftraege DROP COLUMN IF EXISTS prioritaet;
DROP TYPE IF EXISTS public.auftrag_prioritaet;

-- --- 4. WORKER <-> MITARBEITER LINKING -------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_mitarbeiter_for_user(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _p public.profiles%ROWTYPE;
BEGIN
  IF EXISTS (SELECT 1 FROM public.mitarbeiter WHERE linked_user_id = _user_id) THEN
    UPDATE public.mitarbeiter m
       SET vorname = COALESCE(p.vorname, m.vorname),
           nachname = COALESCE(p.nachname, m.nachname),
           email = COALESCE(p.email, m.email),
           telefon = COALESCE(p.telefon, m.telefon),
           aktiv = NOT COALESCE(p.disabled, false),
           updated_at = now()
      FROM public.profiles p
     WHERE p.id = _user_id AND m.linked_user_id = _user_id;
    RETURN;
  END IF;

  SELECT * INTO _p FROM public.profiles WHERE id = _user_id;
  IF _p.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.mitarbeiter (vorname, nachname, email, telefon, linked_user_id, aktiv)
  VALUES (COALESCE(_p.vorname, ''), COALESCE(_p.nachname, ''), _p.email, _p.telefon,
          _user_id, NOT COALESCE(_p.disabled, false));
END;
$function$;

-- Trigger: when a user gets the worker role, ensure a linked Mitarbeiter exists.
CREATE OR REPLACE FUNCTION public.trg_sync_worker_mitarbeiter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'worker' THEN
    PERFORM public.ensure_mitarbeiter_for_user(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_worker_mitarbeiter ON public.user_roles;
CREATE TRIGGER sync_worker_mitarbeiter
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_worker_mitarbeiter();

-- Trigger: keep the linked Mitarbeiter in sync with profile changes (name, disabled).
CREATE OR REPLACE FUNCTION public.trg_sync_profile_mitarbeiter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.mitarbeiter
     SET vorname = NEW.vorname,
         nachname = NEW.nachname,
         email = NEW.email,
         telefon = NEW.telefon,
         aktiv = NOT COALESCE(NEW.disabled, false),
         updated_at = now()
   WHERE linked_user_id = NEW.id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_profile_mitarbeiter ON public.profiles;
CREATE TRIGGER sync_profile_mitarbeiter
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_profile_mitarbeiter();

-- Backfill: link/create Mitarbeiter for all existing worker users.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'worker' LOOP
    PERFORM public.ensure_mitarbeiter_for_user(r.user_id);
  END LOOP;
END $$;

-- Owner-callable: link an existing Mitarbeiter to a user account.
CREATE OR REPLACE FUNCTION public.link_mitarbeiter_to_user(_mitarbeiter_id uuid, _user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Nur Inhaber';
  END IF;
  UPDATE public.mitarbeiter SET linked_user_id = _user_id, updated_at = now()
  WHERE id = _mitarbeiter_id;
  PERFORM public.ensure_mitarbeiter_for_user(_user_id);
END;
$function$;

-- --- 5. DASHBOARD LAYOUT CONFIG (role defaults) ----------------------------
CREATE TABLE IF NOT EXISTS public.dashboard_role_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_role app_role NOT NULL UNIQUE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  allow_customize boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_role_layouts TO authenticated;
GRANT ALL ON public.dashboard_role_layouts TO service_role;

ALTER TABLE public.dashboard_role_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read role layouts"
ON public.dashboard_role_layouts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners manage role layouts"
ON public.dashboard_role_layouts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_dashboard_role_layouts_updated_at
BEFORE UPDATE ON public.dashboard_role_layouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
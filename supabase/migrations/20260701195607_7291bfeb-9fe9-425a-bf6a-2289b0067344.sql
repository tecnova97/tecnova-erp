
-- =====================================================================
-- Phase 3: Auftrag service positions, activity audit log, permissions
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Service positions on an Auftrag
-- ---------------------------------------------------------------------
CREATE TABLE public.auftrag_leistungen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auftrag_id uuid NOT NULL REFERENCES public.auftraege(id) ON DELETE CASCADE,
  leistung_id uuid REFERENCES public.leistungspositionen(id) ON DELETE SET NULL,
  code text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  berechnungsart text NOT NULL DEFAULT 'pauschale',
  einheit text NOT NULL DEFAULT '',
  menge numeric NOT NULL DEFAULT 1,
  mitarbeiter_anzahl integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auftrag_leistungen TO authenticated;
GRANT ALL ON public.auftrag_leistungen TO service_role;

ALTER TABLE public.auftrag_leistungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auftrag_leistungen_select" ON public.auftrag_leistungen
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) OR is_assigned_to_auftrag(auth.uid(), auftrag_id));

CREATE POLICY "auftrag_leistungen_staff_write" ON public.auftrag_leistungen
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE TRIGGER trg_auftrag_leistungen_updated
  BEFORE UPDATE ON public.auftrag_leistungen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Prices kept separate so they can be hidden from non-finance users via RLS
CREATE TABLE public.auftrag_leistung_preise (
  auftrag_leistung_id uuid NOT NULL PRIMARY KEY
    REFERENCES public.auftrag_leistungen(id) ON DELETE CASCADE,
  preis numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auftrag_leistung_preise TO authenticated;
GRANT ALL ON public.auftrag_leistung_preise TO service_role;

ALTER TABLE public.auftrag_leistung_preise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auftrag_leistung_preise_read" ON public.auftrag_leistung_preise
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner') OR
    has_permission(auth.uid(), 'finanzen.manage') OR
    has_permission(auth.uid(), 'umsatz.view')
  );

CREATE POLICY "auftrag_leistung_preise_write" ON public.auftrag_leistung_preise
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- ---------------------------------------------------------------------
-- 2. Central activity / audit log
-- ---------------------------------------------------------------------
CREATE TABLE public.activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'system',
  entity_id uuid,
  entity_name text,
  before_value jsonb,
  after_value jsonb,
  hidden_from_ui boolean NOT NULL DEFAULT false,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_created ON public.activity_log (created_at DESC);
CREATE INDEX idx_activity_log_entity ON public.activity_log (entity_type, entity_id);
CREATE INDEX idx_activity_log_user ON public.activity_log (user_id);

GRANT SELECT, INSERT, UPDATE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Anyone signed in may append (their own) activity
CREATE POLICY "activity_log_insert" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Reading the audit trail requires the activity permission (or owner)
CREATE POLICY "activity_log_select" ON public.activity_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_permission(auth.uid(), 'aktivitaet.view'));

-- Only owners may hide entries or add admin notes
CREATE POLICY "activity_log_owner_update" ON public.activity_log
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'))
  WITH CHECK (has_role(auth.uid(), 'owner'));

-- ---------------------------------------------------------------------
-- 3. Generic activity logging helper + automatic triggers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_activity(
  _action text,
  _entity_type text,
  _entity_id uuid,
  _entity_name text,
  _before jsonb DEFAULT NULL,
  _after jsonb DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, entity_name, before_value, after_value)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _entity_name, _before, _after);
$$;

-- Auftraege trigger: create / status / termin / edit
CREATE OR REPLACE FUNCTION public.trg_log_auftraege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
       OR NEW.strasse IS DISTINCT FROM OLD.strasse OR NEW.ort IS DISTINCT FROM OLD.ort
       OR NEW.prioritaet IS DISTINCT FROM OLD.prioritaet THEN
      PERFORM public.log_activity('auftrag.edited', 'auftrag', NEW.id, NEW.titel, NULL, NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_auftraege
  AFTER INSERT OR UPDATE ON public.auftraege
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_auftraege();

-- Projekte trigger
CREATE OR REPLACE FUNCTION public.trg_log_projekte()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('projekt.created', 'projekt', NEW.id, NEW.name, NULL, NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_activity('projekt.edited', 'projekt', NEW.id, NEW.name, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_projekte
  AFTER INSERT OR UPDATE ON public.projekte
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_projekte();

-- Kunden (Auftraggeber) trigger
CREATE OR REPLACE FUNCTION public.trg_log_kunden()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('auftraggeber.created', 'kunde', NEW.id, NEW.name, NULL, NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_activity('auftraggeber.edited', 'kunde', NEW.id, NEW.name, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_kunden
  AFTER INSERT OR UPDATE ON public.kunden
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_kunden();

-- Mitarbeiter assignment trigger
CREATE OR REPLACE FUNCTION public.trg_log_auftrag_mitarbeiter()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _titel text; _name text; _aid uuid; _mid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN _aid := NEW.auftrag_id; _mid := NEW.mitarbeiter_id;
  ELSE _aid := OLD.auftrag_id; _mid := OLD.mitarbeiter_id; END IF;
  SELECT titel INTO _titel FROM public.auftraege WHERE id = _aid;
  SELECT (vorname || ' ' || nachname) INTO _name FROM public.mitarbeiter WHERE id = _mid;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('mitarbeiter.assigned', 'auftrag', _aid, _titel, NULL, jsonb_build_object('mitarbeiter', _name));
    RETURN NEW;
  ELSE
    PERFORM public.log_activity('mitarbeiter.unassigned', 'auftrag', _aid, _titel, jsonb_build_object('mitarbeiter', _name), NULL);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_activity_auftrag_mitarbeiter
  AFTER INSERT OR DELETE ON public.auftrag_mitarbeiter
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_auftrag_mitarbeiter();

-- Fotos trigger
CREATE OR REPLACE FUNCTION public.trg_log_fotos()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _titel text; _aid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN _aid := NEW.auftrag_id; ELSE _aid := OLD.auftrag_id; END IF;
  SELECT titel INTO _titel FROM public.auftraege WHERE id = _aid;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('foto.uploaded', 'auftrag', _aid, _titel, NULL, NULL);
    RETURN NEW;
  ELSE
    PERFORM public.log_activity('foto.deleted', 'auftrag', _aid, _titel, NULL, NULL);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_activity_fotos
  AFTER INSERT OR DELETE ON public.fotos
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_fotos();

-- Dokumente trigger
CREATE OR REPLACE FUNCTION public.trg_log_dokumente()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _titel text; _aid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN _aid := NEW.auftrag_id; ELSE _aid := OLD.auftrag_id; END IF;
  SELECT titel INTO _titel FROM public.auftraege WHERE id = _aid;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('dokument.uploaded', 'auftrag', _aid, _titel, NULL, NULL);
    RETURN NEW;
  ELSE
    PERFORM public.log_activity('dokument.deleted', 'auftrag', _aid, _titel, NULL, NULL);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_activity_dokumente
  AFTER INSERT OR DELETE ON public.dokumente
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_dokumente();

-- Service position definitions trigger
CREATE OR REPLACE FUNCTION public.trg_log_leistungen()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('leistung.created', 'leistung', NEW.id, NEW.name, NULL, NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_activity('leistung.edited', 'leistung', NEW.id, NEW.name, NULL, NULL);
    RETURN NEW;
  ELSE
    PERFORM public.log_activity('leistung.deleted', 'leistung', OLD.id, OLD.name, NULL, NULL);
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_activity_leistungen
  AFTER INSERT OR UPDATE OR DELETE ON public.leistungspositionen
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_leistungen();

-- ---------------------------------------------------------------------
-- 4. Login / failed-login events also flow into activity_log
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_login_attempt(_email text, _action text, _ip text DEFAULT NULL::text, _user_agent text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  INSERT INTO public.security_events (email, user_id, action, ip_address, user_agent)
  VALUES (_email, _uid, _action, _ip, _user_agent);
  IF _action = 'login_success' AND _uid IS NOT NULL THEN
    UPDATE public.profiles SET last_login_at = now() WHERE id = _uid;
  END IF;
  INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, entity_name, after_value)
  VALUES (_uid,
    CASE _action WHEN 'login_success' THEN 'auth.login'
                 WHEN 'login_failed' THEN 'auth.login_failed'
                 WHEN 'logout' THEN 'auth.logout'
                 ELSE 'auth.' || _action END,
    'auth', _uid, _email, NULL);
END;
$function$;

-- ---------------------------------------------------------------------
-- 5. Seed missing permissions (activity view, page management)
-- ---------------------------------------------------------------------
INSERT INTO public.permissions (key, label, kategorie, beschreibung, sort_order)
VALUES
  ('aktivitaet.view', 'Aktivität einsehen', 'Verwaltung', 'Zugriff auf das systemweite Aktivitätsprotokoll', 90),
  ('seiten.manage', 'Seiten verwalten', 'Verwaltung', 'Navigationsreihenfolge und Sichtbarkeit steuern', 91)
ON CONFLICT (key) DO NOTHING;

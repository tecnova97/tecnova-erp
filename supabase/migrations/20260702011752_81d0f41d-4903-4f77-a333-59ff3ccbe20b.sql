-- ============================================================
-- Projekte / Auftraggeber / Mitarbeiter module upgrade
-- ============================================================

-- 1) Extend projekte with business fields + archive flag
ALTER TABLE public.projekte
  ADD COLUMN IF NOT EXISTS hausnummer   text,
  ADD COLUMN IF NOT EXISTS nvt          text,
  ADD COLUMN IF NOT EXISTS esass_nr     text,
  ADD COLUMN IF NOT EXISTS ag_leb_nr    text,
  ADD COLUMN IF NOT EXISTS kostenstelle text,
  ADD COLUMN IF NOT EXISTS projektleiter text,
  ADD COLUMN IF NOT EXISTS leistungsort text,
  ADD COLUMN IF NOT EXISTS notizen      text,
  ADD COLUMN IF NOT EXISTS updated_by   uuid,
  ADD COLUMN IF NOT EXISTS archiviert   boolean NOT NULL DEFAULT false;

-- 2) Extend kunden (Auftraggeber)
ALTER TABLE public.kunden
  ADD COLUMN IF NOT EXISTS festnetz   text,
  ADD COLUMN IF NOT EXISTS website    text,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS archiviert boolean NOT NULL DEFAULT false;

-- 3) Extend mitarbeiter
ALTER TABLE public.mitarbeiter
  ADD COLUMN IF NOT EXISTS rolle      text,
  ADD COLUMN IF NOT EXISTS notizen    text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- 4) Equipment / Ausstattung
CREATE TABLE IF NOT EXISTS public.mitarbeiter_ausstattung (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mitarbeiter_id uuid NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  typ text NOT NULL DEFAULT 'geraet',
  bezeichnung text NOT NULL,
  kennzeichen text,
  seriennummer text,
  ausgabe_datum date,
  rueckgabe_datum date,
  notiz text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mitarbeiter_ausstattung TO authenticated;
GRANT ALL ON public.mitarbeiter_ausstattung TO service_role;
ALTER TABLE public.mitarbeiter_ausstattung ENABLE ROW LEVEL SECURITY;

CREATE POLICY ausstattung_staff_modify ON public.mitarbeiter_ausstattung
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY ausstattung_worker_select ON public.mitarbeiter_ausstattung
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mitarbeiter m
      WHERE m.id = mitarbeiter_ausstattung.mitarbeiter_id AND m.linked_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_ausstattung_mitarbeiter ON public.mitarbeiter_ausstattung(mitarbeiter_id);
CREATE TRIGGER update_ausstattung_updated_at
  BEFORE UPDATE ON public.mitarbeiter_ausstattung
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Vacation / Urlaub
CREATE TABLE IF NOT EXISTS public.urlaub (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mitarbeiter_id uuid NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  typ text NOT NULL DEFAULT 'urlaub',
  start_datum date NOT NULL,
  end_datum date NOT NULL,
  status text NOT NULL DEFAULT 'beantragt',
  grund text,
  notiz text,
  entschieden_von uuid,
  entschieden_am timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.urlaub TO authenticated;
GRANT ALL ON public.urlaub TO service_role;
ALTER TABLE public.urlaub ENABLE ROW LEVEL SECURITY;

CREATE POLICY urlaub_staff_modify ON public.urlaub
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY urlaub_worker_select ON public.urlaub
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mitarbeiter m
      WHERE m.id = urlaub.mitarbeiter_id AND m.linked_user_id = auth.uid()
    )
  );

-- Workers may create their own vacation requests
CREATE POLICY urlaub_worker_insert ON public.urlaub
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mitarbeiter m
      WHERE m.id = urlaub.mitarbeiter_id AND m.linked_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_urlaub_mitarbeiter ON public.urlaub(mitarbeiter_id);
CREATE INDEX IF NOT EXISTS idx_urlaub_start ON public.urlaub(start_datum);
CREATE TRIGGER update_urlaub_updated_at
  BEFORE UPDATE ON public.urlaub
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Activity logging triggers for new/updated entities
CREATE OR REPLACE FUNCTION public.trg_log_mitarbeiter()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('mitarbeiter.created', 'mitarbeiter', NEW.id, NEW.vorname || ' ' || NEW.nachname, NULL, NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.aktiv IS DISTINCT FROM OLD.aktiv THEN
      PERFORM public.log_activity(CASE WHEN NEW.aktiv THEN 'mitarbeiter.activated' ELSE 'mitarbeiter.archived' END,
        'mitarbeiter', NEW.id, NEW.vorname || ' ' || NEW.nachname, NULL, NULL);
    ELSIF NEW.linked_user_id IS DISTINCT FROM OLD.linked_user_id THEN
      PERFORM public.log_activity(CASE WHEN NEW.linked_user_id IS NULL THEN 'mitarbeiter.unlinked' ELSE 'mitarbeiter.linked' END,
        'mitarbeiter', NEW.id, NEW.vorname || ' ' || NEW.nachname, NULL, NULL);
    ELSE
      PERFORM public.log_activity('mitarbeiter.edited', 'mitarbeiter', NEW.id, NEW.vorname || ' ' || NEW.nachname, NULL, NULL);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_mitarbeiter ON public.mitarbeiter;
CREATE TRIGGER trg_log_mitarbeiter
  AFTER INSERT OR UPDATE ON public.mitarbeiter
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_mitarbeiter();

CREATE OR REPLACE FUNCTION public.trg_log_ausstattung()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT vorname || ' ' || nachname INTO _name FROM public.mitarbeiter WHERE id = OLD.mitarbeiter_id;
    PERFORM public.log_activity('ausstattung.returned', 'mitarbeiter', OLD.mitarbeiter_id, _name, jsonb_build_object('bezeichnung', OLD.bezeichnung), NULL);
    RETURN OLD;
  END IF;
  SELECT vorname || ' ' || nachname INTO _name FROM public.mitarbeiter WHERE id = NEW.mitarbeiter_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('ausstattung.assigned', 'mitarbeiter', NEW.mitarbeiter_id, _name, NULL, jsonb_build_object('bezeichnung', NEW.bezeichnung));
  ELSE
    PERFORM public.log_activity('ausstattung.edited', 'mitarbeiter', NEW.mitarbeiter_id, _name, NULL, jsonb_build_object('bezeichnung', NEW.bezeichnung));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_ausstattung ON public.mitarbeiter_ausstattung;
CREATE TRIGGER trg_log_ausstattung
  AFTER INSERT OR UPDATE OR DELETE ON public.mitarbeiter_ausstattung
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_ausstattung();

CREATE OR REPLACE FUNCTION public.trg_log_urlaub()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _name text;
BEGIN
  SELECT vorname || ' ' || nachname INTO _name FROM public.mitarbeiter WHERE id = COALESCE(NEW.mitarbeiter_id, OLD.mitarbeiter_id);
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('urlaub.created', 'mitarbeiter', NEW.mitarbeiter_id, _name, NULL, jsonb_build_object('typ', NEW.typ, 'status', NEW.status));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity('urlaub.' || NEW.status, 'mitarbeiter', NEW.mitarbeiter_id, _name,
      jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_urlaub ON public.urlaub;
CREATE TRIGGER trg_log_urlaub
  AFTER INSERT OR UPDATE ON public.urlaub
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_urlaub();

-- 7) New permissions
INSERT INTO public.permissions (key, label, kategorie, beschreibung, sort_order) VALUES
  ('projekte.create',      'Projekte erstellen',      'Projekte',     'Neue Projekte anlegen', 205),
  ('projekte.finanzen',    'Projekt-Finanzen',        'Projekte',     'Finanzdaten von Projekten sehen', 240),
  ('auftraggeber.create',  'Auftraggeber erstellen',  'Auftraggeber', 'Neue Auftraggeber anlegen', 305),
  ('auftraggeber.finanzen','Auftraggeber-Finanzen',   'Auftraggeber', 'Finanzdaten von Auftraggebern sehen', 340),
  ('mitarbeiter.view',     'Mitarbeiter ansehen',     'Mitarbeiter',  'Mitarbeiterliste und Profile sehen', 500),
  ('mitarbeiter.create',   'Mitarbeiter erstellen',   'Mitarbeiter',  'Neue Mitarbeiter anlegen', 505),
  ('mitarbeiter.edit',     'Mitarbeiter bearbeiten',  'Mitarbeiter',  'Mitarbeiterdaten bearbeiten', 510),
  ('mitarbeiter.delete',   'Mitarbeiter archivieren', 'Mitarbeiter',  'Mitarbeiter deaktivieren/archivieren', 515),
  ('mitarbeiter.gehalt',   'Gehalt sehen',            'Mitarbeiter',  'Gehaltsdaten von Mitarbeitern sehen', 520),
  ('mitarbeiter.leistung', 'Leistung sehen',          'Mitarbeiter',  'Leistungs-/Umsatzkennzahlen von Mitarbeitern sehen', 525),
  ('mitarbeiter.ausstattung.view',   'Ausstattung sehen',   'Mitarbeiter', 'Fahrzeuge/Geräte eines Mitarbeiters sehen', 530),
  ('mitarbeiter.ausstattung.assign', 'Ausstattung verwalten','Mitarbeiter', 'Ausstattung zuweisen/zurücknehmen', 535),
  ('mitarbeiter.urlaub.manage',      'Urlaub verwalten',     'Mitarbeiter', 'Urlaubsanträge verwalten und genehmigen', 540)
ON CONFLICT (key) DO NOTHING;

-- 8) Grant all new permissions to Owner role
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (VALUES
  ('projekte.create'),('projekte.finanzen'),
  ('auftraggeber.create'),('auftraggeber.finanzen'),
  ('mitarbeiter.view'),('mitarbeiter.create'),('mitarbeiter.edit'),('mitarbeiter.delete'),
  ('mitarbeiter.gehalt'),('mitarbeiter.leistung'),
  ('mitarbeiter.ausstattung.view'),('mitarbeiter.ausstattung.assign'),('mitarbeiter.urlaub.manage')
) AS p(key)
WHERE r.base_role = 'owner'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- 9) Grant management (non-financial) permissions to Disponent
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (VALUES
  ('projekte.create'),
  ('auftraggeber.create'),
  ('mitarbeiter.view'),('mitarbeiter.create'),('mitarbeiter.edit'),
  ('mitarbeiter.ausstattung.view'),('mitarbeiter.ausstattung.assign'),
  ('mitarbeiter.urlaub.manage')
) AS p(key)
WHERE r.base_role = 'disponent'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Existing Disponent already has projekte.view/edit and auftraggeber.view/edit via prior seeds.
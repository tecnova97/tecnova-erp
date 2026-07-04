-- ============================================================
-- 1. Event number on payment events
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.zahlungsereignis_nummer_seq;
ALTER TABLE public.auftrag_zahlungsereignisse
  ADD COLUMN IF NOT EXISTS nummer bigint;
-- backfill existing rows in chronological order
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.auftrag_zahlungsereignisse WHERE nummer IS NULL ORDER BY created_at, id LOOP
    UPDATE public.auftrag_zahlungsereignisse SET nummer = nextval('public.zahlungsereignis_nummer_seq') WHERE id = r.id;
  END LOOP;
END $$;
ALTER TABLE public.auftrag_zahlungsereignisse
  ALTER COLUMN nummer SET DEFAULT nextval('public.zahlungsereignis_nummer_seq');

-- ============================================================
-- 2. Rechnungsgruppen (billing groups)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.rechnung_gruppe_nummer_seq;

CREATE TABLE public.rechnung_gruppen (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nummer text NOT NULL UNIQUE,
  name text,
  auftraggeber_id uuid REFERENCES public.kunden(id) ON DELETE SET NULL,
  projekt_id uuid REFERENCES public.projekte(id) ON DELETE SET NULL,
  nvt text,
  esass_nr text,
  ag_bestell_nr text,
  ag_leb_nr text,
  sm_nr text,
  kostenstelle text,
  projektleiter text,
  leistungsort text,
  leistungszeitraum_von date,
  leistungszeitraum_bis date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','geprueft','freigegeben','abgerechnet','storniert')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_rechnung_gruppe_nummer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.nummer IS NULL OR NEW.nummer = '' THEN
    NEW.nummer := 'RG-' || to_char(now(),'YYYY') || '-' ||
                  lpad(nextval('public.rechnung_gruppe_nummer_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rechnung_gruppe_nummer BEFORE INSERT ON public.rechnung_gruppen
  FOR EACH ROW EXECUTE FUNCTION public.set_rechnung_gruppe_nummer();
CREATE TRIGGER trg_rechnung_gruppen_updated BEFORE UPDATE ON public.rechnung_gruppen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rechnung_gruppen TO authenticated;
GRANT ALL ON public.rechnung_gruppen TO service_role;
ALTER TABLE public.rechnung_gruppen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rechnung_gruppen read" ON public.rechnung_gruppen FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'abrechnung.view') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "rechnung_gruppen insert" ON public.rechnung_gruppen FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'abrechnung.create') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "rechnung_gruppen update" ON public.rechnung_gruppen FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'abrechnung.edit') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'abrechnung.edit') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "rechnung_gruppen delete" ON public.rechnung_gruppen FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'abrechnung.delete') OR public.has_role(auth.uid(),'owner'));

-- ============================================================
-- 3. Rechnungsgruppe <-> Zahlungsereignis link
-- ============================================================
CREATE TABLE public.rechnung_gruppe_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rechnung_gruppe_id uuid NOT NULL REFERENCES public.rechnung_gruppen(id) ON DELETE CASCADE,
  zahlungsereignis_id uuid NOT NULL REFERENCES public.auftrag_zahlungsereignisse(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  included boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rechnung_gruppe_id, zahlungsereignis_id)
);
CREATE INDEX rechnung_gruppe_events_gruppe_idx ON public.rechnung_gruppe_events(rechnung_gruppe_id);
CREATE INDEX rechnung_gruppe_events_event_idx ON public.rechnung_gruppe_events(zahlungsereignis_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rechnung_gruppe_events TO authenticated;
GRANT ALL ON public.rechnung_gruppe_events TO service_role;
ALTER TABLE public.rechnung_gruppe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rg_events read" ON public.rechnung_gruppe_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'abrechnung.view') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "rg_events manage" ON public.rechnung_gruppe_events FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'abrechnung.events') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'abrechnung.events') OR public.has_role(auth.uid(),'owner'));

-- ============================================================
-- 4. Rechnungsgruppe documents
-- ============================================================
CREATE TABLE public.rechnung_gruppe_dokumente (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rechnung_gruppe_id uuid NOT NULL REFERENCES public.rechnung_gruppen(id) ON DELETE CASCADE,
  titel text NOT NULL,
  typ text NOT NULL DEFAULT 'sonstiges'
    CHECK (typ IN ('rechnung','rechnungsanlage','aufmass','pdf','excel','sonstiges')),
  datei_pfad text NOT NULL,
  datei_name text,
  mime_type text,
  groesse bigint,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rechnung_gruppe_dokumente_gruppe_idx ON public.rechnung_gruppe_dokumente(rechnung_gruppe_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rechnung_gruppe_dokumente TO authenticated;
GRANT ALL ON public.rechnung_gruppe_dokumente TO service_role;
ALTER TABLE public.rechnung_gruppe_dokumente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rg_docs read" ON public.rechnung_gruppe_dokumente FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'abrechnung.view') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "rg_docs manage" ON public.rechnung_gruppe_dokumente FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'abrechnung.upload') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'abrechnung.upload') OR public.has_role(auth.uid(),'owner'));

-- ============================================================
-- 5. Extend betriebsausgaben (expenses)
-- ============================================================
ALTER TABLE public.betriebsausgaben
  ADD COLUMN IF NOT EXISTS kategorie text,
  ADD COLUMN IF NOT EXISTS mwst_satz numeric(5,2) NOT NULL DEFAULT 19,
  ADD COLUMN IF NOT EXISTS beleg_url text,
  ADD COLUMN IF NOT EXISTS auftrag_id uuid REFERENCES public.auftraege(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS projekt_id uuid REFERENCES public.projekte(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mitarbeiter_id uuid REFERENCES public.mitarbeiter(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auftraggeber_id uuid REFERENCES public.kunden(id) ON DELETE SET NULL;

-- ============================================================
-- 6. Activity log trigger for Rechnungsgruppen
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_log_rechnung_gruppen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('abrechnung.created','rechnung_gruppe',NEW.id,COALESCE(NEW.name,NEW.nummer),NULL,jsonb_build_object('status',NEW.status));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_activity('abrechnung.status','rechnung_gruppe',NEW.id,COALESCE(NEW.name,NEW.nummer),
        jsonb_build_object('status',OLD.status),jsonb_build_object('status',NEW.status));
    ELSE
      PERFORM public.log_activity('abrechnung.edited','rechnung_gruppe',NEW.id,COALESCE(NEW.name,NEW.nummer),NULL,NULL);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.log_activity('abrechnung.deleted','rechnung_gruppe',OLD.id,COALESCE(OLD.name,OLD.nummer),NULL,NULL);
    RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER trg_log_rechnung_gruppen
  AFTER INSERT OR UPDATE OR DELETE ON public.rechnung_gruppen
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_rechnung_gruppen();

-- ============================================================
-- 7. Permissions
-- ============================================================
INSERT INTO public.permissions (key, label, kategorie, beschreibung, sort_order) VALUES
  ('zahlungsereignisse.view','Zahlungsereignisse ansehen','Finanzen','Alle Zahlungsereignisse einsehen',529),
  ('zahlungsereignisse.edit','Zahlungsereignisse bearbeiten','Finanzen','Zahlungsereignisse bearbeiten / Notizen pflegen',529),
  ('abrechnung.view','Abrechnung ansehen','Abrechnung','Rechnungsgruppen einsehen',800),
  ('abrechnung.create','Abrechnung erstellen','Abrechnung','Neue Rechnungsgruppen anlegen',801),
  ('abrechnung.edit','Abrechnung bearbeiten','Abrechnung','Rechnungsgruppen bearbeiten',802),
  ('abrechnung.delete','Abrechnung löschen / stornieren','Abrechnung','Rechnungsgruppen löschen oder stornieren',803),
  ('abrechnung.events','Zahlungsereignisse zuordnen','Abrechnung','Zahlungsereignisse einer Rechnungsgruppe zuordnen',804),
  ('abrechnung.upload','Abrechnungsdateien hochladen','Abrechnung','Dateien zu Rechnungsgruppen hochladen',805),
  ('abrechnung.export','Abrechnung exportieren','Abrechnung','Rechnungsgruppen exportieren',806)
ON CONFLICT (key) DO NOTHING;

-- Grant all new permissions to the Owner role(s)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (VALUES
  ('zahlungsereignisse.view'),('zahlungsereignisse.edit'),
  ('abrechnung.view'),('abrechnung.create'),('abrechnung.edit'),('abrechnung.delete'),
  ('abrechnung.events'),('abrechnung.upload'),('abrechnung.export')
) AS p(key)
WHERE r.base_role = 'owner'
ON CONFLICT DO NOTHING;
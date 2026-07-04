
CREATE TYPE public.app_role AS ENUM ('owner','disponent','worker');
CREATE TYPE public.auftrag_status AS ENUM ('neu','geplant','zugewiesen','in_arbeit','warten','abgeschlossen','storniert');
CREATE TYPE public.auftrag_prioritaet AS ENUM ('niedrig','mittel','hoch','dringend');
CREATE TYPE public.projekt_status AS ENUM ('aktiv','pausiert','abgeschlossen','archiviert');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vorname TEXT, nachname TEXT, email TEXT, telefon TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','disponent'));
$$;

CREATE TABLE public.kunden (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, ansprechpartner TEXT, email TEXT, telefon TEXT,
  strasse TEXT, plz TEXT, ort TEXT, notizen TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kunden TO authenticated;
GRANT ALL ON public.kunden TO service_role;
ALTER TABLE public.kunden ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_kunden_updated BEFORE UPDATE ON public.kunden FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mitarbeiter (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  vorname TEXT NOT NULL, nachname TEXT NOT NULL, email TEXT, telefon TEXT, position TEXT,
  qualifikationen TEXT[] NOT NULL DEFAULT '{}',
  farbe TEXT NOT NULL DEFAULT '#3b82f6',
  aktiv BOOLEAN NOT NULL DEFAULT true,
  linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mitarbeiter TO authenticated;
GRANT ALL ON public.mitarbeiter TO service_role;
ALTER TABLE public.mitarbeiter ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_mitarbeiter_updated BEFORE UPDATE ON public.mitarbeiter FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.projekte (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kunde_id UUID REFERENCES public.kunden(id) ON DELETE SET NULL,
  beschreibung TEXT,
  status projekt_status NOT NULL DEFAULT 'aktiv',
  strasse TEXT, plz TEXT, ort TEXT, start_datum DATE, end_datum DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projekte TO authenticated;
GRANT ALL ON public.projekte TO service_role;
ALTER TABLE public.projekte ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_projekte_updated BEFORE UPDATE ON public.projekte FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE SEQUENCE public.auftrag_nr_seq START 1001;
CREATE TABLE public.auftraege (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  auftragsnummer TEXT NOT NULL UNIQUE DEFAULT ('A-' || nextval('public.auftrag_nr_seq')),
  titel TEXT NOT NULL, beschreibung TEXT,
  status auftrag_status NOT NULL DEFAULT 'neu',
  prioritaet auftrag_prioritaet NOT NULL DEFAULT 'mittel',
  kunde_id UUID REFERENCES public.kunden(id) ON DELETE SET NULL,
  projekt_id UUID REFERENCES public.projekte(id) ON DELETE SET NULL,
  strasse TEXT, plz TEXT, ort TEXT,
  termin_start TIMESTAMPTZ, termin_ende TIMESTAMPTZ,
  interne_notizen TEXT, abschluss_notizen TEXT, abgeschlossen_am TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auftraege TO authenticated;
GRANT ALL ON public.auftraege TO service_role;
ALTER TABLE public.auftraege ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_auftraege_updated BEFORE UPDATE ON public.auftraege FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_auftraege_status ON public.auftraege(status);
CREATE INDEX idx_auftraege_termin ON public.auftraege(termin_start);

CREATE TABLE public.auftrag_mitarbeiter (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id UUID NOT NULL REFERENCES public.auftraege(id) ON DELETE CASCADE,
  mitarbeiter_id UUID NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auftrag_id, mitarbeiter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auftrag_mitarbeiter TO authenticated;
GRANT ALL ON public.auftrag_mitarbeiter TO service_role;
ALTER TABLE public.auftrag_mitarbeiter ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_assigned_to_auftrag(_user_id UUID, _auftrag_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auftrag_mitarbeiter am
    JOIN public.mitarbeiter m ON m.id = am.mitarbeiter_id
    WHERE am.auftrag_id = _auftrag_id AND m.linked_user_id = _user_id
  );
$$;

CREATE TABLE public.auftrag_historie (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id UUID NOT NULL REFERENCES public.auftraege(id) ON DELETE CASCADE,
  aktion TEXT NOT NULL, details TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auftrag_historie TO authenticated;
GRANT ALL ON public.auftrag_historie TO service_role;
ALTER TABLE public.auftrag_historie ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.fotos (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id UUID NOT NULL REFERENCES public.auftraege(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, dateiname TEXT, beschreibung TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fotos TO authenticated;
GRANT ALL ON public.fotos TO service_role;
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dokumente (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id UUID REFERENCES public.auftraege(id) ON DELETE CASCADE,
  projekt_id UUID REFERENCES public.projekte(id) ON DELETE CASCADE,
  kunde_id UUID REFERENCES public.kunden(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, dateiname TEXT NOT NULL, dateityp TEXT, groesse BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dokumente TO authenticated;
GRANT ALL ON public.dokumente TO service_role;
ALTER TABLE public.dokumente ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, vorname, nachname, email)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'vorname', split_part(COALESCE(NEW.raw_user_meta_data->>'name',''), ' ', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nachname', ''),
    NEW.email);
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'worker');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "user_roles_owner_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE POLICY "kunden_select" ON public.kunden FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.auftraege a WHERE a.kunde_id = kunden.id AND public.is_assigned_to_auftrag(auth.uid(), a.id)));
CREATE POLICY "kunden_staff_modify" ON public.kunden FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "mitarbeiter_select" ON public.mitarbeiter FOR SELECT TO authenticated USING (true);
CREATE POLICY "mitarbeiter_staff_modify" ON public.mitarbeiter FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "projekte_select" ON public.projekte FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.auftraege a WHERE a.projekt_id = projekte.id AND public.is_assigned_to_auftrag(auth.uid(), a.id)));
CREATE POLICY "projekte_staff_modify" ON public.projekte FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "auftraege_select" ON public.auftraege FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_assigned_to_auftrag(auth.uid(), id));
CREATE POLICY "auftraege_staff_modify" ON public.auftraege FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "auftraege_worker_update" ON public.auftraege FOR UPDATE TO authenticated
  USING (public.is_assigned_to_auftrag(auth.uid(), id)) WITH CHECK (public.is_assigned_to_auftrag(auth.uid(), id));

CREATE POLICY "am_select" ON public.auftrag_mitarbeiter FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_assigned_to_auftrag(auth.uid(), auftrag_id));
CREATE POLICY "am_staff_modify" ON public.auftrag_mitarbeiter FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "historie_select" ON public.auftrag_historie FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_assigned_to_auftrag(auth.uid(), auftrag_id));
CREATE POLICY "historie_insert" ON public.auftrag_historie FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR public.is_assigned_to_auftrag(auth.uid(), auftrag_id));

CREATE POLICY "fotos_select" ON public.fotos FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_assigned_to_auftrag(auth.uid(), auftrag_id));
CREATE POLICY "fotos_insert" ON public.fotos FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR public.is_assigned_to_auftrag(auth.uid(), auftrag_id));
CREATE POLICY "fotos_delete" ON public.fotos FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) OR uploaded_by = auth.uid());

CREATE POLICY "dokumente_select" ON public.dokumente FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR (auftrag_id IS NOT NULL AND public.is_assigned_to_auftrag(auth.uid(), auftrag_id)));
CREATE POLICY "dokumente_insert" ON public.dokumente FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR (auftrag_id IS NOT NULL AND public.is_assigned_to_auftrag(auth.uid(), auftrag_id)));
CREATE POLICY "dokumente_delete" ON public.dokumente FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) OR uploaded_by = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.auftraege;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fotos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auftrag_historie;

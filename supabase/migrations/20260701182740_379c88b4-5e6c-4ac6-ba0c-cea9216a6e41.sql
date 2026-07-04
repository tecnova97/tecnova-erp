-- ============================================================
-- PERMISSION CATALOG
-- ============================================================
CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  label text NOT NULL,
  kategorie text NOT NULL,
  beschreibung text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions readable by authenticated"
  ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions manageable by owner"
  ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- ROLES (templates)
-- ============================================================
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  beschreibung text,
  base_role app_role NOT NULL DEFAULT 'worker',
  is_system boolean NOT NULL DEFAULT false,
  farbe text NOT NULL DEFAULT '#64748b',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable by authenticated"
  ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles manageable by owner"
  ON public.roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ROLE <-> PERMISSION MAP
-- ============================================================
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions readable by authenticated"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions manageable by owner"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- USER <-> ROLE MEMBERSHIP (granular role assignment)
-- ============================================================
CREATE TABLE public.user_role_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_role_memberships TO authenticated;
GRANT ALL ON public.user_role_memberships TO service_role;
ALTER TABLE public.user_role_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own membership readable"
  ON public.user_role_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "membership manageable by owner"
  ON public.user_role_memberships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_memberships m
    JOIN public.role_permissions rp ON rp.role_id = m.role_id
    WHERE m.user_id = _user_id AND rp.permission_key = _permission
  );
$$;

CREATE OR REPLACE FUNCTION public.current_permissions()
RETURNS TABLE(permission_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT rp.permission_key
  FROM public.user_role_memberships m
  JOIN public.role_permissions rp ON rp.role_id = m.role_id
  WHERE m.user_id = auth.uid();
$$;

-- ============================================================
-- SEED PERMISSION CATALOG
-- ============================================================
INSERT INTO public.permissions (key, label, kategorie, sort_order) VALUES
  ('dashboard.view',        'Dashboard ansehen',            'Dashboard', 10),
  ('dashboard.edit',        'Dashboard bearbeiten',         'Dashboard', 20),
  ('dashboard.widgets',     'Widgets verwalten',            'Dashboard', 30),
  ('auftraege.view',        'Aufträge ansehen',             'Aufträge', 100),
  ('auftraege.create',      'Aufträge erstellen',           'Aufträge', 110),
  ('auftraege.edit',        'Aufträge bearbeiten',          'Aufträge', 120),
  ('auftraege.delete',      'Aufträge löschen',             'Aufträge', 130),
  ('auftraege.assign',      'Mitarbeiter zuweisen',         'Aufträge', 140),
  ('auftraege.status',      'Status ändern',                'Aufträge', 150),
  ('auftraege.complete',    'Auftrag abschließen',          'Aufträge', 160),
  ('projekte.view',         'Projekte ansehen',             'Projekte', 200),
  ('projekte.edit',         'Projekte bearbeiten',          'Projekte', 210),
  ('projekte.delete',       'Projekte löschen',             'Projekte', 220),
  ('auftraggeber.view',     'Auftraggeber ansehen',         'Auftraggeber', 300),
  ('auftraggeber.edit',     'Auftraggeber bearbeiten',      'Auftraggeber', 310),
  ('auftraggeber.delete',   'Auftraggeber löschen',         'Auftraggeber', 320),
  ('kalender.view',         'Kalender ansehen',             'Kalender', 400),
  ('kalender.edit',         'Kalender bearbeiten',          'Kalender', 410),
  ('kalender.blocker.create','Sperren erstellen',           'Kalender', 420),
  ('kalender.blocker.delete','Sperren löschen',             'Kalender', 430),
  ('mitarbeiter.manage',    'Mitarbeiter verwalten',        'Mitarbeiter & Finanzen', 500),
  ('gehalt.view',           'Gehalt ansehen',               'Mitarbeiter & Finanzen', 510),
  ('umsatz.view',           'Umsatz ansehen',               'Mitarbeiter & Finanzen', 520),
  ('gewinn.view',           'Gewinn ansehen',               'Mitarbeiter & Finanzen', 530),
  ('finanzen.manage',       'Finanzdaten verwalten',        'Mitarbeiter & Finanzen', 540),
  ('status.manage',         'Status verwalten',             'Verwaltung', 600),
  ('leistungen.manage',     'Leistungspositionen verwalten','Verwaltung', 610),
  ('einstellungen.manage',  'Einstellungen verwalten',      'Verwaltung', 620),
  ('users.manage',          'Benutzer verwalten',           'Verwaltung', 630),
  ('roles.manage',          'Rollen verwalten',             'Verwaltung', 640),
  ('firmenprofil.manage',   'Firmenprofil verwalten',       'Verwaltung', 650)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED SYSTEM ROLES
-- ============================================================
INSERT INTO public.roles (key, name, beschreibung, base_role, is_system, farbe, sort_order) VALUES
  ('owner',     'Inhaber',    'Voller Zugriff inkl. Finanzen und Systemverwaltung', 'owner', true, '#2563eb', 10),
  ('disponent', 'Disponent',  'Verwaltet Projekte, Aufträge und Mitarbeiter',       'disponent', true, '#7c3aed', 20),
  ('worker',    'Mitarbeiter','Mobiler Zugriff auf zugewiesene Aufträge',           'worker', true, '#0d9488', 30)
ON CONFLICT (key) DO NOTHING;

-- Owner: all permissions
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'owner'
ON CONFLICT DO NOTHING;

-- Disponent: everything except financials + system admin
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'disponent'
  AND p.key IN (
    'dashboard.view','dashboard.edit','dashboard.widgets',
    'auftraege.view','auftraege.create','auftraege.edit','auftraege.delete','auftraege.assign','auftraege.status','auftraege.complete',
    'projekte.view','projekte.edit','projekte.delete',
    'auftraggeber.view','auftraggeber.edit','auftraggeber.delete',
    'kalender.view','kalender.edit','kalender.blocker.create','kalender.blocker.delete',
    'mitarbeiter.manage','leistungen.manage'
  )
ON CONFLICT DO NOTHING;

-- Worker: minimal mobile access
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'worker'
  AND p.key IN ('dashboard.view','auftraege.view','auftraege.status','auftraege.complete','kalender.view')
ON CONFLICT DO NOTHING;

-- ============================================================
-- BACKFILL: map existing users to granular roles by their app_role
-- ============================================================
INSERT INTO public.user_role_memberships (user_id, role_id)
SELECT ur.user_id, r.id
FROM public.user_roles ur
JOIN public.roles r ON r.key = ur.role::text
ON CONFLICT (user_id) DO NOTHING;
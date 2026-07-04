-- ============================================================
-- Disposition / Kalender module
-- ============================================================

-- 1) Blocker / Sperrzeiten (absences, breaks, travel time, etc.)
CREATE TABLE public.blocker (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mitarbeiter_id uuid NOT NULL REFERENCES public.mitarbeiter(id) ON DELETE CASCADE,
  titel text NOT NULL,
  typ text NOT NULL DEFAULT 'privat',
  grund text,
  start_zeit timestamptz NOT NULL,
  end_zeit timestamptz NOT NULL,
  farbe text NOT NULL DEFAULT '#64748b',
  notiz text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocker TO authenticated;
GRANT ALL ON public.blocker TO service_role;

ALTER TABLE public.blocker ENABLE ROW LEVEL SECURITY;

-- Staff can fully manage all blockers.
CREATE POLICY blocker_staff_modify ON public.blocker
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Workers can view their own blockers (mapped through mitarbeiter.linked_user_id).
CREATE POLICY blocker_worker_select ON public.blocker
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.mitarbeiter m
      WHERE m.id = blocker.mitarbeiter_id AND m.linked_user_id = auth.uid()
    )
  );

CREATE INDEX idx_blocker_mitarbeiter ON public.blocker(mitarbeiter_id);
CREATE INDEX idx_blocker_start ON public.blocker(start_zeit);

CREATE TRIGGER update_blocker_updated_at
  BEFORE UPDATE ON public.blocker
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) New granular Kalender permissions
INSERT INTO public.permissions (key, label, kategorie, beschreibung, sort_order) VALUES
  ('kalender.plan',            'Termine planen',           'Kalender', 'Bestehende Aufträge im Kalender einplanen', 412),
  ('kalender.move',            'Termine verschieben',      'Kalender', 'Termine per Drag & Drop verschieben', 414),
  ('kalender.blocker.edit',    'Blocker bearbeiten',       'Kalender', 'Bestehende Blocker/Sperrzeiten bearbeiten', 425),
  ('kalender.abwesenheit',     'Urlaub/Krank sehen',       'Kalender', 'Abwesenheiten (Urlaub, Krank) aller Mitarbeiter sehen', 440),
  ('kalender.alle_mitarbeiter','Alle Mitarbeiter sehen',   'Kalender', 'Kalender aller Mitarbeiter sehen (sonst nur eigener)', 450)
ON CONFLICT (key) DO NOTHING;

-- 3) Grant all new Kalender permissions to the Owner role (full access)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (VALUES
  ('kalender.plan'),
  ('kalender.move'),
  ('kalender.blocker.edit'),
  ('kalender.abwesenheit'),
  ('kalender.alle_mitarbeiter')
) AS p(key)
WHERE r.base_role = 'owner'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- 4) Grant planning-oriented permissions to the Disponent role
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (VALUES
  ('kalender.view'),
  ('kalender.edit'),
  ('kalender.plan'),
  ('kalender.move'),
  ('kalender.blocker.create'),
  ('kalender.blocker.edit'),
  ('kalender.blocker.delete'),
  ('kalender.abwesenheit'),
  ('kalender.alle_mitarbeiter')
) AS p(key)
WHERE r.base_role = 'disponent'
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- 5) Grant own-calendar view to the Worker role
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'kalender.view'
FROM public.roles r
WHERE r.base_role = 'worker'
ON CONFLICT (role_id, permission_key) DO NOTHING;
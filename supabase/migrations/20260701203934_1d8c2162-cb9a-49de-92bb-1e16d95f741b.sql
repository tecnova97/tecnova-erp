-- 1. MULTI-STATUS
CREATE TABLE public.status_zugriff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key text NOT NULL REFERENCES public.status_definitionen(key) ON DELETE CASCADE,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_assign boolean NOT NULL DEFAULT false,
  can_remove boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT status_zugriff_subject_ck CHECK (
    (role_id IS NOT NULL AND user_id IS NULL) OR (role_id IS NULL AND user_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX status_zugriff_role_uk ON public.status_zugriff (status_key, role_id) WHERE role_id IS NOT NULL;
CREATE UNIQUE INDEX status_zugriff_user_uk ON public.status_zugriff (status_key, user_id) WHERE user_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_zugriff TO authenticated;
GRANT ALL ON public.status_zugriff TO service_role;
ALTER TABLE public.status_zugriff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_zugriff staff read" ON public.status_zugriff
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "status_zugriff manage" ON public.status_zugriff
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'status.manage') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_permission(auth.uid(), 'status.manage') OR public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER trg_status_zugriff_updated
  BEFORE UPDATE ON public.status_zugriff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.status_action_allowed(_status_key text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    public.has_role(auth.uid(), 'owner')
    OR (
      NOT EXISTS (SELECT 1 FROM public.status_zugriff z WHERE z.status_key = _status_key)
      AND CASE _action
            WHEN 'view'   THEN public.has_permission(auth.uid(), 'auftraege.view')
            WHEN 'assign' THEN public.has_permission(auth.uid(), 'auftraege.status')
            WHEN 'remove' THEN public.has_permission(auth.uid(), 'auftraege.status')
            ELSE false
          END
    )
    OR EXISTS (
      SELECT 1
      FROM public.status_zugriff z
      LEFT JOIN public.user_role_memberships m
             ON m.role_id = z.role_id AND m.user_id = auth.uid()
      WHERE z.status_key = _status_key
        AND (z.user_id = auth.uid() OR m.user_id IS NOT NULL)
        AND CASE _action
              WHEN 'view'   THEN z.can_view
              WHEN 'assign' THEN z.can_assign
              WHEN 'remove' THEN z.can_remove
              ELSE false
            END
    );
$fn$;

CREATE TABLE public.auftrag_status_zuweisungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES public.auftraege(id) ON DELETE CASCADE,
  status_key text NOT NULL REFERENCES public.status_definitionen(key) ON DELETE CASCADE,
  sichtbar boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auftrag_id, status_key)
);
CREATE INDEX auftrag_status_zuweisungen_auftrag_idx ON public.auftrag_status_zuweisungen (auftrag_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auftrag_status_zuweisungen TO authenticated;
GRANT ALL ON public.auftrag_status_zuweisungen TO service_role;
ALTER TABLE public.auftrag_status_zuweisungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auftrag_status read" ON public.auftrag_status_zuweisungen
  FOR SELECT TO authenticated
  USING (
    public.status_action_allowed(status_key, 'view')
    AND (public.is_staff(auth.uid()) OR public.is_assigned_to_auftrag(auth.uid(), auftrag_id))
  );
CREATE POLICY "auftrag_status insert" ON public.auftrag_status_zuweisungen
  FOR INSERT TO authenticated
  WITH CHECK (
    public.status_action_allowed(status_key, 'assign')
    AND (public.is_staff(auth.uid()) OR public.is_assigned_to_auftrag(auth.uid(), auftrag_id))
  );
CREATE POLICY "auftrag_status update" ON public.auftrag_status_zuweisungen
  FOR UPDATE TO authenticated
  USING (public.status_action_allowed(status_key, 'assign') AND public.is_staff(auth.uid()))
  WITH CHECK (public.status_action_allowed(status_key, 'assign') AND public.is_staff(auth.uid()));
CREATE POLICY "auftrag_status delete" ON public.auftrag_status_zuweisungen
  FOR DELETE TO authenticated
  USING (
    public.status_action_allowed(status_key, 'remove')
    AND (public.is_staff(auth.uid()) OR public.is_assigned_to_auftrag(auth.uid(), auftrag_id))
  );
CREATE TRIGGER trg_auftrag_status_updated
  BEFORE UPDATE ON public.auftrag_status_zuweisungen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_primary_status_zuweisung()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status IS NOT NULL THEN
    UPDATE public.auftrag_status_zuweisungen SET is_primary = false WHERE auftrag_id = NEW.id;
    INSERT INTO public.auftrag_status_zuweisungen (auftrag_id, status_key, sichtbar, sort_order, is_primary, assigned_by)
    VALUES (NEW.id, NEW.status, true, 0, true, auth.uid())
    ON CONFLICT (auftrag_id, status_key)
    DO UPDATE SET is_primary = true, sichtbar = true, updated_at = now();
  END IF;
  RETURN NEW;
END;
$fn$;
CREATE TRIGGER trg_sync_primary_status
  AFTER INSERT OR UPDATE OF status ON public.auftraege
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_status_zuweisung();

-- 2. FINANCE FOUNDATION
CREATE TABLE public.ausgaben_kategorien (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  farbe text NOT NULL DEFAULT '#64748b',
  aktiv boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ausgaben_kategorien TO authenticated;
GRANT ALL ON public.ausgaben_kategorien TO service_role;
ALTER TABLE public.ausgaben_kategorien ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ausgaben_kat read" ON public.ausgaben_kategorien
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'ausgaben.view') OR public.has_permission(auth.uid(),'ausgaben.edit') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "ausgaben_kat manage" ON public.ausgaben_kategorien
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'ausgaben.edit') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'ausgaben.edit') OR public.has_role(auth.uid(),'owner'));
CREATE TRIGGER trg_ausgaben_kat_updated
  BEFORE UPDATE ON public.ausgaben_kategorien
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.auftrag_ausgaben (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_id uuid NOT NULL REFERENCES public.auftraege(id) ON DELETE CASCADE,
  kategorie_id uuid REFERENCES public.ausgaben_kategorien(id) ON DELETE SET NULL,
  bezeichnung text NOT NULL,
  betrag numeric(12,2) NOT NULL DEFAULT 0,
  datum date NOT NULL DEFAULT current_date,
  notiz text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auftrag_ausgaben_auftrag_idx ON public.auftrag_ausgaben (auftrag_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auftrag_ausgaben TO authenticated;
GRANT ALL ON public.auftrag_ausgaben TO service_role;
ALTER TABLE public.auftrag_ausgaben ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auftrag_ausgaben read" ON public.auftrag_ausgaben
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'ausgaben.view') OR public.has_permission(auth.uid(),'ausgaben.edit') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "auftrag_ausgaben manage" ON public.auftrag_ausgaben
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'ausgaben.edit') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'ausgaben.edit') OR public.has_role(auth.uid(),'owner'));
CREATE TRIGGER trg_auftrag_ausgaben_updated
  BEFORE UPDATE ON public.auftrag_ausgaben
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.betriebsausgaben (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kategorie_id uuid REFERENCES public.ausgaben_kategorien(id) ON DELETE SET NULL,
  bezeichnung text NOT NULL,
  betrag numeric(12,2) NOT NULL DEFAULT 0,
  datum date NOT NULL DEFAULT current_date,
  wiederkehrend boolean NOT NULL DEFAULT false,
  notiz text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.betriebsausgaben TO authenticated;
GRANT ALL ON public.betriebsausgaben TO service_role;
ALTER TABLE public.betriebsausgaben ENABLE ROW LEVEL SECURITY;
CREATE POLICY "betriebsausgaben read" ON public.betriebsausgaben
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'ausgaben.view') OR public.has_permission(auth.uid(),'ausgaben.edit') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "betriebsausgaben manage" ON public.betriebsausgaben
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'ausgaben.edit') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'ausgaben.edit') OR public.has_role(auth.uid(),'owner'));
CREATE TRIGGER trg_betriebsausgaben_updated
  BEFORE UPDATE ON public.betriebsausgaben
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.auftrag_gewinn_map()
RETURNS TABLE(auftrag_id uuid, umsatz numeric, ausgaben numeric, gewinn numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH allowed AS (
    SELECT (public.has_permission(auth.uid(),'auftrag.profit.card')
        OR public.has_permission(auth.uid(),'auftrag.profit.detail')
        OR public.has_permission(auth.uid(),'gewinn.view')
        OR public.has_role(auth.uid(),'owner')) AS ok
  ),
  ums AS (
    SELECT al.auftrag_id,
           SUM((CASE WHEN al.berechnungsart = 'stunde_mitarbeiter'
                     THEN al.menge * COALESCE(al.mitarbeiter_anzahl,1)
                     ELSE al.menge END) * COALESCE(p.preis,0)) AS umsatz
    FROM public.auftrag_leistungen al
    LEFT JOIN public.auftrag_leistung_preise p ON p.auftrag_leistung_id = al.id
    GROUP BY al.auftrag_id
  ),
  aus AS (
    SELECT a.auftrag_id, SUM(a.betrag) AS ausgaben
    FROM public.auftrag_ausgaben a GROUP BY a.auftrag_id
  ),
  ids AS (
    SELECT auftrag_id FROM ums UNION SELECT auftrag_id FROM aus
  )
  SELECT ids.auftrag_id,
         COALESCE(ums.umsatz,0) AS umsatz,
         COALESCE(aus.ausgaben,0) AS ausgaben,
         COALESCE(ums.umsatz,0) - COALESCE(aus.ausgaben,0) AS gewinn
  FROM ids
  LEFT JOIN ums ON ums.auftrag_id = ids.auftrag_id
  LEFT JOIN aus ON aus.auftrag_id = ids.auftrag_id
  WHERE (SELECT ok FROM allowed);
$fn$;
-- migration end</query>

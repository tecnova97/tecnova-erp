
-- ============================================================
-- 1. STATUS DEFINITIONEN v2
-- ============================================================
ALTER TABLE public.status_definitionen
  ADD COLUMN IF NOT EXISTS sichtbar_dashboard boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sichtbar_worker boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ist_bezahlt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS worker_waehlbar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sperrt_bearbeitung boolean NOT NULL DEFAULT false;

-- Re-map existing orders from the old demo status keys to the new ones
UPDATE public.auftraege SET status = CASE status
  WHEN 'neu' THEN 'geplant'
  WHEN 'zugewiesen' THEN '1_lauf'
  WHEN 'in_arbeit' THEN '2_lauf'
  WHEN 'warten' THEN 'kein_termin_moeglich'
  WHEN 'abgeschlossen' THEN 'erledigt'
  WHEN 'storniert' THEN 'abbruch'
  ELSE status END;

DELETE FROM public.status_definitionen;
INSERT INTO public.status_definitionen
 (key,label,farbe,reihenfolge,aktiv,ist_abschluss,ist_bezahlt,sichtbar_dashboard,sichtbar_worker,worker_waehlbar,sperrt_bearbeitung) VALUES
 ('1_lauf','1 Lauf','#3b82f6',1,true,false,false,true,true,true,false),
 ('2_lauf','2 Lauf','#6366f1',2,true,false,false,true,true,true,false),
 ('3_lauf','3 Lauf','#8b5cf6',3,true,false,false,true,true,true,false),
 ('privat_termin','Privat Termin','#ec4899',4,true,false,false,true,true,true,false),
 ('geplant','Geplant','#06b6d4',5,true,false,false,true,true,false,false),
 ('kein_termin_moeglich','Kein Termin möglich','#f59e0b',6,true,false,false,true,true,true,false),
 ('abbruch','Abbruch','#ef4444',7,true,false,false,true,true,true,false),
 ('nicht_ganz_fertig','Nicht ganz fertig','#eab308',8,true,false,false,true,true,true,false),
 ('erledigt','Erledigt','#22c55e',9,true,true,false,true,true,true,false),
 ('bezahlt','Bezahlt','#15803d',10,true,true,true,true,false,false,true),
 ('bezahlt_abbruch','Bezahlt Abbruch','#b91c1c',11,true,false,true,true,false,false,true),
 ('bezahlt_nicht_ganz_fertig','Bezahlt Nicht ganz fertig','#a16207',12,true,true,true,true,false,false,true);

-- ============================================================
-- 2. FIRMENPROFIL
-- ============================================================
CREATE TABLE public.firmenprofil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firmenname text NOT NULL DEFAULT 'TecNova GmbH',
  logo_full_url text,
  logo_round_url text,
  logo_white_url text,
  favicon_url text,
  strasse text, plz text, ort text,
  telefon text, email text, website text,
  steuernummer text, ust_idnr text, iban text, bic text, bank text,
  farbe_primary text NOT NULL DEFAULT '#3b82f6',
  farbe_secondary text NOT NULL DEFAULT '#0f172a',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firmenprofil TO authenticated;
GRANT ALL ON public.firmenprofil TO service_role;
ALTER TABLE public.firmenprofil ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firmenprofil_read" ON public.firmenprofil FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner')
      OR public.has_permission(auth.uid(),'firmenprofil.manage')
      OR public.has_permission(auth.uid(),'finanzen.manage'));
CREATE POLICY "firmenprofil_write" ON public.firmenprofil FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'firmenprofil.manage'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'firmenprofil.manage'));
INSERT INTO public.firmenprofil (firmenname, email, website)
  VALUES ('TecNova GmbH', 'info@tec-nova.de', 'https://www.tec-nova.de');

-- Safe, public branding lookup (name, logos, colors only)
CREATE OR REPLACE FUNCTION public.get_branding()
RETURNS TABLE(firmenname text, logo_full_url text, logo_round_url text, logo_white_url text, favicon_url text, farbe_primary text, farbe_secondary text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT firmenname, logo_full_url, logo_round_url, logo_white_url, favicon_url, farbe_primary, farbe_secondary
  FROM public.firmenprofil ORDER BY created_at LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_branding() TO anon, authenticated;

-- ============================================================
-- 3. LEISTUNGSPOSITIONEN
-- ============================================================
CREATE TABLE public.leistungspositionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  preis numeric(12,2) NOT NULL DEFAULT 0,
  berechnungsart text NOT NULL DEFAULT 'pauschale',
  einheit text NOT NULL DEFAULT 'Pauschale',
  aktiv boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  worker_ohne_preis boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leistungspositionen TO authenticated;
GRANT ALL ON public.leistungspositionen TO service_role;
ALTER TABLE public.leistungspositionen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leistungen_read" ON public.leistungspositionen FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner')
      OR public.has_permission(auth.uid(),'leistungen.manage')
      OR public.has_permission(auth.uid(),'finanzen.manage'));
CREATE POLICY "leistungen_write" ON public.leistungspositionen FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'leistungen.manage'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'leistungen.manage'));

-- Price-free list readable by any authenticated user (workers)
CREATE VIEW public.leistungen_ohne_preis AS
  SELECT id, code, name, berechnungsart, einheit, aktiv, sort_order, worker_ohne_preis
  FROM public.leistungspositionen;
GRANT SELECT ON public.leistungen_ohne_preis TO authenticated;

INSERT INTO public.leistungspositionen (code,name,preis,berechnungsart,einheit,sort_order,worker_ohne_preis) VALUES
 ('30360','Gf-Hausanschluss komplett herstellen',300.00,'pauschale','Pauschale',1,true),
 ('30348','Montagearbeiten an Glasfaserkomponenten',8.00,'stueck','Stück',2,true),
 ('44100','Gf-Innenkabel befestigen/einziehen',2.80,'meter','Meter',3,true),
 ('99980','Mehrarbeit Stunden',55.00,'stunde_mitarbeiter','Stunde × Mitarbeiter',4,false);

-- ============================================================
-- 4. APP SETTINGS (global) + per-user dashboard settings
-- ============================================================
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings_write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'einstellungen.manage') OR public.has_permission(auth.uid(),'seiten.manage'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'einstellungen.manage') OR public.has_permission(auth.uid(),'seiten.manage'));

CREATE TABLE public.user_dashboard_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dashboard_settings TO authenticated;
GRANT ALL ON public.user_dashboard_settings TO service_role;
ALTER TABLE public.user_dashboard_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_dashboard" ON public.user_dashboard_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. PROFILES: account management fields
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE POLICY "staff_read_profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'users.manage'));
CREATE POLICY "staff_update_profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'users.manage'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'users.manage'));

-- ============================================================
-- 6. New permissions
-- ============================================================
INSERT INTO public.permissions (key,label,kategorie,beschreibung,sort_order) VALUES
 ('sicherheit.manage','Sicherheit verwalten','Sicherheit','Sitzungen, MFA und Kontosperren verwalten',90),
 ('aktivitaet.view','Aktivität einsehen','Aktivität','Audit-Protokoll und Verlauf einsehen',91),
 ('seiten.manage','Seiten & Dashboard verwalten','System','Sidebar, Seiten und Dashboard-Widgets konfigurieren',92)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 7. Record last login on success
-- ============================================================
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
END;
$function$;

-- ============================================================
-- 8. Updated-at triggers for new tables
-- ============================================================
CREATE TRIGGER trg_firmenprofil_updated BEFORE UPDATE ON public.firmenprofil
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leistungspositionen_updated BEFORE UPDATE ON public.leistungspositionen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_user_dashboard_updated BEFORE UPDATE ON public.user_dashboard_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 9. Storage policies for the branding bucket
-- ============================================================
CREATE POLICY "branding_read_all" ON storage.objects FOR SELECT
  USING (bucket_id = 'branding');
CREATE POLICY "branding_insert_mgr" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'firmenprofil.manage')));
CREATE POLICY "branding_update_mgr" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'firmenprofil.manage')));
CREATE POLICY "branding_delete_mgr" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'firmenprofil.manage')));

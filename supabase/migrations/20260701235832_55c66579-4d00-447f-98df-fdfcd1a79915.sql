-- ============================================================
-- IMPORT CENTER — Foundation
-- ============================================================

-- 1) Extended Auftrag fields (never split Straße & Nr.)
ALTER TABLE public.auftraege
  ADD COLUMN IF NOT EXISTS esass_nr text,
  ADD COLUMN IF NOT EXISTS ag_bestell_nr text,
  ADD COLUMN IF NOT EXISTS ag_leb_nr text,
  ADD COLUMN IF NOT EXISTS sm_nr text,
  ADD COLUMN IF NOT EXISTS kostenstelle text,
  ADD COLUMN IF NOT EXISTS projektleiter text,
  ADD COLUMN IF NOT EXISTS leistungsort text,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid;

-- 2) Default "Neue Aufträge" status (configurable like any other)
INSERT INTO public.status_definitionen (key, label, farbe, reihenfolge, aktiv, sichtbar_dashboard, sichtbar_worker, worker_waehlbar)
SELECT 'neue_auftraege', 'Neue Aufträge', '#2563eb', -10, true, true, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.status_definitionen WHERE key = 'neue_auftraege');

-- ============================================================
-- import_batches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type text NOT NULL DEFAULT 'csv',
  source_name text,
  uploaded_file_url text,
  original_filename text,
  uploaded_by uuid REFERENCES auth.users,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft',
  row_count integer NOT NULL DEFAULT 0,
  created_auftrag_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_batches_select" ON public.import_batches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.view'));
CREATE POLICY "import_batches_insert" ON public.import_batches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.upload'));
CREATE POLICY "import_batches_update" ON public.import_batches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.edit') OR public.has_permission(auth.uid(),'importe.review') OR public.has_permission(auth.uid(),'importe.confirm'));
CREATE POLICY "import_batches_delete" ON public.import_batches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.delete'));

-- ============================================================
-- import_rows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL DEFAULT 0,
  raw_data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsed_data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL DEFAULT 'ok',
  error_messages text,
  duplicate_candidate_id uuid,
  selected boolean NOT NULL DEFAULT true,
  created_auftrag_id uuid,
  edited_by uuid,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON public.import_rows(import_batch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_rows_select" ON public.import_rows FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.view'));
CREATE POLICY "import_rows_insert" ON public.import_rows FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.upload'));
CREATE POLICY "import_rows_update" ON public.import_rows FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.edit') OR public.has_permission(auth.uid(),'importe.review') OR public.has_permission(auth.uid(),'importe.confirm'));
CREATE POLICY "import_rows_delete" ON public.import_rows FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.edit') OR public.has_permission(auth.uid(),'importe.delete'));

-- ============================================================
-- import_mapping_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_mapping_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'csv',
  column_mapping_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_status_id text,
  default_auftraggeber_id uuid,
  default_project_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_mapping_profiles TO authenticated;
GRANT ALL ON public.import_mapping_profiles TO service_role;
ALTER TABLE public.import_mapping_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_mapping_select" ON public.import_mapping_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.view'));
CREATE POLICY "import_mapping_write" ON public.import_mapping_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.mapping'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.mapping'));

-- ============================================================
-- import_confirmations (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.import_confirmations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  confirmed_by uuid,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_auftrag_ids uuid[] NOT NULL DEFAULT '{}',
  notes text
);

GRANT SELECT, INSERT ON public.import_confirmations TO authenticated;
GRANT ALL ON public.import_confirmations TO service_role;
ALTER TABLE public.import_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_conf_select" ON public.import_confirmations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.view') OR public.has_permission(auth.uid(),'importe.history'));
CREATE POLICY "import_conf_insert" ON public.import_confirmations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.confirm'));

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER trg_import_batches_updated BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_rows_updated BEFORE UPDATE ON public.import_rows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_mapping_updated BEFORE UPDATE ON public.import_mapping_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Permissions
-- ============================================================
INSERT INTO public.permissions (key, label, kategorie, beschreibung, sort_order) VALUES
  ('importe.view',    'Importe ansehen',        'Import', 'Import Center und Eingang ansehen', 700),
  ('importe.upload',  'Importe hochladen',      'Import', 'Dateien hochladen und einlesen',    710),
  ('importe.review',  'Importe prüfen',         'Import', 'Import-Zeilen in der Vorschau prüfen', 720),
  ('importe.edit',    'Importe bearbeiten',     'Import', 'Import-Zeilen bearbeiten und löschen', 730),
  ('importe.confirm', 'Importe bestätigen',     'Import', 'Import bestätigen und Aufträge erstellen', 740),
  ('importe.delete',  'Importe löschen',        'Import', 'Import-Stapel löschen',              750),
  ('importe.mapping', 'Import Mapping verwalten','Import', 'Mapping-Profile verwalten',          760),
  ('importe.history', 'Import Historie ansehen','Import', 'Import-Historie einsehen',           770)
ON CONFLICT (key) DO NOTHING;

-- Grant all new permissions to every owner-based role
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.base_role = 'owner'
  AND p.key IN ('importe.view','importe.upload','importe.review','importe.edit','importe.confirm','importe.delete','importe.mapping','importe.history')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_key = p.key
  );
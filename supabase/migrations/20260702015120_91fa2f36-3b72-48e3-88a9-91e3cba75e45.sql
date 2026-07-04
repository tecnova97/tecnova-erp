-- ============================================================
-- Document Management System (DMS)
-- Reusable, multi-entity, versioned documents with tags.
-- ============================================================

-- 1. Master document record
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  notiz text,
  vertraulich boolean NOT NULL DEFAULT false,
  worker_sichtbar boolean NOT NULL DEFAULT false,
  aktuelle_version integer NOT NULL DEFAULT 1,
  archiviert boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Version history (one row per uploaded file version)
CREATE TABLE public.document_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_path text NOT NULL,
  original_dateiname text NOT NULL,
  extension text,
  mime_type text,
  groesse bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

-- 3. Entity links (a document can belong to many entities)
CREATE TABLE public.document_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN
    ('auftrag','projekt','auftraggeber','mitarbeiter','rechnung_gruppe','company','import','vehicle','equipment')),
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, entity_type, entity_id)
);
CREATE INDEX idx_document_links_entity ON public.document_links (entity_type, entity_id);
CREATE INDEX idx_document_links_document ON public.document_links (document_id);

-- 4. Tag catalog (Owner managed)
CREATE TABLE public.dokument_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  farbe text NOT NULL DEFAULT '#64748b',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Document <-> Tag links
CREATE TABLE public.document_tag_links (
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.dokument_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

-- ------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_links TO authenticated;
GRANT ALL ON public.document_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dokument_tags TO authenticated;
GRANT ALL ON public.dokument_tags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_tag_links TO authenticated;
GRANT ALL ON public.document_tag_links TO service_role;

-- ------------------------------------------------------------
-- Visibility helper (SECURITY DEFINER -> bypasses RLS, no recursion)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_document(_doc uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents d WHERE d.id = _doc AND (
      public.has_role(auth.uid(),'owner')
      OR (
        public.has_permission(auth.uid(),'dokumente.view')
        AND (NOT d.vertraulich OR public.has_permission(auth.uid(),'dokumente.confidential'))
      )
      OR (
        d.worker_sichtbar AND NOT d.vertraulich AND EXISTS (
          SELECT 1 FROM public.document_links dl
          JOIN public.auftrag_mitarbeiter am ON am.auftrag_id = dl.entity_id AND dl.entity_type = 'auftrag'
          JOIN public.mitarbeiter m ON m.id = am.mitarbeiter_id
          WHERE dl.document_id = d.id AND m.linked_user_id = auth.uid()
        )
      )
    )
  );
$$;

-- ------------------------------------------------------------
-- RLS: documents
-- ------------------------------------------------------------
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents select" ON public.documents FOR SELECT TO authenticated
  USING (public.can_view_document(id));
CREATE POLICY "documents insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
    AND (public.has_permission(auth.uid(),'dokumente.upload') OR public.has_role(auth.uid(),'owner')));
CREATE POLICY "documents update" ON public.documents FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'dokumente.notes')
      OR public.has_permission(auth.uid(),'dokumente.rename')
      OR public.has_permission(auth.uid(),'dokumente.upload')
      OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'dokumente.notes')
      OR public.has_permission(auth.uid(),'dokumente.rename')
      OR public.has_permission(auth.uid(),'dokumente.upload')
      OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "documents delete" ON public.documents FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'dokumente.delete') OR public.has_role(auth.uid(),'owner'));

-- ------------------------------------------------------------
-- RLS: document_versions
-- ------------------------------------------------------------
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_versions select" ON public.document_versions FOR SELECT TO authenticated
  USING (public.can_view_document(document_id));
CREATE POLICY "document_versions insert" ON public.document_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'dokumente.upload') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "document_versions delete" ON public.document_versions FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'dokumente.delete') OR public.has_role(auth.uid(),'owner'));

-- ------------------------------------------------------------
-- RLS: document_links
-- ------------------------------------------------------------
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_links select" ON public.document_links FOR SELECT TO authenticated
  USING (public.can_view_document(document_id));
CREATE POLICY "document_links insert" ON public.document_links FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'dokumente.upload') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "document_links delete" ON public.document_links FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'dokumente.upload')
      OR public.has_permission(auth.uid(),'dokumente.delete')
      OR public.has_role(auth.uid(),'owner'));

-- ------------------------------------------------------------
-- RLS: dokument_tags (catalog)
-- ------------------------------------------------------------
ALTER TABLE public.dokument_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dokument_tags select" ON public.dokument_tags FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'dokumente.view') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "dokument_tags insert" ON public.dokument_tags FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'dokumente.tags') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "dokument_tags update" ON public.dokument_tags FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'dokumente.tags') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_permission(auth.uid(),'dokumente.tags') OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "dokument_tags delete" ON public.dokument_tags FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'dokumente.tags') OR public.has_role(auth.uid(),'owner'));

-- ------------------------------------------------------------
-- RLS: document_tag_links
-- ------------------------------------------------------------
ALTER TABLE public.document_tag_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_tag_links select" ON public.document_tag_links FOR SELECT TO authenticated
  USING (public.can_view_document(document_id));
CREATE POLICY "document_tag_links insert" ON public.document_tag_links FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'dokumente.upload')
      OR public.has_permission(auth.uid(),'dokumente.tags')
      OR public.has_role(auth.uid(),'owner'));
CREATE POLICY "document_tag_links delete" ON public.document_tag_links FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'dokumente.upload')
      OR public.has_permission(auth.uid(),'dokumente.tags')
      OR public.has_role(auth.uid(),'owner'));

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.trg_log_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity('dokument.created','document',NEW.id,NEW.name,NULL,NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.archiviert IS DISTINCT FROM OLD.archiviert THEN
      PERFORM public.log_activity(CASE WHEN NEW.archiviert THEN 'dokument.archived' ELSE 'dokument.restored' END,
        'document',NEW.id,NEW.name,NULL,NULL);
    ELSIF NEW.aktuelle_version IS DISTINCT FROM OLD.aktuelle_version THEN
      PERFORM public.log_activity('dokument.version','document',NEW.id,NEW.name,
        jsonb_build_object('version',OLD.aktuelle_version), jsonb_build_object('version',NEW.aktuelle_version));
    ELSE
      PERFORM public.log_activity('dokument.edited','document',NEW.id,NEW.name,NULL,NULL);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.log_activity('dokument.deleted','document',OLD.id,OLD.name,NULL,NULL);
    RETURN OLD;
  END IF;
END $$;

CREATE TRIGGER trg_activity_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_documents();

-- ------------------------------------------------------------
-- Permissions catalog
-- ------------------------------------------------------------
INSERT INTO public.permissions (key, label, kategorie, beschreibung, sort_order) VALUES
  ('dokumente.view','Dokumente ansehen','Dokumente','Dokumente einsehen und suchen',900),
  ('dokumente.upload','Dokumente hochladen','Dokumente','Neue Dokumente und Versionen hochladen',901),
  ('dokumente.download','Dokumente herunterladen','Dokumente','Dateien herunterladen',902),
  ('dokumente.delete','Dokumente löschen','Dokumente','Dokumente löschen oder archivieren',903),
  ('dokumente.rename','Dokumente umbenennen','Dokumente','Dokumentnamen ändern',904),
  ('dokumente.notes','Dokument-Notizen bearbeiten','Dokumente','Notizen zu Dokumenten pflegen',905),
  ('dokumente.tags','Tags verwalten','Dokumente','Tags anlegen, bearbeiten und zuweisen',906),
  ('dokumente.confidential','Vertrauliche Dokumente ansehen','Dokumente','Als vertraulich markierte Dokumente einsehen',907)
ON CONFLICT (key) DO NOTHING;

-- Grant all DMS permissions to the Owner role(s)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN (VALUES
  ('dokumente.view'),('dokumente.upload'),('dokumente.download'),('dokumente.delete'),
  ('dokumente.rename'),('dokumente.notes'),('dokumente.tags'),('dokumente.confidential')
) AS p(key)
WHERE r.base_role = 'owner'
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Seed a starter tag catalog
-- ------------------------------------------------------------
INSERT INTO public.dokument_tags (name, farbe, sort_order) VALUES
  ('Rechnung','#dc2626',10),
  ('Aufmaß','#2563eb',20),
  ('eSASS','#7c3aed',30),
  ('DG','#0891b2',40),
  ('Vodafone','#e11d48',50),
  ('Wichtig','#ea580c',60),
  ('Freigabe','#16a34a',70)
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- Storage RLS for the private 'dms' bucket
-- ------------------------------------------------------------
CREATE POLICY "dms objects select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dms' AND (
    public.has_permission(auth.uid(),'dokumente.view')
    OR public.has_permission(auth.uid(),'dokumente.download')
    OR public.has_role(auth.uid(),'owner')
  ));
CREATE POLICY "dms objects insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dms' AND (
    public.has_permission(auth.uid(),'dokumente.upload') OR public.has_role(auth.uid(),'owner')
  ));
CREATE POLICY "dms objects delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dms' AND (
    public.has_permission(auth.uid(),'dokumente.delete') OR public.has_role(auth.uid(),'owner')
  ));
-- =====================================================================
-- 1. Pilot feedback table
-- =====================================================================
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  page text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_insert_own"
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_select_own_or_owner"
  ON public.feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "feedback_delete_owner"
  ON public.feedback FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- =====================================================================
-- 2. Owner-only cleanup of temporary/demo operational data.
--    Preserves ALL system configuration (roles, permissions, statuses,
--    leistungspositionen + prices, branding, theme, company profile,
--    metadata field definitions, import mapping profiles, dashboards,
--    app settings, profiles, user roles, invitations, tags, categories).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cleanup_test_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  counts jsonb := '{}'::jsonb;
  n bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Nur der Inhaber darf Testdaten bereinigen.';
  END IF;

  -- Auftrag children
  DELETE FROM public.auftrag_leistung_preise;
  DELETE FROM public.auftrag_leistungen;
  DELETE FROM public.auftrag_mitarbeiter;
  DELETE FROM public.auftrag_status_zuweisungen;
  DELETE FROM public.auftrag_historie;
  DELETE FROM public.auftrag_ausgaben;
  DELETE FROM public.auftrag_zahlungsereignis_umsatz;

  DELETE FROM public.auftrag_zahlungsereignisse;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('zahlungsereignisse', n);

  -- Abrechnung / Rechnungsgruppen
  DELETE FROM public.rechnung_gruppe_dokumente;
  DELETE FROM public.rechnung_gruppe_events;
  DELETE FROM public.rechnung_gruppe_positionen;
  DELETE FROM public.rechnung_gruppen;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('rechnungsgruppen', n);

  -- Documents (both DMS variants) + photos
  DELETE FROM public.document_versions;
  DELETE FROM public.document_tag_links;
  DELETE FROM public.document_links;
  DELETE FROM public.documents;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('documents', n);
  DELETE FROM public.dokumente;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('dokumente', n);
  DELETE FROM public.fotos;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('fotos', n);

  -- Import center batches (mapping profiles are config -> kept)
  DELETE FROM public.import_rows;
  DELETE FROM public.import_confirmations;
  DELETE FROM public.import_batches;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('import_batches', n);

  -- Calendar entries / absences
  DELETE FROM public.blocker;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('blocker', n);
  DELETE FROM public.urlaub;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('urlaub', n);

  -- Company expenses
  DELETE FROM public.betriebsausgaben;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('betriebsausgaben', n);

  -- Feedback
  DELETE FROM public.feedback;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('feedback', n);

  -- Core operational entities
  DELETE FROM public.auftraege;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('auftraege', n);
  DELETE FROM public.kunden;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('kunden', n);
  DELETE FROM public.projekte;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('projekte', n);

  -- Test mitarbeiter WITHOUT a real login account (linked_user_id IS NULL).
  -- Remove their dependent records first.
  DELETE FROM public.mitarbeiter_ausstattung
    WHERE mitarbeiter_id IN (SELECT id FROM public.mitarbeiter WHERE linked_user_id IS NULL);
  DELETE FROM public.mitarbeiter_verguetung_eintraege
    WHERE mitarbeiter_id IN (SELECT id FROM public.mitarbeiter WHERE linked_user_id IS NULL);
  DELETE FROM public.mitarbeiter_verguetung
    WHERE mitarbeiter_id IN (SELECT id FROM public.mitarbeiter WHERE linked_user_id IS NULL);
  DELETE FROM public.mitarbeiter_leistungsnotizen
    WHERE mitarbeiter_id IN (SELECT id FROM public.mitarbeiter WHERE linked_user_id IS NULL);
  DELETE FROM public.mitarbeiter WHERE linked_user_id IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT; counts := counts || jsonb_build_object('mitarbeiter', n);

  -- Activity & security logs LAST (delete triggers above write into activity_log)
  DELETE FROM public.security_events;
  DELETE FROM public.activity_log;

  RETURN jsonb_build_object('ok', true, 'counts', counts);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_test_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_test_data() TO authenticated;
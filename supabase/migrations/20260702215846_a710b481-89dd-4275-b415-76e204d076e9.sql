-- =====================================================================
-- 1. PAYMENT REVENUE TABLE — add write policies (owner / finance only)
--    Rows are created by the SECURITY DEFINER trigger create_zahlungsereignis,
--    which bypasses RLS, so the payment workflow is unaffected.
-- =====================================================================
CREATE POLICY "Zahlungsereignis-Umsatz anlegen (Finanzen)"
  ON public.auftrag_zahlungsereignis_umsatz
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'owner')
    OR public.has_permission(auth.uid(), 'finanzen.manage')
  );

CREATE POLICY "Zahlungsereignis-Umsatz bearbeiten (Finanzen)"
  ON public.auftrag_zahlungsereignis_umsatz
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_permission(auth.uid(), 'finanzen.manage')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner')
    OR public.has_permission(auth.uid(), 'finanzen.manage')
  );

CREATE POLICY "Zahlungsereignis-Umsatz löschen (Finanzen)"
  ON public.auftrag_zahlungsereignis_umsatz
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_permission(auth.uid(), 'finanzen.manage')
  );

-- =====================================================================
-- 2. PAYMENT EVENTS — add INSERT policy (owner / finance only)
--    Automatic creation happens via SECURITY DEFINER trigger (RLS bypassed).
-- =====================================================================
CREATE POLICY "Zahlungsereignis anlegen (Finanzen)"
  ON public.auftrag_zahlungsereignisse
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'owner')
    OR public.has_permission(auth.uid(), 'finanzen.manage')
  );

-- =====================================================================
-- 3. CUSTOM FIELD DEFINITIONS — restrict management to authenticated only
-- =====================================================================
ALTER POLICY "cfd manage" ON public.custom_field_defs TO authenticated;

-- =====================================================================
-- 4. INVOICE LINE ITEMS — restrict read + manage to authenticated only
-- =====================================================================
ALTER POLICY "rg_pos read" ON public.rechnung_gruppe_positionen TO authenticated;
ALTER POLICY "rg_pos manage" ON public.rechnung_gruppe_positionen TO authenticated;

-- =====================================================================
-- 5. STORAGE — add missing UPDATE policies (dokumente + fotos)
--    Mirrors DELETE semantics: staff/owner or the original uploader.
--    Anonymous users have no access (authenticated role only).
-- =====================================================================
CREATE POLICY "dok_obj_update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dokumente'
    AND (public.is_staff(auth.uid()) OR owner = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'dokumente'
    AND (public.is_staff(auth.uid()) OR owner = auth.uid())
  );

CREATE POLICY "fotos_obj_update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fotos'
    AND (public.is_staff(auth.uid()) OR owner = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'fotos'
    AND (public.is_staff(auth.uid()) OR owner = auth.uid())
  );

-- =====================================================================
-- 6. SECURITY DEFINER FUNCTIONS — revoke public execute on internal
--    trigger/logging helpers. They run inside triggers as the function
--    owner, so revoking direct API execute does not change behaviour.
--    (All these functions already pin SET search_path = public.)
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_verguetung() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_verg_eintrag() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_documents() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_dokumente() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_leistungsnotiz() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_leistungen() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_auftraege() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_auftrag_mitarbeiter() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_projekte() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_kunden() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_fotos() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_urlaub() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_ausstattung() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_mitarbeiter() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_log_rechnung_gruppen() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_primary_status_zuweisung() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_auftrag_bezahlt() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.void_zahlungsereignis() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_zahlungsereignis() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.snapshot_auftrag_leistung_preis() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_worker_mitarbeiter() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_sync_profile_mitarbeiter() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_rechnung_gruppe_nummer() FROM PUBLIC;

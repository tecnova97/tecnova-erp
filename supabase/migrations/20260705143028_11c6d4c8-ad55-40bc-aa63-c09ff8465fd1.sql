-- Allow users who hold the 'auftraege.create' permission (not only owner/disponent staff)
-- to create Aufträge from any interface. This enforces the create permission at the
-- database level, not only in the UI.

-- 1) Aufträge: permit INSERT for staff OR holders of the auftraege.create permission.
CREATE POLICY auftraege_insert_creator ON public.auftraege
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid())
    OR public.has_permission(auth.uid(), 'auftraege.create')
  );

-- 2) Aufträge: creators may read back the rows they created (needed for the
--    insert .select() round-trip and so the new Auftrag shows in their list).
CREATE POLICY auftraege_select_creator ON public.auftraege
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- 3) Worker assignments: creators may manage assignments on Aufträge they created.
CREATE POLICY am_creator_insert ON public.auftrag_mitarbeiter
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'auftraege.create')
    AND EXISTS (
      SELECT 1 FROM public.auftraege a
      WHERE a.id = auftrag_id AND a.created_by = auth.uid()
    )
  );

CREATE POLICY am_creator_delete ON public.auftrag_mitarbeiter
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'auftraege.create')
    AND EXISTS (
      SELECT 1 FROM public.auftraege a
      WHERE a.id = auftrag_id AND a.created_by = auth.uid()
    )
  );

-- 4) History: creators may write history entries for Aufträge they created.
CREATE POLICY historie_creator_insert ON public.auftrag_historie
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.auftraege a
      WHERE a.id = auftrag_id AND a.created_by = auth.uid()
    )
  );

-- FOTOS bucket
CREATE POLICY "fotos_obj_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos' AND (
    public.is_staff(auth.uid())
    OR public.is_assigned_to_auftrag(auth.uid(), ((storage.foldername(name))[1])::uuid)
  ));
CREATE POLICY "fotos_obj_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos' AND (
    public.is_staff(auth.uid())
    OR public.is_assigned_to_auftrag(auth.uid(), ((storage.foldername(name))[1])::uuid)
  ));
CREATE POLICY "fotos_obj_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos' AND (public.is_staff(auth.uid()) OR owner = auth.uid()));

-- DOKUMENTE bucket
CREATE POLICY "dok_obj_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dokumente' AND (
    public.is_staff(auth.uid())
    OR public.is_assigned_to_auftrag(auth.uid(), ((storage.foldername(name))[1])::uuid)
  ));
CREATE POLICY "dok_obj_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dokumente' AND (
    public.is_staff(auth.uid())
    OR public.is_assigned_to_auftrag(auth.uid(), ((storage.foldername(name))[1])::uuid)
  ));
CREATE POLICY "dok_obj_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dokumente' AND (public.is_staff(auth.uid()) OR owner = auth.uid()));

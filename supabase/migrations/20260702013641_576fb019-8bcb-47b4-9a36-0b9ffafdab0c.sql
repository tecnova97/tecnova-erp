CREATE POLICY "abrechnung read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'abrechnung' AND (public.has_permission(auth.uid(),'abrechnung.view') OR public.has_role(auth.uid(),'owner')));
CREATE POLICY "abrechnung insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'abrechnung' AND (public.has_permission(auth.uid(),'abrechnung.upload') OR public.has_role(auth.uid(),'owner')));
CREATE POLICY "abrechnung update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'abrechnung' AND (public.has_permission(auth.uid(),'abrechnung.upload') OR public.has_role(auth.uid(),'owner')));
CREATE POLICY "abrechnung delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'abrechnung' AND (public.has_permission(auth.uid(),'abrechnung.upload') OR public.has_role(auth.uid(),'owner')));
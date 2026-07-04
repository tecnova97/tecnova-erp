CREATE POLICY "importe_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'importe' AND (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.view')));
CREATE POLICY "importe_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'importe' AND (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.upload')));
CREATE POLICY "importe_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'importe' AND (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'importe.delete')));
-- Allow permanent deletion of an Auftrag for owners and users holding the
-- 'auftraege.delete' permission. Combined with existing policies via OR.
CREATE POLICY auftraege_delete_permitted
ON public.auftraege
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner')
  OR public.has_permission(auth.uid(), 'auftraege.delete')
);
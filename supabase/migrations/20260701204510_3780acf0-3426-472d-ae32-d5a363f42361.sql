-- Assigned workers may manage service positions on their assigned orders
CREATE POLICY "auftrag_leistungen worker insert" ON public.auftrag_leistungen
  FOR INSERT TO authenticated
  WITH CHECK (public.is_assigned_to_auftrag(auth.uid(), auftrag_id));
CREATE POLICY "auftrag_leistungen worker update" ON public.auftrag_leistungen
  FOR UPDATE TO authenticated
  USING (public.is_assigned_to_auftrag(auth.uid(), auftrag_id))
  WITH CHECK (public.is_assigned_to_auftrag(auth.uid(), auftrag_id));
CREATE POLICY "auftrag_leistungen worker delete" ON public.auftrag_leistungen
  FOR DELETE TO authenticated
  USING (public.is_assigned_to_auftrag(auth.uid(), auftrag_id));

-- Snapshot the catalog price whenever a position is added (revenue stays correct
-- even when a worker without price access adds the line).
CREATE OR REPLACE FUNCTION public.snapshot_auftrag_leistung_preis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE _preis numeric;
BEGIN
  IF NEW.leistung_id IS NOT NULL THEN
    SELECT preis INTO _preis FROM public.leistung_preise WHERE leistung_id = NEW.leistung_id;
    IF _preis IS NOT NULL THEN
      INSERT INTO public.auftrag_leistung_preise (auftrag_leistung_id, preis)
      VALUES (NEW.id, _preis)
      ON CONFLICT (auftrag_leistung_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_snapshot_leistung_preis ON public.auftrag_leistungen;
CREATE TRIGGER trg_snapshot_leistung_preis
  AFTER INSERT ON public.auftrag_leistungen
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_auftrag_leistung_preis();
-- end</query>

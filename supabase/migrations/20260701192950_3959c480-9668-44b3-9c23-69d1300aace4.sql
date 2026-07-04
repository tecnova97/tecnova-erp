
DROP VIEW IF EXISTS public.leistungen_ohne_preis;

CREATE TABLE public.leistung_preise (
  leistung_id uuid PRIMARY KEY REFERENCES public.leistungspositionen(id) ON DELETE CASCADE,
  preis numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leistung_preise TO authenticated;
GRANT ALL ON public.leistung_preise TO service_role;
ALTER TABLE public.leistung_preise ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preise_read" ON public.leistung_preise FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner')
      OR public.has_permission(auth.uid(),'leistungen.manage')
      OR public.has_permission(auth.uid(),'finanzen.manage'));
CREATE POLICY "preise_write" ON public.leistung_preise FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'leistungen.manage'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'leistungen.manage'));

INSERT INTO public.leistung_preise (leistung_id, preis)
  SELECT id, preis FROM public.leistungspositionen;

ALTER TABLE public.leistungspositionen DROP COLUMN preis;
DROP POLICY "leistungen_read" ON public.leistungspositionen;
CREATE POLICY "leistungen_read" ON public.leistungspositionen FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_leistung_preise_updated BEFORE UPDATE ON public.leistung_preise
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

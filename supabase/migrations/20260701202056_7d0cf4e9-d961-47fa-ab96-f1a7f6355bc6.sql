-- Phase 4: financial permissions, payment-via-status workflow, revenue function

-- 1) New granular financial permissions (none owner-only; owner short-circuits in app)
INSERT INTO public.permissions (key, label, kategorie, beschreibung, sort_order) VALUES
  ('auftrag.preise.view',  'Leistungspreise ansehen',        'Finanzen', 'Preise der Leistungspositionen sehen', 521),
  ('auftrag.preise.edit',  'Leistungspreise bearbeiten',     'Finanzen', 'Preise der Leistungspositionen ändern', 522),
  ('auftrag.profit.card',  'Umsatz auf Auftragskarten',      'Finanzen', 'Umsatz/Gewinn auf Auftragskarten sehen', 523),
  ('auftrag.profit.detail','Umsatz in Auftragsdetails',      'Finanzen', 'Umsatz/Gewinn im Auftragsdetail sehen', 524),
  ('bezahlt.view',         'Bezahlte Aufträge ansehen',      'Finanzen', 'Zugriff auf die Seite „Bezahlte Aufträge"', 525),
  ('ausgaben.view',        'Ausgaben ansehen',               'Finanzen', 'Ausgaben eines Auftrags sehen', 526),
  ('ausgaben.edit',        'Ausgaben bearbeiten',            'Finanzen', 'Ausgaben eines Auftrags erfassen', 527),
  ('finanzen.export',      'Finanzberichte exportieren',     'Finanzen', 'Finanzdaten exportieren', 528)
ON CONFLICT (key) DO NOTHING;

-- 2) Payment is now derived from the assigned status flag (ist_bezahlt)
CREATE OR REPLACE FUNCTION public.sync_auftrag_bezahlt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _paid boolean;
BEGIN
  SELECT COALESCE(ist_bezahlt, false) INTO _paid
  FROM public.status_definitionen WHERE key = NEW.status;
  _paid := COALESCE(_paid, false);
  IF _paid THEN
    NEW.bezahlt := true;
    IF NEW.bezahlt_am IS NULL THEN NEW.bezahlt_am := now(); END IF;
  ELSE
    NEW.bezahlt := false;
    NEW.bezahlt_am := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auftrag_bezahlt ON public.auftraege;
CREATE TRIGGER trg_sync_auftrag_bezahlt
  BEFORE INSERT OR UPDATE OF status ON public.auftraege
  FOR EACH ROW EXECUTE FUNCTION public.sync_auftrag_bezahlt();

-- 3) Revenue per Auftrag, only returned to finance-permitted users (safe: empty otherwise)
CREATE OR REPLACE FUNCTION public.auftrag_umsatz_map()
RETURNS TABLE(auftrag_id uuid, umsatz numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT al.auftrag_id,
         SUM(
           (CASE WHEN al.berechnungsart = 'stunde_mitarbeiter'
                 THEN al.menge * COALESCE(al.mitarbeiter_anzahl, 1)
                 ELSE al.menge END) * COALESCE(p.preis, 0)
         ) AS umsatz
  FROM public.auftrag_leistungen al
  LEFT JOIN public.auftrag_leistung_preise p ON p.auftrag_leistung_id = al.id
  WHERE public.has_permission(auth.uid(), 'auftrag.profit.card')
     OR public.has_permission(auth.uid(), 'auftrag.profit.detail')
     OR public.has_permission(auth.uid(), 'umsatz.view')
     OR public.has_role(auth.uid(), 'owner')
  GROUP BY al.auftrag_id;
$$;

GRANT EXECUTE ON FUNCTION public.auftrag_umsatz_map() TO authenticated;
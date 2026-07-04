-- =========================================================================
-- Multi paid-billing-event architecture
-- A single Auftrag can generate unlimited, permanent paid events over its
-- lifetime. Each event is created automatically when a status flagged as
-- "creates paid billing event" (status_definitionen.ist_bezahlt) is assigned.
-- =========================================================================

-- 1) Paid billing events (visible metadata) --------------------------------
CREATE TABLE public.auftrag_zahlungsereignisse (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auftrag_id uuid NOT NULL REFERENCES public.auftraege(id) ON DELETE CASCADE,
  status_key text NOT NULL,
  status_label text NOT NULL,
  status_farbe text NOT NULL DEFAULT '#16a34a',
  datum timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  leistungen jsonb NOT NULL DEFAULT '[]'::jsonb,
  notiz text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_zahlungsereignisse_auftrag ON public.auftrag_zahlungsereignisse(auftrag_id);

GRANT SELECT, UPDATE, DELETE ON public.auftrag_zahlungsereignisse TO authenticated;
GRANT ALL ON public.auftrag_zahlungsereignisse TO service_role;

ALTER TABLE public.auftrag_zahlungsereignisse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zahlungsereignisse ansehen"
ON public.auftrag_zahlungsereignisse FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'owner')
  OR public.has_permission(auth.uid(),'bezahlt.view')
  OR public.has_permission(auth.uid(),'umsatz.view')
  OR public.has_permission(auth.uid(),'gewinn.view')
  OR public.has_permission(auth.uid(),'auftrag.profit.card')
  OR public.has_permission(auth.uid(),'auftrag.profit.detail')
);

CREATE POLICY "Zahlungsereignis-Notiz bearbeiten"
ON public.auftrag_zahlungsereignisse FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'finanzen.manage'))
WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_permission(auth.uid(),'finanzen.manage'));

CREATE POLICY "Zahlungsereignis löschen (nur Owner)"
ON public.auftrag_zahlungsereignisse FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(),'owner'));

CREATE TRIGGER trg_zahlungsereignisse_updated
BEFORE UPDATE ON public.auftrag_zahlungsereignisse
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Revenue snapshot per event (finance-gated) ----------------------------
CREATE TABLE public.auftrag_zahlungsereignis_umsatz (
  ereignis_id uuid NOT NULL PRIMARY KEY REFERENCES public.auftrag_zahlungsereignisse(id) ON DELETE CASCADE,
  umsatz numeric NOT NULL DEFAULT 0,
  positionen jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auftrag_zahlungsereignis_umsatz TO authenticated;
GRANT ALL ON public.auftrag_zahlungsereignis_umsatz TO service_role;

ALTER TABLE public.auftrag_zahlungsereignis_umsatz ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zahlungsereignis-Umsatz ansehen (Finanzen)"
ON public.auftrag_zahlungsereignis_umsatz FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'owner')
  OR public.has_permission(auth.uid(),'umsatz.view')
  OR public.has_permission(auth.uid(),'gewinn.view')
  OR public.has_permission(auth.uid(),'auftrag.profit.card')
  OR public.has_permission(auth.uid(),'auftrag.profit.detail')
);

-- 3) Trigger: create a paid event whenever a paid status is assigned --------
CREATE OR REPLACE FUNCTION public.create_zahlungsereignis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _paid boolean;
  _label text;
  _farbe text;
  _umsatz numeric := 0;
  _positionen jsonb := '[]'::jsonb;
  _positionen_frei jsonb := '[]'::jsonb;
  _ev_id uuid;
BEGIN
  SELECT COALESCE(ist_bezahlt,false), label, farbe
    INTO _paid, _label, _farbe
  FROM public.status_definitionen WHERE key = NEW.status_key;

  IF NOT COALESCE(_paid,false) THEN
    RETURN NEW;
  END IF;

  -- price-free service positions (visible to bezahlt.view)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'code', code, 'name', name, 'berechnungsart', berechnungsart,
           'einheit', einheit, 'menge', menge, 'mitarbeiter_anzahl', mitarbeiter_anzahl
         ) ORDER BY sort_order), '[]'::jsonb)
    INTO _positionen_frei
  FROM public.auftrag_leistungen WHERE auftrag_id = NEW.auftrag_id;

  -- priced positions + revenue snapshot (finance-gated)
  SELECT
    COALESCE(SUM(faktor * preis), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'code', code, 'name', name, 'einheit', einheit,
      'menge', menge, 'faktor', faktor, 'preis', preis, 'total', faktor * preis
    ) ORDER BY sort_order), '[]'::jsonb)
    INTO _umsatz, _positionen
  FROM (
    SELECT al.code, al.name, al.einheit, al.menge, al.sort_order,
           (CASE WHEN al.berechnungsart = 'stunde_mitarbeiter'
                 THEN al.menge * COALESCE(al.mitarbeiter_anzahl,1)
                 ELSE al.menge END) AS faktor,
           COALESCE(p.preis,0) AS preis
    FROM public.auftrag_leistungen al
    LEFT JOIN public.auftrag_leistung_preise p ON p.auftrag_leistung_id = al.id
    WHERE al.auftrag_id = NEW.auftrag_id
  ) q;

  INSERT INTO public.auftrag_zahlungsereignisse
    (auftrag_id, status_key, status_label, status_farbe, datum, created_by, leistungen)
  VALUES
    (NEW.auftrag_id, NEW.status_key, COALESCE(_label, NEW.status_key),
     COALESCE(_farbe, '#16a34a'), now(), COALESCE(NEW.assigned_by, auth.uid()), _positionen_frei)
  RETURNING id INTO _ev_id;

  INSERT INTO public.auftrag_zahlungsereignis_umsatz (ereignis_id, umsatz, positionen)
  VALUES (_ev_id, _umsatz, _positionen);

  -- mark the order as having paid events (never unset)
  UPDATE public.auftraege
     SET bezahlt = true,
         bezahlt_am = COALESCE(bezahlt_am, now())
   WHERE id = NEW.auftrag_id AND bezahlt IS DISTINCT FROM true;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_zahlungsereignis
AFTER INSERT ON public.auftrag_status_zuweisungen
FOR EACH ROW EXECUTE FUNCTION public.create_zahlungsereignis();

-- 4) Stop auto-unsetting "bezahlt" on status change ------------------------
DROP TRIGGER IF EXISTS trg_sync_auftrag_bezahlt ON public.auftraege;

-- 5) Revenue maps now sum permanent paid events ----------------------------
CREATE OR REPLACE FUNCTION public.auftrag_umsatz_map()
RETURNS TABLE(auftrag_id uuid, umsatz numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.auftrag_id, SUM(u.umsatz) AS umsatz
  FROM public.auftrag_zahlungsereignisse e
  JOIN public.auftrag_zahlungsereignis_umsatz u ON u.ereignis_id = e.id
  WHERE public.has_permission(auth.uid(),'auftrag.profit.card')
     OR public.has_permission(auth.uid(),'auftrag.profit.detail')
     OR public.has_permission(auth.uid(),'umsatz.view')
     OR public.has_permission(auth.uid(),'gewinn.view')
     OR public.has_role(auth.uid(),'owner')
  GROUP BY e.auftrag_id;
$$;

CREATE OR REPLACE FUNCTION public.auftrag_gewinn_map()
RETURNS TABLE(auftrag_id uuid, umsatz numeric, ausgaben numeric, gewinn numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH allowed AS (
    SELECT (public.has_permission(auth.uid(),'auftrag.profit.card')
        OR public.has_permission(auth.uid(),'auftrag.profit.detail')
        OR public.has_permission(auth.uid(),'gewinn.view')
        OR public.has_permission(auth.uid(),'umsatz.view')
        OR public.has_role(auth.uid(),'owner')) AS ok
  ),
  ums AS (
    SELECT e.auftrag_id, SUM(u.umsatz) AS umsatz
    FROM public.auftrag_zahlungsereignisse e
    JOIN public.auftrag_zahlungsereignis_umsatz u ON u.ereignis_id = e.id
    GROUP BY e.auftrag_id
  ),
  aus AS (
    SELECT a.auftrag_id, SUM(a.betrag) AS ausgaben
    FROM public.auftrag_ausgaben a GROUP BY a.auftrag_id
  ),
  ids AS (SELECT auftrag_id FROM ums UNION SELECT auftrag_id FROM aus)
  SELECT ids.auftrag_id,
         COALESCE(ums.umsatz,0) AS umsatz,
         COALESCE(aus.ausgaben,0) AS ausgaben,
         COALESCE(ums.umsatz,0) - COALESCE(aus.ausgaben,0) AS gewinn
  FROM ids
  LEFT JOIN ums ON ums.auftrag_id = ids.auftrag_id
  LEFT JOIN aus ON aus.auftrag_id = ids.auftrag_id
  WHERE (SELECT ok FROM allowed);
$$;

-- Per-event revenue map (finance-gated) for the paid-orders page
CREATE OR REPLACE FUNCTION public.zahlungsereignis_umsatz_map()
RETURNS TABLE(ereignis_id uuid, umsatz numeric, positionen jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.ereignis_id, u.umsatz, u.positionen
  FROM public.auftrag_zahlungsereignis_umsatz u
  WHERE public.has_permission(auth.uid(),'auftrag.profit.card')
     OR public.has_permission(auth.uid(),'auftrag.profit.detail')
     OR public.has_permission(auth.uid(),'umsatz.view')
     OR public.has_permission(auth.uid(),'gewinn.view')
     OR public.has_role(auth.uid(),'owner');
$$;

-- 6) Backfill: create one event for each currently paid order --------------
INSERT INTO public.auftrag_zahlungsereignisse
  (auftrag_id, status_key, status_label, status_farbe, datum, created_by, leistungen)
SELECT a.id, a.status, sd.label, sd.farbe,
  COALESCE(a.bezahlt_am, a.updated_at, now()), a.created_by,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'code', al.code, 'name', al.name, 'berechnungsart', al.berechnungsart,
      'einheit', al.einheit, 'menge', al.menge, 'mitarbeiter_anzahl', al.mitarbeiter_anzahl
    ) ORDER BY al.sort_order)
    FROM public.auftrag_leistungen al WHERE al.auftrag_id = a.id
  ), '[]'::jsonb)
FROM public.auftraege a
JOIN public.status_definitionen sd ON sd.key = a.status
WHERE a.bezahlt = true
  AND COALESCE(sd.ist_bezahlt,false) = true
  AND NOT EXISTS (SELECT 1 FROM public.auftrag_zahlungsereignisse e WHERE e.auftrag_id = a.id);

INSERT INTO public.auftrag_zahlungsereignis_umsatz (ereignis_id, umsatz, positionen)
SELECT e.id,
  COALESCE((
    SELECT SUM((CASE WHEN al.berechnungsart = 'stunde_mitarbeiter'
                     THEN al.menge * COALESCE(al.mitarbeiter_anzahl,1)
                     ELSE al.menge END) * COALESCE(p.preis,0))
    FROM public.auftrag_leistungen al
    LEFT JOIN public.auftrag_leistung_preise p ON p.auftrag_leistung_id = al.id
    WHERE al.auftrag_id = e.auftrag_id
  ), 0),
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'code', al.code, 'name', al.name, 'einheit', al.einheit, 'menge', al.menge,
      'faktor', (CASE WHEN al.berechnungsart = 'stunde_mitarbeiter'
                      THEN al.menge * COALESCE(al.mitarbeiter_anzahl,1)
                      ELSE al.menge END),
      'preis', COALESCE(p.preis,0),
      'total', (CASE WHEN al.berechnungsart = 'stunde_mitarbeiter'
                     THEN al.menge * COALESCE(al.mitarbeiter_anzahl,1)
                     ELSE al.menge END) * COALESCE(p.preis,0)
    ) ORDER BY al.sort_order)
    FROM public.auftrag_leistungen al
    LEFT JOIN public.auftrag_leistung_preise p ON p.auftrag_leistung_id = al.id
    WHERE al.auftrag_id = e.auftrag_id
  ), '[]'::jsonb)
FROM public.auftrag_zahlungsereignisse e
WHERE NOT EXISTS (SELECT 1 FROM public.auftrag_zahlungsereignis_umsatz u WHERE u.ereignis_id = e.id);
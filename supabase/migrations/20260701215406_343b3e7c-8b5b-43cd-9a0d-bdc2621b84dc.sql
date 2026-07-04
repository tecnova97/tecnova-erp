-- 1. Add cancellation fields to payment events
ALTER TABLE public.auftrag_zahlungsereignisse
  ADD COLUMN IF NOT EXISTS storniert boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS storniert_am timestamptz,
  ADD COLUMN IF NOT EXISTS storniert_by uuid;

-- 2. Trigger: when a paid status is removed from an Auftrag, void its events
CREATE OR REPLACE FUNCTION public.void_zahlungsereignis()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _paid boolean; _remaining int;
BEGIN
  SELECT COALESCE(ist_bezahlt,false) INTO _paid
  FROM public.status_definitionen WHERE key = OLD.status_key;

  IF COALESCE(_paid,false) THEN
    UPDATE public.auftrag_zahlungsereignisse
       SET storniert = true,
           storniert_am = now(),
           storniert_by = auth.uid()
     WHERE auftrag_id = OLD.auftrag_id
       AND status_key = OLD.status_key
       AND storniert = false;

    -- If no active paid events remain, unset the order's paid flag
    SELECT count(*) INTO _remaining
    FROM public.auftrag_zahlungsereignisse
    WHERE auftrag_id = OLD.auftrag_id AND storniert = false;

    IF _remaining = 0 THEN
      UPDATE public.auftraege
         SET bezahlt = false, bezahlt_am = NULL
       WHERE id = OLD.auftrag_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_void_zahlungsereignis ON public.auftrag_status_zuweisungen;
CREATE TRIGGER trg_void_zahlungsereignis
  AFTER DELETE ON public.auftrag_status_zuweisungen
  FOR EACH ROW EXECUTE FUNCTION public.void_zahlungsereignis();

-- 3. Exclude voided events from revenue map
CREATE OR REPLACE FUNCTION public.auftrag_umsatz_map()
 RETURNS TABLE(auftrag_id uuid, umsatz numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.auftrag_id, SUM(u.umsatz) AS umsatz
  FROM public.auftrag_zahlungsereignisse e
  JOIN public.auftrag_zahlungsereignis_umsatz u ON u.ereignis_id = e.id
  WHERE e.storniert = false
    AND (public.has_permission(auth.uid(),'auftrag.profit.card')
     OR public.has_permission(auth.uid(),'auftrag.profit.detail')
     OR public.has_permission(auth.uid(),'umsatz.view')
     OR public.has_permission(auth.uid(),'gewinn.view')
     OR public.has_role(auth.uid(),'owner'))
  GROUP BY e.auftrag_id;
$function$;

-- 4. Exclude voided events from profit map
CREATE OR REPLACE FUNCTION public.auftrag_gewinn_map()
 RETURNS TABLE(auftrag_id uuid, umsatz numeric, ausgaben numeric, gewinn numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE e.storniert = false
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
$function$;

-- 5. Exclude voided events from per-event revenue map
CREATE OR REPLACE FUNCTION public.zahlungsereignis_umsatz_map()
 RETURNS TABLE(ereignis_id uuid, umsatz numeric, positionen jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.ereignis_id, u.umsatz, u.positionen
  FROM public.auftrag_zahlungsereignis_umsatz u
  JOIN public.auftrag_zahlungsereignisse e ON e.id = u.ereignis_id
  WHERE e.storniert = false
    AND (public.has_permission(auth.uid(),'auftrag.profit.card')
     OR public.has_permission(auth.uid(),'auftrag.profit.detail')
     OR public.has_permission(auth.uid(),'umsatz.view')
     OR public.has_permission(auth.uid(),'gewinn.view')
     OR public.has_role(auth.uid(),'owner'));
$function$;
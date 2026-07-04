
-- Restrict which columns an assigned (non-staff) worker may change on an order.
-- The worker completion flow only ever writes: status, abschluss_notizen,
-- abgeschlossen_am. Everything else must retain its previous value. The paid
-- flag is derived from active payment events so it cannot be forged, while the
-- payment-event triggers (which run in the worker's context) still work.
CREATE OR REPLACE FUNCTION public.protect_auftrag_worker_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _res public.auftraege%ROWTYPE;
  _has_paid boolean;
BEGIN
  -- Office staff / owner keep full write access (governed by their own policy).
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Start from the unchanged row, then re-apply only worker-writable fields.
  _res := OLD;
  _res.status := NEW.status;
  _res.abschluss_notizen := NEW.abschluss_notizen;
  _res.abgeschlossen_am := NEW.abgeschlossen_am;
  _res.updated_at := now();

  -- Paid flag is always derived from active (non-voided) payment events.
  SELECT EXISTS (
    SELECT 1 FROM public.auftrag_zahlungsereignisse
    WHERE auftrag_id = OLD.id AND storniert = false
  ) INTO _has_paid;

  _res.bezahlt := _has_paid;
  _res.bezahlt_am := CASE WHEN _has_paid THEN COALESCE(OLD.bezahlt_am, now()) ELSE NULL END;

  RETURN _res;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_auftrag_worker_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_auftrag_worker_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_auftrag_worker_update() FROM authenticated;

DROP TRIGGER IF EXISTS protect_auftrag_worker_update ON public.auftraege;
CREATE TRIGGER protect_auftrag_worker_update
  BEFORE UPDATE ON public.auftraege
  FOR EACH ROW EXECUTE FUNCTION public.protect_auftrag_worker_update();

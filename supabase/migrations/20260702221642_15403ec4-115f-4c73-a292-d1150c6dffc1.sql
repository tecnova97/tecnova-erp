
-- ============================================================
-- 1. COMPANY BANKING DATA (firmenprofil) — column-aware protection
-- ============================================================

-- Restrict direct table reads to owner + finance only (protects ALL columns,
-- including IBAN/BIC/Steuernummer/USt-IdNr). Branding is served separately
-- via the get_branding() RPC and the get_firmenprofil_admin() RPC below.
DROP POLICY IF EXISTS firmenprofil_read ON public.firmenprofil;
CREATE POLICY firmenprofil_read ON public.firmenprofil
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
    OR public.has_permission(auth.uid(), 'finanzen.manage')
  );

-- Admin read for the company-profile settings page: returns the full row but
-- NULLs out banking/tax fields unless the caller is owner or has finance rights.
CREATE OR REPLACE FUNCTION public.get_firmenprofil_admin()
RETURNS public.firmenprofil
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.firmenprofil%ROWTYPE;
  _fin boolean;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.has_permission(auth.uid(), 'firmenprofil.manage')
    OR public.has_permission(auth.uid(), 'branding.edit')
    OR public.has_permission(auth.uid(), 'branding.view')
    OR public.has_permission(auth.uid(), 'finanzen.manage')
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _row FROM public.firmenprofil ORDER BY created_at LIMIT 1;
  IF _row.id IS NULL THEN
    RETURN NULL;
  END IF;

  _fin := public.has_role(auth.uid(), 'owner')
       OR public.has_permission(auth.uid(), 'finanzen.manage');

  IF NOT _fin THEN
    _row.steuernummer := NULL;
    _row.ust_idnr := NULL;
    _row.iban := NULL;
    _row.bic := NULL;
  END IF;

  RETURN _row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_firmenprofil_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_firmenprofil_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_firmenprofil_admin() TO authenticated;

-- Prevent branding editors (firmenprofil.manage / branding.edit) from changing
-- banking/tax fields. Only owner or finance users may edit them; for others we
-- silently keep the previous values so branding saves don't wipe banking data.
CREATE OR REPLACE FUNCTION public.protect_firmenprofil_banking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'owner')
    OR public.has_permission(auth.uid(), 'finanzen.manage')
  ) THEN
    NEW.steuernummer := OLD.steuernummer;
    NEW.ust_idnr := OLD.ust_idnr;
    NEW.iban := OLD.iban;
    NEW.bic := OLD.bic;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_firmenprofil_banking() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_firmenprofil_banking() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_firmenprofil_banking() FROM authenticated;

DROP TRIGGER IF EXISTS protect_firmenprofil_banking ON public.firmenprofil;
CREATE TRIGGER protect_firmenprofil_banking
  BEFORE UPDATE ON public.firmenprofil
  FOR EACH ROW EXECUTE FUNCTION public.protect_firmenprofil_banking();

-- ============================================================
-- 2. DMS STORAGE SELECT — enforce document confidentiality
-- ============================================================

-- Downloads now require an existing document version whose parent document is
-- visible to the caller under can_view_document() (confidential flag,
-- worker_sichtbar flag, linked-order assignment, DMS permissions, owner).
-- TO authenticated only => anonymous users have no access.
DROP POLICY IF EXISTS "dms objects select" ON storage.objects;
CREATE POLICY "dms objects select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dms'
    AND EXISTS (
      SELECT 1
      FROM public.document_versions dv
      WHERE dv.storage_path = storage.objects.name
        AND public.can_view_document(dv.document_id)
    )
  );

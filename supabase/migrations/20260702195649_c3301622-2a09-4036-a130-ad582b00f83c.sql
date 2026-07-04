-- ============================================================
-- 1. INVITATIONS: remove plaintext secrets, use hashed one-time token
-- ============================================================
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS token_hash text;

-- Migrate existing plaintext tokens to hashes so existing links keep working
UPDATE public.invitations
   SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
 WHERE token_hash IS NULL AND token IS NOT NULL;

-- Drop plaintext secret columns (clears stored temp passwords + tokens)
ALTER TABLE public.invitations DROP COLUMN IF EXISTS temp_password;
ALTER TABLE public.invitations DROP COLUMN IF EXISTS token;

CREATE INDEX IF NOT EXISTS invitations_token_hash_idx ON public.invitations(token_hash);

-- Rewrite lookup to match by hash (return type changes -> drop + recreate)
DROP FUNCTION IF EXISTS public.get_invitation(text);
CREATE FUNCTION public.get_invitation(_token text)
 RETURNS TABLE(email text, vorname text, nachname text, valid boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT i.email, i.vorname, i.nachname,
         (i.status = 'pending' AND i.expires_at > now()) AS valid
  FROM public.invitations i
  WHERE i.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex');
$function$;

-- Rewrite acceptance to match by hash and invalidate the token (single-use)
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE inv public.invitations%ROWTYPE; _base app_role;
BEGIN
  SELECT * INTO inv FROM public.invitations
  WHERE token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
    AND status = 'pending' AND expires_at > now();
  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Ungueltige oder abgelaufene Einladung';
  END IF;

  IF inv.role_id IS NOT NULL THEN
    DELETE FROM public.user_role_memberships WHERE user_id = auth.uid();
    INSERT INTO public.user_role_memberships (user_id, role_id) VALUES (auth.uid(), inv.role_id);
    SELECT base_role INTO _base FROM public.roles WHERE id = inv.role_id;
    IF _base IS NOT NULL THEN
      DELETE FROM public.user_roles WHERE user_id = auth.uid();
      INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), _base);
    END IF;
  END IF;

  UPDATE public.profiles SET
    force_password_change = true,
    vorname = COALESCE(inv.vorname, vorname),
    nachname = COALESCE(inv.nachname, nachname),
    telefon = COALESCE(inv.telefon, telefon)
  WHERE id = auth.uid();

  UPDATE public.invitations
  SET status = 'accepted', accepted_user_id = auth.uid(), token_hash = NULL, updated_at = now()
  WHERE id = inv.id;

  PERFORM public.log_activity('invitation.accepted', 'invitation', inv.id, inv.email, NULL, NULL);
END;
$function$;

-- ============================================================
-- 2. MITARBEITER: restrict employee data reads
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT COALESCE((SELECT disabled FROM public.profiles WHERE id = _user_id), true);
$function$;

DROP POLICY IF EXISTS mitarbeiter_select ON public.mitarbeiter;
CREATE POLICY mitarbeiter_select ON public.mitarbeiter
  FOR SELECT TO authenticated
  USING (
    public.is_active_user(auth.uid())
    AND (
      public.is_staff(auth.uid())
      OR public.has_permission(auth.uid(), 'mitarbeiter.view')
      OR public.has_permission(auth.uid(), 'mitarbeiter.manage')
      OR linked_user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. SECURITY EVENTS: allow self-insert + self-view (owner keeps view-all)
-- ============================================================
CREATE POLICY security_events_insert_self ON public.security_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY security_events_select_self ON public.security_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 4. ACTIVITY LOG: replace always-true INSERT with self-scoped check
-- ============================================================
DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;
CREATE POLICY activity_log_insert ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 6. STORAGE: permission-scoped UPDATE policies for dms + importe
-- ============================================================
CREATE POLICY "dms objects update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'dms' AND (public.has_permission(auth.uid(), 'dokumente.upload') OR public.has_role(auth.uid(), 'owner')))
  WITH CHECK (bucket_id = 'dms' AND (public.has_permission(auth.uid(), 'dokumente.upload') OR public.has_role(auth.uid(), 'owner')));

CREATE POLICY "importe_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'importe' AND (public.has_role(auth.uid(), 'owner') OR public.has_permission(auth.uid(), 'importe.upload')))
  WITH CHECK (bucket_id = 'importe' AND (public.has_role(auth.uid(), 'owner') OR public.has_permission(auth.uid(), 'importe.upload')));

-- ============================================================
-- 5. SECURITY DEFINER: revoke broad execute, re-grant only what's used
-- ============================================================
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- service_role (backend/admin) keeps full access
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Callable before sign-in (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.get_invitation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_branding() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_needs_setup() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_lock(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, text, text, text) TO anon, authenticated;

-- Signed-in only: RPCs called by the app
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.setup_grant_owner_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_mitarbeiter_to_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auftrag_gewinn_map() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auftrag_umsatz_map() TO authenticated;
GRANT EXECUTE ON FUNCTION public.zahlungsereignis_umsatz_map() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, text, jsonb, jsonb) TO authenticated;

-- Signed-in only: helper functions referenced inside RLS policies
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_auftrag(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.status_action_allowed(text, text) TO authenticated;

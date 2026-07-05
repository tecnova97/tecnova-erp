-- Look up a pending, non-expired invitation by e-mail (callable before login).
CREATE OR REPLACE FUNCTION public.get_pending_invitation(_email text)
RETURNS TABLE(email text, vorname text, nachname text, telefon text, role_id uuid, valid boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.email, i.vorname, i.nachname, i.telefon, i.role_id, true AS valid
  FROM public.invitations i
  WHERE lower(i.email) = lower(_email)
    AND i.status = 'pending'
    AND i.expires_at > now()
  ORDER BY i.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_invitation(text) TO anon, authenticated;

-- Claim a pending invitation as the currently authenticated (just-registered) user.
CREATE OR REPLACE FUNCTION public.accept_self_invitation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  inv public.invitations%ROWTYPE;
  _base app_role;
  _base_text text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert';
  END IF;

  SELECT lower(email) INTO _email FROM auth.users WHERE id = _uid;

  SELECT * INTO inv FROM public.invitations
  WHERE lower(email) = _email
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF inv.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_invitation');
  END IF;

  UPDATE public.profiles SET
    vorname = COALESCE(inv.vorname, vorname),
    nachname = COALESCE(inv.nachname, nachname),
    telefon = COALESCE(inv.telefon, telefon),
    email = COALESCE(email, _email)
  WHERE id = _uid;

  IF inv.role_id IS NOT NULL THEN
    DELETE FROM public.user_role_memberships WHERE user_id = _uid;
    INSERT INTO public.user_role_memberships (user_id, role_id) VALUES (_uid, inv.role_id);
    SELECT base_role INTO _base FROM public.roles WHERE id = inv.role_id;
    IF _base IS NOT NULL THEN
      DELETE FROM public.user_roles WHERE user_id = _uid;
      INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _base);
    END IF;
  END IF;

  UPDATE public.invitations
  SET status = 'accepted', accepted_user_id = _uid, updated_at = now()
  WHERE id = inv.id;

  _base_text := COALESCE(
    _base::text,
    (SELECT role::text FROM public.user_roles WHERE user_id = _uid LIMIT 1),
    'worker'
  );

  RETURN jsonb_build_object('ok', true, 'base_role', _base_text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_self_invitation() TO authenticated;
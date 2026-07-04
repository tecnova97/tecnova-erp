CREATE OR REPLACE FUNCTION public.system_needs_setup()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner');
$$;
GRANT EXECUTE ON FUNCTION public.system_needs_setup() TO anon, authenticated;

CREATE TABLE public.invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  vorname text,
  nachname text,
  telefon text,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  temp_password text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_user_id uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User-Manager verwalten Einladungen"
ON public.invitations FOR ALL
TO authenticated
USING (public.has_permission(auth.uid(), 'users.manage') OR public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_permission(auth.uid(), 'users.manage') OR public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_invitations_updated_at
BEFORE UPDATE ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trusted_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  label text,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_devices TO authenticated;
GRANT ALL ON public.trusted_devices TO service_role;

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eigene Geraete verwalten"
ON public.trusted_devices FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User-Manager sehen alle Geraete"
ON public.trusted_devices FOR SELECT
TO authenticated
USING (public.has_permission(auth.uid(), 'users.manage') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "User-Manager entfernen Geraete"
ON public.trusted_devices FOR DELETE
TO authenticated
USING (public.has_permission(auth.uid(), 'users.manage') OR public.has_role(auth.uid(), 'owner'));

CREATE OR REPLACE FUNCTION public.get_invitation(_token text)
RETURNS TABLE(email text, vorname text, nachname text, temp_password text, valid boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.email, i.vorname, i.nachname, i.temp_password,
         (i.status = 'pending' AND i.expires_at > now()) AS valid
  FROM public.invitations i
  WHERE i.token = _token;
$$;
GRANT EXECUTE ON FUNCTION public.get_invitation(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE inv public.invitations%ROWTYPE; _base app_role;
BEGIN
  SELECT * INTO inv FROM public.invitations
  WHERE token = _token AND status = 'pending' AND expires_at > now();
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
  SET status = 'accepted', accepted_user_id = auth.uid(), updated_at = now()
  WHERE id = inv.id;

  PERFORM public.log_activity('invitation.accepted', 'invitation', inv.id, inv.email, NULL, NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.setup_grant_owner_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _owner_role uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RAISE EXCEPTION 'Nur Inhaber';
  END IF;
  SELECT id INTO _owner_role FROM public.roles
  WHERE base_role = 'owner' ORDER BY is_system DESC LIMIT 1;
  IF _owner_role IS NULL THEN RETURN; END IF;

  INSERT INTO public.role_permissions (role_id, permission_key)
  SELECT _owner_role, p.key FROM public.permissions p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = _owner_role AND rp.permission_key = p.key
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.user_role_memberships
    WHERE user_id = auth.uid() AND role_id = _owner_role
  ) THEN
    INSERT INTO public.user_role_memberships (user_id, role_id)
    VALUES (auth.uid(), _owner_role);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.setup_grant_owner_permissions() TO authenticated;
-- 1) Make handle_new_user always grant owner to the primary owner email,
--    without creating duplicates and without touching passwords.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, vorname, nachname, email)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'vorname', split_part(COALESCE(NEW.raw_user_meta_data->>'name',''), ' ', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nachname', ''),
    NEW.email);

  SELECT count(*) INTO user_count FROM public.user_roles;

  IF lower(NEW.email) = 'info@tec-nova.de' OR user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'worker')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;

-- 2) If the primary owner account already exists, ensure it has the owner role.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'owner'::app_role
FROM auth.users u
WHERE lower(u.email) = 'info@tec-nova.de'
ON CONFLICT (user_id, role) DO NOTHING;
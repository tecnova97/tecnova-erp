UPDATE public.profiles p
SET force_password_change = true
FROM auth.users u
WHERE u.id = p.id AND lower(u.email) = 'info@tec-nova.de';
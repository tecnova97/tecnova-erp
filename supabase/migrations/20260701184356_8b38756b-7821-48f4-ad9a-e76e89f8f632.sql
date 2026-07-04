CREATE TABLE public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text,
  user_id uuid,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_email_created ON public.security_events (lower(email), created_at DESC);
CREATE INDEX idx_security_events_created ON public.security_events (created_at DESC);

GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view security events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- Record a login attempt (callable pre-auth by anon)
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  _email text,
  _action text,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  INSERT INTO public.security_events (email, user_id, action, ip_address, user_agent)
  VALUES (_email, _uid, _action, _ip, _user_agent);
END;
$$;

-- Check whether an email is currently locked out after too many failed attempts
CREATE OR REPLACE FUNCTION public.check_login_lock(_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _failed int;
  _last_fail timestamptz;
  _window interval := interval '15 minutes';
  _threshold int := 5;
  _locked boolean := false;
  _seconds_remaining int := 0;
BEGIN
  SELECT count(*), max(created_at)
    INTO _failed, _last_fail
  FROM public.security_events
  WHERE lower(email) = lower(_email)
    AND action = 'login_failed'
    AND created_at > now() - _window;

  IF _failed >= _threshold AND _last_fail IS NOT NULL THEN
    _seconds_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM ((_last_fail + _window) - now()))))::int;
    IF _seconds_remaining > 0 THEN
      _locked := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'locked', _locked,
    'failed_count', _failed,
    'seconds_remaining', _seconds_remaining
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_login_attempt(text, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.check_login_lock(text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_lock(text) TO anon, authenticated;
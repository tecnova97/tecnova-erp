DO $$
DECLARE
  fn record;
  keep_anon text[] := ARRAY[
    'check_login_lock',
    'record_login_attempt',
    'system_needs_setup',
    'get_invitation',
    'get_branding'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid,
           p.proname,
           'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
    IF fn.proname = ANY (keep_anon) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', fn.sig);
    END IF;
  END LOOP;
END $$;

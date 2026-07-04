DO $$
DECLARE
  fn record;
  trigger_only text[] := ARRAY[
    'handle_new_user',
    'update_updated_at_column',
    'log_activity',
    'ensure_mitarbeiter_for_user',
    'trg_log_verguetung',
    'trg_log_verg_eintrag',
    'trg_log_documents',
    'trg_log_dokumente',
    'trg_log_leistungsnotiz',
    'trg_log_leistungen',
    'trg_log_auftraege',
    'trg_log_auftrag_mitarbeiter',
    'trg_log_projekte',
    'trg_log_kunden',
    'trg_log_fotos',
    'trg_log_urlaub',
    'trg_log_ausstattung',
    'trg_log_mitarbeiter',
    'trg_log_rechnung_gruppen',
    'sync_primary_status_zuweisung',
    'sync_auftrag_bezahlt',
    'void_zahlungsereignis',
    'create_zahlungsereignis',
    'snapshot_auftrag_leistung_preis',
    'trg_sync_worker_mitarbeiter',
    'trg_sync_profile_mitarbeiter',
    'set_rechnung_gruppe_nummer'
  ];
BEGIN
  FOR fn IN
    SELECT 'public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.proname = ANY (trigger_only)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn.sig);
  END LOOP;
END $$;

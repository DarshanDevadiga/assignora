-- Post-migration verification for 20261112000001_round2_optional_faculty_invitation_token.sql
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef,
  p.proconfig,
  pg_get_functiondef(p.oid) LIKE '%Optional invitation token omitted%' AS has_optional_trigger_logic,
  pg_get_functiondef(p.oid) LIKE '%Unauthorized role escalation attempt rejected%' AS has_escalation_guard
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'validate_faculty_invitation',
    'handle_new_user',
    'register_user_profile'
  )
ORDER BY p.proname;

-- Verify trigger remains attached on auth.users
SELECT tgname, tgrelid::regclass::text AS table_name
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND NOT tgisinternal
  AND tgname = 'on_auth_user_created';

-- Verify RLS role guards on public.users remain intact
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
  AND policyname IN ('users_insert_policy', 'users_update_policy')
ORDER BY policyname;

-- ============================================================================
-- ASSIGNORA ROUND 2 ADVANCED: POST-MIGRATION VERIFICATION
-- File: supabase/migrations/post_migration_verification_advanced.sql
-- ============================================================================

DO $verify$
DECLARE
    v_missing_functions INT;
    v_missing_policies INT;
BEGIN
    SELECT COUNT(*) INTO v_missing_functions
    FROM (VALUES 
        ('professor_create_group'),
        ('add_group_members'),
        ('get_class_roster')
    ) AS req(fname)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = req.fname AND pronamespace = 'public'::regnamespace
    );

    IF v_missing_functions > 0 THEN
        RAISE EXCEPTION 'Verification failed: % advanced RPC function(s) missing.', v_missing_functions;
    END IF;

    SELECT COUNT(*) INTO v_missing_policies
    FROM (VALUES
        ('class_members_peer_select_policy', 'class_members'),
        ('users_classmates_select_policy', 'users')
    ) AS pol(pname, tname)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = pol.pname AND polrelid = ('public.' || pol.tname)::regclass
    );

    IF v_missing_policies > 0 THEN
        RAISE EXCEPTION 'Verification failed: % peer select policy(ies) missing.', v_missing_policies;
    END IF;

    RAISE NOTICE 'SUCCESS: All advanced group & roster functions and policies are verified in catalog.';
END;
$verify$;

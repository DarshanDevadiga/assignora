-- ============================================================================
-- ASSIGNORA ROUND 2 ADVANCED: ROLLBACK
-- File: supabase/migrations/rollback_round2_advanced.sql
-- ============================================================================

DO $rollback$
BEGIN
    -- Drop peer policies
    DROP POLICY IF EXISTS class_members_peer_select_policy ON public.class_members;
    DROP POLICY IF EXISTS users_classmates_select_policy ON public.users;

    -- Drop functions
    DROP FUNCTION IF EXISTS public.professor_create_group(uuid, text, uuid[], uuid);
    DROP FUNCTION IF EXISTS public.add_group_members(uuid, uuid[]);
    DROP FUNCTION IF EXISTS public.get_class_roster(uuid);

    -- Remove from manifest
    DELETE FROM public._assignora_migration_manifest
    WHERE (object_type = 'FUNCTION' AND object_name IN ('professor_create_group', 'add_group_members', 'get_class_roster'))
       OR (object_type = 'POLICY' AND sub_object_name IN ('class_members_peer_select_policy', 'users_classmates_select_policy'));
END;
$rollback$;

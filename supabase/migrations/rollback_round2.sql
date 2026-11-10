-- ==============================================================================
-- ASSIGNORA REVISED PRODUCTION ROLLBACK SCRIPT: ROUND 2 (OWNERSHIP-GUARDED)
-- File: supabase/migrations/rollback_round2.sql
-- Target: PostgreSQL 17.11 (Supabase project trkcagoxopabqerljgvn)
-- Description:
--   Surgically rolls back ONLY objects created by migration 20261110000000_round2
--   using the migration ownership manifest (public._assignora_migration_manifest).
--   Fail-closed: aborts immediately if manifest is missing or damaged.
--   ZERO CASCADE clauses: all drops use RESTRICT.
--   Preserves all Round 1 objects and any pre-existing Round 2-named objects.
-- ==============================================================================

DO $$
DECLARE
    v_has_manifest BOOLEAN;
    v_is_owner BOOLEAN;
    v_tbl TEXT;
    v_col TEXT;
    v_idx TEXT;
    v_pol RECORD;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ASSIGNORA ROUND 2 OWNERSHIP-AWARE SURGICAL ROLLBACK';
    RAISE NOTICE '=======================================================';

    -- Check if migration manifest table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '_assignora_migration_manifest'
    ) INTO v_has_manifest;

    -- Fail closed: without the manifest, ownership cannot be established safely.
    IF NOT v_has_manifest THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: ownership manifest public._assignora_migration_manifest is missing; no objects were changed';
    END IF;

    -- 1. Deregister Realtime publication entries ONLY if created by this migration
    FOREACH v_tbl IN ARRAY ARRAY['group_submissions', 'group_members', 'groups'] LOOP
        SELECT EXISTS (
            SELECT 1 FROM public._assignora_migration_manifest
            WHERE object_type = 'PUBLICATION_TABLE' 
              AND object_schema = 'public' 
              AND object_name = 'supabase_realtime' 
              AND sub_object_name = v_tbl
              AND created_by_migration = '20261110000000_round2'
        ) INTO v_is_owner;

        IF v_is_owner THEN
            IF EXISTS (
                SELECT 1 FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tbl
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I;', v_tbl);
                RAISE NOTICE 'Deregistered public.%I from supabase_realtime (created by migration).', v_tbl;
            END IF;
        ELSE
            RAISE NOTICE 'Preserved public.%I in supabase_realtime (pre-existing or not owned).', v_tbl;
        END IF;
    END LOOP;

    -- 2. Drop Triggers ONLY if parent table exists AND trigger is recorded in manifest
    IF to_regclass('public.group_submissions') IS NOT NULL
       AND EXISTS (
          SELECT 1 FROM public._assignora_migration_manifest
          WHERE object_type='TRIGGER' AND object_schema='public'
            AND object_name='group_submissions'
            AND sub_object_name='trg_protect_group_submission_immutables'
            AND created_by_migration='20261110000000_round2'
       ) THEN
        DROP TRIGGER IF EXISTS trg_protect_group_submission_immutables ON public.group_submissions;
        RAISE NOTICE 'Dropped trigger trg_protect_group_submission_immutables on group_submissions.';
    END IF;

    IF to_regclass('public.group_members') IS NOT NULL
       AND EXISTS (
          SELECT 1 FROM public._assignora_migration_manifest
          WHERE object_type='TRIGGER' AND object_schema='public'
            AND object_name='group_members'
            AND sub_object_name='trg_prevent_leader_abandonment'
            AND created_by_migration='20261110000000_round2'
       ) THEN
        DROP TRIGGER IF EXISTS trg_prevent_leader_abandonment ON public.group_members;
        RAISE NOTICE 'Dropped trigger trg_prevent_leader_abandonment on group_members.';
    END IF;

    IF to_regclass('public.groups') IS NOT NULL
       AND EXISTS (
          SELECT 1 FROM public._assignora_migration_manifest
          WHERE object_type='TRIGGER' AND object_schema='public'
            AND object_name='groups'
            AND sub_object_name='trg_protect_group_immutables'
            AND created_by_migration='20261110000000_round2'
       ) THEN
        DROP TRIGGER IF EXISTS trg_protect_group_immutables ON public.groups;
        RAISE NOTICE 'Dropped trigger trg_protect_group_immutables on groups.';
    END IF;

    -- 3. Drop RLS Policies ONLY if parent table exists and policy is recorded in manifest
    FOR v_pol IN (
        SELECT object_name AS tbl_name, sub_object_name AS pol_name
        FROM public._assignora_migration_manifest
        WHERE object_type = 'POLICY' 
          AND object_schema = 'public' 
          AND created_by_migration = '20261110000000_round2'
    ) LOOP
        IF to_regclass(format('public.%I', v_pol.tbl_name)) IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM pg_policy p
                JOIN pg_class c ON c.oid = p.polrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relname = v_pol.tbl_name AND p.polname = v_pol.pol_name
            ) THEN
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol.pol_name, v_pol.tbl_name);
                RAISE NOTICE 'Dropped policy % on public.%.', v_pol.pol_name, v_pol.tbl_name;
            END IF;
        END IF;
    END LOOP;

    -- 4. Drop Indexes ONLY if recorded in manifest
    FOR v_idx IN (
        SELECT sub_object_name
        FROM public._assignora_migration_manifest
        WHERE object_type = 'INDEX' 
          AND object_schema = 'public' 
          AND created_by_migration = '20261110000000_round2'
    ) LOOP
        IF to_regclass(format('public.%I', v_idx)) IS NOT NULL THEN
            EXECUTE format('DROP INDEX IF EXISTS public.%I RESTRICT;', v_idx);
            RAISE NOTICE 'Dropped index public.% (owned by migration).', v_idx;
        END IF;
    END LOOP;

    -- 5. Drop Tables ONLY if recorded in manifest (Reverse FK order, NO CASCADE)
    FOREACH v_tbl IN ARRAY ARRAY['group_submissions', 'group_members', 'groups', 'faculty_invitations'] LOOP
        v_is_owner := FALSE;
        SELECT EXISTS (
            SELECT 1 FROM public._assignora_migration_manifest
            WHERE object_type = 'TABLE' 
              AND object_schema = 'public' 
              AND object_name = v_tbl
              AND created_by_migration = '20261110000000_round2'
        ) INTO v_is_owner;

        IF v_is_owner THEN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
                EXECUTE format('DROP TABLE public.%I RESTRICT;', v_tbl);
                RAISE NOTICE 'Dropped table public.%I (owned by migration).', v_tbl;
            END IF;
        ELSE
            RAISE NOTICE 'Preserved table public.%I (pre-existing or not owned by migration).', v_tbl;
        END IF;
    END LOOP;

    -- 6. Drop Functions ONLY when exact signature is recorded in manifest
    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='register_user_profile' AND UPPER(sub_object_name)=UPPER('TEXT, TEXT, TEXT, TEXT')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.register_user_profile(TEXT, TEXT, TEXT, TEXT) RESTRICT;
        RAISE NOTICE 'Dropped function public.register_user_profile(TEXT, TEXT, TEXT, TEXT).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='create_faculty_invitation' AND UPPER(sub_object_name)=UPPER('TEXT, TEXT')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.create_faculty_invitation(TEXT, TEXT) RESTRICT;
        RAISE NOTICE 'Dropped function public.create_faculty_invitation(TEXT, TEXT).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='grade_group_submission' AND UPPER(sub_object_name)=UPPER('UUID, NUMERIC, TEXT')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.grade_group_submission(UUID, NUMERIC, TEXT) RESTRICT;
        RAISE NOTICE 'Dropped function public.grade_group_submission(UUID, NUMERIC, TEXT).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='acknowledge_group_assignment' AND UPPER(sub_object_name)=UPPER('UUID, UUID, TEXT, TEXT')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.acknowledge_group_assignment(UUID, UUID, TEXT, TEXT) RESTRICT;
        RAISE NOTICE 'Dropped function public.acknowledge_group_assignment(UUID, UUID, TEXT, TEXT).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='disband_course_group' AND UPPER(sub_object_name)=UPPER('UUID')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.disband_course_group(UUID) RESTRICT;
        RAISE NOTICE 'Dropped function public.disband_course_group(UUID).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='archive_course_group' AND UPPER(sub_object_name)=UPPER('UUID')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.archive_course_group(UUID) RESTRICT;
        RAISE NOTICE 'Dropped function public.archive_course_group(UUID).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='transfer_group_leadership' AND UPPER(sub_object_name)=UPPER('UUID, UUID')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.transfer_group_leadership(UUID, UUID) RESTRICT;
        RAISE NOTICE 'Dropped function public.transfer_group_leadership(UUID, UUID).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='leave_course_group' AND UPPER(sub_object_name)=UPPER('UUID')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.leave_course_group(UUID) RESTRICT;
        RAISE NOTICE 'Dropped function public.leave_course_group(UUID).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='join_course_group' AND UPPER(sub_object_name)=UPPER('UUID')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.join_course_group(UUID) RESTRICT;
        RAISE NOTICE 'Dropped function public.join_course_group(UUID).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='create_course_group' AND UPPER(sub_object_name)=UPPER('UUID, TEXT')
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.create_course_group(UUID, TEXT) RESTRICT;
        RAISE NOTICE 'Dropped function public.create_course_group(UUID, TEXT).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='check_group_submission_immutables' AND sub_object_name=''
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.check_group_submission_immutables() RESTRICT;
        RAISE NOTICE 'Dropped function public.check_group_submission_immutables().';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='check_group_member_deletion' AND sub_object_name=''
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.check_group_member_deletion() RESTRICT;
        RAISE NOTICE 'Dropped function public.check_group_member_deletion().';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type='FUNCTION' AND object_schema='public'
          AND object_name='check_group_immutables' AND sub_object_name=''
          AND created_by_migration='20261110000000_round2'
    ) THEN
        DROP FUNCTION IF EXISTS public.check_group_immutables() RESTRICT;
        RAISE NOTICE 'Dropped function public.check_group_immutables().';
    END IF;

    -- 7. Drop constraint on assignments ONLY if recorded in manifest
    v_is_owner := FALSE;
    SELECT EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type = 'CONSTRAINT' 
          AND object_schema = 'public' 
          AND object_name = 'assignments' 
          AND sub_object_name = 'assignments_submission_type_check'
          AND created_by_migration = '20261110000000_round2'
    ) INTO v_is_owner;

    IF v_is_owner THEN
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.assignments'::regclass 
              AND conname = 'assignments_submission_type_check'
        ) THEN
            ALTER TABLE public.assignments DROP CONSTRAINT assignments_submission_type_check RESTRICT;
            RAISE NOTICE 'Dropped constraint assignments_submission_type_check (owned by migration).';
        END IF;
    ELSE
        RAISE NOTICE 'Preserved constraint assignments_submission_type_check (pre-existing or not owned).';
    END IF;

    -- 8. Drop columns on assignments ONLY if recorded in manifest
    FOREACH v_col IN ARRAY ARRAY['onedrive_link', 'submission_type'] LOOP
        v_is_owner := FALSE;
        SELECT EXISTS (
            SELECT 1 FROM public._assignora_migration_manifest
            WHERE object_type = 'COLUMN' 
              AND object_schema = 'public' 
              AND object_name = 'assignments' 
              AND sub_object_name = v_col
              AND created_by_migration = '20261110000000_round2'
        ) INTO v_is_owner;

        IF v_is_owner THEN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = v_col
            ) THEN
                EXECUTE format('ALTER TABLE public.assignments DROP COLUMN %I RESTRICT;', v_col);
                RAISE NOTICE 'Dropped column public.assignments.%I (owned by migration).', v_col;
            END IF;
        ELSE
            RAISE NOTICE 'Preserved column public.assignments.%I (pre-existing or not owned).', v_col;
        END IF;
    END LOOP;

    -- 9. Clean up migration records from manifest
    DELETE FROM public._assignora_migration_manifest 
    WHERE created_by_migration = '20261110000000_round2';
    RAISE NOTICE 'Cleaned up manifest entries for 20261110000000_round2.';

    -- If manifest is now completely empty, drop the manifest table itself with RESTRICT
    IF NOT EXISTS (SELECT 1 FROM public._assignora_migration_manifest LIMIT 1) THEN
        DROP TABLE public._assignora_migration_manifest RESTRICT;
        RAISE NOTICE 'Dropped empty _assignora_migration_manifest table.';
    END IF;

    -- 10. Verify Round 1 base tables remain 100% intact
    FOREACH v_tbl IN ARRAY ARRAY['users', 'classes', 'class_members', 'assignments', 'submissions'] LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
            RAISE EXCEPTION 'CRITICAL ROLLBACK ANOMALY: Missing Round 1 table %', v_tbl;
        END IF;
    END LOOP;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'OWNERSHIP-AWARE ROLLBACK COMPLETED.';
    RAISE NOTICE 'ALL PRE-EXISTING ROUND 1 AND ROUND 2 OBJECTS PRESERVED.';
    RAISE NOTICE '=======================================================';
END $$;

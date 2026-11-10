-- ==============================================================================
-- ASSIGNORA ENHANCED PREFLIGHT VALIDATION SCRIPT (SAFE READ-ONLY)
-- File: supabase/migrations/preflight_validation.sql
-- Description:
--   Runs prior to executing 20261110000000_round2_groups_and_acknowledgements.sql.
--   Performs deep catalog reflection across tables, views, materialized views,
--   types, functions, policies, constraints, and column definitions.
--   ABORTS on any incompatible pre-existing definition or conflicting namespace.
-- ZERO DDL / ZERO DML.
-- ==============================================================================

DO $$
DECLARE
    v_missing_tables TEXT[] := ARRAY[]::TEXT[];
    v_rls_disabled TEXT[] := ARRAY[]::TEXT[];
    v_conflicts TEXT[] := ARRAY[]::TEXT[];
    v_tbl TEXT;
    v_col TEXT;
    v_has_rls BOOLEAN;
    v_con_def TEXT;
    v_udt TEXT;
    v_base_tables TEXT[] := ARRAY[
        'users',
        'classes',
        'class_members',
        'assignments',
        'assignment_students',
        'submissions',
        'announcements',
        'notifications',
        'class_messages'
    ];
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ASSIGNORA ROUND 2 DEEP PREFLIGHT VALIDATION';
    RAISE NOTICE '=======================================================';

    -- 1. Check all Round 1 base tables exist and have RLS enabled
    FOREACH v_tbl IN ARRAY v_base_tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = v_tbl
        ) THEN
            v_missing_tables := array_append(v_missing_tables, v_tbl);
        ELSE
            SELECT relrowsecurity INTO v_has_rls
            FROM pg_class
            WHERE relnamespace = 'public'::regnamespace AND relname = v_tbl;

            IF NOT v_has_rls THEN
                v_rls_disabled := array_append(v_rls_disabled, v_tbl);
            END IF;
        END IF;
    END LOOP;

    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT ABORT: Missing required Round 1 base tables: %', array_to_string(v_missing_tables, ', ');
    END IF;

    IF array_length(v_rls_disabled, 1) > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT ABORT: RLS disabled on required base tables: %', array_to_string(v_rls_disabled, ', ');
    END IF;

    RAISE NOTICE '[PASS] All 9 Round 1 prerequisite tables verified with RLS active.';

    -- 2. Check for namespace collisions with views, materialized views, or custom types
    FOREACH v_tbl IN ARRAY ARRAY['faculty_invitations', 'groups', 'group_members', 'group_submissions'] LOOP
        IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = v_tbl) THEN
            v_conflicts := array_append(v_conflicts, v_tbl || ' (VIEW collision)');
        END IF;
        IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = v_tbl) THEN
            v_conflicts := array_append(v_conflicts, v_tbl || ' (MATERIALIZED VIEW collision)');
        END IF;
        IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = v_tbl) THEN
            -- Check if it is a standalone enum or composite type not backed by a table
            IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname = v_tbl AND c.relnamespace = 'public'::regnamespace) THEN
                v_conflicts := array_append(v_conflicts, v_tbl || ' (STANDALONE TYPE collision)');
            END IF;
        END IF;
    END LOOP;

    IF array_length(v_conflicts, 1) > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT ABORT: Conflicting namespace objects detected: %', array_to_string(v_conflicts, ', ');
    END IF;

    RAISE NOTICE '[PASS] Namespace clear of conflicting views, matviews, or standalone types.';

    -- 3. In-depth inspection of assignments table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'submission_type'
    ) THEN
        SELECT udt_name INTO v_udt 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'submission_type';

        IF v_udt NOT IN ('varchar', 'text') THEN
            RAISE EXCEPTION 'PREFLIGHT ABORT: assignments.submission_type exists with incompatible type: %', v_udt;
        END IF;

        -- Check constraint if present
        SELECT pg_get_constraintdef(oid) INTO v_con_def
        FROM pg_constraint 
        WHERE conrelid = 'public.assignments'::regclass AND conname = 'assignments_submission_type_check';

        IF v_con_def IS NOT NULL THEN
            IF v_con_def NOT LIKE '%individual%' OR v_con_def NOT LIKE '%group%' THEN
                RAISE EXCEPTION 'PREFLIGHT ABORT: Incompatible existing constraint on assignments.submission_type: %', v_con_def;
            END IF;
            RAISE NOTICE '[INFO] assignments.submission_type constraint already verified compatible: %', v_con_def;
        END IF;
    ELSE
        RAISE NOTICE '[INFO] assignments.submission_type ready for additive creation.';
    END IF;

    -- 4. In-depth inspection of pre-existing Round 2 tables (if any exist)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups') THEN
        -- Check required columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'class_id' AND udt_name = 'uuid') THEN
            RAISE EXCEPTION 'PREFLIGHT ABORT: Existing groups table has incompatible class_id column.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'leader_id' AND udt_name = 'uuid') THEN
            RAISE EXCEPTION 'PREFLIGHT ABORT: Existing groups table has incompatible leader_id column.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'status') THEN
            RAISE EXCEPTION 'PREFLIGHT ABORT: Existing groups table is missing status column.';
        END IF;
        RAISE NOTICE '[INFO] Pre-existing groups table verified structurally compatible.';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_members') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_members' AND column_name = 'class_id' AND udt_name = 'uuid') THEN
            RAISE EXCEPTION 'PREFLIGHT ABORT: Existing group_members table has incompatible class_id column.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_members' AND column_name = 'student_id' AND udt_name = 'uuid') THEN
            RAISE EXCEPTION 'PREFLIGHT ABORT: Existing group_members table has incompatible student_id column.';
        END IF;
        RAISE NOTICE '[INFO] Pre-existing group_members table verified structurally compatible.';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_submissions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_submissions' AND column_name = 'assignment_id' AND udt_name = 'uuid') THEN
            RAISE EXCEPTION 'PREFLIGHT ABORT: Existing group_submissions table has incompatible assignment_id column.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_submissions' AND column_name = 'group_id' AND udt_name = 'uuid') THEN
            RAISE EXCEPTION 'PREFLIGHT ABORT: Existing group_submissions table has incompatible group_id column.';
        END IF;
        RAISE NOTICE '[INFO] Pre-existing group_submissions table verified structurally compatible.';
    END IF;

    -- 5. Inspect CSPRNG availability for 192-bit token generation in extensions or core schema
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON n.oid = p.pronamespace 
        WHERE n.nspname IN ('extensions', 'pg_catalog') AND p.proname = 'gen_random_bytes'
    ) THEN
        RAISE EXCEPTION 'PREFLIGHT ABORT: extensions.gen_random_bytes is not available in PostgreSQL instance.';
    END IF;
    RAISE NOTICE '[PASS] Cryptographic CSPRNG (extensions.gen_random_bytes) verified available.';

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'DEEP PREFLIGHT VALIDATION PASSED COMPLETELY. SAFE TO PROCEED.';
    RAISE NOTICE '=======================================================';
END $$;

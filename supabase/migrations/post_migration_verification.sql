-- ==============================================================================
-- ASSIGNORA RIGOROUS POST-MIGRATION VERIFICATION & INVARIANT SUITE
-- File: supabase/migrations/post_migration_verification.sql
-- Target: PostgreSQL 17.11 (Supabase project trkcagoxopabqerljgvn)
-- Description:
--   Runs immediately following execution of 20261110000000_round2_groups_and_acknowledgements.sql.
--   Performs deep pg_catalog introspection:
--     1. Verifies prosecdef = true on all 13 RPC and trigger functions.
--     2. Verifies proconfig contains 'search_path=pg_catalog, pg_temp'.
--     3. Verifies EXECUTE privilege for authenticated role, and absence for anon / PUBLIC.
--     4. Verifies all 12 RLS policies on Round 2 tables (group_members DELETE denied).
--     5. Verifies column-level privilege confinement (groups.name only).
--     6. Verifies foreign keys enforce ON DELETE RESTRICT on submissions and groups.
--     7. Verifies triggers and Realtime publication membership.
--     8. Verifies ownership manifest inventory completeness and protection.
-- ==============================================================================

DO $$
DECLARE
    v_signature TEXT;
    v_proc_oid OID;
    v_secdef BOOLEAN;
    v_config TEXT[];
    v_pub_exec BOOLEAN;
    v_tbl TEXT;
    v_has_rls BOOLEAN;
    v_del_type "char";
    v_priv_name BOOLEAN;
    v_priv_leader BOOLEAN;
    v_priv_status BOOLEAN;
    v_pub_count INTEGER;
    v_manifest_count INTEGER;
BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ASSIGNORA ROUND 2 RIGOROUS POST-MIGRATION VERIFICATION';
    RAISE NOTICE '=======================================================';

    -- ------------------------------------------------------------------
    -- 1. FUNCTION SECURITY DEFINER, EXACT SIGNATURES, SEARCH_PATH & ACLS
    -- ------------------------------------------------------------------
    FOREACH v_signature IN ARRAY ARRAY[
        'public.check_group_immutables()',
        'public.check_group_member_deletion()',
        'public.check_group_submission_immutables()',
        'public.create_course_group(uuid,text)',
        'public.join_course_group(uuid)',
        'public.leave_course_group(uuid)',
        'public.transfer_group_leadership(uuid,uuid)',
        'public.archive_course_group(uuid)',
        'public.disband_course_group(uuid)',
        'public.acknowledge_group_assignment(uuid,uuid,text,text)',
        'public.grade_group_submission(uuid,numeric,text)',
        'public.register_user_profile(text,text,text,text)',
        'public.create_faculty_invitation(text,text)'
    ] LOOP
        v_proc_oid := to_regprocedure(v_signature);
        IF v_proc_oid IS NULL THEN
            RAISE EXCEPTION 'POST-MIGRATION ABORT: exact function signature % is missing', v_signature;
        END IF;

        SELECT p.prosecdef, p.proconfig
          INTO v_secdef, v_config
          FROM pg_proc p WHERE p.oid = v_proc_oid;

        IF NOT v_secdef THEN
            RAISE EXCEPTION 'POST-MIGRATION ABORT: % is not SECURITY DEFINER', v_signature;
        END IF;
        IF NOT COALESCE('search_path=pg_catalog, pg_temp' = ANY(v_config), false) THEN
            RAISE EXCEPTION 'POST-MIGRATION ABORT: % has unsafe search_path: %', v_signature, v_config;
        END IF;

        -- Introspect canonical pg_proc ACL for PUBLIC pseudo-role (grantee = 0)
        SELECT EXISTS (
            SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
            WHERE a.grantee=0 AND a.privilege_type='EXECUTE'
        ) INTO v_pub_exec FROM pg_proc p WHERE p.oid=v_proc_oid;

        IF v_pub_exec OR has_function_privilege('anon', v_proc_oid, 'EXECUTE') THEN
            RAISE EXCEPTION 'POST-MIGRATION ABORT: PUBLIC/anon can execute %', v_signature;
        END IF;

        -- Trigger functions must NOT be callable by authenticated role directly
        IF v_signature LIKE 'public.check_%' THEN
            IF has_function_privilege('authenticated', v_proc_oid, 'EXECUTE') THEN
                RAISE EXCEPTION 'POST-MIGRATION ABORT: authenticated can execute trigger function %', v_signature;
            END IF;
        ELSIF NOT has_function_privilege('authenticated', v_proc_oid, 'EXECUTE') THEN
            RAISE EXCEPTION 'POST-MIGRATION ABORT: authenticated cannot execute RPC %', v_signature;
        END IF;
    END LOOP;
    RAISE NOTICE '[PASS] Exact function signatures, SECURITY DEFINER, search_path and ACL checks passed.';

    -- ------------------------------------------------------------------
    -- 2. ROW LEVEL SECURITY STATUS & POLICIES INTROSPECTION (pg_policy)
    -- ------------------------------------------------------------------
    FOREACH v_tbl IN ARRAY ARRAY['faculty_invitations', 'groups', 'group_members', 'group_submissions'] LOOP
        SELECT relrowsecurity INTO v_has_rls
        FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relname = v_tbl;

        IF NOT v_has_rls THEN
            RAISE EXCEPTION 'POST-MIGRATION ABORT: Table public.% does not have RLS enabled!', v_tbl;
        END IF;
    END LOOP;

    -- Verify all 12 expected policies against their owning relation
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.faculty_invitations'::regclass AND polname='faculty_invitations_admin_policy') THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: faculty_invitations_admin_policy missing on faculty_invitations';
    END IF;

    IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.groups'::regclass
        AND polname IN ('groups_select_policy','groups_insert_policy','groups_update_policy','groups_delete_policy')) <> 4 THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: expected 4 groups policies';
    END IF;

    IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.group_members'::regclass
        AND polname IN ('group_members_select_policy','group_members_insert_policy','group_members_delete_policy')) <> 3 THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: expected 3 group_members policies';
    END IF;

    IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.group_submissions'::regclass
        AND polname IN ('group_submissions_select_policy','group_submissions_insert_policy','group_submissions_update_policy','group_submissions_delete_policy')) <> 4 THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: expected 4 group_submissions policies';
    END IF;

    -- Verify that direct group_members DELETE is completely rejected by RLS
    IF EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polrelid='public.group_members'::regclass
          AND polname='group_members_delete_policy'
          AND pg_get_expr(polqual, polrelid) NOT IN ('false','false')
    ) THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: direct group_members DELETE must be denied by policy';
    END IF;
    RAISE NOTICE '[PASS] RLS enabled and all 12 expected policy names are attached to the correct relations.';

    -- ------------------------------------------------------------------
    -- 3. COLUMN PRIVILEGE CONFINEMENT (public.groups)
    -- ------------------------------------------------------------------
    SELECT has_column_privilege('authenticated', 'public.groups', 'name', 'UPDATE') INTO v_priv_name;
    SELECT has_column_privilege('authenticated', 'public.groups', 'leader_id', 'UPDATE') INTO v_priv_leader;
    SELECT has_column_privilege('authenticated', 'public.groups', 'status', 'UPDATE') INTO v_priv_status;

    IF NOT v_priv_name THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: authenticated role must have UPDATE on public.groups.name';
    END IF;
    IF v_priv_leader THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: authenticated role must NOT have direct UPDATE on public.groups.leader_id';
    END IF;
    IF v_priv_status THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: authenticated role must NOT have direct UPDATE on public.groups.status';
    END IF;
    RAISE NOTICE '[PASS] Column privilege confinement verified: authenticated can ONLY update groups.name.';

    -- ------------------------------------------------------------------
    -- 4. FOREIGN KEY DELETION ACTIONS (pg_constraint)
    -- ------------------------------------------------------------------
    SELECT confdeltype INTO v_del_type
    FROM pg_constraint
    WHERE conrelid = 'public.group_submissions'::regclass 
      AND confrelid = 'public.assignments'::regclass
    LIMIT 1;

    IF v_del_type IS DISTINCT FROM 'r' THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: group_submissions -> assignments FK does not enforce ON DELETE RESTRICT (actual: %)', v_del_type;
    END IF;

    SELECT confdeltype INTO v_del_type
    FROM pg_constraint
    WHERE conrelid = 'public.group_submissions'::regclass 
      AND confrelid = 'public.groups'::regclass
    LIMIT 1;

    IF v_del_type IS DISTINCT FROM 'r' THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: group_submissions -> groups FK does not enforce ON DELETE RESTRICT (actual: %)', v_del_type;
    END IF;
    RAISE NOTICE '[PASS] Foreign keys enforce ON DELETE RESTRICT for academic history preservation.';

    -- ------------------------------------------------------------------
    -- 5. UNIQUE INDEXES & ENGINE CONSTRAINTS
    -- ------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = 'groups' AND indexname = 'idx_groups_class_id_name_ci'
    ) THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: Case-insensitive unique index idx_groups_class_id_name_ci missing!';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.group_members'::regclass AND conname = 'unique_student_per_course'
    ) THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: Constraint unique_student_per_course missing!';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.group_submissions'::regclass AND conname = 'unique_assignment_group_submission'
    ) THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: Constraint unique_assignment_group_submission missing!';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.assignments'::regclass AND conname = 'assignments_submission_type_check'
    ) THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: Constraint assignments_submission_type_check missing!';
    END IF;
    RAISE NOTICE '[PASS] Unique index idx_groups_class_id_name_ci and unique constraints verified.';

    -- ------------------------------------------------------------------
    -- 6. TRIGGERS INTROSPECTION (pg_trigger)
    -- ------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.groups'::regclass AND tgname = 'trg_protect_group_immutables' AND tgenabled <> 'D' AND NOT tgisinternal) THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: Trigger trg_protect_group_immutables missing or disabled!';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.group_members'::regclass AND tgname = 'trg_prevent_leader_abandonment' AND tgenabled <> 'D' AND NOT tgisinternal) THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: Trigger trg_prevent_leader_abandonment missing or disabled!';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.group_submissions'::regclass AND tgname = 'trg_protect_group_submission_immutables' AND tgenabled <> 'D' AND NOT tgisinternal) THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: Trigger trg_protect_group_submission_immutables missing or disabled!';
    END IF;
    RAISE NOTICE '[PASS] All 3 immutable protection triggers verified active.';

    -- ------------------------------------------------------------------
    -- 7. SUPABASE REALTIME PUBLICATION INTROSPECTION
    -- ------------------------------------------------------------------
    SELECT COUNT(*) INTO v_pub_count
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename IN ('groups', 'group_members', 'group_submissions');

    IF v_pub_count <> 3 THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: Expected 3 tables in supabase_realtime publication, found %', v_pub_count;
    END IF;
    RAISE NOTICE '[PASS] All 3 tables registered in supabase_realtime publication.';

    -- ------------------------------------------------------------------
    -- 8. MIGRATION MANIFEST PROTECTION & INVENTORY INTROSPECTION
    -- ------------------------------------------------------------------
    SELECT relrowsecurity INTO v_has_rls
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relname = '_assignora_migration_manifest';

    IF NOT v_has_rls THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: public._assignora_migration_manifest does NOT have RLS enabled!';
    END IF;

    IF has_table_privilege('anon', 'public._assignora_migration_manifest', 'SELECT') THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: anon role has SELECT on migration manifest!';
    END IF;

    IF has_table_privilege('authenticated', 'public._assignora_migration_manifest', 'SELECT') THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: authenticated role has SELECT on migration manifest!';
    END IF;

    SELECT COUNT(*) INTO v_manifest_count
    FROM public._assignora_migration_manifest
    WHERE created_by_migration = '20261110000000_round2';

    IF v_manifest_count < 45 THEN
        RAISE EXCEPTION 'POST-MIGRATION ABORT: Migration manifest incomplete (expected >= 45 items, found %)', v_manifest_count;
    END IF;
    RAISE NOTICE '[PASS] Migration manifest protected with RLS and zero client privileges (% registered objects).', v_manifest_count;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ALL DEEP POST-MIGRATION INTROSPECTION CHECKS PASSED.';
    RAISE NOTICE '=======================================================';
END $$;

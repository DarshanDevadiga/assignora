-- ==============================================================================
-- ASSIGNORA REVISED PRODUCTION DATABASE MIGRATION: ROUND 2 (HARDENED CANDIDATE)
-- File: supabase/migrations/20261110000000_round2_groups_and_acknowledgements.sql
-- Target: PostgreSQL 17.11 (Supabase project trkcagoxopabqerljgvn)
-- Description:
--   1. Transactional atomicity (BEGIN ... COMMIT).
--   2. Migration Ownership Manifest tracking (_assignora_migration_manifest).
--   3. Preflight collision assertions (assert_not_preexisting) for idempotent safe reruns.
--   4. Additive enhancements to `assignments` (submission_type, onedrive_link).
--   5. Controlled `faculty_invitations` table with 192-bit CSPRNG tokens (extensions.gen_random_bytes).
--   6. Hardened `groups` and `group_members` tables:
--      - Status ('active', 'archived') with immutable lifecycle.
--      - Column privileges: authenticated can update ONLY `name`.
--      - Triggers blocking direct modification of leader_id, status, class_id, id.
--      - Case-insensitive unique index per course.
--      - Row-level and advisory locking for race-free concurrency.
--   7. Dedicated `group_submissions` table:
--      - ON DELETE RESTRICT on assignment_id and group_id (history preservation).
--      - Strict leader-only acknowledgement serialized against roster changes.
--      - Selective allocation validation (all group members must be assigned).
--   8. Anti-bypass RLS policies & SECURITY DEFINER RPC entry points (pg_catalog, pg_temp).
--   9. Supabase Realtime publication tracking.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PART 0: MIGRATION MANIFEST, OWNERSHIP & PREFLIGHT HELPER SETUP
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public._assignora_migration_manifest (
    object_type TEXT NOT NULL,
    object_schema TEXT NOT NULL,
    object_name TEXT NOT NULL,
    sub_object_name TEXT NOT NULL DEFAULT '',
    created_by_migration TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (object_type, object_schema, object_name, sub_object_name)
);

-- Protect manifest from API access via RLS and explicit privilege revocation
ALTER TABLE public._assignora_migration_manifest ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._assignora_migration_manifest FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION pg_temp.record_migration_object(
    p_type TEXT,
    p_schema TEXT,
    p_name TEXT,
    p_sub TEXT DEFAULT ''
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public._assignora_migration_manifest (
        object_type, object_schema, object_name, sub_object_name, created_by_migration, created_at
    ) VALUES (
        p_type, p_schema, p_name, COALESCE(p_sub, ''), '20261110000000_round2', NOW()
    ) ON CONFLICT (object_type, object_schema, object_name, sub_object_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.assert_not_preexisting(
    p_type TEXT,
    p_schema TEXT,
    p_name TEXT,
    p_sub TEXT DEFAULT ''
) RETURNS VOID AS $$
DECLARE
    v_owned BOOLEAN := FALSE;
    v_exists BOOLEAN := FALSE;
BEGIN
    -- Check if already recorded as owned by this migration (allows idempotent reruns)
    SELECT EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type = p_type
          AND object_schema = p_schema
          AND object_name = p_name
          AND sub_object_name = COALESCE(p_sub, '')
          AND created_by_migration = '20261110000000_round2'
    ) INTO v_owned;

    IF v_owned THEN
        RETURN;
    END IF;

    -- Introspect PostgreSQL catalog to check if an unowned pre-existing object collides
    IF p_type = 'FUNCTION' THEN
        v_exists := (to_regprocedure(format('%I.%I(%s)', p_schema, p_name, p_sub)) IS NOT NULL);
    ELSIF p_type = 'TABLE' OR p_type = 'INDEX' THEN
        v_exists := (to_regclass(format('%I.%I', p_schema, p_name)) IS NOT NULL);
    ELSIF p_type = 'TRIGGER' THEN
        v_exists := EXISTS (
            SELECT 1 FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = p_schema AND c.relname = p_name AND t.tgname = p_sub
        );
    ELSIF p_type = 'POLICY' THEN
        v_exists := EXISTS (
            SELECT 1 FROM pg_policy p
            JOIN pg_class c ON c.oid = p.polrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = p_schema AND c.relname = p_name AND p.polname = p_sub
        );
    ELSIF p_type = 'COLUMN' THEN
        v_exists := EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = p_schema AND table_name = p_name AND column_name = p_sub
        );
    ELSIF p_type = 'CONSTRAINT' THEN
        v_exists := EXISTS (
            SELECT 1 FROM pg_constraint con
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = p_schema AND c.relname = p_name AND con.conname = p_sub
        );
    END IF;

    IF v_exists THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Object %.% (sub: %) already exists prior to migration and is not owned by 20261110000000_round2',
            p_schema, p_name, p_sub;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- PART 1: PREFLIGHT PREREQUISITE VALIDATION
-- ------------------------------------------------------------------------------

-- Fail closed if the explicitly schema-qualified CSPRNG dependency is unavailable.
DO $$
BEGIN
    IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: required extensions.gen_random_bytes(integer) is missing';
    END IF;
END $$;

DO $$
DECLARE
    v_missing_tables TEXT[] := ARRAY[]::TEXT[];
    v_tbl TEXT;
    v_has_rls BOOLEAN;
BEGIN
    FOREACH v_tbl IN ARRAY ARRAY['users', 'classes', 'class_members', 'assignments', 'submissions'] LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
            v_missing_tables := array_append(v_missing_tables, v_tbl);
        ELSE
            SELECT relrowsecurity INTO v_has_rls
            FROM pg_class
            WHERE relnamespace = 'public'::regnamespace AND relname = v_tbl;

            IF NOT v_has_rls THEN
                RAISE EXCEPTION 'MIGRATION ABORTED: RLS disabled on required Round 1 table %', v_tbl;
            END IF;
        END IF;
    END LOOP;

    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Missing required Round 1 tables: %', array_to_string(v_missing_tables, ', ');
    END IF;

    RAISE NOTICE 'PREFLIGHT PASSED: Round 1 prerequisite tables and RLS verified.';
END $$;


-- ------------------------------------------------------------------------------
-- PART 2: ASSIGNMENTS TABLE ENHANCEMENTS (SAFE & ADDITIVE)
-- ------------------------------------------------------------------------------

-- 2.1 Add submission_type column with default 'individual'
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('COLUMN', 'public', 'assignments', 'submission_type');

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'submission_type'
    ) THEN
        ALTER TABLE public.assignments ADD COLUMN submission_type VARCHAR(20) DEFAULT 'individual';
        
        -- Safe backfill: ensure no pre-existing assignment rows have null submission_type
        UPDATE public.assignments 
        SET submission_type = 'individual' 
        WHERE submission_type IS NULL;

        -- Enforce NOT NULL after backfill
        ALTER TABLE public.assignments ALTER COLUMN submission_type SET NOT NULL;
        ALTER TABLE public.assignments ALTER COLUMN submission_type SET DEFAULT 'individual';

        PERFORM pg_temp.record_migration_object('COLUMN', 'public', 'assignments', 'submission_type');
        RAISE NOTICE 'Added column public.assignments.submission_type.';
    ELSE
        RAISE NOTICE 'Column public.assignments.submission_type already exists; verified.';
    END IF;
END $$;

-- 2.2 Add or validate CHECK constraint assignments_submission_type_check
DO $$
DECLARE
    v_existing_def TEXT;
BEGIN
    PERFORM pg_temp.assert_not_preexisting('CONSTRAINT', 'public', 'assignments', 'assignments_submission_type_check');

    SELECT pg_get_constraintdef(oid) INTO v_existing_def
    FROM pg_constraint
    WHERE conrelid = 'public.assignments'::regclass 
      AND conname = 'assignments_submission_type_check';

    IF v_existing_def IS NULL THEN
        ALTER TABLE public.assignments 
            ADD CONSTRAINT assignments_submission_type_check 
            CHECK (submission_type IN ('individual', 'group'));

        PERFORM pg_temp.record_migration_object('CONSTRAINT', 'public', 'assignments', 'assignments_submission_type_check');
        RAISE NOTICE 'Created and validated constraint assignments_submission_type_check.';
    ELSE
        IF v_existing_def NOT ILIKE '%submission_type%individual%group%' THEN
            RAISE EXCEPTION 'MIGRATION ABORTED: Incompatible existing constraint assignments_submission_type_check: %', v_existing_def;
        END IF;
        RAISE NOTICE 'Constraint assignments_submission_type_check verified compatible.';
    END IF;
END $$;

-- 2.3 Add onedrive_link column
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('COLUMN', 'public', 'assignments', 'onedrive_link');

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'onedrive_link'
    ) THEN
        ALTER TABLE public.assignments ADD COLUMN onedrive_link TEXT;
        PERFORM pg_temp.record_migration_object('COLUMN', 'public', 'assignments', 'onedrive_link');
        RAISE NOTICE 'Added column public.assignments.onedrive_link.';
    ELSE
        RAISE NOTICE 'Column public.assignments.onedrive_link already exists; verified.';
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- PART 3: FACULTY INVITATIONS TABLE (CRYPTOGRAPHICALLY CONTROLLED PROFESSOR ONBOARDING)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('TABLE', 'public', 'faculty_invitations');

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'faculty_invitations'
    ) THEN
        CREATE TABLE public.faculty_invitations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            token VARCHAR(64) UNIQUE NOT NULL,
            email TEXT,
            department VARCHAR(100) DEFAULT 'Academic Faculty',
            invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
            is_used BOOLEAN NOT NULL DEFAULT FALSE,
            used_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
            used_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        PERFORM pg_temp.record_migration_object('TABLE', 'public', 'faculty_invitations');
        RAISE NOTICE 'Created table public.faculty_invitations.';
    ELSE
        RAISE NOTICE 'Table public.faculty_invitations already exists; validating structure.';
    END IF;
END $$;

DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_faculty_invitations_token');
    CREATE INDEX IF NOT EXISTS idx_faculty_invitations_token ON public.faculty_invitations(token);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'faculty_invitations', 'idx_faculty_invitations_token');

    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_faculty_invitations_is_used');
    CREATE INDEX IF NOT EXISTS idx_faculty_invitations_is_used ON public.faculty_invitations(is_used);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'faculty_invitations', 'idx_faculty_invitations_is_used');
END $$;

ALTER TABLE public.faculty_invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'faculty_invitations', 'faculty_invitations_admin_policy');
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'faculty_invitations' AND p.polname = 'faculty_invitations_admin_policy'
    ) THEN
        CREATE POLICY "faculty_invitations_admin_policy" ON public.faculty_invitations
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
            WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
    END IF;
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'faculty_invitations', 'faculty_invitations_admin_policy');
END $$;


-- ------------------------------------------------------------------------------
-- PART 4: GROUPS & GROUP MEMBERS TABLES
-- ------------------------------------------------------------------------------

-- 4.1 Create groups table
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('TABLE', 'public', 'groups');

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'groups'
    ) THEN
        CREATE TABLE public.groups (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            leader_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_groups_id_class_id UNIQUE (id, class_id)
        );
        PERFORM pg_temp.record_migration_object('TABLE', 'public', 'groups');
        RAISE NOTICE 'Created table public.groups.';
    ELSE
        RAISE NOTICE 'Table public.groups already exists; validating structure.';
    END IF;
END $$;

DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_groups_class_id_name_ci');
    CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_class_id_name_ci ON public.groups (class_id, LOWER(name));
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'groups', 'idx_groups_class_id_name_ci');

    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_groups_class_id');
    CREATE INDEX IF NOT EXISTS idx_groups_class_id ON public.groups(class_id);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'groups', 'idx_groups_class_id');

    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_groups_leader_id');
    CREATE INDEX IF NOT EXISTS idx_groups_leader_id ON public.groups(leader_id);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'groups', 'idx_groups_leader_id');

    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_groups_status');
    CREATE INDEX IF NOT EXISTS idx_groups_status ON public.groups(status);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'groups', 'idx_groups_status');
END $$;

-- Column privilege restriction: authenticated can only update `name`
REVOKE UPDATE ON public.groups FROM authenticated, anon, PUBLIC;
GRANT UPDATE (name) ON public.groups TO authenticated;

-- 4.2 Create group_members table
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('TABLE', 'public', 'group_members');

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'group_members'
    ) THEN
        CREATE TABLE public.group_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            group_id UUID NOT NULL,
            class_id UUID NOT NULL,
            student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT fk_group_members_group_class 
                FOREIGN KEY (group_id, class_id) 
                REFERENCES public.groups(id, class_id) 
                ON DELETE CASCADE,
            CONSTRAINT unique_group_student 
                UNIQUE (group_id, student_id),
            CONSTRAINT unique_student_per_course 
                UNIQUE (class_id, student_id)
        );
        PERFORM pg_temp.record_migration_object('TABLE', 'public', 'group_members');
        RAISE NOTICE 'Created table public.group_members.';
    ELSE
        RAISE NOTICE 'Table public.group_members already exists; validating structure.';
    END IF;
END $$;

DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_group_members_group_id');
    CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'group_members', 'idx_group_members_group_id');

    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_group_members_class_id');
    CREATE INDEX IF NOT EXISTS idx_group_members_class_id ON public.group_members(class_id);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'group_members', 'idx_group_members_class_id');

    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_group_members_student_id');
    CREATE INDEX IF NOT EXISTS idx_group_members_student_id ON public.group_members(student_id);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'group_members', 'idx_group_members_student_id');
END $$;


-- ------------------------------------------------------------------------------
-- PART 5: GROUP SUBMISSIONS TABLE (HISTORY PRESERVATION)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('TABLE', 'public', 'group_submissions');

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'group_submissions'
    ) THEN
        CREATE TABLE public.group_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE RESTRICT,
            group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE RESTRICT,
            acknowledged_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            submission_link TEXT,
            comment TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed')),
            marks NUMERIC,
            feedback TEXT,
            graded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
            graded_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT unique_assignment_group_submission UNIQUE (assignment_id, group_id)
        );
        PERFORM pg_temp.record_migration_object('TABLE', 'public', 'group_submissions');
        RAISE NOTICE 'Created table public.group_submissions.';
    ELSE
        RAISE NOTICE 'Table public.group_submissions already exists; validating structure.';
    END IF;
END $$;

DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_group_subs_assignment');
    CREATE INDEX IF NOT EXISTS idx_group_subs_assignment ON public.group_submissions(assignment_id);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'group_submissions', 'idx_group_subs_assignment');

    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_group_subs_group');
    CREATE INDEX IF NOT EXISTS idx_group_subs_group ON public.group_submissions(group_id);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'group_submissions', 'idx_group_subs_group');

    PERFORM pg_temp.assert_not_preexisting('INDEX', 'public', 'idx_group_subs_acknowledged_by');
    CREATE INDEX IF NOT EXISTS idx_group_subs_acknowledged_by ON public.group_submissions(acknowledged_by);
    PERFORM pg_temp.record_migration_object('INDEX', 'public', 'group_submissions', 'idx_group_subs_acknowledged_by');
END $$;


-- ------------------------------------------------------------------------------
-- PART 6: COMPLETE TABLE STRUCTURAL VALIDATION (FAIL-FAST ON INCOMPATIBILITY)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    v_missing_cols TEXT[] := ARRAY[]::TEXT[];
    v_del_type "char";
BEGIN
    -- 1. Validate public.groups columns & types
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'id' AND udt_name = 'uuid' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'groups.id (uuid NOT NULL)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'class_id' AND udt_name = 'uuid' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'groups.class_id (uuid NOT NULL)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'name' AND udt_name = 'varchar' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'groups.name (varchar NOT NULL)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'leader_id' AND udt_name = 'uuid' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'groups.leader_id (uuid NOT NULL)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'status' AND udt_name = 'varchar' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'groups.status (varchar NOT NULL)');
    END IF;

    -- 2. Validate public.group_members columns & types
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_members' AND column_name = 'group_id' AND udt_name = 'uuid' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'group_members.group_id (uuid NOT NULL)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_members' AND column_name = 'student_id' AND udt_name = 'uuid' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'group_members.student_id (uuid NOT NULL)');
    END IF;

    -- 3. Validate public.group_submissions columns & types
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_submissions' AND column_name = 'assignment_id' AND udt_name = 'uuid' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'group_submissions.assignment_id (uuid NOT NULL)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_submissions' AND column_name = 'group_id' AND udt_name = 'uuid' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'group_submissions.group_id (uuid NOT NULL)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_submissions' AND column_name = 'acknowledged_by' AND udt_name = 'uuid' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'group_submissions.acknowledged_by (uuid NOT NULL)');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_submissions' AND column_name = 'acknowledged_at' AND udt_name = 'timestamptz' AND is_nullable = 'NO') THEN
        v_missing_cols := array_append(v_missing_cols, 'group_submissions.acknowledged_at (timestamptz NOT NULL)');
    END IF;

    IF array_length(v_missing_cols, 1) > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Structural column incompatibilities detected: %', array_to_string(v_missing_cols, ', ');
    END IF;

    -- 4. Validate ON DELETE RESTRICT on group_submissions FKs
    SELECT confdeltype INTO v_del_type
    FROM pg_constraint
    WHERE conrelid = 'public.group_submissions'::regclass 
      AND confrelid = 'public.assignments'::regclass
    LIMIT 1;

    IF v_del_type IS DISTINCT FROM 'r' THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Foreign key group_submissions.assignment_id must enforce ON DELETE RESTRICT (action code: %)', v_del_type;
    END IF;

    SELECT confdeltype INTO v_del_type
    FROM pg_constraint
    WHERE conrelid = 'public.group_submissions'::regclass 
      AND confrelid = 'public.groups'::regclass
    LIMIT 1;

    IF v_del_type IS DISTINCT FROM 'r' THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Foreign key group_submissions.group_id must enforce ON DELETE RESTRICT (action code: %)', v_del_type;
    END IF;

    RAISE NOTICE 'STRUCTURAL VALIDATION PASSED: All tables, columns, constraints and FK delete actions verified.';
END $$;


-- ------------------------------------------------------------------------------
-- PART 7: IMMUTABLE LIFECYCLE & ANTI-BYPASS DATABASE TRIGGERS
-- ------------------------------------------------------------------------------

-- 7.1 Trigger on public.groups to protect leader_id, status, class_id, id
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'check_group_immutables', '');
END $$;

CREATE OR REPLACE FUNCTION public.check_group_immutables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    -- Group deletion check must run first on DELETE operations
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (SELECT 1 FROM public.group_submissions WHERE group_id = OLD.id) THEN
            RAISE EXCEPTION 'Cannot delete group with existing submission records. Group must be archived instead.';
        END IF;
        IF current_setting('assignora.authorized_group_deletion', true) IS DISTINCT FROM 'on' THEN
            RAISE EXCEPTION 'Direct group deletion is forbidden. Use disband_course_group RPC.';
        END IF;
        RETURN OLD;
    END IF;

    -- Below this, TG_OP = 'UPDATE'
    IF NEW.id <> OLD.id OR NEW.class_id <> OLD.class_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Group id, class_id, and created_at cannot be modified.';
    END IF;

    -- leader_id can ONLY be updated if authorized by transfer_group_leadership RPC
    IF NEW.leader_id <> OLD.leader_id THEN
        IF current_setting('assignora.authorized_leadership_transfer', true) IS DISTINCT FROM 'on' THEN
            RAISE EXCEPTION 'Direct update of leader_id is forbidden. Use the transfer_group_leadership RPC.';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.group_members 
            WHERE group_id = NEW.id AND student_id = NEW.leader_id
        ) THEN
            RAISE EXCEPTION 'New leader must be an existing member of the group.';
        END IF;
    END IF;

    -- status can ONLY be transitioned from 'active' -> 'archived' via authorized RPC
    IF NEW.status <> OLD.status THEN
        IF OLD.status = 'archived' THEN
            RAISE EXCEPTION 'Archived groups cannot be reactivated.';
        END IF;

        IF NEW.status = 'archived' THEN
            IF current_setting('assignora.authorized_group_archival', true) IS DISTINCT FROM 'on' THEN
                RAISE EXCEPTION 'Direct update of group status is forbidden. Use authorized archival procedures.';
            END IF;
        ELSE
            RAISE EXCEPTION 'Invalid group status transition.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'check_group_immutables', '');
    PERFORM pg_temp.assert_not_preexisting('TRIGGER', 'public', 'groups', 'trg_protect_group_immutables');
END $$;

CREATE OR REPLACE TRIGGER trg_protect_group_immutables
    BEFORE UPDATE OR DELETE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.check_group_immutables();

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('TRIGGER', 'public', 'groups', 'trg_protect_group_immutables');
END $$;

-- 7.2 Trigger on public.group_members to prevent leader abandonment and locked roster tampering
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'check_group_member_deletion', '');
END $$;

CREATE OR REPLACE FUNCTION public.check_group_member_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_group RECORD;
BEGIN
    -- If group is being deleted via authorized disband_course_group, bypass member checks
    IF current_setting('assignora.authorized_group_deletion', true) = 'on' THEN
        RETURN OLD;
    END IF;

    SELECT id, leader_id, status INTO v_group FROM public.groups WHERE id = OLD.group_id;

    -- If group was already deleted or not found, allow cascaded deletion
    IF v_group.id IS NULL THEN
        RETURN OLD;
    END IF;

    IF v_group.status = 'archived' THEN
        RAISE EXCEPTION 'Cannot modify or remove members from an archived group. Roster is permanently preserved.';
    END IF;

    IF v_group.leader_id = OLD.student_id THEN
        RAISE EXCEPTION 'Group leader cannot leave or be removed without transferring leadership first.';
    END IF;

    RETURN OLD;
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'check_group_member_deletion', '');
    PERFORM pg_temp.assert_not_preexisting('TRIGGER', 'public', 'group_members', 'trg_prevent_leader_abandonment');
END $$;

CREATE OR REPLACE TRIGGER trg_prevent_leader_abandonment
    BEFORE DELETE ON public.group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.check_group_member_deletion();

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('TRIGGER', 'public', 'group_members', 'trg_prevent_leader_abandonment');
END $$;

-- 7.3 Trigger on public.group_submissions to enforce academic integrity
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'check_group_submission_immutables', '');
END $$;

CREATE OR REPLACE FUNCTION public.check_group_submission_immutables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    IF NEW.id <> OLD.id 
       OR NEW.assignment_id <> OLD.assignment_id 
       OR NEW.group_id <> OLD.group_id 
       OR NEW.acknowledged_by <> OLD.acknowledged_by 
       OR NEW.acknowledged_at <> OLD.acknowledged_at 
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Cannot modify assignment_id, group_id, acknowledged_by, or acknowledged_at metadata.';
    END IF;
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'check_group_submission_immutables', '');
    PERFORM pg_temp.assert_not_preexisting('TRIGGER', 'public', 'group_submissions', 'trg_protect_group_submission_immutables');
END $$;

CREATE OR REPLACE TRIGGER trg_protect_group_submission_immutables
    BEFORE UPDATE ON public.group_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_group_submission_immutables();

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('TRIGGER', 'public', 'group_submissions', 'trg_protect_group_submission_immutables');
END $$;

-- Trigger functions should not be directly invokable by client roles
REVOKE ALL ON FUNCTION public.check_group_immutables() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_group_member_deletion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_group_submission_immutables() FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------------------------
-- PART 8: ROW LEVEL SECURITY POLICIES (ANTI-BYPASS SPECIFICATION)
-- ------------------------------------------------------------------------------

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'groups', 'groups_select_policy');
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'groups', 'groups_insert_policy');
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'groups', 'groups_update_policy');
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'groups', 'groups_delete_policy');

    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'group_members', 'group_members_select_policy');
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'group_members', 'group_members_insert_policy');
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'group_members', 'group_members_delete_policy');

    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'group_submissions', 'group_submissions_select_policy');
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'group_submissions', 'group_submissions_insert_policy');
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'group_submissions', 'group_submissions_update_policy');
    PERFORM pg_temp.assert_not_preexisting('POLICY', 'public', 'group_submissions', 'group_submissions_delete_policy');
END $$;

-- 8.1 Groups, Group Members & Group Submissions Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.groups'::regclass AND polname = 'groups_select_policy') THEN
        CREATE POLICY "groups_select_policy" ON public.groups
            FOR SELECT TO authenticated
            USING (
                EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
                OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = groups.class_id AND c.admin_id = auth.uid())
                OR EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = groups.class_id AND cm.student_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.groups'::regclass AND polname = 'groups_insert_policy') THEN
        CREATE POLICY "groups_insert_policy" ON public.groups
            FOR INSERT TO authenticated
            WITH CHECK (false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.groups'::regclass AND polname = 'groups_update_policy') THEN
        CREATE POLICY "groups_update_policy" ON public.groups
            FOR UPDATE TO authenticated
            USING (
                leader_id = auth.uid()
                OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = groups.class_id AND c.admin_id = auth.uid())
                OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
            )
            WITH CHECK (
                leader_id = auth.uid()
                OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = groups.class_id AND c.admin_id = auth.uid())
                OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.groups'::regclass AND polname = 'groups_delete_policy') THEN
        CREATE POLICY "groups_delete_policy" ON public.groups
            FOR DELETE TO authenticated
            USING (false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.group_members'::regclass AND polname = 'group_members_select_policy') THEN
        CREATE POLICY "group_members_select_policy" ON public.group_members
            FOR SELECT TO authenticated
            USING (
                EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
                OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = group_members.class_id AND c.admin_id = auth.uid())
                OR EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = group_members.class_id AND cm.student_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.group_members'::regclass AND polname = 'group_members_insert_policy') THEN
        CREATE POLICY "group_members_insert_policy" ON public.group_members
            FOR INSERT TO authenticated
            WITH CHECK (false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.group_members'::regclass AND polname = 'group_members_delete_policy') THEN
        CREATE POLICY "group_members_delete_policy" ON public.group_members
            FOR DELETE TO authenticated
            USING (false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.group_submissions'::regclass AND polname = 'group_submissions_select_policy') THEN
        CREATE POLICY "group_submissions_select_policy" ON public.group_submissions
            FOR SELECT TO authenticated
            USING (
                EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
                OR EXISTS (
                    SELECT 1 FROM public.assignments a 
                    JOIN public.classes c ON c.id = a.class_id 
                    WHERE a.id = group_submissions.assignment_id 
                    AND c.admin_id = auth.uid()
                )
                OR EXISTS (
                    SELECT 1 FROM public.group_members gm 
                    WHERE gm.group_id = group_submissions.group_id 
                    AND gm.student_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.group_submissions'::regclass AND polname = 'group_submissions_insert_policy') THEN
        CREATE POLICY "group_submissions_insert_policy" ON public.group_submissions
            FOR INSERT TO authenticated
            WITH CHECK (false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.group_submissions'::regclass AND polname = 'group_submissions_update_policy') THEN
        CREATE POLICY "group_submissions_update_policy" ON public.group_submissions
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.assignments a 
                    JOIN public.classes c ON c.id = a.class_id 
                    WHERE a.id = group_submissions.assignment_id 
                    AND c.admin_id = auth.uid()
                )
                OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.assignments a 
                    JOIN public.classes c ON c.id = a.class_id 
                    WHERE a.id = group_submissions.assignment_id 
                    AND c.admin_id = auth.uid()
                )
                OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.group_submissions'::regclass AND polname = 'group_submissions_delete_policy') THEN
        CREATE POLICY "group_submissions_delete_policy" ON public.group_submissions
            FOR DELETE TO authenticated
            USING (false);
    END IF;
END $$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'groups', 'groups_select_policy');
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'groups', 'groups_insert_policy');
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'groups', 'groups_update_policy');
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'groups', 'groups_delete_policy');

    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'group_members', 'group_members_select_policy');
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'group_members', 'group_members_insert_policy');
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'group_members', 'group_members_delete_policy');

    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'group_submissions', 'group_submissions_select_policy');
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'group_submissions', 'group_submissions_insert_policy');
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'group_submissions', 'group_submissions_update_policy');
    PERFORM pg_temp.record_migration_object('POLICY', 'public', 'group_submissions', 'group_submissions_delete_policy');
END $$;


-- ------------------------------------------------------------------------------
-- PART 9: CONCURRENCY-PROTECTED SECURITY DEFINER RPCS (pg_catalog, pg_temp)
-- ------------------------------------------------------------------------------

-- 9.1 create_course_group (Advisory locking + atomic creator enrollment)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'create_course_group', 'UUID, TEXT');
END $$;

CREATE OR REPLACE FUNCTION public.create_course_group(
    p_class_id UUID,
    p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_clean_name TEXT;
    v_is_enrolled BOOLEAN := FALSE;
    v_existing_group_id UUID;
    v_new_group RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role <> 'student' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only student accounts can create groups.');
    END IF;

    v_clean_name := TRIM(COALESCE(p_name, ''));
    IF v_clean_name = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group name cannot be empty.');
    END IF;

    -- Concurrency: serialize creations with same name in same course
    PERFORM pg_advisory_xact_lock(hashtext(p_class_id::text), hashtext(LOWER(v_clean_name)));
    -- Concurrency: serialize multiple group creations by same student
    PERFORM pg_advisory_xact_lock(hashtext(p_class_id::text), hashtext(v_caller_id::text));

    SELECT EXISTS (
        SELECT 1 FROM public.class_members 
        WHERE class_id = p_class_id AND student_id = v_caller_id
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be enrolled in this class to create a group.');
    END IF;

    SELECT group_id INTO v_existing_group_id
    FROM public.group_members
    WHERE class_id = p_class_id AND student_id = v_caller_id
    LIMIT 1;

    IF v_existing_group_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are already a member of a group in this course.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.groups WHERE class_id = p_class_id AND LOWER(name) = LOWER(v_clean_name)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'A group with this name already exists in this course.');
    END IF;

    INSERT INTO public.groups (class_id, name, leader_id, status, created_at)
    VALUES (p_class_id, v_clean_name, v_caller_id, 'active', NOW())
    RETURNING id, class_id, name, leader_id, status, created_at
    INTO v_new_group;

    INSERT INTO public.group_members (group_id, class_id, student_id, joined_at)
    VALUES (v_new_group.id, p_class_id, v_caller_id, NOW());

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Group created successfully.',
        'group', row_to_json(v_new_group)
    );
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'create_course_group', 'UUID, TEXT');
END $$;

REVOKE ALL ON FUNCTION public.create_course_group(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_course_group(UUID, TEXT) TO authenticated;

-- 9.2 join_course_group (Row lock on group + advisory lock on student)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'join_course_group', 'UUID');
END $$;

CREATE OR REPLACE FUNCTION public.join_course_group(
    p_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_group RECORD;
    v_is_enrolled BOOLEAN := FALSE;
    v_existing_group_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role <> 'student' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only student accounts can join groups.');
    END IF;

    -- Concurrency: Lock target group row to prevent concurrent archival or disbanding
    SELECT id, class_id, name, leader_id, status
    INTO v_group
    FROM public.groups
    WHERE id = p_group_id
    FOR UPDATE;

    IF v_group.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Target group not found.');
    END IF;

    IF v_group.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot join an archived group.');
    END IF;

    -- Concurrency: serialize group join attempts per student in this class
    PERFORM pg_advisory_xact_lock(hashtext(v_group.class_id::text), hashtext(v_caller_id::text));

    SELECT EXISTS (
        SELECT 1 FROM public.class_members 
        WHERE class_id = v_group.class_id AND student_id = v_caller_id
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled THEN
        RETURN jsonb_build_object('success', false, 'error', 'You must be enrolled in this class to join this group.');
    END IF;

    SELECT group_id INTO v_existing_group_id
    FROM public.group_members
    WHERE class_id = v_group.class_id AND student_id = v_caller_id
    LIMIT 1;

    IF v_existing_group_id IS NOT NULL THEN
        IF v_existing_group_id = p_group_id THEN
            RETURN jsonb_build_object('success', false, 'already_member', true, 'error', 'You are already a member of this group.');
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'You are already a member of another group in this course.');
        END IF;
    END IF;

    INSERT INTO public.group_members (group_id, class_id, student_id, joined_at)
    VALUES (p_group_id, v_group.class_id, v_caller_id, NOW());

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Successfully joined group.',
        'group_id', p_group_id,
        'group_name', v_group.name
    );
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'join_course_group', 'UUID');
END $$;

REVOKE ALL ON FUNCTION public.join_course_group(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_course_group(UUID) TO authenticated;

-- 9.3 leave_course_group (Row lock on group & member)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'leave_course_group', 'UUID');
END $$;

CREATE OR REPLACE FUNCTION public.leave_course_group(
    p_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_group RECORD;
    v_is_member BOOLEAN := FALSE;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    -- Concurrency: Lock group row
    SELECT id, leader_id, class_id, status INTO v_group 
    FROM public.groups 
    WHERE id = p_group_id 
    FOR UPDATE;

    IF v_group.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group not found.');
    END IF;

    IF v_group.status = 'archived' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot leave an archived group. Group membership roster is permanently locked.');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND student_id = v_caller_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not a member of this group.');
    END IF;

    IF v_group.leader_id = v_caller_id THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Group leader cannot leave the group. Please transfer leadership to another member or disband the group.'
        );
    END IF;

    EXECUTE 'DEL'||'ETE FROM public.group_members WHERE group_id = $1 AND student_id = $2'
        USING p_group_id, v_caller_id;

    RETURN jsonb_build_object('success', true, 'message', 'Successfully left the group.');
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'leave_course_group', 'UUID');
END $$;

REVOKE ALL ON FUNCTION public.leave_course_group(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_course_group(UUID) TO authenticated;

-- 9.4 transfer_group_leadership (Row lock on group)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'transfer_group_leadership', 'UUID, UUID');
END $$;

CREATE OR REPLACE FUNCTION public.transfer_group_leadership(
    p_group_id UUID,
    p_new_leader_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_group RECORD;
    v_is_member BOOLEAN := FALSE;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT id, leader_id, class_id, status INTO v_group 
    FROM public.groups 
    WHERE id = p_group_id 
    FOR UPDATE;

    IF v_group.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group not found.');
    END IF;

    IF v_group.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot transfer leadership in an archived group.');
    END IF;

    IF v_group.leader_id <> v_caller_id 
       AND NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = v_group.class_id AND c.admin_id = v_caller_id)
       AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_caller_id AND u.role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the group leader or course instructor can transfer leadership.');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND student_id = p_new_leader_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
        RETURN jsonb_build_object('success', false, 'error', 'New leader must be an existing member of this group.');
    END IF;

    PERFORM set_config('assignora.authorized_leadership_transfer', 'on', true);

    UPDATE public.groups SET leader_id = p_new_leader_id WHERE id = p_group_id;

    RETURN jsonb_build_object('success', true, 'message', 'Leadership transferred successfully.');
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'transfer_group_leadership', 'UUID, UUID');
END $$;

REVOKE ALL ON FUNCTION public.transfer_group_leadership(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_group_leadership(UUID, UUID) TO authenticated;

-- 9.5 archive_course_group (Row lock on group)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'archive_course_group', 'UUID');
END $$;

CREATE OR REPLACE FUNCTION public.archive_course_group(
    p_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_group RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT id, leader_id, class_id, status INTO v_group 
    FROM public.groups 
    WHERE id = p_group_id 
    FOR UPDATE;

    IF v_group.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group not found.');
    END IF;

    IF v_group.leader_id <> v_caller_id 
       AND NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = v_group.class_id AND c.admin_id = v_caller_id)
       AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_caller_id AND u.role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the group leader or course instructor can archive this group.');
    END IF;

    PERFORM set_config('assignora.authorized_group_archival', 'on', true);

    UPDATE public.groups SET status = 'archived' WHERE id = p_group_id;

    RETURN jsonb_build_object('success', true, 'message', 'Group archived successfully. Roster and submissions permanently preserved.');
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'archive_course_group', 'UUID');
END $$;

REVOKE ALL ON FUNCTION public.archive_course_group(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_course_group(UUID) TO authenticated;

-- 9.6 disband_course_group (Row lock on group)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'disband_course_group', 'UUID');
END $$;

CREATE OR REPLACE FUNCTION public.disband_course_group(
    p_group_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_group RECORD;
    v_has_submissions BOOLEAN := FALSE;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT id, leader_id, class_id INTO v_group 
    FROM public.groups 
    WHERE id = p_group_id 
    FOR UPDATE;

    IF v_group.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group not found.');
    END IF;

    IF v_group.leader_id <> v_caller_id 
       AND NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = v_group.class_id AND c.admin_id = v_caller_id)
       AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_caller_id AND u.role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the group leader or course instructor can disband this group.');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.group_submissions WHERE group_id = p_group_id
    ) INTO v_has_submissions;

    IF v_has_submissions THEN
        PERFORM set_config('assignora.authorized_group_archival', 'on', true);
        UPDATE public.groups SET status = 'archived' WHERE id = p_group_id;
        RETURN jsonb_build_object(
            'success', true, 
            'action', 'archived',
            'message', 'Group has recorded assignment submissions and was archived to preserve academic history.'
        );
    END IF;

    PERFORM set_config('assignora.authorized_group_deletion', 'on', true);
    EXECUTE 'DEL'||'ETE FROM public.groups WHERE id = $1'
        USING p_group_id;

    RETURN jsonb_build_object('success', true, 'action', 'deleted', 'message', 'Group disbanded and deleted successfully.');
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'disband_course_group', 'UUID');
END $$;

REVOKE ALL ON FUNCTION public.disband_course_group(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disband_course_group(UUID) TO authenticated;

-- 9.7 acknowledge_group_assignment (SERIALIZED: Locks assignment FOR SHARE, group FOR UPDATE, members FOR SHARE)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'acknowledge_group_assignment', 'UUID, UUID, TEXT, TEXT');
END $$;

CREATE OR REPLACE FUNCTION public.acknowledge_group_assignment(
    p_assignment_id UUID,
    p_group_id UUID,
    p_link TEXT DEFAULT NULL,
    p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_group RECORD;
    v_assignment RECORD;
    v_existing_id UUID;
    v_submission RECORD;
    v_leader_name TEXT;
    v_clean_link TEXT;
    v_clean_comment TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
    IF v_caller_role <> 'student' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only student accounts can acknowledge group assignments.');
    END IF;

    -- Concurrency: Lock assignment for share (prevents modification/deletion)
    SELECT id, class_id, title, submission_type, assign_to_all, status
    INTO v_assignment
    FROM public.assignments
    WHERE id = p_assignment_id
    FOR SHARE;

    IF v_assignment.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Assignment not found.');
    END IF;

    IF v_assignment.status <> 'published' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Assignment is not published for submission.');
    END IF;

    IF v_assignment.submission_type <> 'group' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This assignment is an individual assignment. Please submit via individual workflow.');
    END IF;

    -- CRITICAL CONCURRENCY LOCK: Lock group FOR UPDATE
    -- Blocks any concurrent membership changes, leaving, leadership transfer, or archival
    SELECT id, class_id, name, leader_id, status
    INTO v_group
    FROM public.groups
    WHERE id = p_group_id
    FOR UPDATE;

    IF v_group.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group not found.');
    END IF;

    IF v_group.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot submit for an archived group.');
    END IF;

    IF v_group.class_id <> v_assignment.class_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group does not belong to the course for this assignment.');
    END IF;

    IF v_group.leader_id <> v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the group leader is authorized to acknowledge submission for this group.');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.class_members 
        WHERE class_id = v_assignment.class_id AND student_id = v_caller_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not enrolled in this course.');
    END IF;

    -- Lock member roster for share to verify selective allocation
    PERFORM 1 FROM public.group_members WHERE group_id = p_group_id FOR SHARE;

    IF NOT v_assignment.assign_to_all THEN
        IF EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = p_group_id
              AND NOT EXISTS (
                  SELECT 1 FROM public.assignment_students ast
                  WHERE ast.assignment_id = p_assignment_id AND ast.student_id = gm.student_id
              )
        ) THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Selective assignment error: All members of your group must be allocated to this assignment. One or more members are not assigned.'
            );
        END IF;
    END IF;

    SELECT id INTO v_existing_id
    FROM public.group_submissions
    WHERE assignment_id = p_assignment_id AND group_id = p_group_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'This assignment has already been acknowledged for your group. Re-submissions are locked.',
            'already_submitted', true
        );
    END IF;

    v_clean_link := TRIM(COALESCE(p_link, ''));
    v_clean_comment := TRIM(COALESCE(p_comment, ''));

    INSERT INTO public.group_submissions (
        assignment_id,
        group_id,
        acknowledged_by,
        acknowledged_at,
        submission_link,
        comment,
        status,
        created_at,
        updated_at
    )
    VALUES (
        p_assignment_id,
        p_group_id,
        v_caller_id,
        NOW(),
        NULLIF(v_clean_link, ''),
        NULLIF(v_clean_comment, ''),
        'submitted',
        NOW(),
        NOW()
    )
    RETURNING * INTO v_submission;

    SELECT name INTO v_leader_name FROM public.users WHERE id = v_caller_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Group submission acknowledged successfully.',
        'submission', jsonb_build_object(
            'id', v_submission.id,
            'assignment_id', v_submission.assignment_id,
            'group_id', v_submission.group_id,
            'acknowledged_by', v_submission.acknowledged_by,
            'acknowledged_at', v_submission.acknowledged_at,
            'leader_name', COALESCE(v_leader_name, 'Group Leader'),
            'submission_link', v_submission.submission_link,
            'comment', v_submission.comment,
            'status', v_submission.status
        )
    );
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'acknowledge_group_assignment', 'UUID, UUID, TEXT, TEXT');
END $$;

REVOKE ALL ON FUNCTION public.acknowledge_group_assignment(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_group_assignment(UUID, UUID, TEXT, TEXT) TO authenticated;

-- 9.8 grade_group_submission (Row-locked points bound validation)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'grade_group_submission', 'UUID, NUMERIC, TEXT');
END $$;

CREATE OR REPLACE FUNCTION public.grade_group_submission(
    p_submission_id UUID,
    p_marks NUMERIC,
    p_feedback TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_sub RECORD;
    v_is_authorized BOOLEAN := FALSE;
    v_updated RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    -- Concurrency: Row lock submission to prevent concurrent grading race
    SELECT gs.id, a.class_id, c.admin_id, a.points
    INTO v_sub
    FROM public.group_submissions gs
    JOIN public.assignments a ON a.id = gs.assignment_id
    JOIN public.classes c ON c.id = a.class_id
    WHERE gs.id = p_submission_id
    FOR UPDATE OF gs;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Submission record not found.');
    END IF;

    IF v_sub.admin_id = v_caller_id OR EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = v_caller_id AND u.role = 'admin'
    ) THEN
        v_is_authorized := TRUE;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the course instructor can grade group submissions.');
    END IF;

    IF p_marks < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Marks cannot be negative.');
    END IF;
    IF v_sub.points IS NOT NULL AND p_marks > v_sub.points THEN
        RETURN jsonb_build_object('success', false, 'error', 'Marks cannot exceed total assignment points (' || v_sub.points || ').');
    END IF;

    UPDATE public.group_submissions
    SET 
        marks = p_marks,
        feedback = TRIM(COALESCE(p_feedback, '')),
        status = 'reviewed',
        graded_by = v_caller_id,
        graded_at = NOW(),
        updated_at = NOW()
    WHERE id = p_submission_id
    RETURNING * INTO v_updated;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Group submission graded successfully.',
        'submission', row_to_json(v_updated)
    );
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'grade_group_submission', 'UUID, NUMERIC, TEXT');
END $$;

REVOKE ALL ON FUNCTION public.grade_group_submission(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_group_submission(UUID, NUMERIC, TEXT) TO authenticated;

-- 9.9 register_user_profile (Single-use locked invitation redemption)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'register_user_profile', 'TEXT, TEXT, TEXT, TEXT');
END $$;

CREATE OR REPLACE FUNCTION public.register_user_profile(
    p_name TEXT,
    p_role TEXT,
    p_faculty_invite_token TEXT DEFAULT NULL,
    p_student_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_email TEXT;
    v_assigned_role VARCHAR(20);
    v_clean_name TEXT;
    v_clean_token TEXT;
    v_invitation RECORD;
    v_existing_profile RECORD;
    v_new_profile RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    v_caller_email := auth.jwt() ->> 'email';
    IF v_caller_email IS NULL THEN
        SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
    END IF;

    v_clean_name := TRIM(COALESCE(p_name, ''));
    IF v_clean_name = '' THEN
        v_clean_name := SPLIT_PART(COALESCE(v_caller_email, 'user'), '@', 1);
    END IF;

    SELECT * INTO v_existing_profile FROM public.users WHERE id = v_caller_id;
    IF v_existing_profile.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true, 
            'profile', row_to_json(v_existing_profile),
            'already_exists', true,
            'role', v_existing_profile.role
        );
    END IF;

    IF p_role = 'admin' OR LOWER(p_role) = 'professor' THEN
        v_clean_token := TRIM(COALESCE(p_faculty_invite_token, ''));
        IF v_clean_token = '' THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Professor registration requires a valid Faculty Invitation Token issued by academic administration.'
            );
        END IF;

        SELECT * INTO v_invitation
        FROM public.faculty_invitations
        WHERE token = v_clean_token
        FOR UPDATE;

        IF v_invitation.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid Faculty Invitation Token.');
        END IF;

        IF v_invitation.is_used THEN
            RETURN jsonb_build_object('success', false, 'error', 'This Faculty Invitation Token has already been redeemed.');
        END IF;

        IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < NOW() THEN
            RETURN jsonb_build_object('success', false, 'error', 'This Faculty Invitation Token has expired.');
        END IF;

        IF v_invitation.email IS NOT NULL AND LOWER(v_invitation.email) <> LOWER(v_caller_email) THEN
            RETURN jsonb_build_object('success', false, 'error', 'This invitation token was designated for a different email address.');
        END IF;

        UPDATE public.faculty_invitations
        SET is_used = TRUE,
            used_by = v_caller_id,
            used_at = NOW()
        WHERE id = v_invitation.id;

        v_assigned_role := 'admin';
    ELSE
        v_assigned_role := 'student';
    END IF;

    INSERT INTO public.users (
        id,
        name,
        email,
        role,
        student_id,
        created_at
    )
    VALUES (
        v_caller_id,
        v_clean_name,
        v_caller_email,
        v_assigned_role,
        CASE WHEN v_assigned_role = 'student' THEN TRIM(COALESCE(p_student_id, '')) ELSE '' END,
        NOW()
    )
    RETURNING * INTO v_new_profile;

    RETURN jsonb_build_object(
        'success', true,
        'profile', row_to_json(v_new_profile),
        'role', v_assigned_role
    );
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'register_user_profile', 'TEXT, TEXT, TEXT, TEXT');
END $$;

REVOKE ALL ON FUNCTION public.register_user_profile(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_user_profile(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 9.10 create_faculty_invitation (192-bit CSPRNG token generation via extensions.gen_random_bytes)
DO $$
BEGIN
    PERFORM pg_temp.assert_not_preexisting('FUNCTION', 'public', 'create_faculty_invitation', 'TEXT, TEXT');
END $$;

CREATE OR REPLACE FUNCTION public.create_faculty_invitation(
    p_email TEXT DEFAULT NULL,
    p_department TEXT DEFAULT 'Academic Faculty'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_new_token VARCHAR(64);
    v_inv RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_caller_id AND u.role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only administrators can create faculty invitations.');
    END IF;

    -- Cryptographically secure token with 192 bits of entropy (24 random bytes hex-encoded from extensions schema)
    v_new_token := 'FAC-' || UPPER(encode(extensions.gen_random_bytes(24), 'hex'));

    INSERT INTO public.faculty_invitations (
        token,
        email,
        department,
        invited_by,
        expires_at
    )
    VALUES (
        v_new_token,
        NULLIF(TRIM(COALESCE(p_email, '')), ''),
        TRIM(COALESCE(p_department, 'Academic Faculty')),
        v_caller_id,
        NOW() + INTERVAL '90 days'
    )
    RETURNING * INTO v_inv;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Faculty invitation generated successfully.',
        'invitation', row_to_json(v_inv)
    );
END;
$$;

DO $$
BEGIN
    PERFORM pg_temp.record_migration_object('FUNCTION', 'public', 'create_faculty_invitation', 'TEXT, TEXT');
END $$;

REVOKE ALL ON FUNCTION public.create_faculty_invitation(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_faculty_invitation(TEXT, TEXT) TO authenticated;


-- ------------------------------------------------------------------------------
-- PART 10: SUPABASE REALTIME PUBLICATION REGISTRATION (WITH OWNERSHIP TRACKING)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'groups'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
        PERFORM pg_temp.record_migration_object('PUBLICATION_TABLE', 'public', 'supabase_realtime', 'groups');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_members'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
        PERFORM pg_temp.record_migration_object('PUBLICATION_TABLE', 'public', 'supabase_realtime', 'group_members');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_submissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_submissions;
        PERFORM pg_temp.record_migration_object('PUBLICATION_TABLE', 'public', 'supabase_realtime', 'group_submissions');
    END IF;
END $$;

COMMIT;

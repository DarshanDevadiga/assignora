-- ============================================================================
-- ASSIGNORA ROUND 2 ADVANCED: CLASS ROSTER & GROUP MANAGEMENT ENHANCEMENT
-- File: supabase/migrations/20261110000001_round2_advanced_groups_and_roster.sql
-- Purpose:
--   1. Harden group immutables & member deletion triggers for DELETE operations.
--   2. Provide secure RPCs for Professor Group Creation with selected members.
--   3. Provide secure RPCs for Group Leader Member Selection and Additions.
--   4. Provide secure RPC `get_class_roster` to fix the People tab so all students
--      and instructors are visible to enrolled participants with group status.
--   5. Enable classmate visibility policies on `class_members` and `users`.
--   6. Record ownership in `_assignora_migration_manifest`.
-- ============================================================================

DO $manifest_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_assignora_migration_manifest'
    ) THEN
        RAISE EXCEPTION 'Baseline migration manifest does not exist. Run baseline migration first.';
    END IF;
END;
$manifest_check$;

-- ----------------------------------------------------------------------------
-- 1. Trigger updates for safe disband & cascade
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. RPC: professor_create_group
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.professor_create_group(
    p_class_id uuid,
    p_name text,
    p_member_ids uuid[],
    p_leader_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
    v_caller_id UUID;
    v_is_admin BOOLEAN := FALSE;
    v_clean_name TEXT;
    v_group_id UUID;
    v_mid UUID;
    v_already_in_group TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    -- Caller must be class instructor or global admin
    SELECT (c.admin_id = v_caller_id OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_caller_id AND u.role = 'admin'))
    INTO v_is_admin
    FROM public.classes c
    WHERE c.id = p_class_id;

    IF NOT COALESCE(v_is_admin, FALSE) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the course instructor or an administrator can create groups with assigned members.');
    END IF;

    v_clean_name := trim(p_name);
    IF v_clean_name IS NULL OR length(v_clean_name) < 2 OR length(v_clean_name) > 80 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group name must be between 2 and 80 characters.');
    END IF;

    IF p_member_ids IS NULL OR array_length(p_member_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'At least one student must be selected for the group.');
    END IF;

    IF p_leader_id IS NULL OR NOT (p_leader_id = ANY(p_member_ids)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'The group leader must be one of the selected members.');
    END IF;

    -- Check case-insensitive name uniqueness in this class
    IF EXISTS (
        SELECT 1 FROM public.groups
        WHERE class_id = p_class_id
        AND lower(name) = lower(v_clean_name)
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'A group with this name already exists in this course.');
    END IF;

    -- Check all members are enrolled in the class and not already in another group
    FOREACH v_mid IN ARRAY p_member_ids LOOP
        IF NOT EXISTS (SELECT 1 FROM public.class_members WHERE class_id = p_class_id AND student_id = v_mid) THEN
            RETURN jsonb_build_object('success', false, 'error', 'One or more selected students are not enrolled in this course.');
        END IF;

        IF EXISTS (SELECT 1 FROM public.users WHERE id = v_mid AND role = 'admin') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Professors and administrators cannot be added as student group members.');
        END IF;

        SELECT g.name INTO v_already_in_group
        FROM public.group_members gm
        JOIN public.groups g ON g.id = gm.group_id
        WHERE gm.class_id = p_class_id AND gm.student_id = v_mid AND g.status = 'active';

        IF v_already_in_group IS NOT NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'A selected student is already an active member of group "' || v_already_in_group || '".');
        END IF;
    END LOOP;

    -- Create group
    INSERT INTO public.groups (class_id, name, leader_id, status)
    VALUES (p_class_id, v_clean_name, p_leader_id, 'active')
    RETURNING id INTO v_group_id;

    -- Insert all members
    FOREACH v_mid IN ARRAY p_member_ids LOOP
        INSERT INTO public.group_members (group_id, class_id, student_id)
        VALUES (v_group_id, p_class_id, v_mid);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'group_id', v_group_id,
        'name', v_clean_name,
        'leader_id', p_leader_id,
        'member_count', array_length(p_member_ids, 1),
        'message', 'Group created successfully with assigned members.'
    );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.professor_create_group(uuid, text, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.professor_create_group(uuid, text, uuid[], uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. RPC: add_group_members
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_group_members(
    p_group_id uuid,
    p_student_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
    v_caller_id UUID;
    v_group RECORD;
    v_sid UUID;
    v_already_in_group TEXT;
    v_added_count INT := 0;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT id, class_id, leader_id, status INTO v_group
    FROM public.groups
    WHERE id = p_group_id
    FOR UPDATE;

    IF v_group.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Group not found.');
    END IF;

    IF v_group.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot add members to an archived group.');
    END IF;

    -- Caller must be leader, course instructor, or admin
    IF v_group.leader_id <> v_caller_id 
       AND NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = v_group.class_id AND c.admin_id = v_caller_id)
       AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_caller_id AND u.role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the group leader or course instructor can add members.');
    END IF;

    IF p_student_ids IS NULL OR array_length(p_student_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No students selected.');
    END IF;

    FOREACH v_sid IN ARRAY p_student_ids LOOP
        -- Verify student enrolled
        IF NOT EXISTS (SELECT 1 FROM public.class_members WHERE class_id = v_group.class_id AND student_id = v_sid) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Selected student is not enrolled in this course.');
        END IF;

        IF EXISTS (SELECT 1 FROM public.users WHERE id = v_sid AND role = 'admin') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Professors and administrators cannot be added as student group members.');
        END IF;

        -- Verify not already in another active group
        SELECT g.name INTO v_already_in_group
        FROM public.group_members gm
        JOIN public.groups g ON g.id = gm.group_id
        WHERE gm.class_id = v_group.class_id AND gm.student_id = v_sid AND g.status = 'active';

        IF v_already_in_group IS NOT NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Student is already an active member of group "' || v_already_in_group || '".');
        END IF;

        INSERT INTO public.group_members (group_id, class_id, student_id)
        VALUES (p_group_id, v_group.class_id, v_sid)
        ON CONFLICT (class_id, student_id) DO NOTHING;

        v_added_count := v_added_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'added_count', v_added_count,
        'message', 'Members added successfully.'
    );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.add_group_members(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_group_members(uuid, uuid[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC: get_class_roster
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_class_roster(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
    v_caller_id UUID;
    v_class RECORD;
    v_instructor RECORD;
    v_students jsonb;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT id, name, admin_id INTO v_class
    FROM public.classes
    WHERE id = p_class_id;

    IF v_class.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Class not found.');
    END IF;

    IF v_class.admin_id <> v_caller_id 
       AND NOT EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = p_class_id AND cm.student_id = v_caller_id)
       AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_caller_id AND u.role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied.');
    END IF;

    SELECT id, name, email, avatar, role INTO v_instructor
    FROM public.users
    WHERE id = v_class.admin_id;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', cm.id,
            'student_id', u.id,
            'name', u.name,
            'email', u.email,
            'avatar', u.avatar,
            'role', u.role,
            'joined_at', cm.joined_at,
            'group_id', g.id,
            'group_name', g.name,
            'is_leader', (g.leader_id = u.id)
        ) ORDER BY u.name ASC
    ) INTO v_students
    FROM public.class_members cm
    JOIN public.users u ON u.id = cm.student_id
    LEFT JOIN public.group_members gm ON gm.class_id = p_class_id AND gm.student_id = u.id
    LEFT JOIN public.groups g ON g.id = gm.group_id AND g.status = 'active'
    WHERE cm.class_id = p_class_id;

    RETURN jsonb_build_object(
        'success', true,
        'instructor', jsonb_build_object(
            'id', v_instructor.id,
            'name', v_instructor.name,
            'email', v_instructor.email,
            'avatar', v_instructor.avatar,
            'role', 'instructor'
        ),
        'students', COALESCE(v_students, '[]'::jsonb),
        'total_students', jsonb_array_length(COALESCE(v_students, '[]'::jsonb))
    );
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.get_class_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_class_roster(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. RLS Peer Policies with SECURITY DEFINER helpers (prevents recursion)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_class_member(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.class_members 
        WHERE class_id = p_class_id AND student_id = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_class_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_class_member(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_classmate_of(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.class_members my_cm
        JOIN public.class_members peer_cm ON peer_cm.class_id = my_cm.class_id
        WHERE my_cm.student_id = auth.uid() AND peer_cm.student_id = p_user_id
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_classmate_of(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_classmate_of(UUID) TO authenticated;

DO $peer_pol$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'class_members_peer_select_policy'
        AND polrelid = 'public.class_members'::regclass
    ) THEN
        CREATE POLICY class_members_peer_select_policy ON public.class_members
        FOR SELECT TO authenticated
        USING (
            public.is_class_member(class_id)
        );
    ELSE
        ALTER POLICY class_members_peer_select_policy ON public.class_members
        USING (
            public.is_class_member(class_id)
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policy
        WHERE polname = 'users_classmates_select_policy'
        AND polrelid = 'public.users'::regclass
    ) THEN
        CREATE POLICY users_classmates_select_policy ON public.users
        FOR SELECT TO authenticated
        USING (
            public.is_classmate_of(id)
        );
    ELSE
        ALTER POLICY users_classmates_select_policy ON public.users
        USING (
            public.is_classmate_of(id)
        );
    END IF;
END;
$peer_pol$;

-- ----------------------------------------------------------------------------
-- 6. Record objects in migration manifest
-- ----------------------------------------------------------------------------
INSERT INTO public._assignora_migration_manifest (object_type, object_schema, object_name, sub_object_name, created_by_migration)
VALUES
    ('FUNCTION', 'public', 'is_class_member', 'uuid', '20261110000001_round2_advanced_groups_and_roster.sql'),
    ('FUNCTION', 'public', 'is_classmate_of', 'uuid', '20261110000001_round2_advanced_groups_and_roster.sql'),
    ('FUNCTION', 'public', 'professor_create_group', 'uuid, text, uuid[], uuid', '20261110000001_round2_advanced_groups_and_roster.sql'),
    ('FUNCTION', 'public', 'add_group_members', 'uuid, uuid[]', '20261110000001_round2_advanced_groups_and_roster.sql'),
    ('FUNCTION', 'public', 'get_class_roster', 'uuid', '20261110000001_round2_advanced_groups_and_roster.sql'),
    ('POLICY', 'public', 'class_members', 'class_members_peer_select_policy', '20261110000001_round2_advanced_groups_and_roster.sql'),
    ('POLICY', 'public', 'users', 'users_classmates_select_policy', '20261110000001_round2_advanced_groups_and_roster.sql')
ON CONFLICT (object_type, object_schema, object_name, sub_object_name) DO NOTHING;

-- ============================================================================
-- ASSIGNORA — ROUND 2 SAFE MANAGEMENT ACTIONS & DATA-PRESERVATION HARDENING
-- File: supabase/migrations/20261112000000_round2_safe_management_actions.sql
-- Status: STAGED / AWAITING EXPLICIT OWNER APPROVAL (DO NOT AUTO-EXECUTE)
-- ============================================================================
-- Goals:
--   1. Add optional lifecycle & term metadata to public.classes (semester, academic_year, status, archived_at)
--   2. Provide SECURITY DEFINER RPCs: archive_class, restore_class, professor_remove_group_member
--   3. Harden disband_course_group & archive_course_group so ONLY class owner / admin can delete/archive groups (students cannot delete groups)
--   4. Add BEFORE DELETE preservation triggers on public.classes and public.assignments so historical submissions, grades, and memberships cannot be cascade-wiped
-- ============================================================================

-- 1. Additive columns on public.classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS semester TEXT,
  ADD COLUMN IF NOT EXISTS academic_year TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'classes_status_check'
      AND conrelid = 'public.classes'::regclass
  ) THEN
    ALTER TABLE public.classes
      ADD CONSTRAINT classes_status_check CHECK (status IN ('active', 'archived'));
  END IF;
END $$;

-- Ensure update privileges allow editing semester, academic_year, class_code cleanly under existing RLS (classes_update_policy)
GRANT SELECT, UPDATE (name, subject, description, class_code, semester, academic_year) ON public.classes TO authenticated;

-- 2. RPC: archive_class (Class owner / admin only)
CREATE OR REPLACE FUNCTION public.archive_class(
  p_class_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_class RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT u.role INTO v_caller_role
  FROM public.users u
  WHERE u.id = v_caller_id;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only administrators or professors can archive classes.');
  END IF;

  SELECT id, admin_id, status INTO v_class
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;

  IF v_class.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class not found.');
  END IF;

  IF v_class.admin_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owning professor/admin can archive this class.');
  END IF;

  UPDATE public.classes
  SET status = 'archived',
      archived_at = COALESCE(archived_at, NOW())
  WHERE id = p_class_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'archived',
    'message', 'Class archived safely. Enrolled students, assignments, submissions, and marks remain preserved.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_class(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_class(UUID) TO authenticated;

-- 3. RPC: restore_class (Class owner / admin only)
CREATE OR REPLACE FUNCTION public.restore_class(
  p_class_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_class RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT u.role INTO v_caller_role
  FROM public.users u
  WHERE u.id = v_caller_id;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only administrators or professors can restore classes.');
  END IF;

  SELECT id, admin_id INTO v_class
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;

  IF v_class.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Class not found.');
  END IF;

  IF v_class.admin_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owning professor/admin can restore this class.');
  END IF;

  UPDATE public.classes
  SET status = 'active',
      archived_at = NULL
  WHERE id = p_class_id;

  RETURN jsonb_build_object('success', true, 'status', 'active', 'message', 'Class restored to active status.');
END;
$$;

REVOKE ALL ON FUNCTION public.restore_class(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_class(UUID) TO authenticated;

-- 4. RPC: professor_remove_group_member (Remove non-leader member from active group without affecting class_members)
CREATE OR REPLACE FUNCTION public.professor_remove_group_member(
  p_group_id UUID,
  p_student_id UUID
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
  v_class_owner UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT u.role INTO v_caller_role
  FROM public.users u
  WHERE u.id = v_caller_id;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only an authorized professor or admin can remove group members.');
  END IF;

  SELECT id, class_id, leader_id, status INTO v_group
  FROM public.groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF v_group.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Group not found.');
  END IF;

  SELECT c.admin_id INTO v_class_owner
  FROM public.classes c
  WHERE c.id = v_group.class_id;

  IF v_class_owner IS DISTINCT FROM v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owning course instructor can modify this group roster.');
  END IF;

  IF v_group.status = 'archived' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove members from an archived group.');
  END IF;

  IF v_group.leader_id = p_student_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transfer group leadership before removing the current leader.');
  END IF;

  DELETE FROM public.group_members
  WHERE group_id = p_group_id
    AND student_id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student is not a member of this group.');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Student removed from group while preserving class enrollment.');
END;
$$;

REVOKE ALL ON FUNCTION public.professor_remove_group_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.professor_remove_group_member(UUID, UUID) TO authenticated;

-- 5. Harden archive_course_group & disband_course_group: instructors/admins only (students cannot delete or disband groups)
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
  v_caller_role TEXT;
  v_group RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT u.role INTO v_caller_role
  FROM public.users u
  WHERE u.id = v_caller_id;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only an authorized professor or admin can archive groups.');
  END IF;

  SELECT id, leader_id, class_id, status INTO v_group
  FROM public.groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF v_group.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Group not found.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = v_group.class_id AND c.admin_id = v_caller_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the course owner can archive this group.');
  END IF;

  PERFORM set_config('assignora.authorized_group_archival', 'on', true);
  UPDATE public.groups SET status = 'archived' WHERE id = p_group_id;

  RETURN jsonb_build_object('success', true, 'message', 'Group archived successfully. Roster and submissions permanently preserved.');
END;
$$;

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
  v_caller_role TEXT;
  v_group RECORD;
  v_has_submissions BOOLEAN := FALSE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  SELECT u.role INTO v_caller_role
  FROM public.users u
  WHERE u.id = v_caller_id;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Students cannot delete or disband groups. Contact your professor.');
  END IF;

  SELECT id, leader_id, class_id INTO v_group
  FROM public.groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF v_group.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Group not found.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = v_group.class_id AND c.admin_id = v_caller_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owning professor/admin can disband this group.');
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
  DELETE FROM public.groups WHERE id = p_group_id;

  RETURN jsonb_build_object('success', true, 'action', 'deleted', 'message', 'Group deleted successfully.');
END;
$$;

-- 6. Triggers blocking unsafe raw DELETE when historical submissions, grades, or non-empty class dependencies exist
CREATE OR REPLACE FUNCTION public.prevent_unsafe_assignment_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.submissions s WHERE s.assignment_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.group_submissions gs WHERE gs.assignment_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete assignment "%" because student or group submissions already exist. Set status = ''archived'' instead.', OLD.title;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unsafe_assignment_deletion ON public.assignments;
CREATE TRIGGER trg_prevent_unsafe_assignment_deletion
  BEFORE DELETE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unsafe_assignment_deletion();

CREATE OR REPLACE FUNCTION public.prevent_unsafe_class_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.class_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.groups g WHERE g.class_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot delete class "%" while enrolled students, assignments, or groups exist. Archive the class or clear empty test records first.', OLD.name;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unsafe_class_deletion ON public.classes;
CREATE TRIGGER trg_prevent_unsafe_class_deletion
  BEFORE DELETE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unsafe_class_deletion();

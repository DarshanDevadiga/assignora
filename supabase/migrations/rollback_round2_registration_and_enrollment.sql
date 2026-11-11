-- ============================================================================
-- ROLLBACK: ASSIGNORA ROUND 2 REGISTRATION & CLASS ENROLLMENT RLS FIX
-- Target: supabase/migrations/20261111000000_round2_fix_registration_profiles_and_enrollment_rls.sql
-- Safe Rollback: Preserves all Round 1 & Round 2 user and enrollment data.
-- ============================================================================

-- 1. Drop auth.users trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Drop new RPCs and policies on users
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_instructors_select_policy" ON public.users;
DROP FUNCTION IF EXISTS public.is_instructor_of_caller(uuid);
DROP FUNCTION IF EXISTS public.validate_faculty_invitation(text, text);

-- 3. Restore original class_members_insert_policy & class_members_select_policy
DROP POLICY IF EXISTS "class_members_insert_policy" ON public.class_members;

CREATE POLICY "class_members_insert_policy" ON public.class_members
FOR INSERT TO authenticated
WITH CHECK (
    (( SELECT is_class_admin(class_members.class_id) AS is_class_admin) AND ( SELECT is_admin() AS is_admin))
);

DROP POLICY IF EXISTS "class_members_select_policy" ON public.class_members;

CREATE POLICY "class_members_select_policy" ON public.class_members
FOR SELECT TO authenticated
USING (
    ((student_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_class_admin(class_members.class_id) AS is_class_admin))
);

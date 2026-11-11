-- ============================================================================
-- ASSIGNORA ROUND 2: REGISTRATION, USER PROFILES, CLASS ENROLLMENT & RLS REPAIR
-- Migration: 20261111000000_round2_fix_registration_profiles_and_enrollment_rls.sql
-- Description:
--   1. Automatic public.users profile provisioning trigger on auth.users (handle_new_user)
--   2. Backfill existing orphaned auth.users records (e.g. darshan@pim.ac.in) into public.users
--   3. Safe pre-signup faculty invitation token validation RPC (validate_faculty_invitation)
--   4. Secure users_insert_policy and instructor visibility helper (is_instructor_of_caller)
--   5. Secure class_members_insert_policy allowing authenticated student self-enrollment
--   6. Consistent class_members_select_policy for students, instructors, and admins
--   7. Self-healing join_class_by_code RPC & enhanced get_class_preview_by_code RPC
--   8. Least-privilege routine grants
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Automatic Profile Provisioning Trigger on auth.users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
DECLARE
    v_role TEXT;
    v_name TEXT;
    v_student_id TEXT;
    v_token TEXT;
    v_inv RECORD;
BEGIN
    -- Extract and sanitize metadata
    v_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'name', '')), '');
    IF v_name IS NULL THEN
        v_name := SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1);
    END IF;

    v_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', 'student')));
    v_student_id := TRIM(COALESCE(NEW.raw_user_meta_data->>'student_id', ''));
    v_token := TRIM(COALESCE(NEW.raw_user_meta_data->>'faculty_invite_token', ''));

    -- Zero-trust privilege escalation guard:
    -- Never trust client-supplied role='admin' without a valid unused faculty invitation token.
    IF v_role = 'admin' OR v_role = 'professor' THEN
        IF v_token <> '' THEN
            SELECT * INTO v_inv
            FROM public.faculty_invitations
            WHERE token = v_token
              AND NOT is_used
              AND (expires_at IS NULL OR expires_at > NOW())
              AND (email IS NULL OR LOWER(email) = LOWER(COALESCE(NEW.email, '')))
            FOR UPDATE;

            IF v_inv.id IS NOT NULL THEN
                UPDATE public.faculty_invitations
                SET is_used = TRUE,
                    used_by = NEW.id,
                    used_at = NOW()
                WHERE id = v_inv.id;
                v_role := 'admin';
            ELSE
                v_role := 'student';
            END IF;
        ELSE
            v_role := 'student';
        END IF;
    ELSE
        v_role := 'student';
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
        NEW.id,
        v_name,
        COALESCE(NEW.email, ''),
        v_role,
        CASE WHEN v_role = 'student' THEN v_student_id ELSE '' END,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = CASE WHEN public.users.name = '' OR public.users.name IS NULL THEN EXCLUDED.name ELSE public.users.name END,
        email = EXCLUDED.email;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Never abort auth.users account creation on profile trigger error
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Backfill Existing Orphaned auth.users Into public.users
-- ----------------------------------------------------------------------------
-- Note: Safe additive backfill. Preserves all existing public.users rows.
INSERT INTO public.users (id, name, email, role, student_id, created_at)
SELECT
    au.id,
    COALESCE(NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''), SPLIT_PART(COALESCE(au.email, 'user'), '@', 1)),
    COALESCE(au.email, ''),
    'student',
    COALESCE(TRIM(au.raw_user_meta_data->>'student_id'), ''),
    COALESCE(au.created_at, NOW())
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Safe Pre-Signup Faculty Invitation Token Validation RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_faculty_invitation(p_token text, p_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
DECLARE
    v_clean_token TEXT;
    v_inv RECORD;
BEGIN
    v_clean_token := TRIM(COALESCE(p_token, ''));
    IF v_clean_token = '' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Professor registration requires a valid Faculty Invitation Token issued by academic administration.'
        );
    END IF;

    SELECT id, email, is_used, expires_at
    INTO v_inv
    FROM public.faculty_invitations
    WHERE token = v_clean_token
    LIMIT 1;

    IF v_inv.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid Faculty Invitation Token.');
    END IF;

    IF v_inv.is_used THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This Faculty Invitation Token has already been redeemed.');
    END IF;

    IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < NOW() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This Faculty Invitation Token has expired.');
    END IF;

    IF v_inv.email IS NOT NULL AND p_email IS NOT NULL AND TRIM(p_email) <> '' AND LOWER(v_inv.email) <> LOWER(TRIM(p_email)) THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This invitation token was designated for a different email address.');
    END IF;

    RETURN jsonb_build_object('valid', true);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Instructor Visibility Helper & Secure users Policies
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_instructor_of_caller(p_instructor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.classes c
        JOIN public.class_members cm ON cm.class_id = c.id
        WHERE c.admin_id = p_instructor_id
          AND cm.student_id = auth.uid()
    );
$$;

DROP POLICY IF EXISTS "users_instructors_select_policy" ON public.users;
CREATE POLICY "users_instructors_select_policy" ON public.users
FOR SELECT TO authenticated
USING (public.is_instructor_of_caller(id));

DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
CREATE POLICY "users_insert_policy" ON public.users
FOR INSERT TO authenticated
WITH CHECK (
    id = auth.uid()
    AND (
        role = 'student'
        OR
        (role = 'admin' AND EXISTS (
            SELECT 1 FROM public.faculty_invitations fi
            WHERE fi.used_by = auth.uid() AND fi.is_used = TRUE
        ))
    )
);

-- ----------------------------------------------------------------------------
-- 5. Secure class_members INSERT & SELECT Policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "class_members_insert_policy" ON public.class_members;

CREATE POLICY "class_members_insert_policy" ON public.class_members
FOR INSERT TO authenticated
WITH CHECK (
    -- Case 1: Instructor / Class Admin enrolling students
    ((SELECT public.is_class_admin(class_members.class_id)) AND (SELECT public.is_admin()))
    OR
    -- Case 2: Authenticated student self-enrolling with verified student role
    (
        student_id = auth.uid()
        AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'student'
        AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_members.class_id)
    )
);

DROP POLICY IF EXISTS "class_members_select_policy" ON public.class_members;

CREATE POLICY "class_members_select_policy" ON public.class_members
FOR SELECT TO authenticated
USING (
    student_id = (SELECT auth.uid())
    OR (SELECT public.is_class_admin(class_members.class_id))
    OR (SELECT public.is_admin())
);

-- ----------------------------------------------------------------------------
-- 6. Self-Healing join_class_by_code RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_clean_code TEXT;
    v_caller_id UUID;
    v_caller_role TEXT;
    v_class RECORD;
    v_existing_membership_id UUID;
    v_new_member_id UUID;
    v_auth_record RECORD;
BEGIN
    -- 1. Verify caller is authenticated
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required. Please sign in to join a class.');
    END IF;

    -- 2. Verify caller role in public.users
    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = v_caller_id;

    -- Self-heal if public.users profile is missing for this authenticated user
    IF v_caller_role IS NULL THEN
        SELECT id, email, raw_user_meta_data INTO v_auth_record
        FROM auth.users
        WHERE id = v_caller_id;

        IF v_auth_record.id IS NOT NULL THEN
            INSERT INTO public.users (id, name, email, role, student_id, created_at)
            VALUES (
                v_caller_id,
                COALESCE(NULLIF(TRIM(v_auth_record.raw_user_meta_data->>'name'), ''), SPLIT_PART(COALESCE(v_auth_record.email, 'user'), '@', 1)),
                COALESCE(v_auth_record.email, ''),
                'student',
                COALESCE(TRIM(v_auth_record.raw_user_meta_data->>'student_id'), ''),
                NOW()
            )
            ON CONFLICT (id) DO NOTHING;

            v_caller_role := 'student';
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'User profile not found. Please sign in again.');
        END IF;
    END IF;

    IF v_caller_role <> 'student' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only student accounts can join classes with a class code.');
    END IF;

    -- 3. Normalize code: uppercase, trim, strip 'CLS-' prefix
    v_clean_code := UPPER(TRIM(REGEXP_REPLACE(COALESCE(p_code, ''), '^CLS-', '', 'i')));
    IF v_clean_code = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid class code.');
    END IF;

    -- 4. Find target class by class_code or direct UUID
    SELECT id, name, subject, admin_id, class_code
    INTO v_class
    FROM public.classes
    WHERE class_code = v_clean_code OR id::text = p_code
    LIMIT 1;

    IF v_class.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid class code. Please check the code with your teacher.');
    END IF;

    -- 5. Prevent instructor from joining own class as a student
    IF v_class.admin_id = v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are the instructor of this class.');
    END IF;

    -- 6. Check for duplicate membership
    SELECT id INTO v_existing_membership_id
    FROM public.class_members
    WHERE class_id = v_class.id AND student_id = v_caller_id
    LIMIT 1;

    IF v_existing_membership_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'already_member', true,
            'class_id', v_class.id,
            'class_name', v_class.name,
            'error', 'You are already enrolled in this class.'
        );
    END IF;

    -- 7. Insert authenticated student into class_members
    INSERT INTO public.class_members (class_id, student_id, joined_at)
    VALUES (v_class.id, v_caller_id, NOW())
    RETURNING id INTO v_new_member_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Successfully enrolled in class.',
        'membership_id', v_new_member_id,
        'class_id', v_class.id,
        'class_name', v_class.name,
        'class_code', v_class.class_code
    );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 7. Enhanced get_class_preview_by_code RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_class_preview_by_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_clean_code TEXT;
    v_class RECORD;
    v_teacher RECORD;
    v_is_enrolled BOOLEAN := FALSE;
    v_caller_id UUID;
    v_student_count INTEGER := 0;
BEGIN
    v_clean_code := UPPER(TRIM(REGEXP_REPLACE(COALESCE(p_code, ''), '^CLS-', '', 'i')));
    
    IF v_clean_code = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Class code cannot be empty');
    END IF;

    SELECT id, name, subject, description, class_code, admin_id, created_at
    INTO v_class
    FROM public.classes
    WHERE class_code = v_clean_code OR id::text = p_code
    LIMIT 1;

    IF v_class.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid class code. No matching class found.');
    END IF;

    SELECT id, name, email, avatar, role
    INTO v_teacher
    FROM public.users
    WHERE id = v_class.admin_id
    LIMIT 1;

    SELECT count(*) INTO v_student_count
    FROM public.class_members
    WHERE class_id = v_class.id;

    v_caller_id := auth.uid();
    IF v_caller_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.class_members
            WHERE class_id = v_class.id AND student_id = v_caller_id
        ) INTO v_is_enrolled;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'class', jsonb_build_object(
            'id', v_class.id,
            'name', v_class.name,
            'subject', v_class.subject,
            'description', v_class.description,
            'class_code', v_class.class_code,
            'admin_id', v_class.admin_id,
            'users', jsonb_build_object(
                'id', v_teacher.id,
                'name', COALESCE(v_teacher.name, 'Course Instructor'),
                'email', v_teacher.email,
                'avatar', v_teacher.avatar
            ),
            'teacher', jsonb_build_object(
                'id', v_teacher.id,
                'name', COALESCE(v_teacher.name, 'Course Instructor'),
                'email', v_teacher.email,
                'avatar', v_teacher.avatar
            ),
            'student_count', v_student_count,
            'is_enrolled', v_is_enrolled
        )
    );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 8. Grant Routine Permissions
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.validate_faculty_invitation(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_instructor_of_caller(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_class_preview_by_code(text) TO authenticated, anon;

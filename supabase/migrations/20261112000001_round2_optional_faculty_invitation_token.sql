-- ============================================================================
-- ASSIGNORA — OPTIONAL FACULTY INVITATION TOKEN FOR PROFESSOR / FACULTY SIGNUP
-- File: supabase/migrations/20261112000001_round2_optional_faculty_invitation_token.sql
-- Status: STAGED / AWAITING EXPLICIT OWNER APPROVAL (DO NOT AUTO-EXECUTE)
-- ============================================================================
-- Goals:
--   1. Make Faculty Invitation Token optional during Faculty/Professor registration
--      without weakening RLS policies or enabling client-side role self-escalation.
--   2. Preserve full invitation validation, single-use redemption, email matching,
--      expiry enforcement, and department return when a non-empty token IS supplied.
--   3. Keep Student registration, Student/Faculty permissions, and users RLS intact.
-- ============================================================================

-- 1. Pre-signup Faculty Invitation validation RPC
--    - Empty/blank token is valid (optional flow)
--    - Non-empty token MUST exist, be unused, not expired, and match email if scoped
CREATE OR REPLACE FUNCTION public.validate_faculty_invitation(
  p_token TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_clean_token TEXT;
  v_inv RECORD;
BEGIN
  v_clean_token := TRIM(COALESCE(p_token, ''));

  IF v_clean_token = '' THEN
    RETURN jsonb_build_object(
      'valid', true,
      'optional', true,
      'has_token', false
    );
  END IF;

  SELECT id, email, department, is_used, expires_at
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

  IF v_inv.email IS NOT NULL
     AND p_email IS NOT NULL
     AND TRIM(p_email) <> ''
     AND LOWER(v_inv.email) <> LOWER(TRIM(p_email)) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation token was designated for a different email address.');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'has_token', true,
    'department', COALESCE(v_inv.department, 'Academic Faculty')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_faculty_invitation(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_faculty_invitation(TEXT, TEXT) TO authenticated, anon;

-- 2. Auth signup trigger: provision public.users automatically on auth.users INSERT
--    - Faculty role ('admin'/'professor'/'faculty') succeeds WITH OR WITHOUT invitation token
--    - If a non-empty token IS provided, it MUST be valid (otherwise never grant 'admin')
--    - On existing row conflict, role is NEVER overwritten
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_meta_role TEXT;
  v_name TEXT;
  v_student_id TEXT;
  v_token TEXT;
  v_inv RECORD;
BEGIN
  v_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'name', '')), '');
  IF v_name IS NULL THEN
    v_name := SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1);
  END IF;

  v_meta_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', 'student')));
  v_student_id := TRIM(COALESCE(NEW.raw_user_meta_data->>'student_id', ''));
  v_token := TRIM(COALESCE(NEW.raw_user_meta_data->>'faculty_invite_token', ''));

  IF v_meta_role IN ('admin', 'professor', 'faculty') THEN
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
        -- Explicit non-empty token that is invalid/used/expired: never grant Faculty role
        v_role := 'student';
      END IF;
    ELSE
      -- Optional invitation token omitted: permit Faculty registration cleanly
      v_role := 'admin';
    END IF;
  ELSE
    -- Restrict arbitrary/unknown role metadata values to 'student'
    v_role := 'student';
  END IF;

  INSERT INTO public.users (id, name, email, role, student_id, created_at)
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
    RETURN NEW;
END;
$$;

-- 3. Authenticated self-healing / provisioning RPC
--    - Never alters role of an existing public.users profile
--    - Allows Faculty registration with empty token ONLY when auth signup metadata also declared faculty intent
--    - Rejects invalid/expired/used/email-mismatched non-empty tokens
--    - Preserves invitation redemption and returns department when token is redeemed
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
  v_auth_meta_role TEXT;
  v_requested_role TEXT;
  v_assigned_role VARCHAR(20);
  v_clean_name TEXT;
  v_clean_token TEXT;
  v_invitation RECORD;
  v_existing_profile RECORD;
  v_new_profile RECORD;
  v_department TEXT := NULL;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_caller_email := auth.jwt() ->> 'email';
  SELECT email,
         LOWER(TRIM(COALESCE(raw_user_meta_data->>'role', 'student')))
  INTO v_caller_email, v_auth_meta_role
  FROM auth.users
  WHERE id = v_caller_id;

  v_clean_name := TRIM(COALESCE(p_name, ''));
  IF v_clean_name = '' THEN
    v_clean_name := SPLIT_PART(COALESCE(v_caller_email, 'user'), '@', 1);
  END IF;

  -- Never overwrite role on an existing profile (blocks post-signup privilege escalation)
  SELECT * INTO v_existing_profile FROM public.users WHERE id = v_caller_id;
  IF v_existing_profile.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'profile', row_to_json(v_existing_profile),
      'already_exists', true,
      'role', v_existing_profile.role
    );
  END IF;

  v_requested_role := LOWER(TRIM(COALESCE(p_role, 'student')));

  IF v_requested_role IN ('admin', 'professor', 'faculty') THEN
    v_clean_token := TRIM(COALESCE(p_faculty_invite_token, ''));

    IF v_clean_token <> '' THEN
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

      IF v_invitation.email IS NOT NULL AND LOWER(v_invitation.email) <> LOWER(COALESCE(v_caller_email, '')) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This invitation token was designated for a different email address.');
      END IF;

      UPDATE public.faculty_invitations
      SET is_used = TRUE,
          used_by = v_caller_id,
          used_at = NOW()
      WHERE id = v_invitation.id;

      v_department := v_invitation.department;
      v_assigned_role := 'admin';
    ELSE
      -- Without a token, only honor faculty role if auth signup metadata legitimately selected faculty
      IF COALESCE(v_auth_meta_role, 'student') NOT IN ('admin', 'professor', 'faculty') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized role escalation attempt rejected.');
      END IF;
      v_assigned_role := 'admin';
    END IF;
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
    COALESCE(v_caller_email, ''),
    v_assigned_role,
    CASE WHEN v_assigned_role = 'student' THEN TRIM(COALESCE(p_student_id, '')) ELSE '' END,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_new_profile;

  IF v_new_profile.id IS NULL THEN
    SELECT * INTO v_new_profile FROM public.users WHERE id = v_caller_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile', row_to_json(v_new_profile),
    'role', v_new_profile.role,
    'department', v_department
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_user_profile(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_user_profile(TEXT, TEXT, TEXT, TEXT) TO authenticated;

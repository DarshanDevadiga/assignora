-- Rollback for 20261112000001_round2_optional_faculty_invitation_token.sql
-- Restores mandatory Faculty Invitation Token validation in validate_faculty_invitation,
-- handle_new_user, and register_user_profile without dropping or altering existing user rows.

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

REVOKE ALL ON FUNCTION public.validate_faculty_invitation(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_faculty_invitation(TEXT, TEXT) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
  v_student_id TEXT;
  v_token TEXT;
  v_inv RECORD;
BEGIN
  v_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'name', '')), '');
  IF v_name IS NULL THEN
    v_name := SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1);
  END IF;

  v_role := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'role', 'student')));
  v_student_id := TRIM(COALESCE(NEW.raw_user_meta_data->>'student_id', ''));
  v_token := TRIM(COALESCE(NEW.raw_user_meta_data->>'faculty_invite_token', ''));

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

  INSERT INTO public.users (id, name, email, role, student_id, created_at)
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

REVOKE ALL ON FUNCTION public.register_user_profile(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_user_profile(TEXT, TEXT, TEXT, TEXT) TO authenticated;

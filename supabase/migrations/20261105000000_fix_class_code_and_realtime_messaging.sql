-- ==============================================================================
-- ASSIGNORA DATABASE MIGRATION: CLASS JOIN CODE & REAL-TIME CLASS MESSAGING
-- Description:
--   1. Adds persistent `class_code` column to `classes` with unique constraint.
--   2. Backfills existing classes with stable unique uppercase 6-character codes.
--   3. Creates secure RPC functions for class lookup (`get_class_preview_by_code`)
--      and secure student enrollment (`join_class_by_code`) using auth.uid().
--   4. Creates dedicated `class_messages` table with foreign keys, indexes, and RLS.
--   5. Configures Supabase Realtime publication for `class_messages`.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1: ADD PERSISTENT `class_code` TO `classes`
-- ------------------------------------------------------------------------------

-- 1. Add class_code column if not exists
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS class_code VARCHAR(10);

-- 2. Backfill existing classes with deterministic unique uppercase codes
UPDATE public.classes 
SET class_code = UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 6))
WHERE class_code IS NULL;

-- 3. Enforce NOT NULL and UNIQUE constraint
ALTER TABLE public.classes 
ALTER COLUMN class_code SET NOT NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'classes_class_code_key'
    ) THEN
        ALTER TABLE public.classes ADD CONSTRAINT classes_class_code_key UNIQUE (class_code);
    END IF;
END $$;

-- 4. Index on class_code for fast O(1) lookups
CREATE INDEX IF NOT EXISTS idx_classes_class_code ON public.classes(class_code);


-- ------------------------------------------------------------------------------
-- PART 2: SECURE RPC FUNCTIONS FOR CLASS CODE LOOKUP & ENROLLMENT
-- ------------------------------------------------------------------------------

-- Function 1: Preview class details by code (accessible by authenticated students)
CREATE OR REPLACE FUNCTION public.get_class_preview_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_clean_code TEXT;
    v_class RECORD;
    v_teacher RECORD;
    v_is_enrolled BOOLEAN := FALSE;
    v_caller_id UUID;
BEGIN
    -- Normalize code: uppercase, trim, strip 'CLS-' prefix
    v_clean_code := UPPER(TRIM(REGEXP_REPLACE(COALESCE(p_code, ''), '^CLS-', '', 'i')));
    
    IF v_clean_code = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Class code cannot be empty');
    END IF;

    -- Lookup class
    SELECT id, name, subject, description, class_code, admin_id, created_at
    INTO v_class
    FROM public.classes
    WHERE class_code = v_clean_code OR id::text = p_code
    LIMIT 1;

    IF v_class.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid class code. No matching class found.');
    END IF;

    -- Lookup instructor
    SELECT id, name, email, avatar
    INTO v_teacher
    FROM public.users
    WHERE id = v_class.admin_id
    LIMIT 1;

    -- Check if current authenticated caller is enrolled
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
            'teacher', jsonb_build_object(
                'id', v_teacher.id,
                'name', COALESCE(v_teacher.name, 'Course Instructor'),
                'email', v_teacher.email,
                'avatar', v_teacher.avatar
            ),
            'is_enrolled', v_is_enrolled
        )
    );
END;
$$;

-- Grant execution to authenticated and anon users for preview
GRANT EXECUTE ON FUNCTION public.get_class_preview_by_code(TEXT) TO authenticated, anon;


-- Function 2: Join class by code (strictly validates student role and auth.uid())
CREATE OR REPLACE FUNCTION public.join_class_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_clean_code TEXT;
    v_caller_id UUID;
    v_caller_role TEXT;
    v_class RECORD;
    v_existing_membership_id UUID;
    v_new_member_id UUID;
BEGIN
    -- 1. Verify caller is authenticated
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required. Please sign in to join a class.');
    END IF;

    -- 2. Verify caller role is 'student'
    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = v_caller_id;

    IF v_caller_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
    END IF;

    IF v_caller_role <> 'student' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only student accounts can join classes with a class code.');
    END IF;

    -- 3. Normalize code
    v_clean_code := UPPER(TRIM(REGEXP_REPLACE(COALESCE(p_code, ''), '^CLS-', '', 'i')));
    IF v_clean_code = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please enter a valid class code.');
    END IF;

    -- 4. Find class
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
$$;

-- Grant execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.join_class_by_code(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(TEXT) TO authenticated;


-- ------------------------------------------------------------------------------
-- PART 3: CREATE DEDICATED `class_messages` TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.class_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance and sorting
CREATE INDEX IF NOT EXISTS idx_class_messages_class_id ON public.class_messages(class_id);
CREATE INDEX IF NOT EXISTS idx_class_messages_created_at ON public.class_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_class_messages_sender_id ON public.class_messages(sender_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.class_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "class_messages_select_policy" ON public.class_messages;
DROP POLICY IF EXISTS "class_messages_insert_policy" ON public.class_messages;
DROP POLICY IF EXISTS "class_messages_delete_policy" ON public.class_messages;

-- RLS SELECT Policy:
-- Class members and class admin can view messages belonging to their class
CREATE POLICY "class_messages_select_policy" ON public.class_messages
    FOR SELECT
    TO authenticated
    USING (
        -- User is the instructor/admin of this class
        EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = class_messages.class_id
            AND c.admin_id = auth.uid()
        )
        OR
        -- User is an enrolled student member in this class
        EXISTS (
            SELECT 1 FROM public.class_members cm
            WHERE cm.class_id = class_messages.class_id
            AND cm.student_id = auth.uid()
        )
    );

-- RLS INSERT Policy:
-- Authenticated class members and class admin can send messages for their own account
CREATE POLICY "class_messages_insert_policy" ON public.class_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Sender must be the authenticated user
        sender_id = auth.uid()
        AND (
            -- User is the instructor of the class
            EXISTS (
                SELECT 1 FROM public.classes c
                WHERE c.id = class_messages.class_id
                AND c.admin_id = auth.uid()
            )
            OR
            -- User is an enrolled student member of the class
            EXISTS (
                SELECT 1 FROM public.class_members cm
                WHERE cm.class_id = class_messages.class_id
                AND cm.student_id = auth.uid()
            )
        )
    );

-- RLS DELETE Policy:
-- Sender or class instructor can delete a message
CREATE POLICY "class_messages_delete_policy" ON public.class_messages
    FOR DELETE
    TO authenticated
    USING (
        sender_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = class_messages.class_id
            AND c.admin_id = auth.uid()
        )
    );


-- ------------------------------------------------------------------------------
-- PART 4: REALTIME REPLICATION CONFIGURATION
-- ------------------------------------------------------------------------------

-- Ensure class_messages is added to Supabase Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'class_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_messages;
    END IF;
END $$;

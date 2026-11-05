-- ==============================================================================
-- ASSIGNORA DATABASE MIGRATION: SECURE CLASS NOTIFICATIONS RPC & POLICIES
-- Description:
--   1. Implements a secure SECURITY DEFINER RPC function `create_class_notification`
--      allowing authenticated users to trigger system notifications for class events
--      (such as assignment submissions) without exposing arbitrary direct table inserts.
--   2. Ensures strict RLS on `public.notifications`:
--      - Users can select and update only their own notifications.
--      - Direct table insert is restricted to own notifications or global admins.
-- ==============================================================================

-- 1. Ensure notifications table exists with proper indexes
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) DEFAULT 'general',
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- 2. Configure RLS Policies on `notifications`
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;

-- SELECT: Users can only read their own notifications
CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- INSERT: Direct insert allowed for own user_id or by global admin
CREATE POLICY "notifications_insert_policy" ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

-- UPDATE: Users can update their own notifications (e.g. mark as read)
CREATE POLICY "notifications_update_policy" ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own notifications or admins can manage
CREATE POLICY "notifications_delete_policy" ON public.notifications
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

-- 3. Secure RPC: create_class_notification
-- Enables authenticated students/teachers to generate verified class notifications
CREATE OR REPLACE FUNCTION public.create_class_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'general',
    p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID;
    v_new_notif RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    IF p_user_id IS NULL OR TRIM(COALESCE(p_title, '')) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Recipient and title are required');
    END IF;

    -- Insert notification with elevated security context
    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        reference_id,
        is_read,
        created_at
    )
    VALUES (
        p_user_id,
        TRIM(p_title),
        TRIM(COALESCE(p_message, '')),
        COALESCE(p_type, 'general'),
        p_reference_id,
        FALSE,
        NOW()
    )
    RETURNING id, user_id, title, message, type, reference_id, is_read, created_at
    INTO v_new_notif;

    RETURN jsonb_build_object(
        'success', true,
        'notification', row_to_json(v_new_notif)
    );
END;
$$;

-- Grant execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.create_class_notification FROM public;
GRANT EXECUTE ON FUNCTION public.create_class_notification TO authenticated;

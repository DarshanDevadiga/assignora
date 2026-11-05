-- ==============================================================================
-- ASSIGNORA DATABASE MIGRATION: FIX ADMIN & STUDENT MESSAGING RLS POLICIES
-- Description:
--   1. Ensures admins (users with role = 'admin' or classes.admin_id) can select,
--      insert, and manage class_messages across all classes.
--   2. Ensures enrolled students can select and insert class_messages for their classes.
--   3. Guarantees message sender identity cannot be spoofed (sender_id = auth.uid()).
--   4. Preserves foreign keys and Realtime publication on public.class_messages.
-- ==============================================================================

-- 1. Ensure table and publication exist
CREATE TABLE IF NOT EXISTS public.class_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_messages_class_id ON public.class_messages(class_id);
CREATE INDEX IF NOT EXISTS idx_class_messages_created_at ON public.class_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_class_messages_sender_id ON public.class_messages(sender_id);

ALTER TABLE public.class_messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to cleanly replace with unified admin/student policies
DROP POLICY IF EXISTS "class_messages_select_policy" ON public.class_messages;
DROP POLICY IF EXISTS "class_messages_insert_policy" ON public.class_messages;
DROP POLICY IF EXISTS "class_messages_delete_policy" ON public.class_messages;

-- 3. SELECT Policy:
-- Any global administrator (users.role = 'admin'), class owner (classes.admin_id = auth.uid()),
-- or enrolled student member (class_members.student_id = auth.uid()) can view messages.
CREATE POLICY "class_messages_select_policy" ON public.class_messages
    FOR SELECT
    TO authenticated
    USING (
        -- User is a global system administrator
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
        OR
        -- User is the instructor of this class
        EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = class_messages.class_id
            AND c.admin_id = auth.uid()
        )
        OR
        -- User is an enrolled student member of this class
        EXISTS (
            SELECT 1 FROM public.class_members cm
            WHERE cm.class_id = class_messages.class_id
            AND cm.student_id = auth.uid()
        )
    );

-- 4. INSERT Policy:
-- Sender must be auth.uid(), and must be a global admin, class owner, or enrolled member.
CREATE POLICY "class_messages_insert_policy" ON public.class_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = auth.uid()
                AND u.role = 'admin'
            )
            OR
            EXISTS (
                SELECT 1 FROM public.classes c
                WHERE c.id = class_messages.class_id
                AND c.admin_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM public.class_members cm
                WHERE cm.class_id = class_messages.class_id
                AND cm.student_id = auth.uid()
            )
        )
    );

-- 5. DELETE Policy:
-- Sender, class owner, or global admin can delete a message.
CREATE POLICY "class_messages_delete_policy" ON public.class_messages
    FOR DELETE
    TO authenticated
    USING (
        sender_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
        OR
        EXISTS (
            SELECT 1 FROM public.classes c
            WHERE c.id = class_messages.class_id
            AND c.admin_id = auth.uid()
        )
    );

-- 6. Ensure publication contains class_messages
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

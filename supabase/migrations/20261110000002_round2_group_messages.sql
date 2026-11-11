-- ============================================================================
-- ASSIGNORA — MIGRATION 20261110000002: DEDICATED PRIVATE GROUP MESSAGES
-- Scope:
--   1. Create `public.group_messages` table for private intra-group discussion.
--   2. Strict Foreign Keys to `groups(id)` (CASCADE on group removal) and `users(id)` (RESTRICT).
--   3. Message text length constraints (1..5000 chars, non-blank).
--   4. Performance Indexes on `(group_id, created_at ASC)` and `(sender_id)`.
--   5. Strict Row-Level Security (RLS):
--      - SELECT: Active group members OR owning class instructor/admin.
--      - INSERT: Active group members OR owning class instructor/admin with `sender_id = auth.uid()`.
--      - DELETE: Message author OR owning class instructor/admin.
--   6. Least-privilege Grants (REVOKE PUBLIC/anon, GRANT authenticated).
--   7. Register into `supabase_realtime` publication.
--   8. Record all created objects into `public._assignora_migration_manifest`.
-- ============================================================================

BEGIN;

-- Helper to record ownership into migration manifest
CREATE OR REPLACE FUNCTION pg_temp.record_migration_object(
    p_type TEXT,
    p_schema TEXT,
    p_name TEXT,
    p_sub TEXT DEFAULT ''
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public._assignora_migration_manifest (
        object_type, object_schema, object_name, sub_object_name, created_by_migration, created_at
    ) VALUES (
        p_type, p_schema, p_name, COALESCE(p_sub, ''), '20261110000002_group_messages', NOW()
    ) ON CONFLICT (object_type, object_schema, object_name, sub_object_name) DO NOTHING;
END;
$$;

-- 1. Create table `public.group_messages`
CREATE TABLE IF NOT EXISTS public.group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    message TEXT NOT NULL CHECK (char_length(trim(message)) > 0 AND char_length(message) <= 5000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

SELECT pg_temp.record_migration_object('TABLE', 'public', 'group_messages', '');

-- 2. Indexes for fast retrieval & foreign key optimization
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created 
    ON public.group_messages (group_id, created_at ASC);
SELECT pg_temp.record_migration_object('INDEX', 'public', 'group_messages', 'idx_group_messages_group_created');

CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id 
    ON public.group_messages (sender_id);
SELECT pg_temp.record_migration_object('INDEX', 'public', 'group_messages', 'idx_group_messages_sender_id');

-- 3. Enable Row-Level Security
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- SELECT Policy: Active group members or class instructor/admin
DROP POLICY IF EXISTS group_messages_select_policy ON public.group_messages;
CREATE POLICY group_messages_select_policy ON public.group_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_messages.group_id
              AND gm.student_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.groups g
            JOIN public.classes c ON c.id = g.class_id
            WHERE g.id = group_messages.group_id
              AND (
                  c.admin_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.users u
                      WHERE u.id = auth.uid() AND u.role = 'admin'
                  )
              )
        )
    );
SELECT pg_temp.record_migration_object('POLICY', 'public', 'group_messages', 'group_messages_select_policy');

-- INSERT Policy: Authenticated sender must match auth.uid() and be group member or instructor
DROP POLICY IF EXISTS group_messages_insert_policy ON public.group_messages;
CREATE POLICY group_messages_insert_policy ON public.group_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM public.group_members gm
                WHERE gm.group_id = group_messages.group_id
                  AND gm.student_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM public.groups g
                JOIN public.classes c ON c.id = g.class_id
                WHERE g.id = group_messages.group_id
                  AND (
                      c.admin_id = auth.uid()
                      OR EXISTS (
                          SELECT 1 FROM public.users u
                          WHERE u.id = auth.uid() AND u.role = 'admin'
                      )
                  )
            )
        )
    );
SELECT pg_temp.record_migration_object('POLICY', 'public', 'group_messages', 'group_messages_insert_policy');

-- DELETE Policy: Sender can delete their own message; instructor can moderate
DROP POLICY IF EXISTS group_messages_delete_policy ON public.group_messages;
CREATE POLICY group_messages_delete_policy ON public.group_messages
    FOR DELETE TO authenticated
    USING (
        sender_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.groups g
            JOIN public.classes c ON c.id = g.class_id
            WHERE g.id = group_messages.group_id
              AND (
                  c.admin_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.users u
                      WHERE u.id = auth.uid() AND u.role = 'admin'
                  )
              )
        )
    );
SELECT pg_temp.record_migration_object('POLICY', 'public', 'group_messages', 'group_messages_delete_policy');

-- 5. Least-Privilege Grants
REVOKE ALL ON public.group_messages FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.group_messages TO authenticated;

-- 6. Add to Realtime Publication if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'group_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
        PERFORM pg_temp.record_migration_object('PUBLICATION_TABLE', 'public', 'supabase_realtime', 'group_messages');
    END IF;
END $$;

DROP FUNCTION IF EXISTS pg_temp.record_migration_object(TEXT, TEXT, TEXT, TEXT);

COMMIT;

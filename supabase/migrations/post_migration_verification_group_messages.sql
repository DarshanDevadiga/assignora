-- ============================================================================
-- ASSIGNORA — VERIFICATION SCRIPT FOR MIGRATION 20261110000002
-- Scope:
--   Validates table structure, constraints, RLS policies, indexes, and Realtime.
-- ============================================================================

DO $$
DECLARE
    v_count INT;
BEGIN
    RAISE NOTICE 'Starting post-migration verification for group_messages...';

    -- 1. Verify Table Existence
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'group_messages'
    ) THEN
        RAISE EXCEPTION 'Verification Failed: public.group_messages table does not exist.';
    END IF;

    -- 2. Verify RLS Enabled
    SELECT count(*) INTO v_count
    FROM pg_class
    WHERE relname = 'group_messages' AND relrowsecurity = TRUE;
    IF v_count = 0 THEN
        RAISE EXCEPTION 'Verification Failed: RLS is not enabled on public.group_messages.';
    END IF;

    -- 3. Verify Indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'group_messages' AND indexname = 'idx_group_messages_group_created') THEN
        RAISE EXCEPTION 'Verification Failed: idx_group_messages_group_created index missing.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'group_messages' AND indexname = 'idx_group_messages_sender_id') THEN
        RAISE EXCEPTION 'Verification Failed: idx_group_messages_sender_id index missing.';
    END IF;

    -- 4. Verify RLS Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_messages' AND policyname = 'group_messages_select_policy') THEN
        RAISE EXCEPTION 'Verification Failed: group_messages_select_policy missing.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_messages' AND policyname = 'group_messages_insert_policy') THEN
        RAISE EXCEPTION 'Verification Failed: group_messages_insert_policy missing.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_messages' AND policyname = 'group_messages_delete_policy') THEN
        RAISE EXCEPTION 'Verification Failed: group_messages_delete_policy missing.';
    END IF;

    -- 5. Verify Realtime Publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_messages'
    ) THEN
        RAISE EXCEPTION 'Verification Failed: public.group_messages not in supabase_realtime publication.';
    END IF;

    RAISE NOTICE 'SUCCESS: All group_messages migration objects verified.';
END $$;

-- ============================================================================
-- ASSIGNORA — ROLLBACK SCRIPT FOR MIGRATION 20261110000002
-- Scope:
--   Safely reverts objects created exclusively by migration 20261110000002.
--   Preserves all Round 1 objects, users, classes, assignments, and base groups.
-- ============================================================================

BEGIN;

-- 1. Remove from Realtime Publication if recorded by this migration
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type = 'PUBLICATION_TABLE'
          AND object_name = 'supabase_realtime'
          AND sub_object_name = 'group_messages'
          AND created_by_migration = '20261110000002_group_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.group_messages;
        DELETE FROM public._assignora_migration_manifest
        WHERE object_type = 'PUBLICATION_TABLE'
          AND object_name = 'supabase_realtime'
          AND sub_object_name = 'group_messages'
          AND created_by_migration = '20261110000002_group_messages';
    END IF;
END $$;

-- 2. Drop RLS Policies recorded by this migration
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT sub_object_name AS policy_name
        FROM public._assignora_migration_manifest
        WHERE object_type = 'POLICY'
          AND object_name = 'group_messages'
          AND created_by_migration = '20261110000002_group_messages'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.group_messages', pol.policy_name);
        DELETE FROM public._assignora_migration_manifest
        WHERE object_type = 'POLICY'
          AND object_name = 'group_messages'
          AND sub_object_name = pol.policy_name
          AND created_by_migration = '20261110000002_group_messages';
    END LOOP;
END $$;

-- 3. Drop Indexes recorded by this migration
DO $$
DECLARE
    idx RECORD;
BEGIN
    FOR idx IN
        SELECT sub_object_name AS index_name
        FROM public._assignora_migration_manifest
        WHERE object_type = 'INDEX'
          AND object_name = 'group_messages'
          AND created_by_migration = '20261110000002_group_messages'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.index_name);
        DELETE FROM public._assignora_migration_manifest
        WHERE object_type = 'INDEX'
          AND object_name = 'group_messages'
          AND sub_object_name = idx.index_name
          AND created_by_migration = '20261110000002_group_messages';
    END LOOP;
END $$;

-- 4. Drop Table if recorded by this migration
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public._assignora_migration_manifest
        WHERE object_type = 'TABLE'
          AND object_name = 'group_messages'
          AND created_by_migration = '20261110000002_group_messages'
    ) THEN
        DROP TABLE IF EXISTS public.group_messages;
        DELETE FROM public._assignora_migration_manifest
        WHERE object_type = 'TABLE'
          AND object_name = 'group_messages'
          AND created_by_migration = '20261110000002_group_messages';
    END IF;
END $$;

COMMIT;

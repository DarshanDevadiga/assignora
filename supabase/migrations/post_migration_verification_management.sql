-- Post-migration verification queries for 20261112000000_round2_safe_management_actions.sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'classes'
  AND column_name IN ('semester', 'academic_year', 'status', 'archived_at')
ORDER BY column_name;

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'archive_class',
    'restore_class',
    'professor_remove_group_member',
    'archive_course_group',
    'disband_course_group',
    'prevent_unsafe_assignment_deletion',
    'prevent_unsafe_class_deletion'
  )
ORDER BY p.proname;

SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND trigger_name IN (
    'trg_prevent_unsafe_assignment_deletion',
    'trg_prevent_unsafe_class_deletion'
  );

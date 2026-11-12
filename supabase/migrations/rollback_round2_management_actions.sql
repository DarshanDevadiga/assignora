-- Non-destructive rollback for 20261112000000_round2_safe_management_actions.sql
-- Preserves all student/class/assignment/group/submission data cleanly.

DROP TRIGGER IF EXISTS trg_prevent_unsafe_assignment_deletion ON public.assignments;
DROP TRIGGER IF EXISTS trg_prevent_unsafe_class_deletion ON public.classes;
DROP FUNCTION IF EXISTS public.prevent_unsafe_assignment_deletion();
DROP FUNCTION IF EXISTS public.prevent_unsafe_class_deletion();
DROP FUNCTION IF EXISTS public.professor_remove_group_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.restore_class(UUID);
DROP FUNCTION IF EXISTS public.archive_class(UUID);

-- Note: classes.semester, classes.academic_year, classes.status, classes.archived_at
-- are kept (or may be dropped ONLY if intentionally desired and verified unused) so zero data is lost.

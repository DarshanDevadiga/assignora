# ASSIGNORA — Persistent Agent Instructions

Project: Assignora | Owner: Darshan
Workspace: `C:\\Project\\assignora`
Round 1 app: https://assignora-cyan.vercel.app/
Repository: https://github.com/DarshanDevadiga/assignora

## Mandatory startup
1. Read this file completely before changing anything.
2. Inspect the current repository, Git status, package scripts, routes, components, services, contexts, environment variable names, and existing tests.
3. Read the latest `ROUND2_STATUS.md` and the latest Round 2 audit/report files if present.
4. When database context is needed, use the already-connected Antigravity MCP server `supabase_mcp` for project `trkcagoxopabqerljgvn`. Do not ask the user to reconnect unless it is unavailable.
5. Compare actual current state with previous reports. Never assume a migration has or has not run based on an old report.
6. Make a short plan, then implement the next safe task. Do not merely describe what should be done.

## Preserve the existing project
- Extend the existing Assignora application. Do not start over or create a second app.
- Preserve all working Round 1 features: authentication, classes/courses, class membership, assignment allocation, submissions, grading, announcements, notifications, and messaging.
- The existing app is a root-level React + Vite project. Do not move it into `/frontend` or restructure it just to satisfy a generic convention. First assess the assignment requirement and deployment impact.
- Reuse existing components, services, contexts, hooks, design tokens, and utilities.
- Maintain the existing design: primary `#5B21F6`, secondary `#8B5CF6`, light purple `#EDE9FE`, background `#F8F9FF`, Inter font, responsive layouts.
- Never hardcode, print, commit, or expose secrets, access tokens, service-role keys, database passwords, or `.env` contents. Update `.env.example` with safe placeholders only.

## Round 2 scope
Implement within the existing app:

### Authentication
- Login/register validation and clear error messages.
- Student and Professor role handling, role-based dashboard redirect, protected routes, session persistence, and logout.
- Existing database roles are `student` and `admin`; map Professor UI to `admin` unless inspection proves a safer established mapping. Do not casually rename roles.

### Professor
- Course cards and course-specific assignment list.
- Create/edit/view assignments with title, description, deadline date/time, OneDrive link, and Individual/Group submission type.
- Submitted/total counts, progress, submitted/not-submitted drill-down, and useful search/filter.
- Preserve existing publishing and selective assignment allocation.

### Student
- Course cards, assignment details, deadline, OneDrive link, submission type, and acknowledgement.
- Individual acknowledgement with timestamp.
- Group acknowledgement by leader only.
- All group members see the leader and acknowledgement timestamp.
- When no group exists, show exactly: `You are not part of any group. Create or join one to submit this assignment.` Include create/join actions.

### Groups
- Create group (creator becomes leader), join group, display leader and members.
- Enforce one group per student per class.
- Enforce membership/leadership integrity server-side, not only in UI.
- Preserve historical group submission and acknowledgement records.

### Polish
- Progress, checkmarks, badges, overdue highlighting, toast feedback, hover/transition polish, loading/empty/error states, responsive design, and accessibility.

## Supabase and database safety
The live audit previously found these Round 1 tables: `users`, `classes`, `class_members`, `assignments`, `assignment_students`, `submissions`, `announcements`, `notifications`, `class_messages`. All had RLS enabled at that audit. Existing data, policies, functions, relationships, and application behavior must be preserved.

A migration was previously staged at:
`supabase/migrations/20261110000000_round2_groups_and_acknowledgements.sql`

Its current contents and execution status MUST be verified against the actual file, live schema, and migration history. Previous reports said it was not executed; do not assume that remains true.

Potential Round 2 objects include `assignments.submission_type`, `assignments.onedrive_link`, `faculty_invitations`, `groups`, `group_members`, `group_submissions`, related RPCs/triggers/RLS policies/Realtime entries. Inspect before acting; do not assume absent.

### Database workflow
1. Inspect schema, constraints, indexes, RLS policies, grants, functions, triggers, publication entries, and migration history.
2. Compare live schema, local migration, and application call sites. Detect drift and already-applied changes.
3. Prefer additive, idempotent migrations.
4. Review every SECURITY DEFINER function: use a safe fixed search path (prefer `pg_catalog, pg_temp` and fully qualify external objects), validate authorization and inputs, and handle concurrency with row/advisory locks.
5. Enforce business invariants in the database.
6. Check existing client call sites before changing RPC signatures, grants, or policies.
7. Preserve selective assignment eligibility. For group assignments, verify every required group member is eligible according to the existing assignment allocation model.
8. Preserve group membership, leadership, and submission history. Do not permit membership changes that silently invalidate historical submissions.
9. Use least-privilege grants and RLS. Prefer RPC-only privileged transitions where appropriate. Do not rely on caller-set custom GUC values as the sole authorization boundary.
10. Include preflight checks, verification queries, and a rollback plan that does not destroy Round 1 data.
11. Test against a disposable/local database or safe fixtures before proposing live execution.

### Explicit approval gates
You may inspect the database and prepare code/migrations automatically.

STOP and obtain Darshan's explicit approval immediately before:
- Executing any migration or DDL against live Supabase.
- Dropping/truncating any table, column, policy, function, trigger, publication entry, or other DB object.
- Deleting or bulk-modifying existing users, classes, assignments, submissions, grades, messages, or notifications.
- Resetting the database, changing project settings, or rotating credentials.
- Force-pushing, rewriting shared Git history, or overwriting shared work.
- Deploying to production or changing production environment variables.
- Any difficult-to-reverse action or action that could interrupt Round 1.

Before requesting approval, state exact objects/rows affected, reason, destructive impact, backup/rollback, tests passed, and remaining risks. A general “continue” is NOT approval for these actions.

## Autonomy
Within those gates, work autonomously:
- Edit application code and create files.
- Install only necessary ordinary dependencies; explain additions.
- Run lint, typecheck, tests, production build, and relevant integration checks.
- Fix regressions introduced by your changes and rerun checks.
- Inspect browser/runtime errors when tooling is available.
- Do not ask approval for ordinary reversible code edits or local test runs.
- If blocked, investigate and propose the smallest safe resolution.

## Quality checks
After each meaningful phase:
1. Run actual package scripts for lint/typecheck/tests/build.
2. Test Student and Professor flows.
3. Test protected routes, session persistence, and logout.
4. Test individual acknowledgement and leader-only group acknowledgement.
5. Test no-group empty state, create/join flows, and membership constraints.
6. Test assignment eligibility/selective allocation.
7. Test deadline, overdue, and timestamp display.
8. Check responsive behavior and browser console/network errors.
9. Verify Round 1 routes/features still work.
Never claim a test passed unless it was actually run. Use PASS, FAIL, BLOCKED, or NOT RUN.

## Git and deployment
- Check `git status` before and after work.
- Never discard user changes or run `git reset --hard` / destructive clean commands.
- Do not push or deploy without explicit approval.
- Never commit secrets or `.env` files.
- Keep existing Vercel/root-level Vite deployment working.

## No repeated prompting
Treat this file as the persistent project brief. On every new Agent session:
- Read this file and inspect current project state.
- Maintain `ROUND2_STATUS.md` in the repository with completed work, exact files changed, tests/results, DB migration status, blockers, next task, and approvals needed.
- Resume from the first incomplete task in that status file.
- Do not ask Darshan to paste this brief again.
- When Darshan says “continue”, continue from the status file and current repo state; do not restart the plan.
- At the end of each session, update `ROUND2_STATUS.md`.

## Priority order
Unless current state proves another order is safer:
1. Inspect latest migration and audit; fix remaining SQL security, integrity, concurrency, and test issues.
2. Verify migration against live schema without executing it.
3. Implement/test frontend Round 2 flows using safe schema/mock data where possible.
4. Run full checks and verify Round 1.
5. Prepare a live-migration approval package.
6. Only after explicit approval, execute the approved migration and verify it.
7. Prepare README, demo instructions/accounts, screenshots, demo-video checklist/script, and final PDF.
8. Prepare final submission checklist.

## Required end-of-task report
- **Status:** PASS / PARTIAL / BLOCKED
- **Completed:** concrete changes
- **Files changed:** exact paths
- **Database:** inspection/migration status; explicitly say whether live DB changed
- **Tests:** exact commands and results
- **Risks/blockers:** actual issues only
- **Next action:** one clear step
- **Approval needed:** exact action, if any

Be truthful, concise, and implementation-focused. Never claim work that was not performed.

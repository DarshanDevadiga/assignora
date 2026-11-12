# Assignora — Round 2 Implementation Status

**Project:** Assignora (Assign. Track. Achieve.)  
**Owner:** Darshan | **Candidate:** Joineazy Frontend Intern Round 2  
**Target Database:** `trkcagoxopabqerljgvn` (PostgreSQL 17.11 on Supabase ap-southeast-1)  
**Production URL:** https://assignora-cyan.vercel.app/  
**Repository:** https://github.com/DarshanDevadiga/assignora  
**Last Updated:** 2026-11-12T10:46:00+05:30  

---

## 1. Overall Progress Summary

| Phase / Objective | Status | Notes |
| :--- | :--- | :--- |
| **Optional Faculty Invitation Token (Frontend & Live DB Migration)** | **PASS (LIVE APPLIED & VERIFIED)** | Updated `Register.jsx` & `auth.service.js` so Faculty Invitation Token is optional (`validate_faculty_invitation` accepts empty tokens, rejects invalid/expired tokens before `auth.signUp()`). Live DB migration `round2_optional_faculty_invitation_token` applied & verified (`trkcagoxopabqerljgvn`) across `validate_faculty_invitation`, `handle_new_user`, and `register_user_profile` with `pg_catalog, pg_temp` search_path and unchanged `users` RLS |
| **Safe Management Actions (Classes, Groups, Assignments)** | **PASS** | Added 3-dot `ActionMenu`, `EditClassModal`, `EditGroupModal`, `ConfirmDeleteModal`, `ToastProvider`, impact summaries, archival workflows, student delete prevention, and submission-locked assignment editing across Admin/Professor/Student interfaces |
| **Staged Management SQL Migration Package** | **PASS (LIVE APPLIED & VERIFIED)** | Executed by owner on `trkcagoxopabqerljgvn` and verified read-only via `supabase_mcp`: 4 `classes` columns + `classes_status_check`, 7 `SECURITY DEFINER` (`pg_catalog, pg_temp`) functions, 2 `BEFORE DELETE` preservation triggers, student group-delete blocking active, and all existing data preserved (`classes: 11, assignments: 29, groups: 6, submissions: 39, group_submissions: 6`) |
| :--- | :--- | :--- |
| **Phase 1: Full System Audit** | **PASS** | Validated 9 Round 1 tables, 10 functions, and live schema |
| **Manifest Ownership Tracking** | **PASS** | 57 total objects recorded in `_assignora_migration_manifest` |
| **Baseline Migration** | **PASS** | `20261110000000_round2_groups_and_acknowledgements.sql` live applied & verified |
| **Advanced Migration** | **PASS** | `20261110000001_round2_advanced_groups_and_roster.sql` live applied & verified |
| **Authoritative Membership Query** | **PASS** | Single authoritative `getStudentGroupInCourse(classId, studentId)` implemented |
| **4-State Membership Machine** | **PASS** | `loading_membership`, `membership_found`, `membership_not_found`, `membership_error` in `AssignmentDetails.jsx` |
| **Empty Group State Guard** | **PASS** | Exact text `"You are not part of any group. Create or join one to submit this assignment."` shown only on verified absence |
| **Selective Allocation Guard** | **PASS** | Validates `assign_to_all` and `assignment_students` prior to group submission |
| **Notification Realtime Dedup** | **PASS** | Channel reference tracking in `NotificationContext.jsx` prevents duplicate connections |
| **Audio AbortError Guard** | **PASS** | Unhandled promise rejection suppression in `main.jsx` for browser audio interruptions |
| **Admin Group Assignment Open Work** | **PASS** | Unified navigation reusing `/admin/assignments/:id?groupId=...` with auto-inspection modal & deliverable links |
| **Post-Login Role Redirection** | **PASS** | Deterministic role-based redirects (`/admin` vs `/student`) eliminating cross-session `state.from` bleed |
| **Logout Security Teardown** | **PASS** | Purges in-memory caches, unregisters Realtime channels, clears localStorage profile & sessionStorage |
| **Premium Visual Design & Animations** | **PASS** | Semantic CSS tokens, selective glowing accents, GPU page/modal transitions, skeleton shimmers, prefers-reduced-motion |
| **Bundle & Performance Optimization** | **PASS** | Lazy-loaded routes, manualChunk splitting (`confetti`, `icons`, `vendor`), 0 duplicate requests |
| **Group Detail Crash Fix & Context-Aware Back** | **PASS** | TDZ eliminated in `GroupDetailsPage.jsx`; contextual back navigation with matching labels across Student & Professor flows |
| **React Runtime Error Repair & Static Audit** | **PASS** | `useMemo` & `classDetails` errors resolved; static scan across 65 files confirmed 0 missing hook imports or dangling references |
| **WebSocket Lifecycle Stabilization** | **PASS** | Ref-based Realtime subscribers eliminate duplicate teardown loops and socket closed 1006 aborts |
| **Student Group Open Work Repair** | **PASS** | Replaced `canManage` gating with role checks; leaders & members open `/student/assignments/:id` |
| **Realtime Lifecycle & Channel Sharing** | **PASS** | Shared `assignora-realtime` channel, in-memory bus subscription, safe unmount & logout cleanup |
| **Zero-Runtime-Error Stabilization** | **PASS** | Eliminated hooks-after-returns in `AssignmentDetails.jsx` & `CreateAssignment.jsx`; invariant hook execution |
| **ESLint React Hooks Enforcement** | **PASS** | Configured `npm run lint` with `react-hooks/rules-of-hooks: error`; 0 errors across 65 source files |
| **Admin View Work & URL Sanitization** | **PASS** | Purple "View Work" button opens work viewer modal; `sanitizeUrl` prevents relative navigation bouncing to dashboard |
| **Assignment Details & Tracking UI** | **PASS** | Responsive header, summary banner, 5 equal-height metric cards, aligned table headers, zero viewport overflow |
| **Deliverable URL & Open Work In New Tab** | **PASS** | `resolveDeliverableUrl` differentiates external links, OneDrive folders, and relative routes; `RoleRoute` cross-role translation prevents dashboard redirects |
| **Course Details & Class-Specific Navigation** | **PASS** | Course cards navigate to `/admin/classes/:id`; sidebar has distinct "Classes" & "Assignments" links; "Create Assignment" retains class context |
| **Grading Modal Lifecycle & Controlled Actions** | **PASS** | Eliminated auto-open useEffect; modal ONLY opens on explicit user click ("Edit Grade", "Grade Group", "View Work"); atomic group & submission loading via Promise.all; accurate deliverable vs acknowledgement statuses |
| **Centralized Production URL & Email Verification** | **PASS** | `getAppUrl()` & `getAuthRedirectUrl()` enforce HTTPS and `https://assignora-cyan.vercel.app/`; `AuthCallback.jsx` handles PKCE code, OTP token hash, and session redirection; zero localhost redirects |
| **Real Submitted Work Viewer & Multi-Format Pipeline** | **PASS** | Dedicated `SubmittedWorkViewerModal` displays real deliverables (embedded PDF preview, Google Drive viewer, Office docs, code repos, cloud links); classifies empty/circular links as `acknowledgement_only` without blank frames; dual-mode student upload pipeline |
| **Group Submission Cards Layout** | **PASS** | Replaced wide horizontal table with modern 2-column card grid (`GroupSubmissionCard.jsx`) across Admin, Professor, and Student dashboards |
| **Group Assignments Initial Zero Fix** | **PASS** | Eliminated lazy-loading tab gating; immediate fetch on mount; state machine with skeletons & Retry; zero false empty states |
| **Remove Quick Demo Accounts** | **PASS** | Removed Quick Demo Accounts section, buttons, and handlers from Login.jsx; balanced spacing; standard email/password auth preserved |
| **Registration, Profiles & Class Enrollment RLS Fix** | **PASS** | Fixed 406 `.single()`, added profile auto-provisioning, fixed 403/RLS enrollment pipeline; SQL migration `20261111162141` live applied & verified |
| **Global UI/UX, Modal Portal & Responsive Repair** | **PASS** | Refactored Modal & NotificationsDrawer to `document.body` portals via shared `overlayManager`, removed CSS `transform` trap on `.page-enter`, added Tailwind z-index scale, fixed dropdown clipping, unified responsive shell across 7 viewports |
| **Full Application Performance Optimization** | **PASS** | Route/modal/icon/confetti code-splitting (`index.js` 76.6→52.8 kB, `ClassDetailPage` 102.3→50.8 kB), hover/idle route prefetching, `dataCache` SWR + in-flight dedup, `Promise.all` parallelization & duplicate query elimination, memoized contexts/cards, lazy image decoding |
| **Group Messages Migration** | **PASS** | `20261110000002_round2_group_messages.sql` live applied & verified (`public.group_messages` active with RLS; 7 objects in manifest) |
| **Production Build Check** | **PASS** | `vite build` completed cleanly (0 errors) |

---

## 2. Concrete Work Completed

-1. **Optional Faculty Invitation Token (`2026-11-12`, LIVE APPLIED & VERIFIED)**:
   - **Frontend Form & Auth Service**: Updated [Register.jsx](file:///c:/Project/assignora/src/pages/Register.jsx) (`Faculty Invitation Token (Optional)` label, non-required input, helper text `"If you have an invitation token from your department administrator, enter it here. Otherwise, you can leave this field empty."`, targeted token error handling) and [auth.service.js](file:///c:/Project/assignora/src/services/auth.service.js) (only validates non-empty tokens pre-signup; never creates partial auth accounts on invalid/expired tokens).
   - **SQL Migration Package (LIVE APPLIED & VERIFIED)**: Applied `round2_optional_faculty_invitation_token` ([20261112000001_round2_optional_faculty_invitation_token.sql](file:///c:/Project/assignora/supabase/migrations/20261112000001_round2_optional_faculty_invitation_token.sql)) on `trkcagoxopabqerljgvn` via `supabase_mcp` `apply_migration`, verified via read-only `execute_sql` (`validate_faculty_invitation`, `handle_new_user`, `register_user_profile` with `prosecdef: true`, `search_path=pg_catalog, pg_temp`, trigger `on_auth_user_created`, `users_insert_policy` / `users_update_policy`, and untouched `admin: 2, student: 6` counts). Rollback available at [rollback_round2_optional_faculty_invitation_token.sql](file:///c:/Project/assignora/supabase/migrations/rollback_round2_optional_faculty_invitation_token.sql).
   - **Verification**: Created [verify-faculty-optional-token.js](file:///c:/Project/assignora/scripts/verify-faculty-optional-token.js) and updated [verify-registration-profiles-and-enrollment-rls.js](file:///c:/Project/assignora/scripts/verify-registration-profiles-and-enrollment-rls.js).

0. **Safe Admin/Professor Management Actions (`2026-11-12`)**:
   - **Shared Infrastructure**: Created [ToastContext.jsx](file:///c:/Project/assignora/src/context/ToastContext.jsx) (mounted in [App.jsx](file:///c:/Project/assignora/src/App.jsx)), [ActionMenu.jsx](file:///c:/Project/assignora/src/components/common/ActionMenu.jsx), [ConfirmDeleteModal.jsx](file:///c:/Project/assignora/src/components/common/ConfirmDeleteModal.jsx), [EditClassModal.jsx](file:///c:/Project/assignora/src/components/class/EditClassModal.jsx), and [EditGroupModal.jsx](file:///c:/Project/assignora/src/components/group/EditGroupModal.jsx).
   - **Service Safeguards**: Hardened [classes.service.js](file:///c:/Project/assignora/src/services/classes.service.js), [assignments.service.js](file:///c:/Project/assignora/src/services/assignments.service.js), and [groups.service.js](file:///c:/Project/assignora/src/services/groups.service.js) with `getClassImpactSummary`, `getAssignmentImpactSummary`, `getGroupImpactSummary`, `archiveAssignment`, `restoreAssignment`, `archiveCourseGroup`, `updateGroupDetails`, and strict refusal of destructive cascades whenever submissions, grades, assignments, groups, or members exist.
   - **UI Integration & Role Guards**: Wired 3-dot `ActionMenu`, edit modals, and `ConfirmDeleteModal` across [AdminDashboard.jsx](file:///c:/Project/assignora/src/pages/admin/AdminDashboard.jsx), [ClassesManagement.jsx](file:///c:/Project/assignora/src/pages/admin/ClassesManagement.jsx), [ClassDetailPage.jsx](file:///c:/Project/assignora/src/pages/shared/ClassDetailPage.jsx), [AssignmentsList.jsx](file:///c:/Project/assignora/src/pages/admin/AssignmentsList.jsx), [CreateAssignment.jsx](file:///c:/Project/assignora/src/pages/admin/CreateAssignment.jsx), [SubmissionTracking.jsx](file:///c:/Project/assignora/src/pages/admin/SubmissionTracking.jsx), [ClassGroupsTab.jsx](file:///c:/Project/assignora/src/components/class/ClassGroupsTab.jsx), [GroupDetailsModal.jsx](file:///c:/Project/assignora/src/components/group/GroupDetailsModal.jsx), and [GroupDetailsPage.jsx](file:///c:/Project/assignora/src/pages/shared/GroupDetailsPage.jsx); removed student leader group disband/delete actions across [GroupManagementModal.jsx](file:///c:/Project/assignora/src/components/group/GroupManagementModal.jsx), [GroupDetailsModal.jsx](file:///c:/Project/assignora/src/components/group/GroupDetailsModal.jsx), and [GroupDetailsPage.jsx](file:///c:/Project/assignora/src/pages/shared/GroupDetailsPage.jsx).
   - **Staged SQL Migration (LIVE APPLIED & VERIFIED)**: Created and applied [20261112000000_round2_safe_management_actions.sql](file:///c:/Project/assignora/supabase/migrations/20261112000000_round2_safe_management_actions.sql) with [post_migration_verification_management.sql](file:///c:/Project/assignora/supabase/migrations/post_migration_verification_management.sql) and [rollback_round2_management_actions.sql](file:///c:/Project/assignora/supabase/migrations/rollback_round2_management_actions.sql). Live read-only verification on `trkcagoxopabqerljgvn` confirmed all 4 `classes` columns (`academic_year`, `archived_at`, `semester`, `status`), `classes_status_check`, all 7 `SECURITY DEFINER` functions with `search_path=pg_catalog, pg_temp`, both `BEFORE DELETE` triggers (`trg_prevent_unsafe_assignment_deletion`, `trg_prevent_unsafe_class_deletion`), and untouched row counts (`classes: 11, assignments: 29, groups: 6, submissions: 39, group_submissions: 6`).

1. **Class People Directory Overhaul (`ClassDetailPage.jsx`)**:
   - Fixed bug where students only saw themselves due to strict peer RLS policies.
   - Added `classesService.getClassRoster(classId)` which calls `get_class_roster` RPC with relation-fallback.
   - Added `is_class_member` and `is_classmate_of` `SECURITY DEFINER` helpers in database to prevent RLS recursion on `class_members` and `users`.
   - Displays dedicated Course Instructor card with avatar, email, and role badge.
   - Enrolled Students directory with:
     - Student Name, Email, and Avatar.
     - Group Badges: `Leader • [Group Name]` (Purple), `[Group Name]` (Blue), or `No Group Yet` (Gray).
     - Filter Pills: `All`, `Leaders`, `In a Group`, `Without Group` with live count badges.
     - Real-time search filter filtering by student name or email.
     - Accurate total enrolled count: `totalEnrolledStudents`.

2. **Professor Group Creation Modal (`ProfessorCreateGroupModal.jsx`)**:
   - Professors can create groups directly with enrolled members.
   - Student selection checklist showing student name, email, and current group status.
   - Students already in another group are clearly tagged `In group: [Group Name]` and disabled.
   - Dynamic Leader selector dropdown: professor selects who among the chosen students will be the Group Leader.
   - Invokes `groupsService.professorCreateGroup` with full validation.

3. **Group Leader Member Selection (`AddGroupMembersModal.jsx`)**:
   - Group leaders and professors can add eligible unassigned students directly from the group details modal.
   - Searchable checklist of enrolled students who do not yet belong to any group.
   - Instant membership updates upon submission.

4. **Group Leadership Transfer & Member Leave/Disband (`GroupDetailsModal.jsx`)**:
   - Current leader can select any member and click "Make Leader" to transfer leadership.
   - Confirmation dialog protects against accidental transfers.
   - Ordinary members can leave the group via "Leave Group" confirmation dialog.
   - Sole-member leaders can cleanly disband the group via "Disband Group" action.
   - Academic history is preserved if submissions exist: group is safely archived (`action: 'archived'`).

5. **Student & Professor Group Assignment Workflows (`AssignmentDetails.jsx` & `SubmissionTracking.jsx`)**:
   - Exact required empty state text: `"You are not part of any group. Create or join one to submit this assignment."`
   - Group Leader Acknowledgement button: `"Yes, I have submitted"` with confirmation dialog.
   - Shared Group Member Status: `"Acknowledged by [Leader Name] on [Date and Time]"` for all members.
   - Non-leader status prior to submission: `"Not submitted by group leader"`.
   - Dual-list Professor tracking: **SUBMITTED GROUPS** and **NOT SUBMITTED GROUPS** with progress bar and CSV export.

6. **Database Migration Execution (`trkcagoxopabqerljgvn`)**:
   - Executed `supabase/migrations/20261110000001_round2_advanced_groups_and_roster.sql`.
   - Verified catalog via `post_migration_verification_advanced.sql`.
   - 57 objects recorded in `public._assignora_migration_manifest`.

8. **Group Details Modal Redesign (`GroupDetailsModal.jsx`)**:
   - Modern tabbed layout with 4 responsive sections: `Overview`, `Members`, `Group Assignments`, and `Group Chat`.
   - Complete group name display preventing awkward clipping; secondary course name styling.
   - Quick statistics grid (members, group tasks, submitted, pending) and designated leader spotlight.
   - 1-click leadership transfer, member addition modal, and safe leave/disband dialogs.

9. **Private Group Discussion Chat**:
   - Private discussion workspace embedded inside `GroupDetailsModal.jsx`.
   - Strict access gating: only active group members and class instructors can view or send messages.
   - Real-time message streaming over Supabase Realtime channel `group-discussion:[groupId]`.
   - Prepared migration package `20261110000002_round2_group_messages.sql`, rollback script, and verification script with full manifest tracking.

10. **Chat Duplicate Elimination Engine (`messages.service.js`)**:
    - Reconciles optimistic temporary IDs (`opt-*`) with server-persisted database UUIDs upon response receipt.
    - Canonical message deduplication by persisted database ID across concurrent initial fetches, Realtime INSERTs, and broadcast channels.
    - Prevents rapid double-sending through `isSending` button locking and form guards.

11. **Group Assignment History & Allocation Filtering (`groups.service.js` & `SubmissionTracking.jsx`)**:
    - Strictly filters assignments belonging to the group's class with `submission_type = 'group'`.
    - Enforces selective assignment allocation: if `assign_to_all = false`, all group members must be assigned in `assignment_students`. Unallocated assignments are hidden from the group.
    - Isolates submissions: only displays the selected group's acknowledgement status and timestamps.
    - Professor's `SubmissionTracking.jsx` dynamically computes eligible groups based on selective allocation rules.

12. **Dedicated Group Details Page (`GroupDetailsPage.jsx`)**:
    - Full-page routing under `/classes/:classId/groups/:groupId` (and `/admin/...`, `/student/...` subpaths).

13. **Simplified Manage Team Interface (`GroupManagementModal.jsx`)**:
    - Clicking "Manage Team" now renders exclusively the management view for the selected existing group.
    - Removed extraneous "Create New Group" and "Browse & Join Groups" tabs from Manage Team.
    - Preserved independent group creation and joining on the Class Groups page (`ClassGroupsTab.jsx`).
    - Removed misleading demo labels such as "(Demo)" from real group data by eliminating tab title templating.
    - Features: Group name, Course name, Status badge (`Active`/`Archived`), Member count, Group leader highlight, complete scrollable member roster with student IDs, 1-click leadership transfer, "Add Members" button triggering `AddGroupMembersModal`, Leave/Disband group with confirmation dialogs, and clean Done action.

14. **High-Performance Group Caching & Parallelized Data Loading (`groups.service.js`)**:
    - Implemented in-memory cache `groupCache` (TTL 60s) for `getGroupById`, `getCourseGroups`, `getStudentGroupInCourse`, `getGroupAssignmentHistory`, and `getClassStudentsGroupStatus`.
    - Parallelized independent database queries using `Promise.all` in `getGroupById` (group record + members).
    - Resolved leader user profile directly from members array, eliminating redundant network roundtrips.
    - Automated cache invalidation via `invalidateGroupCache` across all mutation RPCs (`createCourseGroup`, `joinCourseGroup`, `leaveCourseGroup`, `transferGroupLeadership`, `disbandCourseGroup`, `acknowledgeGroupAssignment`, `professorCreateGroup`, `addGroupMembers`).
    - Lazy-loaded assignment history in `GroupDetailsModal.jsx` and `GroupDetailsPage.jsx` (only loads upon navigating to the `assignments` tab).
    - Lazy-loaded group discussion chat and Realtime channel subscriptions (only connects when the `chat` tab is active).

15. **Sidebar Navigation Role-Based Cleanup (`Sidebar.jsx` & `MobileNav.jsx`)**:
    - Centrally removed the "Assignments" navigation item from the primary sidebar for Professor and Admin roles (`adminNav` in `Sidebar.jsx` and `items` in `MobileNav.jsx`).
    - Preserved "Assignments" in the student navigation.
    - Kept all in-course assignment routes, assignment creation/editing, grading, submission tracking, and student assignment details completely functional.

16. **Role-Based Group Chat Message Badges & Styling (`GroupDetailsModal.jsx` & `GroupDetailsPage.jsx`)**:
    - Created `getMessageSenderMeta(msg)` that resolves roles based on trusted database sender records:
      - **Professor / Instructor:** Actual sender name, visible purple "Professor" badge, purple avatar/initials, and subtle purple-tinted message bubble.
      - **Administrator:** Actual sender name, visible blue "Admin" badge, blue avatar, and subtle blue-tinted message bubble.
      - **Group Leader:** Actual sender name, visible amber "Leader" badge with Crown icon, amber avatar, and distinct styling.
      - **Student Member:** Actual sender name, clean member styling.
    - Full responsiveness across mobile, tablet, and desktop without text overflowing.
    - Breadcrumbs with "Back to Course Groups" button returning directly to the class Groups tab.
    - Group header card with leader spotlight, member count, and responsive status pills.
    - Four organized tabs: `Overview`, `Members`, `Group Assignments`, and `Private Group Chat`.
    - Realtime message synchronization with optimistic message deduplication.
    - Context-aware modal workflows for adding members, transferring leadership, leaving, and disbanding.

17. **Flicker-Free Delayed Group Membership State (`ClassGroupsTab.jsx`)**:
    - Implemented explicit 4-state machine: `'loading'`, `'member'`, `'not_member'`, `'error'`.
    - Uses authoritative `getStudentGroupInCourse(classId, studentId)` database query.
    - Eliminates UI flicker where "Create Group" button and "You are not part of any group" banner previously flashed before membership loaded.
    - Renders smooth loading skeletons while verifying membership and safe retry alerts on database query error.

18. **Admin Group Assignment Open Work (`GroupDetailsModal.jsx`, `GroupDetailsPage.jsx`, `SubmissionTracking.jsx`)**:
    - Reused existing working `/admin/assignments/:assignmentId?groupId=:groupId&classId=:classId` route rendered by `SubmissionTracking.jsx`.
    - Removed broken navigation to student-restricted routes that bounced administrators out to the dashboard.
    - Added `searchParams.get('groupId')` auto-detection to automatically find and open the Group Submission Inspection & Grading Modal.
    - Displays full deliverable link with prominent "Open Work in New Tab" button, assignment description, course OneDrive link (`Cloud` icon), leader notes, participating member pills, and score/feedback grading controls.
    - History-safe cleanup of `groupId` from URL parameters when closing the modal so browser Back returns smoothly to the group details page.

19. **Deterministic Post-Login Role Redirection (`Login.jsx`, `ProtectedRoute.jsx`)**:
    - Eradicated cross-account session bleed where logging in as a different user restored the previous user's last visited page via `location.state.from`.
    - Fresh login strictly navigates to the authenticated user's role dashboard (`/admin` for Professor/Admin, `/student` for Student) with `{ replace: true }`.
    - Protected route unauthenticated redirect strips sticky `from` state (`<Navigate to="/login" replace />`).
    - Seamlessly preserves public class join/invite URLs (`?code=...` or `/join-class`).

20. **Comprehensive Logout Security Teardown (`AuthContext.jsx`)**:
    - In-memory group/roster/assignment cache purged via `groupsService.invalidateGroupCache()`.
    - All active Realtime WebSocket channels unregistered via `supabase.removeAllChannels()`.
    - Cached profile removed from `localStorage` (`assignora_user_profile_cache`).
    - Session storage completely cleared via `sessionStorage.clear()`.

21. **Premium Visual Design, Micro-Animations & Glow System (`src/index.css`, `tailwind.config.js`)**:
    - Established centralized semantic tokens: `--brand-primary` (`#5B21F6`), `--brand-secondary` (`#8B5CF6`), `--brand-glow`, `--surface-secondary` (`#F8F9FF`), and layered card shadows.
    - Added GPU-accelerated micro-animations: 220ms page entrance (`page-enter`), modal scale entrance (`modal-enter`), and shimmer wave (`skeleton-shimmer`).
    - Applied selective glowing accents: primary action buttons, active navigation item halo (`nav-active-glow`), form input focus rings (`focus:shadow-glow-sm`), and unread alert badges (`shadow-rose-500/40`).
    - Added full accessibility support with `@media (prefers-reduced-motion: reduce)` disabling transforms and loops.

22. **Performance & Bundle Optimization (`vite.config.js`, `AppRoutes.jsx`)**:
    - Code-split heavy external dependencies: `canvas-confetti` isolated into its own `10.67 kB` chunk (`confetti-oQXWb4Lk.js`), eliminating celebration code from critical initial loads.
    - Vendor bundle chunking preserves snappy initial route responses.
    - Database queries benchmarked with 0 duplicate HTTP requests across student and professor flows.

23. **Group Detail TDZ Crash Resolution & Context-Aware Assignment Back Navigation (`GroupDetailsPage.jsx`, `AssignmentDetails.jsx`, `SubmissionTracking.jsx`)**:
    - Eliminated `ReferenceError: Cannot access 'hasChatAccess' before initialization` in `GroupDetailsPage.jsx` by initializing all derived authorization and membership states (`members`, `isLeader`, `isTeacher`, `isMember`, `canManage`, `hasChatAccess`) immediately after component state declarations, prior to any `useEffect` hook.
    - Context-aware back navigation propagates origin context (`from: 'class'`, `'group'`, `'assignments'`) so clicking Back returns directly to the referring view with matched labels:
      - "Back to Class Assignments" -> `/{role}/classes/{classId}?tab=assignments`
      - "Back to Group" -> `/{role}/classes/{classId}/groups/{groupId}?tab=assignments`
      - "Back to Assignments" -> `/{role}/assignments`
    - Direct URLs and page refreshes gracefully fall back to the assignment's actual course (`assignment.class_id`), avoiding stale history.

24. **React Runtime Error Repair & Complete Static Audit (`GroupDetailsPage.jsx`, `ClassDetailPage.jsx`)**:
    - Fixed `ReferenceError: useMemo is not defined` in `GroupDetailsPage.jsx:75` by importing `useMemo` from `react`.
    - Fixed `ReferenceError: classDetails is not defined` in `ClassDetailPage.jsx:1278, 1297, 1316` by resolving `currentClass?.id || classId`.
    - Executed an automated static AST and pattern audit across all 65 `.jsx` and `.js` source files in `src/`, verifying complete imports for all React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`) and router hooks (`useNavigate`, `useLocation`, `useParams`).
    - Confirmed 0 remaining instances of undeclared variables or dangling references.

25. **Realtime WebSocket Lifecycle & Code 1006 Socket Stabilization (`NotificationContext.jsx`, `GroupDetailsPage.jsx`, `GroupDetailsModal.jsx`)**:
    - Eliminated rapid disconnect/reconnect loops that triggered browser `socket closed: 1006` errors.
    - Substituted mutable dependencies (`members`, `currentUser`) in `GroupDetailsPage.jsx` and `GroupDetailsModal.jsx` with stable refs (`membersRef`, `currentUserRef`).
    - Channel effect dependencies reduced to stable identifiers `[activeTab, group?.id, hasChatAccess]`.
    - In `NotificationContext.jsx`, introduced connection tracking with `connectedUserRef` to bypass redundant teardowns on context re-renders.

26. **Student Group Assignment "Open Work" Redirection Fix (`GroupDetailsPage.jsx`, `GroupDetailsModal.jsx`, `AssignmentDetails.jsx`)**:
    - Root cause: "Open Work" action was wrapped in `canManage` (`isLeader || isTeacher`). When a student group leader clicked "Open Work", it called `navigate('/admin/assignments/:id?groupId=...')`. `<RoleRoute requiredRole="admin">` intercepted the student user and redirected them to `/student` (dashboard).
    - Fixed action routing: strictly gated `/admin/...` behind `isTeacher` (`user.role === 'admin'`). All students (both leaders and members) navigate to `/student/assignments/:id` with complete navigation context (`state: { from: 'group', classId, groupId, tab: 'assignments' }`).
    - Added fallback group resolution in `AssignmentDetails.jsx`: if the course-level lookup returns null, it falls back to inspecting `location.state.groupId` or URL search parameters and validating membership in `explicitGroup.members`.

27. **Supabase Realtime Channel Sharing & In-Memory Bus Architecture (`NotificationContext.jsx`, `messages.service.js`, `AuthContext.jsx`)**:
    - Unified the global broadcast lifecycle: `NotificationContext` now reuses the single channel managed by `messagesService.getChannel()`, eliminating competing duplicate channels and connection teardowns.
    - Subscribed `NotificationContext` to `messagesService.subscribe` for 0ms instantaneous intra-tab message counts and alerts.
    - Added `messagesService.cleanupRealtime()` invoked on logout in `AuthContext.signOut()`, cleanly releasing channel topics without unhandled WebSocket transport aborts.

28. **Application-Wide Zero-Runtime-Error Stabilization & ESLint React Hooks Enforcement (`AssignmentDetails.jsx`, `CreateAssignment.jsx`, `.eslintrc.cjs`, `package.json`)**:
    - Eliminated fatal React Rules of Hooks violations where `backNavigation = useMemo(...)` was declared after conditional returns (`if (loading) return`, `if (initialLoading) return`) in both `AssignmentDetails.jsx` and `CreateAssignment.jsx`.
    - Moved all hook declarations to the top level of each component, ensuring invariant hook execution quantity and order across initial load, loaded data, empty data, error, and refresh states.
    - Integrated ESLint with `eslint-plugin-react-hooks` (`rules-of-hooks: error`, `exhaustive-deps: warn`) and added `npm run lint` command to `package.json`.
    - Executed automated AST and lint audits across all 65 source files: **0 errors** across the codebase.

29. **Admin & Professor "View Work" Action & Submission Tracking UI Overhaul (`SubmissionTracking.jsx`, `calculations.js`, `ClassDetailPage.jsx`, `GroupDetailsPage.jsx`, `GroupDetailsModal.jsx`, `AssignmentDetails.jsx`, `StudentSubmissions.jsx`)**:
    - **Root Cause Resolved**: In `SubmissionTracking.jsx`, the purple "View Work" element was an anchor tag `<a href={row.submission_link}>`. If a student or test entered an internal route (e.g. `/student/assignments/:id`) or an external URL without `https://` (e.g. `onedrive.live.com/...`), clicking it caused internal relative browser navigation. Because the active user is an Admin/Professor (`role === 'admin'`), `<RoleRoute requiredRole="student">` or undefined route handlers intercepted the request and redirected the user to the Dashboard (`/admin`).
    - **Comprehensive Work Viewer Modal**: Replaced raw anchor links in both group and student tables with an interactive `<Button variant="primary" icon={Eye} onClick={() => openGroupGradingModal(row)}>View Work</Button>` that directly opens Assignora's comprehensive work viewer modal displaying the full assignment title, description, group leader, members, timestamp, leader submission note, and grading controls without navigating away from the page.
    - **Safe URL Sanitization Engine (`sanitizeUrl`)**: Added and exported `sanitizeUrl` in `src/utils/calculations.js`. Guarantees all external links (`onedrive_link`, `submission_link`, `drive_link`) are normalized to absolute `https://` URLs with `rel="noopener noreferrer"`, completely eliminating relative route collisions across all 7 assignment and submission components.
    - **Responsive Page Header & Dropdown Alignment**: Aligned page title, subtitle, Back to Class Assignments button, and Switch Assignment dropdown into a responsive flex layout (`flex-col lg:flex-row lg:items-center lg:justify-between gap-4`) with explicit dropdown widths (`w-full sm:w-auto min-w-[220px] max-w-full sm:max-w-xs`), preventing overlap across all desktop, tablet, and mobile viewports (1440px, 1280px, 1024px, 768px, 430px, 375px).
    - **5 Equal-Height Metric Cards**: Standardized the 5 summary cards (Total Groups, Acknowledged, Unacknowledged, Graded Groups, Awaiting Grading) with equal heights (`h-full`), identical card styling (`border border-brand-line/60 shadow-2xs p-3.5 sm:p-4`), and clean responsive column grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`).
    - **Table Header & Column Alignment**: Enforced explicit alignments (`text-left`, `text-center`, `text-right`) and `min-w` on all table headers matching table cells, wrapped member badges cleanly (`flex flex-wrap gap-1 max-w-xs`), and self-contained tables in `overflow-x-auto rounded-xl border border-brand-line/60` containers to eliminate whole-page horizontal scrolling.
    - **Verification**: Created `scripts/verify-admin-view-work-and-tracking-ui.js` passing 4/4 tests, with all 7 suites passing (42 tests, 0 failures) and production build passing in 14.80s.

30. **Critical Navigation Fix: Open Work In New Tab, Course Details & Assignment Context (`RoleRoute.jsx`, `calculations.js`, `AdminDashboard.jsx`, `Sidebar.jsx`, `SubmissionTracking.jsx`, `CreateAssignment.jsx`, `ClassDetailPage.jsx`)**:
    - **Root Cause of Dashboard Redirect**: In `group_submissions`, users had submitted self-referential assignment URLs (e.g. `http://localhost:5173/student/assignments/:id`). When an Admin clicked "Open Work in New Tab", the new tab loaded `/student/assignments/:id`. `<RoleRoute requiredRole="student">` detected `user.role === 'admin'` and bounced the user to `/admin` (Admin Dashboard). Furthermore, `sanitizeUrl` previously converted root-relative paths like `/student/assignments/:id` into invalid external URLs like `https://student/assignments/:id`.
    - **Intelligent Cross-Role Route Translation (`RoleRoute.jsx`)**: Enhanced `RoleRoute` so that when an authenticated Admin visits a student route (or vice versa), it seamlessly translates between `/student/assignments/:id` $\leftrightarrow$ `/admin/assignments/:id` and `/student/classes/:id` $\leftrightarrow$ `/admin/classes/:id` instead of kicking the user back to the dashboard.
    - **Deliverable Resolution Engine (`resolveDeliverableUrl`)**: Built `resolveDeliverableUrl` in `src/utils/calculations.js` to intelligently differentiate between external deliverable URLs (OneDrive, Google Drive, GitHub), course-level shared OneDrive folders, and self-referential assignment pages. For self-referential links, it translates them to the viewer route or provides clear fallback options.
    - **Admin Course Card Navigation Fix (`AdminDashboard.jsx`)**: Updated course cards under "Courses Taught" to navigate to `/admin/classes/:id` instead of `/admin/assignments?classId=:id`.
    - **Sidebar Navigation Structure Restored (`Sidebar.jsx`)**: Re-added `{ name: 'Assignments', path: '/admin/assignments', icon: ClipboardList }` to `adminNav` alongside `Classes`. Now clicking "Classes" navigates to classes list, opening a class keeps "Classes" active, and clicking "Assignments" opens the global assignments view.
    - **Class-Specific Assignment Creation Context (`CreateAssignment.jsx` & `ClassDetailPage.jsx`)**: "Create Assignment" button in `ClassDetailPage.jsx` passes `classId` in both search query and state (`/admin/assignments/create?classId=${classId}`). `CreateAssignment.jsx` pre-selects the class and safely navigates back to `/admin/classes/:id?tab=assignments` upon completion.
    - **Verification**: Created `scripts/verify-course-details-and-open-work.js` passing 5/5 tests. All 8 test suites (47/47 tests) pass, ESLint reports 0 errors across 65 files, and `npm run build` succeeds cleanly.

31. **Group Grading Modal Controlled Lifecycle & Centralized Production Auth URL (`SubmissionTracking.jsx`, `appUrl.js`, `auth.service.js`, `AuthCallback.jsx`, `AppRoutes.jsx`, `InviteStudentModal.jsx`, `.env.example`)**:
    - **Root Cause of Grading Modal Auto-Open**: In `SubmissionTracking.jsx`, a `useEffect` monitored `targetGroupId = searchParams.get('groupId')` and called `openGroupGradingModal(match)`. Because `courseGroups` and `groupSubmissions` loaded asynchronously in separate sequential setState calls, the group was matched in `groupRows.notSubmitted` with empty submissions, opening the modal automatically and falsely claiming "Pending Submission" even after a grade had already been saved.
    - **Strictly Controlled Modal Lifecycle**: Eliminated the auto-open `useEffect` completely. The grading modal now ONLY opens upon deliberate user click ("Edit Grade", "Grade Group", "View Work"). Initial load, assignment loading, assignment switching, and returning from other pages keep the modal strictly closed.
    - **Atomic Group & Submission Loading**: Replaced sequential calls with `Promise.all([groupsService.getCourseGroups(...), groupsService.getAllGroupSubmissionsForAssignment(...)])`, updating `currentAssignment`, `courseGroups`, and `groupSubmissions` together without transient half-loaded states.
    - **Status Accuracy (Deliverable vs Acknowledgement)**: Separated `hasAcknowledged` from `hasDeliverable`. Badges and modal cards accurately display `Graded`, `Deliverable Submitted`, or `Acknowledged (No Deliverable Attached)` rather than assuming an uploaded file.
    - **Centralized Production URL Helper (`src/utils/appUrl.js`)**: Created `getAppUrl()` and `getAuthRedirectUrl(path)`. Defaults to `https://assignora-cyan.vercel.app` in production and enforces HTTPS, while cleanly supporting local development.
    - **Production Registration & Password Reset Redirects (`auth.service.js`)**: `authService.signUp` passes `options: { emailRedirectTo: getAuthRedirectUrl('/auth/callback') }`. `authService.resetPasswordForEmail` passes `redirectTo: getAuthRedirectUrl('/login')`.
    - **Dedicated Auth Callback Handler (`src/pages/AuthCallback.jsx`)**: Handled PKCE code exchange, token hash verification, session retrieval, error display, and immediate role-based redirection (`/admin` vs `/student`).
    - **Verification**: Created `scripts/verify-grading-modal-lifecycle-and-auth-url.js` passing 16/16 tests. Combined 63 automated tests passing, 0 ESLint errors across 65 files, and `vite build` generated 2182 modules in 23.87s.

32. **Real Submitted Work Viewer & Multi-Format Deliverable Pipeline (`SubmittedWorkViewerModal.jsx`, `deliverableClassifier.js`, `SubmissionTracking.jsx`, `AssignmentDetails.jsx`)**:
    - **Investigation of Database Submissions**: Live Supabase audit confirmed `storage.buckets` has 0 rows. Deliverables are stored as text URLs in `group_submissions.submission_link`. Live record `2cbe8d08-f543-4deb-90e4-f56f358f3713` (assignment `be665af0-7b57-41b2-a69b-df445996357c`) had `submission_link: "http://localhost:5173/student/assignments/..."`, `marks: 88`, `feedback: "g"`. Records `4434dc14-7468-4913-9a4f-a24495d39dc6` and `bbe1addd-85b6-423a-9bdb-9ae6df37a0fe` had official OneDrive deliverable links (`https://1drv.ms/u/official-leader-deliverable`).
    - **Separation of View Work vs Grading**: Previously clicking "View Work" merely opened the grading modal. Created dedicated `SubmittedWorkViewerModal` component focused purely on deliverable inspection, keeping the grading modal separate.
    - **Multi-Format Deliverable Classifier (`deliverableClassifier.js`)**: Identifies deliverables across 9 categories: `acknowledgement_only` (empty links), `pdf` (embedded iframe preview), `word` (.docx download & launch), `excel` (.xlsx download & launch), `powerpoint` (.pptx download & launch), `onedrive` (1drv.ms direct link), `google_drive` (drive/docs.google.com with preview mode), `code_repo` (github/gitlab repository), and `web_app` (live deployment).
    - **Dual-Mode Student Submission Pipeline (`AssignmentDetails.jsx`)**: Students can submit deliverables either via cloud link (OneDrive, Google Drive, GitHub) or direct file upload (PDF, DOCX, PPTX, XLSX, TXT, ZIP up to 15MB) using `FileReader.readAsDataURL()`, with client-side type/size validation and student deliverable preview modal.

33. **Critical Submission Data Pipeline & Submitter Name Resolution (`deliverableClassifier.js`, `SubmittedWorkViewerModal.jsx`, `SubmissionTracking.jsx`, `AssignmentDetails.jsx`)**:
    - **Root Cause of Deliverable Suppression**: In `deliverableClassifier.js`, an over-broad `isCircular` check matched any URL containing `localhost:5173` or `/assignments/`, treating validly submitted local web project URLs (such as `http://localhost:5173/student/assignments/...` with note `"eved"`) as `acknowledgement_only` (`isDeliverable: false`, `url: null`). This caused the viewer to suppress the student's actual deliverable, hiding the URL and falsely stating "no deliverable has been submitted".
    - **Root Cause of UUID Display**: In `SubmittedWorkViewerModal.jsx`, line 48 inspected `submission?.acknowledged_by` (which stores the raw submitter UUID in PostgreSQL) before checking `submission?.leader?.name` or `group?.acknowledged_by`, directly rendering the UUID `823bfee8-f844-44fd-a7ee-786ac161930e` in the UI.
    - **Universal Deliverable Recognition**: Fixed `deliverableClassifier.js` and `SubmissionTracking.jsx` so that any non-empty submitted URL or data URI is recognized as a genuine deliverable (`isDeliverable: true`), displaying the full URL, "Open Deliverable in New Tab", and "Copy Link". Truly empty submissions are the only records classified as `acknowledgement_only`.
    - **Clean Submitter Name Resolution**: Added UUID regex detector `isUuid`. The modal and tracking tables resolve the submitter's real name (`Rahul Sharma`) from joined profile relations (`submission.leader.name`, `group.leader.name`, `group.acknowledged_by`), completely eliminating raw UUIDs from student, admin, and professor interfaces.
    - **Verification**: Created `scripts/verify-submission-data-pipeline-and-user-resolution.js` passing 5/5 tests against both local logic and live Supabase records. Combined 82 automated tests pass, 0 ESLint errors across 65 files, and `vite build` completed cleanly in 15.21s.

34. **Replaced Submitted Groups Table with Modern Responsive Cards (`GroupSubmissionCard.jsx`, `SubmissionTracking.jsx`, `AssignmentDetails.jsx`)**:
    - **UI Layout Transformation**: Completely replaced the wide horizontal table in `SubmissionTracking.jsx` with a responsive 2-column card grid (`grid grid-cols-1 lg:grid-cols-2 gap-5`), eliminating awkward horizontal scrollbars, truncated names, and hidden columns on tablet/mobile screens.
    - **Comprehensive Submission Cards (`src/components/submission/GroupSubmissionCard.jsx`)**:
      - **Section A (Header)**: Group name, group icon, leader name with crown icon, member count badge, and dynamic status badges (`Graded (X/Y)`, `Deliverable Submitted`, `Acknowledged (No Deliverable)`, `Late`, `Missing (Overdue)`, `Pending Submission`).
      - **Section B (Roster Members)**: Collapsible chips showing all group members with avatar indicators, a dedicated Leader badge (`Crown` icon), and a clean `+X more` toggle for groups with more than 4 members.
      - **Section C (Real Deliverable Viewer)**: Directly displays the submitted file or link inside the card. Classifies documents across PDF, Word, Excel, PowerPoint, OneDrive, Google Drive, GitHub repository, and live web application. Provides monospace URL preview, 1-click "Copy Link", "Inspect Deliverable" modal trigger, "Open in New Tab", and "Download" buttons. Preserves line breaks in submitter notes.
      - **Section D (Acknowledgement Info)**: Displays verified submitter full name (e.g. `Rahul Sharma`, never raw UUID), checkmark icon, and formatted date/time timestamp.
      - **Section E (Grading Information)**: Shows awarded marks out of maximum points, calculated letter grade badge, feedback notes, and "Awaiting evaluation by instructor / Pending Grade" banner for ungraded work.
      - **Section F (Footer Actions & Role Handling)**: Staff (Admin/Professor) see "View Work" and "Grade Group" / "Edit Grade" buttons. Students view an un-editable, verified view of their team's deliverable and feedback.
    - **Unsubmitted Groups Card Section**: Applied consistent card styling to the "Not Submitted Groups" list, displaying allocated student count, designated leader, overdue warnings, and clear submission expectations.
    - **Unified Student View (`AssignmentDetails.jsx`)**: Integrated `<GroupSubmissionCard userRole="student">` into the student assignment view, guaranteeing identical submission and grading information across student, admin, and professor dashboards.
    - **Verification**: Created `scripts/verify-group-submission-cards.js` passing 17/17 tests. Combined 86 automated tests pass across 9 test suites, 0 ESLint errors across 65 files, and `vite build` generated 2185 modules in 6.78s.

35. **Group Assignments Initial Zero & Delayed Loading Fix (`GroupDetailsPage.jsx`, `GroupDetailsModal.jsx`, `groups.service.js`)**:
    - **Root Cause Analysis**:
      - `useEffect` in both `GroupDetailsPage.jsx` and `GroupDetailsModal.jsx` had an `activeTab === 'assignments'` gate: `if (activeTab === 'assignments' && group?.class_id && group?.id) { loadHistory(...) }`.
      - Because Group Details always opens in the default `'overview'` tab, assignments were never fetched on mount.
      - As a result, `assignmentHistory` remained `[]`, causing the Overview tab to falsely display `0` for Eligible Tasks, `0` for Submitted, `0` for Pending, and `Group Assignments (0)` on the tab button.
      - When the user clicked the Group Assignments tab, before the Supabase request resolved, `assignmentHistory.length === 0` caused a false "No Group Assignments Found" empty state to flicker before the actual 3 assignments (Demo, S, zdvvdvd) finally appeared.
      - Furthermore, `groupsService.getGroupAssignmentHistory` silently swallowed errors and returned `[]`, making it impossible for components to detect network failures and render a Retry action.
    - **Immediate Fetch on Mount & ID Availability**:
      - Completely removed `activeTab === 'assignments'` gating. Group assignments now fetch immediately when `effectiveClassId` and `groupId` become available on mount.
      - In `GroupDetailsPage.jsx`: loads assignments in parallel with group details as soon as route/group IDs exist.
      - In `GroupDetailsModal.jsx`: loads assignments immediately when `isOpen` is true and `currentGroup` IDs are present.
    - **Dedicated Loading State Machine & Skeletons**:
      - Maintained discrete states: `loadingHistory`, `historyLoaded`, `historyError`, and `historyReqIdRef`.
      - While loading, `<GroupAssignmentSkeleton />` renders 3 shimmer cards with title, points, due date, status badge, and button placeholders. Never renders a false empty state or 0 count while loading.
      - In the Overview tab, stats cards display an animated shimmer pulse block while loading instead of a hardcoded `0`.
      - Tab header shows a ping loading indicator during fetch and the true count once loaded.
    - **Error Handling with Retry Action**:
      - Updated `groupsService.getGroupAssignmentHistory` to re-throw exceptions on failure and support `forceRefresh = true`.
      - Rendered an error card with a "Retry Loading" button on query failure, allowing users to re-fetch without pretending there are zero assignments.
    - **Race Condition & Stale Group Prevention**:
      - Used `historyReqIdRef` generation counter to discard out-of-order responses when switching groups.
      - Cleanly reset `assignmentHistory` to `[]`, `loadingHistory` to `true`, `historyLoaded` to `false`, and `historyError` to `null` whenever `groupId` changes.
    - **Live Supabase Verification**:
      - Verified against group `Demo` (`cc887d59-6ccb-490e-b787-d8c9eb1048b2`) in class `e2e398f5-5fd1-4964-8e91-8a2c306293b5`, confirming all 3 assignments load with their exact statuses: Demo (Graded: 88/100), S (Not Submitted), and zdvvdvd (Submitted).
    - **Verification**: Created `scripts/verify-group-assignments-initial-loading.js` passing 23/23 tests. Combined 109 automated tests pass across 10 test suites, 0 ESLint errors across 65 files, and `vite build` completed cleanly in 4.15s.

36. **Remove Quick Demo Accounts from Login (`Login.jsx`, `verify-login-page-and-auth-flow.js`)**:
    - **Elimination of Demo Account Section**: Completely removed the "Quick Demo Accounts" heading and section, along with the "Professor Demo" and "Student Demo" buttons from `src/pages/Login.jsx`.
    - **Removal of Hardcoded Credentials**: Removed all hardcoded demo email addresses (`admin@assignora.demo`, `student@assignora.demo`), demo passwords, and quick-login handlers from the login UI.
    - **Preservation of Core Auth Flows**: Standard email/password state and submit handler, password reveal toggle (`Eye`/`EyeOff`), "Forgot password?" modal trigger, and registration link (`/register`) are 100% preserved and fully functional.
    - **Deterministic Role-Based Redirection**: Verified role-based dashboard redirection (`/admin` for Professor/Admin, `/student` for Student) after successful login.
    - **Database Integrity Maintained**: Zero modifications to live Supabase Auth records or user tables; all legitimate test accounts in the database remain intact.
    - **Layout & Spacing Polish**: Adjusted button margins (`mt-2`) and cursor styles on the primary submit button to maintain a clean, balanced vertical rhythm across desktop and mobile screens.
    - **Verification**: Created `scripts/verify-login-page-and-auth-flow.js` passing 11/11 tests across code inspection, input validation, live Professor authentication, live Student authentication, and invalid credential rejection. Combined 120 automated tests pass across 11 suites, 0 ESLint errors across 65 files, and `vite build` generated 2185 modules in 14.00s.

37. **Registration, User Profile Creation, 406/403 Prevention & Class Enrollment RLS Repair (`auth.service.js`, `AuthContext.jsx`, `AuthCallback.jsx`, `Register.jsx`, `classes.service.js`, `JoinClassModal.jsx`, `JoinClassPage.jsx`, `20261111000000_round2_fix_registration_profiles_and_enrollment_rls.sql`)**:
    - **Root Cause Audit (Live Schema & Edge Logs)**:
      - New user registration with email confirmation enabled returned `session: null` (`auth.uid() = NULL`), causing `register_user_profile` RPC to fail with `'Authentication required.'` and direct `users.insert()` to fail with no INSERT RLS policy and no `auth.users` trigger (verified live orphaned user `darshan@pim.ac.in` / `0f1f2c54-c7fb-4a84-804f-022733635da3`).
      - `authService.getUserProfile` used `.single()`, causing PostgREST HTTP `406 Not Acceptable` (`PGRST116: Cannot coerce the result to a single JSON object`) when the user lacked a `public.users` row.
      - Missing user profiles caused `join_class_by_code` RPC to return `'User profile not found.'`, which `classesService.enrollStudent` caught and discarded, falling through to direct `POST /rest/v1/class_members` -> HTTP `403 Forbidden` (`new row violates row-level security policy for table "class_members"`).
      - Direct fallback queries selecting `class_members` on unenrolled classes and missing `users` instructor visibility returned `403` / `null`.
    - **Frontend Pipeline Fixes**:
      - Replaced `.single()` with `.maybeSingle()` in `authService.getUserProfile` (zero 406 errors) and added `ensureUserProfile()` self-healing provisioning using authenticated `register_user_profile` RPC.
      - Updated `authService.signUp` to pass full `student_id` & `faculty_invite_token` in `options.data` metadata, validate faculty tokens before auth creation, and remove failing unauthenticated table inserts.
      - Updated `AuthContext.jsx` & `AuthCallback.jsx` to require verified `profile.role` from DB (never fall back to unverified client metadata or continue with an undefined role).
      - Updated `Register.jsx` to enforce Faculty Invitation Token for Professor registration instead of labeling it optional.
      - Updated `classesService.findClassByCode`, `joinClassByCode`, `verifyInviteToken`, and `enrollStudent` to prioritize `SECURITY DEFINER` RPCs, normalize `teacher`/`users`/`student_count` fields, verify session & Student profile before enrollment, propagate actual RPC errors transparently, and confirm persisted membership.
      - Updated `JoinClassModal.jsx` and `JoinClassPage.jsx` to handle RPC shapes, duplicate enrollments, and session checks with clear user error messages.
    - **Prepared SQL Migration & Rollback (Awaiting Approval)**:
      - Created `supabase/migrations/20261111000000_round2_fix_registration_profiles_and_enrollment_rls.sql` with `handle_new_user()` trigger on `auth.users`, orphaned user backfill, `validate_faculty_invitation()`, `is_instructor_of_caller()`, `users_insert_policy`, student self-enrollment `class_members_insert_policy`, updated `class_members_select_policy`, self-healing `join_class_by_code()`, and enhanced `get_class_preview_by_code()`.
      - Created rollback script `supabase/migrations/rollback_round2_registration_and_enrollment.sql`.
    - **Verification**: Created `scripts/verify-registration-profiles-and-enrollment-rls.js` passing 12/12 static and live Supabase checks.

38. **Global UI/UX Repair — Portal Modals, Overlay Stack, Z-Index Architecture & Responsive Layouts (`Modal.jsx`, `NotificationsDrawer.jsx`, `overlayManager.js`, `DashboardLayout.jsx`, `Header.jsx`, `Sidebar.jsx`, `MobileNav.jsx`, `tailwind.config.js`, `index.css`, `JoinClassModal.jsx`, `InviteStudentModal.jsx`, `StudentProfileModal.jsx`, `AdminDashboard.jsx`, `ClassesManagement.jsx`, `GroupDetailsPage.jsx`, `JoinClassPage.jsx`, `AssignmentDetails.jsx`, `AppRoutes.jsx`)**:
    - **Root Cause Fixed (Partial Modal Backdrop)**:
      - `DashboardLayout.jsx` wrapped `<Outlet />` inside `.page-enter` whose `@keyframes slideUp` used `animation: ... forwards` ending at `transform: translate3d(0, 0, 0)`. CSS retained transforms create a containing block and stacking context that trapped `position: fixed` descendants inside `<main>` (offset by `lg:pl-64` and clipped below sticky `<Header>`).
      - `Modal.jsx` and `NotificationsDrawer.jsx` rendered inline instead of portaling into `document.body`.
    - **Global Portal & Overlay Coordination**:
      - Created `src/utils/overlayManager.js` (`registerOverlay`) to coordinate stacked overlays (`activeOverlayIds`), lock `document.body.style.overflow = 'hidden'` cleanly until the final overlay closes, and handle top-most `Escape` key dismissal.
      - Refactored `src/components/common/Modal.jsx` to render via `createPortal(..., document.body)` at `z-modal`, using a full-viewport backdrop (`fixed inset-0 bg-slate-900/55 backdrop-blur-xs`), ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`), focus capture/restoration, `MODAL_SIZE_MAP` (`sm`/`md`/`lg`/`xl`/`full`) + `maxWidth`, safe viewport margins (`p-4 sm:p-6`, removing `sm:p-0`), and internal scrollable body (`max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]`).
      - Refactored `src/components/common/NotificationsDrawer.jsx` to portal into `document.body` at `z-drawer` via `registerOverlay`.
    - **Semantic Z-Index & Layout Polish**:
      - Added `zIndex` tokens (`header: 20`, `dropdown: 30`, `sidebar: 40`, `drawer: 50`, `modal: 60`, `toast: 70`), `backdropBlur.xs`, and `brand.appBg` (`#F8F9FF`) to `tailwind.config.js` and CSS variables in `src/index.css`; removed `forwards` from `.page-enter` and `.modal-enter`.
      - Unified `DashboardLayout.jsx`, `Header.jsx` (added `aria-label="Notifications"`), `Sidebar.jsx` (`registerOverlay` Escape close), and `MobileNav.jsx`.
      - Fixed clipped 3-dot dropdown menus in `ClassesManagement.jsx`, added outside-click closing for `AdminDashboard.jsx` Create dropdown, standardized `max-w-7xl` widths across `GroupDetailsPage.jsx`, `AssignmentDetails.jsx`, and `AppRoutes.jsx`, and improved responsive stacking in `JoinClassModal.jsx`, `InviteStudentModal.jsx`, and `StudentProfileModal.jsx`.
    - **Verification**: Static suite `scripts/verify-global-ui-responsive-and-modals.js` passed 7/7 checks; headless Chrome E2E `scripts/verify-ui-browser-e2e.mjs` passed across all 7 viewports (`1920x1080`, `1440x900`, `1280x800`, `1024x768`, `768x1024`, `430x932`, `375x812`) for Student & Admin roles with 0 console errors and 0 uncaught page errors.

25. **Complete Application Performance Optimization**:
    - **Bundle Splitting & Prefetching**:
      - Created `src/utils/routePrefetch.js` (`routeLoaders`, `prefetchRoute`, `prefetchRoleCoreRoutes`) for hover/focus/touch preloading in `Sidebar.jsx` & `MobileNav.jsx` and idle role-core route preloading after authentication.
      - Lazy-loaded `DashboardLayout` (`15.86 kB`), `NotificationsDrawer` (`5.36 kB` on open), `ClassGroupsTab` (`55.01 kB`), and heavy sub-modals (`JoinClassModal`, `InviteStudentModal`, `StudentProfileModal`, `TwoStepSubmissionModal`, `AddGroupMembersModal`, `GroupManagementModal`, `StudentSelectionModal`, `SubmittedWorkViewerModal` on student side); dynamically imported `canvas-confetti` (`10.70 kB`) on submission success.
      - Removed monolithic `icons` (`44.66 kB` global preload) & `confetti` manual chunks from `vite.config.js`; shrank `index.js` from `76.63 kB` (`21.79 kB` gzip) to `52.79 kB` (`16.72 kB` gzip) and `ClassDetailPage.js` from `102.31 kB` (`22.83 kB` gzip) to `50.82 kB` (`12.75 kB` gzip).
    - **SWR Caching, Deduplication & Logout Isolation**:
      - Created `src/utils/dataCache.js` (`getCached`, `setCached`, `fetchWithCache` with in-flight Promise deduplication, TTL expiry, prefix invalidation, and `subscribeCacheClear` logout purge).
      - Added cached/deduplicated reads and mutation invalidations across `auth.service.js`, `classes.service.js`, `assignments.service.js`, `submissions.service.js`, `announcements.service.js`, `users.service.js`, `notifications.service.js`, and `groups.service.js`.
      - Removed eager imports of `groupsService` and `messagesService` from `AuthContext.jsx` (using `clearAllAppCaches()` + dynamic `messagesService.cleanupRealtime()` import).
    - **Supabase Waterfall Elimination & Query Slimming**:
      - Narrowed `select('*')` payloads to explicit column projections (`auth.service.js`, `notifications.service.js` + `.limit(50)`, `assignments.service.js` + `getAdminAssignmentSummaries`).
      - Reused parent-fetched `cls`, `announcements`, `submissions`, and `assignmentIds` in `ClassDetailPage.jsx` -> `classesService.getClassActivity()` / `getClassResources()` / `submissionsService.getClassSubmissions()`, and deferred `messagesService.getClassMessages()` until the Messages tab opens (`6366 ms, 15 reqs` -> `2511 ms, 7 reqs`).
      - Joined `groups` inside `getStudentGroupInCourse`, batched `StudentsManagement.jsx` enrollment via `Promise.all`, parallelized secondary fetches in `StudentDashboard.jsx` & edit mode in `CreateAssignment.jsx`, switched 15s unread polling in `NotificationContext.jsx` to visibility-aware 45s polling.
    - **React Render & Asset Optimization**:
      - Wrapped `Sidebar`, `MobileNav`, `Header`, `StatCard`, `Badge`, and `GroupSubmissionCard` with `React.memo`; memoized context `value` objects in `AuthContext.jsx` & `NotificationContext.jsx`; replaced O(N*M) linear `.find()` scans with `Map` lookups inside `useMemo` (`AdminDashboard.jsx`, `GradesGradebook.jsx`, `SubmissionTracking.jsx`).
      - Added `loading="lazy" decoding="async"` on below-the-fold user/preset avatars and reference icons (`Header`, `ClassDetailPage`, `SubmissionTracking`, `ProfilePage`, `SettingsPage`, `AddGroupMembersModal`, `ProfessorCreateGroupModal`, `StudentProfileModal`, `CreateAssignment`).

---

## 3. Database Migration Status

- **Baseline, Advanced & Group Messages Migrations Status:** **LIVE APPLIED & FULLY VERIFIED** (`62` objects recorded in `_assignora_migration_manifest`: `50` baseline, `5` advanced roster/groups, `7` `group_messages`)
- **Target DB:** `trkcagoxopabqerljgvn` (PostgreSQL 17.11 on AWS ap-southeast-1)
- **Auth & Enrollment RLS Migration (`supabase/migrations/20261111000000_round2_fix_registration_profiles_and_enrollment_rls.sql`):** **LIVE APPLIED & VERIFIED** (Supabase migration version `20261111162141`, name `round2_fix_registration_profiles_and_enrollment_rls`)
  - Objects applied & verified: `public.handle_new_user()` + trigger `on_auth_user_created` on `auth.users`, orphaned `auth.users` backfill into `public.users` (`orphaned_users_count: 0`, `darshan@pim.ac.in` provisioned), `public.validate_faculty_invitation(text, text)`, `public.is_instructor_of_caller(uuid)`, RLS policies `users_insert_policy` & `users_instructors_select_policy` on `public.users`, updated `class_members_insert_policy` & `class_members_select_policy` on `public.class_members`, self-healing `public.join_class_by_code(text)`, and enhanced `public.get_class_preview_by_code(text)`.
  - Rollback script available: `supabase/migrations/rollback_round2_registration_and_enrollment.sql`.
- **Previous Applied Manifest Count:** 57 objects recorded in `_assignora_migration_manifest`
  - Columns: 2 (`assignments.submission_type`, `assignments.onedrive_link`)
  - Tables: 4 (`faculty_invitations`, `groups`, `group_members`, `group_submissions`)
  - Functions: 15 (`create_course_group`, `join_course_group`, `leave_course_group`, `transfer_group_leadership`, `archive_course_group`, `disband_course_group`, `acknowledge_group_assignment`, `grade_group_submission`, `register_user_profile`, `create_faculty_invitation`, `professor_create_group`, `add_group_members`, `get_class_roster`, `is_class_member`, `is_classmate_of`)
  - Policies: 14 (including peer visibility policies `class_members_peer_select_policy` and `users_classmates_select_policy`)
  - Triggers: 4 (immutable group lifecycle protection)
  - Indexes: 10 (including case-insensitive name uniqueness `idx_groups_class_id_name_ci`)
  - Constraints: 5 (including `unique_student_course_group`, `unique_assignment_group_submission`)
  - Realtime Publications: 3 (`groups`, `group_members`, `group_submissions`)

---

## 4. Verification & Test Summary

| Test Suite | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Global UI/UX Portals & Responsive Layout (Static)** | `node --test scripts/verify-global-ui-responsive-and-modals.js` | **PASS** | 7/7 checks passed: `document.body` portals for `Modal` & `NotificationsDrawer`, `overlayManager` stack/Escape lock, z-index scale, no transform trap, shell & modal responsiveness |
| **Multi-Viewport Browser E2E (Playwright/Chrome)** | `node scripts/verify-ui-browser-e2e.mjs` | **PASS** | All 7 viewports (`1920x1080`, `1440x900`, `1280x800`, `1024x768`, `768x1024`, `430x932`, `375x812`) verified against live preview + Supabase for Student & Admin flows, modals, drawers, Escape scroll unlock, 0 horizontal overflow, 0 console/page errors |
| **Registration, Profiles & Enrollment RLS** | `node --env-file=.env --test scripts/verify-registration-profiles-and-enrollment-rls.js` | **PASS** | 12/12 tests passed: 406 .maybeSingle() fix, self-healing ensureUserProfile, zero-trust AuthContext/AuthCallback role handling, 403/RLS enrollment repair, live Student & Admin Supabase checks |
| **Login Page & Auth Flow** | `node --env-file=.env --test scripts/verify-login-page-and-auth-flow.js` | **PASS** | 11/11 tests passed: complete removal of Quick Demo Accounts UI & credentials, standard email/password form, password toggle, forgot password, /register link, live Professor & Student Supabase auth, invalid credential rejection |
| **Group Assignments Initial Loading** | `node --test scripts/verify-group-assignments-initial-loading.js` | **PASS** | 23/23 tests passed: Immediate load on mount, no activeTab gating, state machine (loading/success/error/empty), skeleton loaders, Retry action, zero stale flash on group switch, live Supabase query confirming Demo/S/zdvvdvd |
| **Group Submission Cards Layout** | `node --test scripts/verify-group-submission-cards.js` | **PASS** | 17/17 tests passed: Header with group name/leader/count, collapsible member chips, direct deliverable rendering (PDF/Office/Cloud/Code), submitter name resolution, grading display, staff vs student actions, unsubmitted state, 2-column card grid in tracking |
| **Submission Pipeline & UUID Resolution** | `node --test scripts/verify-submission-data-pipeline-and-user-resolution.js` | **PASS** | 5/5 tests passed: live Supabase query on assignment zdvvdvd, web project deliverable classification, URL persistence, name resolution to Rahul Sharma (0 UUID leaks) |
| **Real Submitted Work Viewer & Multi-Format Pipeline** | `node --test scripts/verify-real-submitted-work-viewer.js` | **PASS** | 14/14 tests passed: deliverable classifier, empty acknowledgement-only detection, embedded PDF & Office doc viewers, OneDrive/Google Drive/GitHub classifiers, View Work vs Grading modal separation, student file upload & FileReader integration |
| **Grading Modal Lifecycle & Auth URL** | `node --test scripts/verify-grading-modal-lifecycle-and-auth-url.js` | **PASS** | 16/16 tests passed: modal visibility control, Promise.all concurrent loading, zero auto-open effects, deliverable status differentiation, centralized production URL helper, HTTPS enforcement, AuthCallback handler |
| **Course Details & Deliverable Work Resolution** | `node --test scripts/verify-course-details-and-open-work.js` | **PASS** | 5/5 tests passed: `resolveDeliverableUrl` engine, `RoleRoute` cross-role translation, `AdminDashboard` course card routing to class details, sidebar persistence, class-specific assignment context |
| **Admin View Work & Tracking UI** | `node --test scripts/verify-admin-view-work-and-tracking-ui.js` | **PASS** | 4/4 tests passed: View Work modal triggers, URL sanitization engine, metrics calculation, multi-file link audit |
| **Vite Production Build** | `npm run build` | **PASS** | Built cleanly in 8.85s (`vite v6.4.5`, 2188 modules transformed, 0 errors; `index.js` 52.79 kB / 16.72 kB gzip; `ClassDetailPage` 50.82 kB / 12.75 kB gzip) |
| **React Rules of Hooks Audit** | `node --test scripts/verify-rules-of-hooks-and-component-stability.js` | **PASS** | 5/5 tests passed: invariant hook order in `AssignmentDetails` & `CreateAssignment`, 0 ESLint hook errors across source files, package script validation |
| **ESLint Complete Audit** | `npm run lint` | **PASS** | 0 errors, 162 warnings (`eslint src --ext .js,.jsx`) |
| **Live Preview Performance Benchmark (Before/After)** | Chrome Playwright vs `vite preview` + live Supabase | **PASS** | `studentClassDetail`: 6366 ms (15 reqs) → 2511 ms (7 reqs); `studentClassesSpa`: 479 ms (9 reqs) → 237 ms (2 reqs); `studentDashReturnSpa`: 367 ms (6 reqs) → 184 ms (2 reqs); `adminClassesSpa`: 398 ms (6 reqs) → 96 ms (0 reqs); `adminAssignmentsSpa`: 352 ms (6 reqs) → 231 ms (0 reqs); `adminDashReturnSpa`: 367 ms (4 reqs) → 154 ms (0 reqs); 0 console/page errors |
| **Group Open Work & Realtime** | `node --test scripts/verify-group-assignment-open-work-and-realtime.js` | **PASS** | 9/9 tests passed: student navigation to `/student/assignments/:id`, fallback group lookup, OneDrive & group metadata display, shared Realtime channel, in-memory bus |
| **Static Codebase Audit** | AST hook & symbol scan across 65 files | **PASS** | 0 missing hook imports, 0 missing router hooks, 0 dangling references |
| **Admin Open Work & Login Redirect** | `node scripts/verify-admin-open-work-and-login-redirect.js` | **PASS** | 11/11 tests passed: route reuse, query param inspection, work modal metadata, back cleanup, role redirects, shared-device logout, cache purge |
| **Group Details & Context Back Nav** | `node scripts/verify-group-detail-and-context-back-navigation.js` | **PASS** | 11/11 tests passed: TDZ elimination, chat permission gating, class/group/global back navigation, label consistency, direct URL fallback |
| **Group Page & Membership Flow** | `node scripts/verify-group-page-and-membership-flow.js` | **PASS** | 15/15 tests passed: authoritative membership query, getGroupById contract, assignment allocation filtering, chat deduplication |
| **Group Chat & Assignment Filtering** | `node scripts/verify-group-chat-and-filtering.js` | **PASS** | 18/18 tests passed: optimistic reconciliation, zero duplicate messages, assignment filtering, leader auth, migration verification |
| **Group Fixes & E2E Verification** | `node scripts/verify-group-fixes-e2e.js` | **PASS** | 8/8 test phases passed (Group creation, member join, relationship resolution, leader acknowledgement, timestamps, archival protection, join rejection, class roster) |
| **Advanced People & Groups** | `node scripts/verify-advanced-people-and-groups.js` | **PASS** | 11/11 tests passed: creation, membership, single group rule, leadership transfer, leave, solo group, professor creation, roster query, leader acknowledgement, archival protection |
| **Full Submission Pipeline** | `node scripts/verify-submission-full.js` | **PASS** | Assignment creation, S1 submission, duplicate block, S2 submission, grading |
| **Round 2 Invariant Suite** | `node scripts/verify-round2-database-invariants.js` | **PASS** | Table counts, CSPRNG tokens, schema constraints, zero regressions |

---

## 5. Next Steps & Data Refresh Audit (2026-11-12)

1. **Completed Previously:** Performance optimizations (`8ee4bf8`) pushed to `origin/main` and verified live (`HTTP/1.1 200 OK`) on `https://assignora-cyan.vercel.app/`.
2. **Production DB Audit, Backup & SQL Ops Generation (`trkcagoxopabqerljgvn`):**
   - Verified 15 `public` tables (`users`: 8, `classes`: 9, `class_members`: 24, `assignments`: 30, `assignment_students`: 2, `submissions`: 32, `announcements`: 37, `notifications`: 130, `class_messages`: 8, `groups`: 5, `group_members`: 11, `group_submissions`: 5, `group_messages`: 3, `faculty_invitations`: 0, `_assignora_migration_manifest`: 62) and `storage.buckets`: 0 / `storage.objects`: 0.
   - Confirmed `auth.users` count = 8 (`0` orphans), including genuine account `darshan@pim.ac.in` (`0f1f2c54-c7fb-4a84-804f-022733635da3`).
   - Created verified local JSON backup snapshot (`scratch/prod_backup_2026-11-12.json`, 165,502 bytes) with exact 15-table row parity.
   - Generated & validated `supabase/ops/cleanup_round2_test_data.sql` (Option B cleanup), `supabase/ops/rollback_round2_test_data.sql` (70-row exact restoration), and `supabase/ops/seed_round2_demo_data.sql` (Phase 4 idempotent demo dataset across 3 courses, 5 groups, 9 assignments, group & individual submissions, announcements, messages, notifications).
   - Attempted Option B cleanup execution via `supabase_mcp` `execute_sql` after user approval: **BLOCKED** by MCP host confirmation auto-cancellation (`"The client cancelled this confirmation 0.2 s after it was sent. Nothing was run."`). Neither `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_URL`) nor `npx supabase` has direct privileged DB access without interactive SQL Editor / service credentials.
   - **Live database remains UNCHANGED.**
3. **Manual Execution Required From Darshan (Supabase Dashboard -> SQL Editor on `trkcagoxopabqerljgvn`):**
   - Step 1: Run `supabase/ops/cleanup_round2_test_data.sql` (asserts exact 70 deleted rows atomically).
   - Step 2: Run `supabase/ops/seed_round2_demo_data.sql` (seeds clean Round 2 demo dataset using `.demo` accounts only).
   - Step 3: Reply `"done"` so Phase 5 post-refresh database + live UI verification and verification script updates can run.

4. **Completed README Documentation Update (Task 1 + Task 2 — 2026-11-12):**
   - Replaced stale `README.md` with verified Task 1 + Task 2 documentation (`845` lines, `27` sections, `2` Mermaid diagrams covering architecture and ER relationships).
   - Verified all `15` PostgreSQL tables, column constraints, foreign keys, triggers (`3`), functions (`30`), indexes (`54`), RLS policies, and `supabase_realtime` publications (`6` tables) directly against live DB `trkcagoxopabqerljgvn` and source files in `src/`.
   - Removed all quick-demo credentials, `"Quick Demo"` UI instructions, hardcoded `eyJhbGci` token prefix, concrete `trkcagoxopabqerljgvn.supabase.co` URL, and `Demo Video` placeholder link.
   - Re-verified `npm run lint` (`0` errors, `162` warnings) and `npm run build` (`vite build` succeeded in `10.18s`).

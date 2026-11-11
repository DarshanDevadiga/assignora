# Assignora — Round 2 Implementation Status

**Project:** Assignora (Assign. Track. Achieve.)  
**Owner:** Darshan | **Candidate:** Joineazy Frontend Intern Round 2  
**Target Database:** `trkcagoxopabqerljgvn` (PostgreSQL 17.11 on Supabase ap-southeast-1)  
**Production URL:** https://assignora-cyan.vercel.app/  
**Repository:** https://github.com/DarshanDevadiga/assignora  
**Last Updated:** 2026-11-10T21:10:00+05:30  

---

## 1. Overall Progress Summary

| Phase / Objective | Status | Notes |
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
| **Group Messages Migration** | **PENDING APPROVAL** | `20261110000002_round2_group_messages.sql` prepared with RLS, rollback & verification; awaiting approval |
| **Production Build Check** | **PASS** | `npm run build` completed cleanly (2180 modules bundled, 0 errors) |

---

## 2. Concrete Work Completed

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

---

## 3. Database Migration Status

- **Status:** **LIVE APPLIED & FULLY VERIFIED**
- **Target DB:** `trkcagoxopabqerljgvn` (PostgreSQL 17.11 on AWS ap-southeast-1)
- **Manifest Count:** 57 objects recorded in `_assignora_migration_manifest`
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
| **Vite Production Build** | `npm run build` | **PASS** | 2180 modules bundled in 7.99s, 0 errors |
| **Admin Open Work & Login Redirect** | `node scripts/verify-admin-open-work-and-login-redirect.js` | **PASS** | 11/11 tests passed: route reuse, query param inspection, work modal metadata, back cleanup, role redirects, shared-device logout, cache purge |
| **Group Page & Membership Flow** | `node scripts/verify-group-page-and-membership-flow.js` | **PASS** | 15/15 tests passed: authoritative membership query, getGroupById contract, assignment allocation filtering, chat deduplication |
| **Group Chat & Assignment Filtering** | `node scripts/verify-group-chat-and-filtering.js` | **PASS** | 18/18 tests passed: optimistic reconciliation, zero duplicate messages, assignment filtering, leader auth, migration verification |
| **Group Fixes & E2E Verification** | `node scripts/verify-group-fixes-e2e.js` | **PASS** | 8/8 test phases passed (Group creation, member join, relationship resolution, leader acknowledgement, timestamps, archival protection, join rejection, class roster) |
| **Advanced People & Groups** | `node scripts/verify-advanced-people-and-groups.js` | **PASS** | 11/11 tests passed: creation, membership, single group rule, leadership transfer, leave, solo group, professor creation, roster query, leader acknowledgement, archival protection |
| **Full Submission Pipeline** | `node scripts/verify-submission-full.js` | **PASS** | Assignment creation, S1 submission, duplicate block, S2 submission, grading |
| **Round 2 Invariant Suite** | `node scripts/verify-round2-database-invariants.js` | **PASS** | Table counts, CSPRNG tokens, schema constraints, zero regressions |

---

## 5. Next Steps

1. Review Git status and prepare commit.
2. Request Darshan's approval to push to GitHub `origin/main` and trigger production deployment on Vercel.

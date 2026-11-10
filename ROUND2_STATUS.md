# Assignora — Round 2 Implementation Status

**Project:** Assignora (Assign. Track. Achieve.)  
**Owner:** Darshan | **Candidate:** Joineazy Frontend Intern Round 2  
**Target Database:** `trkcagoxopabqerljgvn` (PostgreSQL 17.11 on Supabase ap-southeast-1)  
**Production URL:** https://assignora-cyan.vercel.app/  
**Repository:** https://github.com/DarshanDevadiga/assignora  
**Last Updated:** 2026-11-10T14:59:30+05:30  

---

## 1. Overall Progress Summary

| Phase / Objective | Status | Notes |
| :--- | :--- | :--- |
| **Phase 1: Full System Audit** | **PASS** | Validated 9 Round 1 tables, 10 functions, and live schema |
| **Candidate SQL Source Audit** | **PASS** | Extracted and audited `assignora_round2_hardened_review_candidate.zip`; addressed all 6 identified blockers |
| **Manifest Ownership Tracking** | **PASS** | Full inventory tracking (50 objects registered in `_assignora_migration_manifest`) |
| **Preflight Collision Protection** | **PASS** | `preflight_validation.sql` executed against live database and passed (`[]`) |
| **Database Migration Execution** | **PASS** | Applied `20261110000000_round2_groups_and_acknowledgements.sql` to live database `trkcagoxopabqerljgvn` |
| **Post-Migration Verification** | **PASS** | Ran `post_migration_verification.sql`; all 8 catalog checks passed (`[]`, 0 errors) |
| **Non-Destructive Rollback** | **PASS** | Manifest-guarded, fail-closed, zero `CASCADE` (all drops use `RESTRICT`), preserves pre-existing state |
| **In-Course Groups Page/Tab** | **PASS** | `ClassGroupsTab.jsx` embedded into `ClassDetailPage.jsx` under `Groups` tab |
| **Group Details Modal & History** | **PASS** | `GroupDetailsModal.jsx` displays leader badge, member roster, assignment history, and status |
| **Leader-Only Acknowledgement** | **PASS** | Two-step dialog with `"Yes, I have submitted"`, member timestamp, and `"Not submitted by group leader"` |
| **Empty Group State Guard** | **PASS** | Exact text `"You are not part of any group. Create or join one to submit this assignment."` |
| **Professor Dual-List Tracking** | **PASS** | `SubmissionTracking.jsx` displays progress bar, stats, **SUBMITTED GROUPS**, and **NOT SUBMITTED GROUPS** |
| **Group Grading & CSV Export** | **PASS** | Modal for grading group deliverables via `grade_group_submission` RPC; CSV exports with leader & members |
| **Production Build Check** | **PASS** | `npm run build` completed cleanly in 24.67s (2177 modules, 0 errors) |
| **Regression Verification** | **PASS** | 100% pass across individual submissions, group RPCs, and baseline invariant suite |
| **README Documentation** | **PASS** | `README.md` completely updated with Task 1 vs Task 2 separation, Mermaid diagram, demo logins, submission checklist |

---

## 2. Concrete Work Completed

1. **In-Course Class Groups Section (`ClassGroupsTab.jsx` & `ClassDetailPage.jsx`)**:
   - Added `Groups` tab to the course navigation alongside `Overview`, `Assignments`, `People`, `Messages`, and `Resources`.
   - Displays all groups belonging to the active course with search filter.
   - Shows Group Name, Leader with Crown badge, member avatars and names, member count, and assignment status.
   - Provides `Create Group`, `Join Group`, and `View Details` modal actions directly in course context.
   - Creator of a group automatically becomes leader with immediate Leader badge and member enrollment.
   - Prevents joining a second group in the same course via database invariant.

2. **Group Details Modal (`GroupDetailsModal.jsx`)**:
   - Full-featured modal displaying Course Name, Group Name, Leader Profile with Crown badge.
   - Complete Member Roster with Leader vs Member distinguishing badges and email IDs.
   - Group Assignment History listing all assignments with due dates, points, deliverables, and acknowledgement status.

3. **Student Group Assignment Submission Workflow (`AssignmentDetails.jsx`)**:
   - When student is not part of any group:
     - Exact required prompt: `"You are not part of any group. Create or join one to submit this assignment."`
     - Includes Create Group, Join Group, and View Course Groups action buttons.
   - Group Leader Acknowledgement:
     - Submission button: `"Yes, I have submitted"`
     - Triggers confirmation dialog modal (`Confirm Group Submission`) before invoking `acknowledgeGroupAssignment`.
     - Displays deliverable link and notes.
   - Shared Group Member Status:
     - All members see: `"Acknowledged by [Leader Name] on [Date and Time]"`
     - Non-leader members prior to submission see: `"Not submitted by group leader"` and `"Awaiting Leader Acknowledgement"`.

4. **Professor Group Assignment Tracking (`SubmissionTracking.jsx`)**:
   - Detects `submission_type === 'group'` and switches to dual-list group view.
   - Progress bar with completion percentage:
     `[Percentage]% ([Acknowledged] of [Total] Groups Submitted)`
   - 5 Summary metric cards: Total Groups, Acknowledged, Unacknowledged, Graded Groups, Awaiting Grading.
   - Search filter to filter groups by name, leader, or member name.
   - **SUBMITTED GROUPS**: Group Name, Leader with Crown, Members roster, Acknowledged By, Acknowledgement Timestamp, Deliverable link, Marks, Grade, Feedback, and Grade Group button.
   - **NOT SUBMITTED GROUPS**: Group Name, Leader, Members roster, Member count, and Pending/Overdue status.
   - Group grading modal evaluating group deliverable and recording grade via `grade_group_submission` RPC.
   - Dedicated Group CSV Export (`Group_Submissions_[Title].csv`).
   - Completely preserves Round 1 individual assignment tracking table and workflows when `submission_type === 'individual'`.

5. **Live Database Migration Applied & Verified (`trkcagoxopabqerljgvn`)**:
   - All 50 objects recorded in `public._assignora_migration_manifest`.
   - Tables: `faculty_invitations`, `groups`, `group_members`, `group_submissions`.
   - Columns: `assignments.submission_type`, `assignments.onedrive_link`.
   - 10 `SECURITY DEFINER` RPCs with `search_path = pg_catalog, pg_temp`.
   - 12 anti-bypass RLS policies.
   - Foreign keys enforce `ON DELETE RESTRICT` to protect submission history.

6. **Automated Verification Suites Executed**:
   - `node scripts/verify-round2-database-invariants.js`: **PASS**
   - `node scripts/verify-submission-full.js`: **PASS**
   - `npm run build`: **PASS** (2177 modules bundled in 24.67s, 0 errors).

---

## 3. Database Migration Status

- **Status:** **LIVE APPLIED & FULLY VERIFIED**
- **Target DB:** `trkcagoxopabqerljgvn` (PostgreSQL 17.11 on AWS ap-southeast-1)
- **Manifest Count:** 50 objects recorded in `_assignora_migration_manifest`
  - Columns: 2 (`assignments.submission_type`, `assignments.onedrive_link`)
  - Tables: 4 (`faculty_invitations`, `groups`, `group_members`, `group_submissions`)
  - Functions: 10 (`create_course_group`, `join_course_group`, `leave_course_group`, `transfer_group_leadership`, `archive_course_group`, `disband_course_group`, `acknowledge_group_assignment`, `grade_group_submission`, `register_user_profile`, `create_faculty_invitation`)
  - Policies: 12 (enforcing zero-bypass RLS)
  - Triggers: 4 (immutable group lifecycle protection)
  - Indexes: 10 (including case-insensitive name uniqueness `idx_groups_class_id_name_ci`)
  - Constraints: 5 (including `unique_student_course_group`, `unique_assignment_group_submission`)
  - Realtime Publications: 3 (`groups`, `group_members`, `group_submissions`)

---

## 4. Verification & Test Summary

| Test Suite | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **Vite Production Build** | `npm run build` | **PASS** | 2177 modules bundled in 24.67s, 0 errors |
| **Full Submission Pipeline** | `node scripts/verify-submission-full.js` | **PASS** | Creation, student 1 submission, duplicate block, student 2 submission, teacher review |
| **Round 2 Invariant Suite** | `node scripts/verify-round2-database-invariants.js` | **PASS** | Baseline table counts, 1,000 CSPRNG tokens, schema constraints, zero regressions |

---

## 5. Next Steps

1. Commit and push the in-course group management and dual-list tracking features to GitHub `origin/main`.
2. Perform end-to-end user review on Vercel preview/production.

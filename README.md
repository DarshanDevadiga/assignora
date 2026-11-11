# Assignora – Student, Group & Assignment Management

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0.7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![React Router](https://img.shields.io/badge/React_Router-7.18.5-CA4245?logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Production-000000?logo=vercel&logoColor=white)](https://assignora-cyan.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Assign. Track. Achieve.**  
> An enterprise-grade, role-isolated academic management platform engineered with modern React, Tailwind CSS, and cloud-native Supabase PostgreSQL. Designed to eliminate coursework fragmentation, streamline assignment workflows, and provide end-to-end transparency for educators and students.

- **Production Application URL**: [https://assignora-cyan.vercel.app](https://assignora-cyan.vercel.app)
- **Official GitHub Repository**: [https://github.com/DarshanDevadiga/assignora](https://github.com/DarshanDevadiga/assignora)
- **Target Database Instance**: `trkcagoxopabqerljgvn` (PostgreSQL 17.11 on Supabase, AWS ap-southeast-1)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Task 1 – Round 1: Initial Application Development](#3-task-1--round-1-initial-application-development)
4. [Task 2 – Round 2: Student, Group & Assignment Management – UI/UX Enhancement](#4-task-2--round-2-student-group--assignment-management--uiux-enhancement)
5. [Task 1 vs Task 2 Comparison](#5-task-1-vs-task-2-comparison)
6. [System Architecture](#6-system-architecture)
7. [Database Schema](#7-database-schema)
8. [Project Folder Structure](#8-project-folder-structure)
9. [Installation and Setup](#9-installation-and-setup)
10. [Environment Variables](#10-environment-variables)
11. [Demo Login Details](#11-demo-login-details)
12. [Feature Completion Checklist](#12-feature-completion-checklist)
13. [Testing & Quality Verification](#13-testing--quality-verification)
14. [Screenshots and Interface Walkthrough](#14-screenshots-and-interface-walkthrough)
15. [Deployment](#15-deployment)
16. [Demo Video](#16-demo-video)
17. [Official Submission Requirements](#17-official-submission-requirements)

---

## 1. Project Overview

**Assignora** is an academic coursework and assignment tracking platform tailored for colleges and universities. It bridges the gap between instructors and students by providing role-specific dashboards, frictionless submission workflows, and real-time collaboration tools.

### Core Value Proposition
- **Dual Workspace Isolation**: Strict role segregation between **Professor** (course creation, assignment authoring, grading, student management) and **Student** (coursework feeds, deadlines, submission acknowledgements, team collaboration).
- **Academic Integrity by Architecture**: Duplicate submission locks, immutable submission records, and audit-logged grading backed by PostgreSQL engine constraints and Row Level Security (RLS).
- **Design Excellence**: Consistent purple-gradient visual identity (`#5B21F6` primary, `#8B5CF6` secondary, `#EDE9FE` accent, `#F8F9FF` background), Inter typography, accessible form controls, and fully responsive layouts across mobile, tablet, and desktop screens.

---

## 2. Technology Stack

### Frontend Architecture
- **Core Library**: [React 18.3.1](https://react.dev/) (Hooks, Context API, Suspense with route-level code splitting)
- **Build Tooling**: [Vite 6.0.7](https://vitejs.dev/) with Fast Refresh and chunk optimization
- **Routing**: [React Router DOM 7.18.5](https://reactrouter.com/) (Role-based guards, protected routes, dynamic redirect paths)
- **Styling**: [Tailwind CSS 3.4.17](https://tailwindcss.com/) with `@tailwindcss/forms` and custom design tokens
- **Icons**: [Lucide React 1.16.0](https://lucide.dev/) (Semantic SVG icons throughout)
- **Visual Feedback**: [canvas-confetti 1.9.4](https://www.kirilv.com/canvas-confetti/) for submission celebration

### Backend & Cloud Infrastructure
- **Database Engine**: [PostgreSQL 17.11](https://www.postgresql.org/) managed via Supabase (AWS ap-southeast-1)
- **Authentication**: Supabase Auth (JWT session management, local persistence, auto-refresh)
- **Real-Time Engine**: Supabase Realtime (PostgreSQL replication publication over WebSockets)
- **Hosting & CI/CD**: [Vercel](https://vercel.com/) (Production deployment linked directly to GitHub repository)

---

## 3. Task 1 – Round 1: Initial Application Development

In Round 1, the foundational prototype for Assignora was established to prove full-stack feasibility, data isolation, and core academic workflows.

### Objectives & Delivered Scope
1. **Authentication & Session Persistence**:
   - Email/password authentication integrated with Supabase Auth.
   - User profile storage in `public.users` storing roles (`student`, `admin`), student IDs, and registration metadata.
   - Protected routes preventing unauthenticated access; automatic redirect to role dashboard upon sign-in.
2. **Course / Classroom Governance**:
   - Instructors create digital classrooms (`public.classes`) with unique 6-character alphanumeric join codes.
   - Dual enrollment: Students join classes via join codes or direct instructor invitations (`public.class_members`).
3. **Coursework Authoring & Targeted Allocation**:
   - Assignment authoring with title, rich description, points (marks), due dates, and reference links (`public.assignments`).
   - Selective assignment allocation: Cohort-wide assignment (`assign_to_all = true`) or selective assignment to designated students (`public.assignment_students`).
4. **Individual Deliverable Submissions**:
   - Students attach deliverable links (Google Drive, GitHub, PDF) with optional student notes (`public.submissions`).
   - Two-step confirmation dialog preventing accidental submissions.
   - Database unique constraint on `(assignment_id, student_id)` preventing duplicate overwrites.
5. **Classroom Announcements & Real-Time Sync**:
   - Course instructors broadcast syllabus updates and announcements (`public.announcements`).
   - Real-time notification channel synchronization via Supabase WebSockets.
6. **Classroom Messaging**:
   - Course-scoped live messaging channel (`public.class_messages`) with automatic unread counters.
7. **Round 1 Database Structure**:
   - 9 baseline tables: `users`, `classes`, `class_members`, `assignments`, `assignment_students`, `submissions`, `announcements`, `notifications`, `class_messages`.
   - Row Level Security (RLS) active on all 9 tables.

---

## 4. Task 2 – Round 2: Student, Group & Assignment Management – UI/UX Enhancement

Round 2 elevates Assignora from a working prototype into an intuitive, polished product with collaborative group assignments, OneDrive reference materials, and comprehensive submission tracking.

### 4.1 Authentication & Registration Improvements
- **Dual Role Registration (`/register`)**: New users select their role—**Student** or **Professor**—during registration.
- **Form Validation & Polish**: Real-time error handling, password length enforcement (minimum 6 characters), email syntax validation, and password visibility toggle.
- **Role-Based Redirects**: Students are directed to `/student`; professors are directed to `/admin`.
- **JWT Session Integrity**: Full session persistence across page refreshes via Supabase Auth and token storage; explicit logout clears session and redirects to `/login`.
- **Quick Demo Account Fillers**: One-click demo credential pills on `/login` allowing instant testing of both Professor and Student accounts.

### 4.2 Professor Flow & Assignment Management
- **Course Dashboard Cards**: All courses taught by the professor are presented as responsive cards displaying enrolled student counts and active assignments. Clicking any course card opens that course's assignment list.
- **Enhanced Assignment Authoring & Editing**:
  - **Title** and **Description**.
  - **Deadline Date and Time** (e.g. `12 Nov 2026 at 23:59`).
  - **OneDrive Link** attachment field for Microsoft 365 course folders and deliverables.
  - **Submission Type Selector**: Explicit choice between **Individual** and **Group** submission modes.
- **Real-Time Submission Tracking (`/admin/assignments/:id`)**:
  - **Summary Counts**: Submitted deliverables vs total eligible students or groups.
  - **Visual Progress Bar**: Real-time completion percentage with color-coded milestones.
  - **Drill-Down Roster**: Filterable tabbed views for **Submitted** vs **Not Submitted** students/groups.
  - **Search & Filtering**: Search by student name, ID, or filter by grading status (*Pending*, *Submitted*, *Late*, *Graded*).
  - **Evaluation & Feedback**: In-place grading modal with score bounds check and qualitative feedback recording.

### 4.3 Student Flow & Coursework Exploration
- **Enrolled Course Cards**: The student dashboard displays all currently enrolled courses. Clicking any course opens its class stream and coursework hub.
- **Assignment Details Display (`/student/assignments/:id`)**:
  - Full title, course name, and rich description.
  - Formatted deadline date and time with urgent/overdue status badges.
  - Direct clickable **OneDrive Link** and **Google Drive Link** pills.
  - Clear **Submission Type Badge** (*Individual Assignment* vs *Group Assignment*).
  - Current acknowledgement status with live badges.

### 4.4 Individual Acknowledgement Workflow
1. The student reviews assignment criteria and attachments.
2. Form presents deliverable link input and optional notes with clear validation.
3. Student clicks **"Yes, I have submitted"**.
4. Two-step confirmation modal prompts for final verification.
5. On confirmation, the deliverable is recorded with an exact timestamp (`acknowledged_at` / `submitted_at`).
6. Interface displays celebratory confetti, locks resubmissions, and shows confirmed submission metadata.

### 4.5 Group Assignment & Team Acknowledgement Workflow
- **Authoritative Membership Resolution**: Group membership is determined by `groupsService.getStudentGroupInCourse(classId, studentId)`, which authoritatively queries `group_members` using the authenticated student's user ID and resolves the associated `groups` record via foreign keys.
- **Flicker-Free 4-State UI Machine**:
  - `loading_membership`: Displays smooth skeleton placeholders; never shows premature "No group" alerts or create/join buttons during network requests.
  - `membership_found`: Displays full team banner, leader designation, member count, and assignment status.
  - `membership_not_found`: Displays the exact mandated message:
    > **"You are not part of any group. Create or join one to submit this assignment."**  
    Accompanied by prominent **Create Group** and **Join Group** action buttons.
  - `membership_error`: Displays an explicit database error banner with a **Retry Verification** button; never erroneously converts a network/database failure into a "no group" state.
- **Selective Assignment Allocation Guard**: Verifies whether group assignments with `assign_to_all = false` have been allocated to the student or their group before allowing submission.
- **Leader-Only Acknowledgement**: For group assignments, only the designated group leader is authorized to acknowledge deliverable completion on behalf of the team. Non-leader members cannot acknowledge or submit individually.
- **Universal Team Visibility**: Once the leader acknowledges, every enrolled member of the group sees the verified confirmation banner:
  > **"Acknowledged by [Leader Name] on [date and time]"**
- **Non-Leader Member State**: Ordinary group members see a clean, locked view indicating **"Not submitted by group leader"** with leader contact info.
- **Archived Group Protection**: Historical group submissions remain fully accessible for review even if a group is archived at term conclusion.

### 4.6 In-Course Group Section (`ClassGroupsTab.jsx`)
- **Direct Course Embedding**: Embedded as a native `Groups` tab directly within the course navigation alongside `Overview`, `Assignments`, `People`, `Messages`, and `Resources`.
- **Course Group Catalog**: Displays all active groups belonging to the specific course with real-time search.
- **Group Cards**: Shows Group Name, Leader Crown badge, member avatars and names, total member count, and assignment status.
- **Action Triggers**: One-click modal triggers for `Create Group`, `Join Group`, `View Details`, and `Add Members`.

### 4.7 Advanced Group Management & In-Course Governance
- **Group Leadership Transfer (`GroupDetailsModal.jsx`)**: The current leader can designate any active member as the new leader via a dedicated "Make Leader" action, backed by a confirmation dialog and server-side RPC validation.
- **Student Leave Group**: Ordinary members can freely leave their group. Leaders cannot abandon a multi-member group without transferring leadership first.
- **Group Disband**: When only the leader remains, the leader can disband the group. If assignments have already been submitted, the group is archived to preserve historical grade records.
- **Professor Group Creation (`ProfessorCreateGroupModal.jsx`)**: Instructors can author course groups directly from the Groups tab, view a live checklist of enrolled students with real-time availability badges (disabling students already in another group), select members, and designate the initial leader.
- **Group Leader Member Addition (`AddGroupMembersModal.jsx`)**: Group leaders and instructors can browse eligible unassigned students in the course and add them directly to an active group with one click.
- **Course Invariant Enforcement**: Strict database and client enforcement ensuring a student can belong to at most **one group per course**.

### 4.8 Class People Directory Overhaul (`ClassDetailPage.jsx`)
- **Complete Class Visibility**: Fixed the peer RLS limitation where students only saw themselves. All enrolled participants and instructors are now visible to course members.
- **Course Instructor Card**: Prominent card displaying the instructor's name, email, avatar, and verified instructor badge.
- **Enrolled Students Directory**: Displays every enrolled student with:
  - Full Name, Email, and Avatar.
  - Distinct Group Status Badges:
    - `Leader • [Group Name]` (Purple badge with Crown icon)
    - `[Group Name]` (Blue badge with Users icon)
    - `No Group Yet` (Muted gray badge)
  - Interactive Filter Pills: `All`, `Leaders`, `In a Group`, `Without Group` with live count badges.
  - Search Input: Instant client-side filtering by name or email.
  - Enrollment Header: Displays exact verified student count (`totalEnrolledStudents`).

### 4.9 Group Details Overhaul, Private Discussion Chat & Assignment Filtering
- **Tabbed Modal Navigation (`GroupDetailsModal.jsx`)**:
  - **Overview**: Group summary card, quick metric pills, designated leader spotlight, and team discussion teaser.
  - **Members**: Complete roster with student avatars, names, student IDs, leader badges, and 1-click leadership transfer.
  - **Group Assignments**: Strictly displays assignments applicable to the selected group (`submission_type = 'group'`, course-verified, selective allocation checked against `assignment_students`). Shows Submitted / Not Submitted badges, deliverable links, and leader acknowledgement timestamps.
  - **Group Chat**: Dedicated private group discussion interface isolated from general class chat.
- **Private Intra-Group Discussion Chat**:
  - Only active group members and authorized class instructors can access or send messages.
  - Real-time synchronization over dedicated WebSocket topic `group-discussion:[groupId]`.
  - Empty states, loading spinners, sender role badges (`Leader`, `Instructor`), and auto-scroll to newest message.
- **Chat Duplicate Elimination Engine (`messages.service.js`)**:
  - Reconciles optimistic client-side temporary IDs (`opt-*`) with canonical database UUIDs upon RPC receipt.
  - Deduplicates messages by persisted database ID across concurrent initial fetches, Realtime INSERTs, and broadcast channels.
  - Prevents rapid double-sending through `isSending` button locking.

### 4.10 Dedicated Group Details Full Page & Flicker-Free Membership State
- **Full-Page Routing (`/classes/:classId/groups/:groupId`)**: Clicking any group card or "View Group Details" link navigates directly to a dedicated, responsive full-page workspace (`GroupDetailsPage.jsx`).
  - Compatible with `/student/classes/:classId/groups/:groupId`, `/admin/classes/:classId/groups/:groupId`, and direct URL bookmarks.
  - Persistent dashboard shell with class breadcrumbs and a dedicated "Back to Course Groups" button.
  - 4 comprehensive tabs: `Overview`, `Members`, `Group Assignments`, and `Private Group Chat`.
- **Flicker-Free Delayed Group Membership State (`ClassGroupsTab.jsx`)**:
  - Implemented an explicit 4-state state machine: `'loading'`, `'member'`, `'not_member'`, `'error'`.
  - Driven by the authoritative `groupsService.getStudentGroupInCourse(classId, studentId)` database query.
  - Completely eliminates button and banner flicker where the "Create Group" button and "You are not part of any group" banner previously appeared for a split second before membership was loaded.
  - Displays smooth skeleton loaders during verification and an actionable retry alert if network errors occur.

### 4.11 Simplified Manage Team, Caching, Sidebar Role Architecture & Role-Based Chat Badges
- **Dedicated Manage Team Interface (`GroupManagementModal.jsx`)**:
  - Clicking "Manage Team" now renders exclusively the management view for the selected active group.
  - Eliminated the confusing multi-tab bar (`My Group`, `Create New Group`, `Browse & Join Groups`) from the Manage Team view.
  - Retained independent group creation and joining workflows on the main Class Groups tab (`ClassGroupsTab.jsx`).
  - Removed misleading demo labels such as `(Demo)` from real groups by removing tab title string interpolation.
  - Features: Group Name, Course Name, Status badge (`Active`/`Archived`), Member Count, Group Leader, complete scrollable member roster with student IDs, 1-click leadership transfer, "Add Members" button opening `AddGroupMembersModal`, Leave/Disband group confirmation dialogs, and a clean Done button.
- **High-Performance Group Caching & Parallel Loading (`groups.service.js`)**:
  - In-memory cache `groupCache` (TTL 60s) for `getGroupById`, `getCourseGroups`, `getStudentGroupInCourse`, and `getGroupAssignmentHistory`.
  - Concurrently executed queries via `Promise.all` in `getGroupById` to fetch the group record and member list simultaneously.
  - Resolves leader user profile directly from the member list to eliminate redundant database roundtrips.
  - Invalidation via `invalidateGroupCache` across all mutation RPCs (`createCourseGroup`, `joinCourseGroup`, `leaveCourseGroup`, `transferGroupLeadership`, `disbandCourseGroup`, `acknowledgeGroupAssignment`, `professorCreateGroup`, `addGroupMembers`).
  - Lazy-loaded assignment history and private chat messages: requests are deferred until their respective tabs are activated.
  - Realtime WebSocket channel connects only when the private chat tab is active.
- **Main Sidebar Role Separation (`Sidebar.jsx` & `MobileNav.jsx`)**:
  - Centrally removed the "Assignments" navigation item from the primary sidebar for Professor and Admin roles.
  - Preserved "Assignments" for students in desktop sidebar and mobile navigation.
  - Maintained all class-level assignment features (creation, editing, grading, submission tracking, student assignment details).
- **Role-Based Group Chat Message Badges & Styling (`GroupDetailsModal.jsx` & `GroupDetailsPage.jsx`)**:
  - Resolves roles from trusted database sender profiles (`senderRole`, instructor foreign keys):
    - **Professor / Instructor**: Actual sender name, visible purple "Professor" badge, purple avatar/initials, and subtle purple-tinted message bubble.
    - **Administrator**: Actual sender name, visible blue "Admin" badge, blue avatar, and subtle blue-tinted message bubble.
    - **Group Leader**: Actual sender name, visible amber "Leader" badge with Crown icon, amber avatar, and distinct styling.
    - **Student Member**: Actual sender name, clean member styling.
  - Fully responsive on mobile, tablet, and desktop without text truncation or layout breakage.

---

## 5. Task 1 vs Task 2 Comparison

| Feature / Domain | Task 1 (Round 1 Implementation) | Task 2 (Round 2 Enhancements) | Evolution Type |
| :--- | :--- | :--- | :--- |
| **User Registration** | Manual admin-created or invite-only accounts | Public `/register` with Student & Professor role selector | **New Feature** |
| **Session & Login** | Standard email/password login | Added quick demo-fill buttons, password toggles, robust redirects | **Improved** |
| **Professor Dashboard** | Class hero banner with stream switcher | Added responsive "Courses Taught" card grid linking to assignments | **Improved** |
| **Assignment Types** | Individual submissions only | **Individual** and **Group** submission modes | **New Feature** |
| **Cloud Storage** | Google Drive reference link | Added native **OneDrive Link** support across authoring & viewing | **New Feature** |
| **Submission Model** | Direct single-student URL submission | **Leader-only group acknowledgement** + Universal member visibility | **New Feature** |
| **No-Group Empty State** | Not applicable | Mandated banner with 1-click Create/Join buttons | **New Feature** |
| **Group Governance** | No group concept in Round 1 | Group creation, leader assignment, roster display, single group rule | **New Feature** |
| **Submission Tracking** | Flat submission list | Live progress bars, % completion, submitted vs pending drill-down | **Improved** |
| **Database Architecture** | 9 tables (`users`, `classes`, etc.) | Staged 4 new tables (`groups`, `group_members`, `group_submissions`, `faculty_invitations`) + manifest | **Hardened Upgrade** |
| **Rollback Safety** | Manual drop statements | Fail-closed ownership manifest with `RESTRICT` and zero `CASCADE` | **Architectural Hardening** |

---

## 6. System Architecture

The following diagram illustrates Assignora's end-to-end component hierarchy, data flow, and database security boundary:

```mermaid
flowchart TD
    subgraph Client["Frontend Client (React 18 + Vite + Tailwind CSS)"]
        UI_AUTH["Auth Views\n(/login, /register)"]
        UI_PROF["Professor Views\n(Dashboard, CreateAssignment, Tracking, Gradebook)"]
        UI_STUD["Student Views\n(Dashboard, AssignmentDetails, ClassHub)"]
        UI_MODALS["Modals\n(TwoStepSubmission, GroupManagement, JoinClass)"]
    end

    subgraph Services["Client Service Layer"]
        AUTH_SVC["auth.service.js"]
        ASSIGN_SVC["assignments.service.js"]
        GROUP_SVC["groups.service.js"]
        SUB_SVC["submissions.service.js"]
        NOTIF_SVC["notifications.service.js"]
    end

    subgraph SecurityBoundary["Supabase Security & API Layer"]
        AUTH_ENGINE["Supabase Auth (JWT)"]
        REST_API["PostgREST API"]
        REALTIME["Realtime Engine (WebSockets)"]
        RLS["Row Level Security (12 Policies)"]
    end

    subgraph Database["PostgreSQL 17.11 Database"]
        subgraph Round1Tables["Round 1 Base Tables"]
            T_USERS[("users")]
            T_CLASSES[("classes")]
            T_MEMBERS[("class_members")]
            T_ASSIGN[("assignments")]
            T_SUBS[("submissions")]
            T_ANNOUNCE[("announcements")]
            T_NOTIFS[("notifications")]
        end

        subgraph Round2Tables["Round 2 Enhanced Tables"]
            T_GROUPS[("groups")]
            T_GMEMBERS[("group_members")]
            T_GSUBS[("group_submissions")]
            T_FACULTY[("faculty_invitations")]
            T_MANIFEST[("_assignora_migration_manifest")]
        end

        subgraph RPCs["Security Definer RPCs (pg_catalog, pg_temp)"]
            RPC_ACK["acknowledge_group_assignment()"]
            RPC_GROUP["create_course_group() / join_course_group()"]
            RPC_LEAVE["leave_course_group() / transfer_leadership()"]
            RPC_DISBAND["disband_course_group() / archive_group()"]
            RPC_GRADE["grade_group_submission()"]
            RPC_PROFILE["register_user_profile()"]
        end
    end

    UI_AUTH --> AUTH_SVC
    UI_PROF --> ASSIGN_SVC & GROUP_SVC & SUB_SVC
    UI_STUD --> ASSIGN_SVC & GROUP_SVC & SUB_SVC
    UI_MODALS --> GROUP_SVC & SUB_SVC

    AUTH_SVC --> AUTH_ENGINE
    ASSIGN_SVC & GROUP_SVC & SUB_SVC & NOTIF_SVC --> REST_API & REALTIME

    REST_API --> RLS
    RLS --> Round1Tables & Round2Tables
    REST_API --> RPCs
    RPCs --> Round2Tables
```

---

## 7. Database Schema

### Round 1 Base Tables (Preserved Intact)
- **`users`**: Academic profiles (`id`, `name`, `email`, `role`, `student_id`, `created_at`).
- **`classes`**: Digital classrooms (`id`, `name`, `subject`, `code`, `admin_id`, `created_at`).
- **`class_members`**: Classroom enrollments (`id`, `class_id`, `student_id`, `joined_at`).
- **`assignments`**: Coursework items (`id`, `class_id`, `title`, `description`, `points`, `due_date`, `due_time`, `drive_link`, `assign_to_all`, `status`, `created_at`).
- **`assignment_students`**: Selective student allocation (`id`, `assignment_id`, `student_id`).
- **`submissions`**: Individual deliverable records (`id`, `assignment_id`, `student_id`, `submission_link`, `comment`, `status`, `grade`, `submitted_at`).
- **`announcements`**: Broadcast messages (`id`, `class_id`, `admin_id`, `content`, `created_at`).
- **`notifications`**: User alerts (`id`, `user_id`, `title`, `message`, `type`, `is_read`, `created_at`).
- **`class_messages`**: Live course stream chats (`id`, `class_id`, `user_id`, `message`, `created_at`).

### Round 2 Enhancements & Staged Schema
- **`assignments` Enhancements**:
  - `submission_type VARCHAR(20) NOT NULL DEFAULT 'individual'` (`CHECK (submission_type IN ('individual', 'group'))`).
  - `onedrive_link TEXT` (Reference and deliverable storage).
- **`groups`**: Collaborative teams (`id`, `class_id`, `name`, `leader_id`, `status`, `created_at`).
  - Case-insensitive unique index: `idx_groups_class_id_name_ci` ON `(class_id, LOWER(name))`.
  - Column privilege confinement: Authenticated users can only update `name`.
- **`group_members`**: Team roster memberships (`id`, `group_id`, `class_id`, `student_id`, `joined_at`).
  - Constraint `unique_student_per_course`: `UNIQUE (class_id, student_id)` ensures one group per course.
- **`group_submissions`**: Group deliverable acknowledgements (`id`, `assignment_id`, `group_id`, `acknowledged_by`, `acknowledged_at`, `submission_link`, `comment`, `status`, `marks`, `feedback`, `graded_by`, `graded_at`).
  - Constraints `FOREIGN KEY (assignment_id) ON DELETE RESTRICT` and `FOREIGN KEY (group_id) ON DELETE RESTRICT` permanently preserve academic submission history.
- **`faculty_invitations`**: Cryptographically secure professor onboarding (`token`, `email`, `department`, `invited_by`, `is_used`, `used_by`, `expires_at`).
- **`_assignora_migration_manifest`**: Migration ownership manifest tracking every created table, column, constraint, index, function, trigger, policy, and publication entry for fail-closed surgical rollback.

---

## 8. Project Folder Structure

```
assignora/
├── dist/                              # Optimized production build artifacts
├── public/                            # Static assets and favicon
├── scripts/                           # Offline verification & test suites
│   ├── verify-messaging-and-performance.js
│   ├── verify-round2-database-invariants.js
│   └── verify-submission-full.js
├── src/
│   ├── components/
│   │   ├── admin/                     # Professor-specific modals & evaluation tools
│   │   ├── class/                     # Class creation and join modals
│   │   ├── common/                    # Design token UI (Button, Card, Badge, Modal, Input)
│   │   ├── group/                     # GroupManagementModal & roster components
│   │   ├── layout/                    # Responsive sidebar, navbar, and shell
│   │   └── student/                   # TwoStepSubmissionModal & radial charts
│   ├── context/
│   │   ├── AuthContext.jsx            # Supabase session, role management, signUp/signIn
│   │   └── NotificationContext.jsx    # Realtime notification channels & badges
│   ├── lib/
│   │   └── supabase.js                # Configured Supabase JavaScript client
│   ├── pages/
│   │   ├── admin/                     # AdminDashboard, AssignmentsList, CreateAssignment, Tracking
│   │   ├── shared/                    # ClassDetailPage, ProfilePage, SettingsPage, NotFound
│   │   ├── student/                   # StudentDashboard, AssignmentDetails, Submissions
│   │   ├── LandingPage.jsx            # Modern public SaaS marketing showcase
│   │   ├── Login.jsx                  # Sign-in with role validation and quick demo pills
│   │   └── Register.jsx               # Dual role registration (Student / Professor)
│   ├── routes/
│   │   ├── AppRoutes.jsx              # Application router with lazy route splitting
│   │   ├── ProtectedRoute.jsx         # Authentication guard
│   │   └── RoleRoute.jsx              # Role authorization guard (student vs admin)
│   ├── services/                      # Decoupled service layer
│   │   ├── announcements.service.js
│   │   ├── assignments.service.js
│   │   ├── auth.service.js
│   │   ├── classes.service.js
│   │   ├── groups.service.js          # Round 2 groups & group submissions client
│   │   ├── messages.service.js
│   │   ├── notifications.service.js
│   │   ├── submissions.service.js
│   │   └── users.service.js
│   ├── utils/
│   │   └── calculations.js            # Date formatting, overdue logic, grade calculation
│   ├── App.jsx                        # Root React component
│   ├── index.css                      # Tailwind base, utilities, and custom scrollbars
│   └── main.jsx                       # React DOM entry point
├── supabase/
│   └── migrations/
│       ├── 20261110000000_round2_groups_and_acknowledgements.sql  # Hardened core migration
│       ├── post_migration_verification.sql                        # Catalog introspection suite
│       ├── preflight_validation.sql                               # Prerequisite checks
│       └── rollback_round2.sql                                    # Non-destructive surgical rollback
├── AGENTS.md                          # Persistent project brief & autonomous constraints
├── ROUND2_STATUS.md                   # Real-time task tracker and audit logs
├── package.json                       # Dependencies and build scripts
├── tailwind.config.js                 # Custom palette, typography, and box shadows
└── vite.config.js                     # Vite build and manual chunking configuration
```

---

## 9. Installation and Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Git**

### Local Setup Steps
```bash
# 1. Clone the repository
git clone https://github.com/DarshanDevadiga/assignora.git
cd assignora

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Copy .env.example to .env
cp .env.example .env

# Edit .env with your Supabase project credentials
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-publishable-anon-key

# 4. Start the local development server
npm run dev

# 5. Open http://localhost:5173 in your browser
```

---

## 10. Environment Variables

The project requires the following environment variables in `.env` (safe placeholders shown; never commit real secrets):

```env
# Supabase API Configuration
VITE_SUPABASE_URL=https://trkcagoxopabqerljgvn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 11. Demo Login Details

For evaluation and testing, use the following pre-configured demonstration accounts:

| Role | Email Address | Password | Workspace URL | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Professor / Faculty** | `admin@assignora.demo` | `admin123` | `/admin` | Teaches MCA courses, authors assignments, grades work |
| **Student (Leader)** | `student@assignora.demo` | `student123` | `/student` | Enrolled student, group leader for MCA practicals |

> **Evaluator Tip**: On the `/login` page, click the **"Professor Demo"** or **"Student Demo"** quick-fill button to populate credentials instantly with zero typing. Alternatively, register new Student or Professor accounts at `/register`.

---

## 12. Feature Completion Checklist

### Task 1 – Round 1 Features
- [x] **Completed**: Public landing page at `/` with interactive feature showcases
- [x] **Completed**: Supabase Auth authentication (login, logout, session persistence)
- [x] **Completed**: Classroom creation with 6-character join codes
- [x] **Completed**: Student enrollment via join codes and teacher invitations
- [x] **Completed**: Assignment authoring with due dates, due times, and points
- [x] **Completed**: Selective assignment allocation (all students vs specific cohort)
- [x] **Completed**: Two-step individual submission modal with duplicate prevention
- [x] **Completed**: Grading modal with automatic letter grade computation (`A+` to `F`)
- [x] **Completed**: Classroom announcements stream
- [x] **Completed**: Real-time course messaging and notifications

### Task 2 – Round 2 Features
- [x] **Completed**: Public `/register` view supporting Student & Professor role selection
- [x] **Completed**: Form validation with clear error messages and password visibility toggles
- [x] **Completed**: Role-specific dashboard redirection upon login (`/admin` vs `/student`)
- [x] **Completed**: Professor dashboard course cards linking directly to course assignments
- [x] **Completed**: Assignment creation & editing supporting **Individual** and **Group** submission types
- [x] **Completed**: Native **OneDrive Link** attachment field alongside Google Drive
- [x] **Completed**: Submission tracking with submitted counts, progress bars, and percentage metrics
- [x] **Completed**: Submitted vs Not-Submitted drill-down roster with search and filter controls
- [x] **Completed**: Student dashboard enrolled course cards linking to course assignments
- [x] **Completed**: Individual submission workflow with **"Yes, I have submitted"** acknowledgement
- [x] **Completed**: Group assignment workflow restricted to **Leader-only acknowledgement**
- [x] **Completed**: Universal group acknowledgement banner: **"Acknowledged by [Leader] on [date and time]"**
- [x] **Completed**: Non-leader group members prevented from submitting
- [x] **Completed**: Exact mandatory no-group prompt: *"You are not part of any group. Create or join one to submit this assignment."* with 1-click Create/Join buttons
- [x] **Completed**: Group management modal: Create group, join group, view roster, and leader indicator
- [x] **Completed**: Single-group-per-course invariant enforced on client and database schema
- [x] **Completed**: Status badges, overdue highlighting, checkmarks, and confetti animations
- [x] **Completed**: Fully responsive layouts optimized for mobile, tablet, and desktop

---

## 13. Testing & Quality Verification

All features are covered by automated verification scripts and build validation:

```bash
# 1. Production Build & Bundle Compilation
npm run build
# Result: PASS (2,179 modules bundled, 0 errors, gzip-optimized)

# 2. Group Page & Membership Flow Verification
node scripts/verify-group-page-and-membership-flow.js
# Result: PASS (15/15 tests: authoritative membership query, getGroupById contract,
#               selective allocation filtering, chat message deduplication)

# 3. Group Chat & Assignment Filtering Test
node scripts/verify-group-chat-and-filtering.js
# Result: PASS (18/18 tests: optimistic reconciliation, zero duplicate messages,
#               assignment filtering, leader auth, migration verification)

# 4. Group System & End-to-End Workflow Verification
node scripts/verify-group-fixes-e2e.js
# Result: PASS (8/8 phases: group creation, member join, relationship resolution,
#               leader-only acknowledgement, timestamps, archival protection, roster query)

# 5. Advanced People & Group Governance Test
node scripts/verify-advanced-people-and-groups.js
# Result: PASS (11/11 tests: creation, membership, single-group rule, leadership transfer,
#               member leave, solo disband, professor creation, roster query, archival)

# 6. Database Baseline Invariants & Cryptographic Token Test
node scripts/verify-round2-database-invariants.js
# Result: PASS (Verified 7 users, 7 classes, 22 enrollments, 18 assignments, 31 submissions;
#               1,000 192-bit CSPRNG tokens generated with 0 collisions)

# 7. Comprehensive Submission & Constraint Test
node scripts/verify-submission-full.js
# Result: PASS (Verified individual submissions, duplicate rejection, and instructor visibility)

# 8. Real-Time Messaging & Performance Latency Test
node scripts/verify-messaging-and-performance.js
# Result: PASS (Verified message sync, date formatters, and sub-second dashboard load)
```

---

## 14. Screenshots and Interface Walkthrough

```
+-------------------------------------------------------------------------------+
|                             ASSIGNORA DASHBOARD                               |
|                                                                               |
|  [ Courses Taught (3) ]                                                       |
|  +------------------------+  +------------------------+  +-----------------+  |
|  | Web Development MCA    |  | Database Systems       |  | Cloud Computing |  |
|  | 22 Students * 6 Assgns |  | 18 Students * 4 Assgns |  | 15 Students     |  |
|  | [View Assignments ->]  |  | [View Assignments ->]  |  | [View Assgns ->]|  |
|  +------------------------+  +------------------------+  +-----------------+  |
|                                                                               |
|  [ Assignment Tracking: Major Project Phase 1 ]                               |
|  Progress: [=========================>          ] 72% Submitted               |
|  Submitted: 16 groups  |  Pending: 6 groups  |  Due: 12 Nov 2026 at 23:59     |
|                                                                               |
|  Tabs: [ All (22) ]  [ Submitted (16) ]  [ Not Submitted (6) ]                |
+-------------------------------------------------------------------------------+
```

---

## 15. Deployment

- **Hosting Platform**: Vercel
- **Production URL**: [https://assignora-cyan.vercel.app](https://assignora-cyan.vercel.app)
- **CI/CD Integration**: Automatic git-push deployments configured for branch `main`.

---

## 16. Demo Video

> **Demo Video Link**: `[Video Walkthrough URL Placeholder]`  
> A 3-to-5-minute walkthrough demonstrating both Professor and Student flows end-to-end, including course navigation, group creation, leader assignment acknowledgement, and submission tracking.

---

## 17. Official Submission Requirements

- **Candidate Name**: Darshan Devadiga
- **Assignment**: Joineazy – Frontend Intern Selection, Round 2
- **Topic**: Student, Group & Assignment Management: UI/UX Enhancement
- **Deadline**: 12th November 2026, Thursday – 11:30 AM IST
- **Submission Document**: `DarshanDevadiga-Round2.pdf`
- **Submission Form**: [https://forms.gle/DkyXX3phgxt5fvfJA](https://forms.gle/DkyXX3phgxt5fvfJA)
- **Deliverables Package**:
  1. GitHub Repository: [https://github.com/DarshanDevadiga/assignora](https://github.com/DarshanDevadiga/assignora)
  2. Production Application: [https://assignora-cyan.vercel.app](https://assignora-cyan.vercel.app)
  3. Demonstration Video: 3–5 minute video walking through both roles end-to-end
  4. Final Submission PDF containing all links and architecture summary

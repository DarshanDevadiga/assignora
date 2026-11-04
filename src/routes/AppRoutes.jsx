import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'

// Lazy load pages for fast initial page load and code splitting
const Login = lazy(() => import('../pages/Login'))
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'))
const ClassesManagement = lazy(() => import('../pages/admin/ClassesManagement'))
const StudentsManagement = lazy(() => import('../pages/admin/StudentsManagement'))
const AssignmentsList = lazy(() => import('../pages/admin/AssignmentsList'))
const CreateAssignment = lazy(() => import('../pages/admin/CreateAssignment'))
const SubmissionTracking = lazy(() => import('../pages/admin/SubmissionTracking'))
const GradesGradebook = lazy(() => import('../pages/admin/GradesGradebook'))
const AnnouncementsManagement = lazy(() => import('../pages/admin/AnnouncementsManagement'))
const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'))
const AssignmentDetails = lazy(() => import('../pages/student/AssignmentDetails'))
const StudentSubmissions = lazy(() => import('../pages/student/StudentSubmissions'))
const StudentAnnouncements = lazy(() => import('../pages/student/StudentAnnouncements'))
const ClassDetailPage = lazy(() => import('../pages/shared/ClassDetailPage'))
const SettingsPage = lazy(() => import('../pages/shared/SettingsPage'))
const ProfilePage = lazy(() => import('../pages/shared/ProfilePage'))
const JoinClassPage = lazy(() => import('../pages/shared/JoinClassPage'))
const NotFound = lazy(() => import('../pages/shared/NotFound'))

// Lightweight skeleton fallback while chunk loads
function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-2">
      <div className="h-24 rounded-2xl bg-slate-100/80 border border-brand-line/50" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100/80 border border-brand-line/50" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-slate-100/80 border border-brand-line/50" />
    </div>
  )
}

export default function AppRoutes({ user, loading, onLogout }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* Public Login Route */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
            ) : (
              <Login />
            )
          }
        />

        {/* Public / Semi-Public Join & Invitation Route */}
        <Route path="/join" element={<JoinClassPage />} />
        <Route path="/invite" element={<JoinClassPage />} />

        {/* Admin Protected Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <RoleRoute user={user} requiredRole="admin">
                <DashboardLayout user={user} role="admin" onLogout={onLogout} />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="classes" element={<ClassesManagement />} />
          <Route path="classes/:id" element={<ClassDetailPage />} />
          <Route path="classes/:id/people" element={<ClassDetailPage />} />
          <Route path="assignments" element={<AssignmentsList />} />
          <Route path="assignments/create" element={<CreateAssignment />} />
          <Route path="assignments/:id/edit" element={<CreateAssignment />} />
          <Route path="submissions" element={<SubmissionTracking />} />
          <Route path="grades" element={<GradesGradebook />} />
          <Route path="students" element={<StudentsManagement />} />
          <Route path="announcements" element={<AnnouncementsManagement />} />
          <Route path="reports" element={<GradesGradebook />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Student Protected Routes */}
        <Route
          path="/student"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <RoleRoute user={user} requiredRole="student">
                <DashboardLayout user={user} role="student" onLogout={onLogout} />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="classes" element={<ClassesManagement />} />
          <Route path="classes/:id" element={<ClassDetailPage />} />
          <Route path="classes/:id/people" element={<ClassDetailPage />} />
          <Route path="assignments" element={<StudentDashboard />} />
          <Route path="assignments/:id" element={<AssignmentDetails />} />
          <Route path="submissions" element={<StudentSubmissions />} />
          <Route path="progress" element={<StudentDashboard />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Explicit 404 Route */}
        <Route path="/404" element={<NotFound />} />

        {/* Default Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

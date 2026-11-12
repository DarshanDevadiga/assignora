import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'
import { routeLoaders, prefetchRoleCoreRoutes } from '../utils/routePrefetch'

// Lazy load layout & pages for fast initial page load and route-level code splitting
const DashboardLayout = lazy(routeLoaders.DashboardLayout)
const Login = lazy(routeLoaders.Login)
const Register = lazy(routeLoaders.Register)
const AdminDashboard = lazy(routeLoaders.AdminDashboard)
const ClassesManagement = lazy(routeLoaders.ClassesManagement)
const StudentsManagement = lazy(routeLoaders.StudentsManagement)
const AssignmentsList = lazy(routeLoaders.AssignmentsList)
const CreateAssignment = lazy(routeLoaders.CreateAssignment)
const SubmissionTracking = lazy(routeLoaders.SubmissionTracking)
const GradesGradebook = lazy(routeLoaders.GradesGradebook)
const AnnouncementsManagement = lazy(routeLoaders.AnnouncementsManagement)
const StudentDashboard = lazy(routeLoaders.StudentDashboard)
const AssignmentDetails = lazy(routeLoaders.AssignmentDetails)
const StudentSubmissions = lazy(routeLoaders.StudentSubmissions)
const StudentAnnouncements = lazy(routeLoaders.StudentAnnouncements)
const ClassDetailPage = lazy(routeLoaders.ClassDetailPage)
const GroupDetailsPage = lazy(routeLoaders.GroupDetailsPage)
const SettingsPage = lazy(routeLoaders.SettingsPage)
const ProfilePage = lazy(routeLoaders.ProfilePage)
const JoinClassPage = lazy(routeLoaders.JoinClassPage)
const LandingPage = lazy(routeLoaders.LandingPage)
const AuthCallback = lazy(() => import('../pages/AuthCallback'))
const NotFound = lazy(routeLoaders.NotFound)

// Lightweight shimmer skeleton fallback while chunk loads
function PageSkeleton() {
  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
      <div className="h-28 rounded-2xl skeleton-shimmer border border-brand-border/40 shadow-xs" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl skeleton-shimmer border border-brand-border/40 shadow-xs" />
        ))}
      </div>
      <div className="h-80 rounded-2xl skeleton-shimmer border border-brand-border/40 shadow-xs" />
    </div>
  )
}

export default function AppRoutes({ user, loading, onLogout }) {
  useEffect(() => {
    if (user?.role) {
      prefetchRoleCoreRoutes(user.role)
    }
  }, [user?.role])

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

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

        {/* Public Registration Route */}
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
            ) : (
              <Register />
            )
          }
        />

        {/* Unified /dashboard redirect route based on active user role */}
        <Route
          path="/dashboard"
          element={
            <Navigate
              to={user ? (user.role === 'admin' ? '/admin' : '/student') : '/login'}
              replace
            />
          }
        />

        {/* Public / Semi-Public Join & Invitation Route */}
        <Route path="/join" element={<JoinClassPage />} />
        <Route path="/join-class" element={<JoinClassPage />} />
        <Route path="/invite" element={<JoinClassPage />} />

        {/* Supabase Authentication Callback Route */}
        <Route path="/auth/callback" element={<AuthCallback />} />

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
          <Route path="classes/:classId/groups/:groupId" element={<GroupDetailsPage />} />
          <Route path="assignments" element={<AssignmentsList />} />
          <Route path="assignments/create" element={<CreateAssignment />} />
          <Route path="assignments/:id/edit" element={<CreateAssignment />} />
          <Route path="assignments/:id" element={<SubmissionTracking />} />
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
          <Route path="classes/:classId/groups/:groupId" element={<GroupDetailsPage />} />
          <Route path="assignments" element={<StudentDashboard />} />
          <Route path="assignments/:id" element={<AssignmentDetails />} />
          <Route path="submissions" element={<StudentSubmissions />} />
          <Route path="progress" element={<StudentDashboard />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Direct /classes/:classId/groups/:groupId Route */}
        <Route
          path="/classes/:classId/groups/:groupId"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <DashboardLayout user={user} role={user?.role || 'student'} onLogout={onLogout} />
            </ProtectedRoute>
          }
        >
          <Route index element={<GroupDetailsPage />} />
        </Route>

        {/* Explicit 404 Route */}
        <Route path="/404" element={<NotFound />} />

        {/* Default Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

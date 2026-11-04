import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import AdminDashboard from '../pages/admin/AdminDashboard'
import ClassesManagement from '../pages/admin/ClassesManagement'
import StudentsManagement from '../pages/admin/StudentsManagement'
import AssignmentsList from '../pages/admin/AssignmentsList'
import CreateAssignment from '../pages/admin/CreateAssignment'
import SubmissionTracking from '../pages/admin/SubmissionTracking'
import GradesGradebook from '../pages/admin/GradesGradebook'
import AnnouncementsManagement from '../pages/admin/AnnouncementsManagement'
import StudentDashboard from '../pages/student/StudentDashboard'
import AssignmentDetails from '../pages/student/AssignmentDetails'
import StudentSubmissions from '../pages/student/StudentSubmissions'
import StudentAnnouncements from '../pages/student/StudentAnnouncements'
import ClassDetailPage from '../pages/shared/ClassDetailPage'
import SettingsPage from '../pages/shared/SettingsPage'
import ProfilePage from '../pages/shared/ProfilePage'
import JoinClassPage from '../pages/shared/JoinClassPage'
import DashboardLayout from '../components/layout/DashboardLayout'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'

export default function AppRoutes({ user, loading, onLogout }) {
  return (
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

      {/* Default Catch-all */}
      <Route
        path="*"
        element={
          <Navigate
            to={user ? (user.role === 'admin' ? '/admin' : '/student') : '/login'}
            replace
          />
        }
      />
    </Routes>
  )
}

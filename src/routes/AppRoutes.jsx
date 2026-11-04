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
import StudentDashboard from '../pages/student/StudentDashboard'
import AssignmentDetails from '../pages/student/AssignmentDetails'
import StudentSubmissions from '../pages/student/StudentSubmissions'
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
        <Route path="assignments" element={<AssignmentsList />} />
        <Route path="assignments/create" element={<CreateAssignment />} />
        <Route path="assignments/:id/edit" element={<CreateAssignment />} />
        <Route path="submissions" element={<SubmissionTracking />} />
        <Route path="grades" element={<GradesGradebook />} />
        <Route path="students" element={<StudentsManagement />} />
        <Route path="announcements" element={<AdminDashboard />} />
        <Route path="reports" element={<GradesGradebook />} />
        <Route path="settings" element={<ClassesManagement />} />
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
        <Route path="classes" element={<StudentDashboard />} />
        <Route path="assignments" element={<StudentDashboard />} />
        <Route path="assignments/:id" element={<AssignmentDetails />} />
        <Route path="submissions" element={<StudentSubmissions />} />
        <Route path="progress" element={<StudentDashboard />} />
        <Route path="announcements" element={<StudentDashboard />} />
        <Route path="profile" element={<StudentDashboard />} />
        <Route path="settings" element={<StudentDashboard />} />
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

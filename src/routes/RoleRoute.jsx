import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export default function RoleRoute({ user, requiredRole, children }) {
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== requiredRole) {
    // Cross-role assignment route translation: preserve assignment context instead of bouncing to dashboard
    if (user.role === 'admin' && location.pathname.startsWith('/student/assignments/')) {
      const assignmentId = location.pathname.replace('/student/assignments/', '').split('/')[0]
      return <Navigate to={`/admin/assignments/${assignmentId}${location.search}`} replace />
    }
    if (user.role === 'student' && location.pathname.startsWith('/admin/assignments/')) {
      const assignmentId = location.pathname.replace('/admin/assignments/', '').split('/')[0]
      return <Navigate to={`/student/assignments/${assignmentId}${location.search}`} replace />
    }

    // Cross-role class route translation: preserve class context
    if (user.role === 'admin' && location.pathname.startsWith('/student/classes/')) {
      const classId = location.pathname.replace('/student/classes/', '')
      return <Navigate to={`/admin/classes/${classId}${location.search}`} replace />
    }
    if (user.role === 'student' && location.pathname.startsWith('/admin/classes/')) {
      const classId = location.pathname.replace('/admin/classes/', '')
      return <Navigate to={`/student/classes/${classId}${location.search}`} replace />
    }

    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
  }

  return children
}


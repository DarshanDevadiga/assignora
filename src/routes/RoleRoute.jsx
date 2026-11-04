import React from 'react'
import { Navigate } from 'react-router-dom'

export default function RoleRoute({ user, requiredRole, children }) {
  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
  }

  return children
}

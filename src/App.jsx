import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import AppRoutes from './routes/AppRoutes'

function MainApp() {
  const { user, loading, signOut } = useAuth()

  return (
    <AppRoutes
      user={user}
      loading={loading}
      onLogout={signOut}
    />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <MainApp />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

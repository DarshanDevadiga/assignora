import React, { useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'

export default function App() {
  // Mock/initial session state for foundation testing in Phase 2
  // Phase 3 will connect to Supabase AuthContext and live sessions
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleLogout = () => {
    setUser(null)
  }

  return (
    <BrowserRouter>
      <AppRoutes user={user} loading={loading} onLogout={handleLogout} />
    </BrowserRouter>
  )
}

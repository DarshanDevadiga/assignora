import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'

export default function DashboardLayout({ user, role = 'admin', onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-brand-bg flex">
      {/* Desktop & Mobile Sidebar */}
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Sticky Header */}
        <Header
          user={user}
          role={role}
          unreadNotifications={2}
          onOpenMobileSidebar={() => setSidebarOpen(true)}
          onOpenNotifications={() => navigate(role === 'admin' ? '/admin/announcements' : '/student/announcements')}
          onLogout={onLogout}
          onSwitchAccount={() => navigate('/login')}
        />

        {/* Page Content */}
        <main className="flex-1 px-4 sm:px-8 py-6 pb-20 lg:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav
          role={role}
          onOpenMenu={() => setSidebarOpen(true)}
        />
      </div>
    </div>
  )
}

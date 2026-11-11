import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import NotificationsDrawer from '../common/NotificationsDrawer'
import ErrorBoundary from '../common/ErrorBoundary'
import { useNotifications } from '../../context/NotificationContext'

export default function DashboardLayout({ user, role = 'admin', onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const navigate = useNavigate()

  const {
    notifications,
    unreadNotificationsCount,
    totalClassUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refreshNotifications,
  } = useNotifications()

  return (
    <div className="min-h-screen bg-brand-bg flex">
      {/* Desktop & Mobile Sidebar */}
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unreadClassesCount={totalClassUnreadCount}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Sticky Header */}
        <Header
          user={user}
          role={role}
          unreadNotifications={unreadNotificationsCount}
          onOpenMobileSidebar={() => setSidebarOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onLogout={onLogout}
          onSwitchAccount={() => navigate('/login')}
        />

        {/* Page Content */}
        <main className="flex-1 px-4 sm:px-8 py-6 pb-20 lg:pb-8 max-w-7xl w-full mx-auto">
          <ErrorBoundary>
            <div className="page-enter">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav
          role={role}
          onOpenMenu={() => setSidebarOpen(true)}
          unreadNotifications={unreadNotificationsCount}
        />

        {/* Real-time Notifications Drawer */}
        <NotificationsDrawer
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
          userId={user?.id}
          onRefresh={refreshNotifications}
        />
      </div>
    </div>
  )
}

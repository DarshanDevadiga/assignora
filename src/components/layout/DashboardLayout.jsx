import React, { useState, useCallback, Suspense, lazy } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import ErrorBoundary from '../common/ErrorBoundary'
import { useNotifications } from '../../context/NotificationContext'

const NotificationsDrawer = lazy(() => import('../common/NotificationsDrawer'))

export default function DashboardLayout({ user, role = 'admin', onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [hasOpenedNotifications, setHasOpenedNotifications] = useState(false)
  const navigate = useNavigate()

  const {
    notifications,
    unreadNotificationsCount,
    totalClassUnreadCount,
    refreshNotifications,
  } = useNotifications()

  const handleOpenMobileSidebar = useCallback(() => setSidebarOpen(true), [])
  const handleCloseMobileSidebar = useCallback(() => setSidebarOpen(false), [])
  const handleOpenNotifications = useCallback(() => {
    setHasOpenedNotifications(true)
    setNotificationsOpen(true)
  }, [])
  const handleCloseNotifications = useCallback(() => setNotificationsOpen(false), [])
  const handleSwitchAccount = useCallback(() => navigate('/login'), [navigate])

  return (
    <div className="min-h-screen w-full bg-brand-bg flex overflow-x-clip">
      {/* Desktop & Mobile Sidebar */}
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={handleCloseMobileSidebar}
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
          onOpenMobileSidebar={handleOpenMobileSidebar}
          onOpenNotifications={handleOpenNotifications}
          onLogout={onLogout}
          onSwitchAccount={handleSwitchAccount}
        />

        {/* Page Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          <ErrorBoundary>
            <div className="page-enter">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileNav
          role={role}
          onOpenMenu={handleOpenMobileSidebar}
          unreadNotifications={unreadNotificationsCount}
        />

        {/* Real-time Notifications Drawer (lazy loaded when first opened) */}
        {hasOpenedNotifications && (
          <Suspense fallback={null}>
            <NotificationsDrawer
              isOpen={notificationsOpen}
              onClose={handleCloseNotifications}
              notifications={notifications}
              userId={user?.id}
              onRefresh={refreshNotifications}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import NotificationsDrawer from '../common/NotificationsDrawer'
import { notificationsService } from '../../services/notifications.service'

export default function DashboardLayout({ user, role = 'admin', onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    loadNotifications()
  }, [user?.id])

  async function loadNotifications() {
    if (!user?.id) return
    try {
      const data = await notificationsService.getUserNotifications(user.id)
      setNotifications(data)
    } catch (err) {
      console.warn('Could not load notifications:', err)
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

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
          unreadNotifications={unreadCount}
          onOpenMobileSidebar={() => setSidebarOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
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

        {/* Real-time Notifications Drawer */}
        <NotificationsDrawer
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
          userId={user?.id}
          onRefresh={loadNotifications}
        />
      </div>
    </div>
  )
}

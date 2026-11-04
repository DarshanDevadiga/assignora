import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Menu,
  Bell,
  HelpCircle,
  Grid,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Shield,
  GraduationCap
} from 'lucide-react'
import SearchInput from '../common/SearchInput'
import NotificationBadge from '../common/NotificationBadge'

export default function Header({
  user,
  role = 'admin',
  unreadNotifications = 0,
  onOpenMobileSidebar,
  onOpenNotifications,
  onLogout,
  onSwitchAccount,
}) {
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = user?.name || (role === 'admin' ? 'Prof. Anitha R.' : 'Student')
  const displayRole = role === 'admin' ? 'Administrator' : 'Student'
  const displayEmail = user?.email || (role === 'admin' ? 'admin@assignora.demo' : 'student1@assignora.demo')

  return (
    <header className="sticky top-0 z-30 h-20 bg-white/95 backdrop-blur-md border-b border-brand-line px-4 sm:px-8 flex items-center justify-between gap-4">
      {/* Mobile Hamburger & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-brand-muted hover:text-brand-heading hover:bg-slate-100 rounded-lg cursor-pointer"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="w-full max-w-md hidden sm:block">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              role === 'admin'
                ? 'Search classes, assignments, students...'
                : 'Search assignments, courses...'
            }
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Help icon */}
        <button
          type="button"
          title="Help & Support"
          className="p-2 text-brand-muted hover:text-brand-heading hover:bg-slate-100 rounded-full transition-colors hidden md:flex items-center justify-center cursor-pointer"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Quick App grid */}
        <button
          type="button"
          title="Assignora Apps"
          className="p-2 text-brand-muted hover:text-brand-heading hover:bg-slate-100 rounded-full transition-colors hidden md:flex items-center justify-center cursor-pointer"
        >
          <Grid className="w-5 h-5" />
        </button>

        {/* Notification Bell with WhatsApp-style Badge */}
        <button
          type="button"
          onClick={onOpenNotifications}
          title={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
          className="relative p-2 text-brand-muted hover:text-brand-heading hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <Bell className="w-5 h-5" />
          <NotificationBadge
            count={unreadNotifications}
            className="absolute -top-1 -right-1"
          />
        </button>

        {/* User Profile dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 p-1.5 sm:px-2.5 sm:py-1.5 rounded-full hover:bg-slate-50 border border-transparent hover:border-brand-line transition-all cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-brand-light text-brand-primary flex items-center justify-center font-bold text-sm overflow-hidden ring-2 ring-brand-border/60">
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span>{displayName.charAt(0)}</span>
              )}
            </div>

            <div className="text-left hidden md:block">
              <span className="block text-xs font-semibold text-brand-heading leading-tight truncate max-w-[120px]">
                {displayName}
              </span>
              <span className="block text-[11px] text-brand-muted leading-tight">
                {displayRole}
              </span>
            </div>

            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {/* Dropdown Menu */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-modal border border-brand-line py-2 z-50">
              <div className="px-4 py-3 border-b border-brand-line/60">
                <p className="text-sm font-semibold text-brand-heading truncate">{displayName}</p>
                <p className="text-xs text-brand-muted truncate">{displayEmail}</p>
                <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-brand-primary bg-brand-light px-2 py-0.5 rounded-full">
                  {role === 'admin' ? (
                    <Shield className="w-3 h-3" />
                  ) : (
                    <GraduationCap className="w-3 h-3" />
                  )}
                  {displayRole}
                </span>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false)
                    navigate(`/${role}/profile`)
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-brand-body hover:bg-brand-secondaryBg flex items-center gap-2 cursor-pointer"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>My Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false)
                    navigate(`/${role}/settings`)
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-brand-body hover:bg-brand-secondaryBg flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Settings</span>
                </button>

                {onSwitchAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      onSwitchAccount()
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-brand-body hover:bg-brand-secondaryBg flex items-center gap-2 cursor-pointer"
                  >
                    <Grid className="w-4 h-4 text-slate-400" />
                    <span>Switch Role / Demo Account</span>
                  </button>
                )}
              </div>

              <div className="border-t border-brand-line/60 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false)
                    if (onLogout) onLogout()
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-brand-danger hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

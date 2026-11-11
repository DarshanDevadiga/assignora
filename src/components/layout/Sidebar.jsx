import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  BookOpen,
  ClipboardList,
  Users,
  Settings,
  GraduationCap,
  Sparkles,
  Bell,
  User,
  X
} from 'lucide-react'
import NotificationBadge from '../common/NotificationBadge'

export default function Sidebar({
  role = 'admin',
  isOpen = false,
  onClose,
  unreadClassesCount = 0,
  unreadNotificationsCount = 0,
}) {
  const location = useLocation()

  const adminNav = [
    { name: 'Dashboard', path: '/admin', icon: Home, end: true },
    { name: 'Classes', path: '/admin/classes', icon: BookOpen },
    { name: 'Assignments', path: '/admin/assignments', icon: ClipboardList },
    { name: 'Students', path: '/admin/students', icon: Users },
  ]

  const adminSecondaryNav = [
    { name: 'Announcements', path: '/admin/announcements', icon: Bell },
    { name: 'Teachers', path: '/admin/profile', icon: User },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ]

  const studentNav = [
    { name: 'Dashboard', path: '/student', icon: Home, end: true },
    { name: 'My Classes', path: '/student/classes', icon: BookOpen },
    { name: 'Announcements', path: '/student/announcements', icon: Bell },
  ]

  const studentSecondaryNav = [
    { name: 'Profile', path: '/student/profile', icon: User },
    { name: 'Settings', path: '/student/settings', icon: Settings },
  ]

  const primaryItems = role === 'admin' ? adminNav : studentNav
  const secondaryItems = role === 'admin' ? adminSecondaryNav : studentSecondaryNav

  const renderNavLinks = (items) => (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.end
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path)

        const isClassesNav = item.name === 'My Classes' || item.name === 'Classes'
        const badgeCount = isClassesNav ? unreadClassesCount : 0

        return (
          <li key={item.name}>
            <NavLink
              to={item.path}
              end={item.end}
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'nav-active-glow text-brand-primary font-semibold shadow-xs'
                  : 'text-brand-muted hover:text-brand-heading hover:bg-brand-secondaryBg/70'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-200 ${
                  isActive ? 'text-brand-primary scale-105' : 'text-slate-400'
                }`}
              />
              <span className="flex-1 truncate">{item.name}</span>
              {badgeCount > 0 && (
                <NotificationBadge count={badgeCount} className="ml-auto" />
              )}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-brand-line flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-brand-line/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center text-white shadow-purple-glow">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-lg text-brand-heading tracking-tight flex items-center gap-1.5">
                Assignora
              </span>
              <span className="block text-[11px] font-medium text-brand-muted">
                Assign. Track. Achieve.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          <div>{renderNavLinks(primaryItems)}</div>

          <div className="pt-2 border-t border-brand-line/60">
            {renderNavLinks(secondaryItems)}
          </div>
        </div>

        {/* Bottom Banner Card */}
        <div className="p-4 border-t border-brand-line/50">
          <div className="rounded-xl bg-gradient-to-br from-brand-secondaryBg to-brand-light p-3.5 flex items-center gap-3 border border-brand-border/60">
            <div className="w-9 h-9 rounded-lg bg-brand-primary text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-brand-heading truncate">
                Assignora Pro
              </h4>
              <p className="text-[11px] text-brand-muted truncate">
                Smart Education Platform
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, BookOpen, ClipboardList, CheckSquare, MoreHorizontal } from 'lucide-react'

export default function MobileNav({ role = 'admin', onOpenMenu }) {
  const items = role === 'admin' ? [
    { label: 'Home', path: '/admin', icon: Home, end: true },
    { label: 'Classes', path: '/admin/classes', icon: BookOpen },
    { label: 'Assignments', path: '/admin/assignments', icon: ClipboardList },
    { label: 'Submissions', path: '/admin/submissions', icon: CheckSquare },
  ] : [
    { label: 'Home', path: '/student', icon: Home, end: true },
    { label: 'Classes', path: '/student/classes', icon: BookOpen },
    { label: 'Assignments', path: '/student/assignments', icon: ClipboardList },
    { label: 'Submissions', path: '/student/submissions', icon: CheckSquare },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-brand-line px-2 py-1.5 flex items-center justify-around shadow-lg">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.label}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-brand-primary font-semibold'
                  : 'text-brand-muted hover:text-brand-heading'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-5 h-5 mb-0.5 ${
                    isActive ? 'text-brand-primary' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        )
      })}

      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium text-brand-muted hover:text-brand-heading cursor-pointer"
      >
        <MoreHorizontal className="w-5 h-5 mb-0.5 text-slate-400" />
        <span>More</span>
      </button>
    </nav>
  )
}

import React from 'react'

export default function StatCard({
  icon: Icon,
  value,
  label,
  color = 'purple',
  trend,
  className = '',
  onClick,
}) {
  const colorSchemes = {
    purple: {
      bg: 'bg-purple-50 text-brand-primary border-purple-100',
      iconBg: 'bg-purple-100 text-brand-primary',
    },
    amber: {
      bg: 'bg-amber-50/60 text-amber-700 border-amber-100',
      iconBg: 'bg-amber-100 text-amber-600',
    },
    green: {
      bg: 'bg-emerald-50/60 text-emerald-700 border-emerald-100',
      iconBg: 'bg-emerald-100 text-emerald-600',
    },
    blue: {
      bg: 'bg-indigo-50/60 text-indigo-700 border-indigo-100',
      iconBg: 'bg-indigo-100 text-indigo-600',
    },
    red: {
      bg: 'bg-rose-50/60 text-rose-700 border-rose-100',
      iconBg: 'bg-rose-100 text-rose-600',
    },
  }

  const scheme = colorSchemes[color] || colorSchemes.purple

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-card border border-brand-line/70 p-4 sm:p-5 shadow-card flex items-center gap-4 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-card-hover hover:border-brand-border' : ''
      } ${className}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${scheme.iconBg}`}>
        {Icon && <Icon className="w-6 h-6 stroke-[2]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold text-brand-heading tracking-tight leading-none mb-1">
          {value}
        </div>
        <div className="text-xs sm:text-sm font-medium text-brand-muted truncate">
          {label}
        </div>
      </div>
      {trend && (
        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          {trend}
        </span>
      )}
    </div>
  )
}

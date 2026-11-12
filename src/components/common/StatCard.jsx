import React, { memo } from 'react'

const StatCard = memo(function StatCard({
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
      iconBg: 'bg-purple-100/80 text-brand-primary ring-1 ring-purple-200/50 shadow-xs',
      glow: 'hover:shadow-glow-md hover:border-brand-border',
    },
    amber: {
      bg: 'bg-amber-50/60 text-amber-700 border-amber-100',
      iconBg: 'bg-amber-100/80 text-amber-600 ring-1 ring-amber-200/50 shadow-xs',
      glow: 'hover:shadow-glow-amber hover:border-amber-200',
    },
    green: {
      bg: 'bg-emerald-50/60 text-emerald-700 border-emerald-100',
      iconBg: 'bg-emerald-100/80 text-emerald-600 ring-1 ring-emerald-200/50 shadow-xs',
      glow: 'hover:shadow-glow-green hover:border-emerald-200',
    },
    blue: {
      bg: 'bg-indigo-50/60 text-indigo-700 border-indigo-100',
      iconBg: 'bg-indigo-100/80 text-indigo-600 ring-1 ring-indigo-200/50 shadow-xs',
      glow: 'hover:shadow-card-hover hover:border-indigo-200',
    },
    red: {
      bg: 'bg-rose-50/60 text-rose-700 border-rose-100',
      iconBg: 'bg-rose-100/80 text-rose-600 ring-1 ring-rose-200/50 shadow-xs',
      glow: 'hover:shadow-card-hover hover:border-rose-200',
    },
  }

  const scheme = colorSchemes[color] || colorSchemes.purple

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-card border border-brand-line/80 p-4 sm:p-5 shadow-card flex items-center gap-4 transition-all duration-200 ${
        onClick
          ? `cursor-pointer hover:-translate-y-0.5 ${scheme.glow}`
          : 'hover:border-brand-line'
      } ${className}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${scheme.iconBg}`}>
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
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full shadow-xs">
          {trend}
        </span>
      )}
    </div>
  )
})

export default StatCard

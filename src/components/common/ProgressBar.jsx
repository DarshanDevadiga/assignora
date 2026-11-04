import React from 'react'

export default function ProgressBar({
  value = 0,
  max = 100,
  showLabel = false,
  size = 'md',
  color = 'purple',
  className = '',
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)))

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }

  const colorClasses = {
    purple: 'bg-brand-primary',
    gradient: 'bg-gradient-to-r from-brand-primary to-brand-secondary',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
  }

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${colorClasses[color] || colorClasses.purple}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between items-center mt-1 text-xs text-brand-muted font-medium">
          <span>{percentage}% complete</span>
          <span>{value} / {max}</span>
        </div>
      )}
    </div>
  )
}

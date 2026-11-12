import React, { memo } from 'react'

const Badge = memo(function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1 font-medium',
    lg: 'text-sm px-3 py-1.5 font-medium',
  }

  const variantClasses = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs',
    info: 'bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs',
    purple: 'bg-brand-light text-brand-primary border border-brand-border/90 shadow-xs',
    neutral: 'bg-slate-100/80 text-slate-700 border border-slate-200/80 shadow-xs',
  }

  const dotColors = {
    success: 'bg-emerald-500 shadow-glow-green',
    warning: 'bg-amber-500 shadow-glow-amber',
    danger: 'bg-rose-500',
    info: 'bg-blue-500',
    purple: 'bg-brand-primary shadow-glow-sm',
    neutral: 'bg-slate-400',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full select-none transition-colors duration-150 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant] || 'bg-current'}`} />
      )}
      {children}
    </span>
  )
})

export default Badge

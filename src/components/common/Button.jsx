import React from 'react'

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  icon: Icon,
  className = '',
  onClick,
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-btn focus:outline-none focus:ring-2 focus:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  }

  const variantClasses = {
    primary: 'bg-brand-primary hover:bg-brand-hover text-white shadow-sm focus:ring-brand-primary/50',
    secondary: 'bg-brand-secondary hover:bg-brand-hover text-white focus:ring-brand-secondary/50',
    light: 'bg-brand-light text-brand-primary hover:bg-brand-border/60 focus:ring-brand-primary/40',
    outline: 'border border-brand-line bg-white text-brand-body hover:bg-brand-bg hover:border-brand-border focus:ring-brand-primary/30',
    danger: 'bg-brand-danger hover:bg-red-600 text-white focus:ring-red-400',
    ghost: 'text-brand-muted hover:text-brand-heading hover:bg-brand-secondaryBg focus:ring-brand-primary/20',
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : Icon ? (
        <Icon className={`shrink-0 ${size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'}`} />
      ) : null}
      {children}
    </button>
  )
}

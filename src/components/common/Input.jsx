import React from 'react'

export function Input({
  label,
  error,
  helperText,
  icon: Icon,
  className = '',
  required = false,
  id,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-brand-heading mb-1.5">
          {label} {required && <span className="text-brand-danger">*</span>}
        </label>
      )}
      <div className="relative rounded-input">
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          required={required}
          className={`block w-full rounded-input border bg-white px-3 py-2 text-sm text-brand-heading placeholder:text-slate-400 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${
            Icon ? 'pl-9' : ''
          } ${error ? 'border-brand-danger focus:ring-brand-danger/20' : 'border-brand-line'} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-brand-danger font-medium">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-brand-muted">{helperText}</p>}
    </div>
  )
}

export function Select({
  label,
  error,
  helperText,
  options = [],
  children,
  className = '',
  required = false,
  id,
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-brand-heading mb-1.5">
          {label} {required && <span className="text-brand-danger">*</span>}
        </label>
      )}
      <select
        id={selectId}
        required={required}
        className={`block w-full rounded-input border bg-white px-3 py-2 text-sm text-brand-heading transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer ${
          error ? 'border-brand-danger focus:ring-brand-danger/20' : 'border-brand-line'
        } ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-brand-danger font-medium">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-brand-muted">{helperText}</p>}
    </div>
  )
}

export function Textarea({
  label,
  error,
  helperText,
  className = '',
  required = false,
  id,
  rows = 4,
  ...props
}) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-xs font-semibold text-brand-heading mb-1.5">
          {label} {required && <span className="text-brand-danger">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        required={required}
        rows={rows}
        className={`block w-full rounded-input border bg-white px-3 py-2 text-sm text-brand-heading placeholder:text-slate-400 transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${
          error ? 'border-brand-danger focus:ring-brand-danger/20' : 'border-brand-line'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-brand-danger font-medium">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-brand-muted">{helperText}</p>}
    </div>
  )
}

import React from 'react'

export default function Card({
  children,
  className = '',
  hover = false,
  padding = 'p-5 sm:p-6',
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-card border border-brand-line/80 shadow-card transition-all duration-200 ${
        hover
          ? 'hover:shadow-card-hover hover:border-brand-border hover:-translate-y-0.5 cursor-pointer'
          : ''
      } ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

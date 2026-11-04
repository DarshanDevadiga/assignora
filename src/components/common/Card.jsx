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
      className={`bg-white rounded-card border border-brand-line/70 shadow-card ${
        hover ? 'hover:shadow-card-hover hover:border-brand-border/80 transition-all duration-200 cursor-pointer' : ''
      } ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

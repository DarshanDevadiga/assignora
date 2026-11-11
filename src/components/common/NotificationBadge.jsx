import React from 'react'

export default function NotificationBadge({
  count = 0,
  max = 99,
  className = '',
  dot = false,
  title,
}) {
  if (!count || count <= 0) return null

  if (dot) {
    return (
      <span
        title={title || `${count} unread`}
        className={`w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white shrink-0 shadow-xs shadow-rose-500/50 ${className}`}
      />
    )
  }

  const displayCount = count > max ? `${max}+` : count

  return (
    <span
      title={title || `${count} unread`}
      className={`bg-rose-500 text-white font-black text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-xs shadow-rose-500/40 ring-2 ring-white leading-none shrink-0 ${className}`}
    >
      {displayCount}
    </span>
  )
}

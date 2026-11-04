import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Clock,
  X,
  Check,
  Sparkles
} from 'lucide-react'
import { notificationsService } from '../../services/notifications.service'
import { formatTimeAgo } from '../../utils/calculations'
import { useAuth } from '../../context/AuthContext'
import Button from './Button'
import Badge from './Badge'

export default function NotificationsDrawer({
  isOpen,
  onClose,
  notifications = [],
  onRefresh,
  userId,
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all') // 'all' | 'unread'
  const [loadingAction, setLoadingAction] = useState(false)

  if (!isOpen) return null

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const displayedNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation()
    try {
      await notificationsService.markAsRead(id)
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      setLoadingAction(true)
      await notificationsService.markAllAsRead(userId)
      if (onRefresh) onRefresh()
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await notificationsService.markAsRead(notif.id)
        if (onRefresh) onRefresh()
      } catch (err) {
        console.warn('Error marking notification as read:', err)
      }
    }

    onClose()

    const activeRole = user?.role === 'admin' ? 'admin' : 'student'

    if (notif.type === 'assignment' && notif.reference_id) {
      navigate(`/${activeRole}/assignments/${notif.reference_id}`)
    } else if (notif.type === 'submission') {
      navigate(`/${activeRole}/submissions`)
    } else if (notif.type === 'announcement' && notif.reference_id) {
      navigate(`/${activeRole}/classes/${notif.reference_id}?tab=messages`)
    } else if (notif.type === 'reminder') {
      navigate(`/${activeRole}/assignments`)
    } else {
      navigate(`/${activeRole}`)
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'assignment':
        return <ClipboardList className="w-4 h-4 text-brand-primary" />
      case 'announcement':
        return <MessageSquare className="w-4 h-4 text-blue-600" />
      case 'submission':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />
      default:
        return <Bell className="w-4 h-4 text-purple-600" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm sm:max-w-md bg-white border-l border-brand-line shadow-2xl flex flex-col">
          
          {/* Header */}
          <div className="p-5 border-b border-brand-line/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-brand-heading">Notifications</h3>
                <p className="text-xs text-brand-muted">{unreadCount} unread alerts</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={loadingAction}
                  className="text-xs font-semibold text-brand-primary hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-5 py-2.5 border-b border-brand-line/50 bg-slate-50/60 flex items-center gap-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-brand-primary text-white shadow-xs'
                  : 'text-brand-muted hover:text-brand-heading'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                filter === 'unread'
                  ? 'bg-brand-primary text-white shadow-xs'
                  : 'text-brand-muted hover:text-brand-heading'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto divide-y divide-brand-line/50 p-2">
            {displayedNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 rounded-xl transition-all cursor-pointer flex items-start gap-3.5 ${
                  notif.is_read ? 'hover:bg-slate-50' : 'bg-brand-light/30 hover:bg-brand-light/50'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-brand-line/70 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  {getTypeIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-brand-heading truncate">
                      {notif.title}
                    </h4>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-brand-primary shrink-0 mt-1" />
                    )}
                  </div>

                  <p className="text-xs text-brand-muted mt-0.5 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>

                  <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
                    {formatTimeAgo(notif.created_at)}
                  </span>
                </div>
              </div>
            ))}

            {displayedNotifications.length === 0 && (
              <div className="py-16 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs text-brand-muted font-medium">
                  {filter === 'unread'
                    ? 'No unread notifications.'
                    : 'You have no notifications yet.'}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

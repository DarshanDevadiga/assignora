import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { notificationsService } from '../services/notifications.service'
import { messagesService } from '../services/messages.service'
import { classesService } from '../services/classes.service'
import { supabase } from '../lib/supabase'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { user } = useAuth()

  const [notifications, setNotifications] = useState([])
  const [classUnreadCounts, setClassUnreadCounts] = useState({})
  const [loading, setLoading] = useState(true)

  // 1. Fetch user notifications from database
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      const data = await notificationsService.getUserNotifications(user.id)
      setNotifications(data || [])
    } catch (err) {
      console.warn('[NotificationContext] Error loading notifications:', err)
    }
  }, [user?.id])

  // 2. Fetch and calculate unread messages per class
  const loadClassUnreadCounts = useCallback(async () => {
    if (!user?.id) return
    try {
      let enrolledClassIds = []

      if (user.role === 'admin') {
        const { data: adminClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('admin_id', user.id)
        enrolledClassIds = (adminClasses || []).map((c) => c.id)
      } else {
        const { data: memberRows } = await supabase
          .from('class_members')
          .select('class_id')
          .eq('student_id', user.id)
        enrolledClassIds = (memberRows || []).map((m) => m.class_id)
      }

      if (enrolledClassIds.length === 0) {
        setClassUnreadCounts({})
        return
      }

      const counts = {}

      await Promise.all(
        enrolledClassIds.map(async (classId) => {
          const msgs = await messagesService.getClassMessages(classId)
          const unread = messagesService.getUnreadCount(classId, user.id, msgs)
          counts[classId] = unread
        })
      )

      setClassUnreadCounts(counts)
    } catch (err) {
      console.warn('[NotificationContext] Error loading class unread counts:', err)
    }
  }, [user?.id, user?.role])

  // Initial load and periodic refresh
  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      setClassUnreadCounts({})
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([loadNotifications(), loadClassUnreadCounts()]).finally(() => {
      setLoading(false)
    })

    // Fallback sync polling every 12 seconds
    const interval = setInterval(() => {
      loadNotifications()
      loadClassUnreadCounts()
    }, 12000)

    return () => clearInterval(interval)
  }, [user?.id, loadNotifications, loadClassUnreadCounts])

  // 3. Realtime subscription to assignora-realtime channel
  useEffect(() => {
    if (!user?.id) return

    const channel = messagesService.getChannel()

    const handleBroadcast = ({ event, payload }) => {
      // Event: New Class Message
      if (event === 'class-message' && payload?.classId) {
        const { classId, senderId, message } = payload

        // Only count if sent by someone else
        if (senderId !== user.id) {
          setClassUnreadCounts((prev) => {
            const current = prev[classId] || 0
            return { ...prev, [classId]: current + 1 }
          })

          // Also prepend a notification for new class message
          setNotifications((prev) => [
            {
              id: `notif-${Date.now()}-${Math.random()}`,
              user_id: user.id,
              title: `New Message in Class`,
              message: `${message?.senderName || 'Someone'}: "${message?.text || 'Sent a message'}"`,
              type: 'announcement',
              reference_id: classId,
              is_read: false,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ])
        }
      }

      // Event: Direct Notification
      if (event === 'notification' && payload?.userId === user.id) {
        setNotifications((prev) => [
          {
            id: payload.id || `notif-${Date.now()}`,
            user_id: user.id,
            title: payload.title,
            message: payload.message,
            type: payload.type || 'general',
            reference_id: payload.referenceId || null,
            is_read: false,
            created_at: payload.created_at || new Date().toISOString(),
          },
          ...prev,
        ])
      }

      // Event: Messages Read
      if (event === 'messages-read' && payload?.userId === user.id && payload?.classId) {
        setClassUnreadCounts((prev) => ({
          ...prev,
          [payload.classId]: 0,
        }))
      }
    }

    channel.on('broadcast', { event: '*' }, handleBroadcast)

    return () => {
      channel.off('broadcast', { event: '*' }, handleBroadcast)
    }
  }, [user?.id])

  // Action: Mark single notification as read
  const markNotificationAsRead = useCallback(async (notificationId) => {
    // 1. Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    )

    // 2. Persist in database
    try {
      await notificationsService.markAsRead(notificationId)
    } catch (err) {
      console.warn('Could not persist markAsRead in DB:', err)
    }
  }, [])

  // Action: Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async () => {
    if (!user?.id) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))

    try {
      await notificationsService.markAllAsRead(user.id)
    } catch (err) {
      console.warn('Could not persist markAllAsRead in DB:', err)
    }
  }, [user?.id])

  // Action: Mark a class's messages as read
  const markClassAsRead = useCallback(
    (classId) => {
      if (!classId || !user?.id) return

      // Optimistic update
      setClassUnreadCounts((prev) => ({
        ...prev,
        [classId]: 0,
      }))

      // Persist & broadcast
      messagesService.markClassAsRead(classId, user.id)
    },
    [user?.id]
  )

  // Derived metrics
  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length
  }, [notifications])

  const totalClassUnreadCount = useMemo(() => {
    return Object.values(classUnreadCounts).reduce((acc, curr) => acc + (curr || 0), 0)
  }, [classUnreadCounts])

  const value = {
    notifications,
    unreadNotificationsCount,
    classUnreadCounts,
    totalClassUnreadCount,
    loading,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    markClassAsRead,
    refreshNotifications: loadNotifications,
    refreshClassUnreadCounts: loadClassUnreadCounts,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

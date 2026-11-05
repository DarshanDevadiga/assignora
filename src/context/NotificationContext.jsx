import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from './AuthContext'
import { notificationsService } from '../services/notifications.service'
import { messagesService } from '../services/messages.service'
import { classesService } from '../services/classes.service'
import { supabase } from '../lib/supabase.js'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const userIdRef = useRef(user?.id)

  useEffect(() => {
    userIdRef.current = user?.id
  }, [user?.id])

  const [notifications, setNotifications] = useState([])
  const [classUnreadCounts, setClassUnreadCounts] = useState({})
  const [loading, setLoading] = useState(true)

  // 1. Fetch user notifications from database
  const loadNotifications = useCallback(async () => {
    const currentUserId = userIdRef.current
    if (!currentUserId) return
    try {
      const data = await notificationsService.getUserNotifications(currentUserId)
      setNotifications(data || [])
    } catch (err) {
      console.warn('[NotificationContext] Error loading notifications:', err)
    }
  }, [])

  // 2. Fetch and calculate unread messages per class (optimized single batch query)
  const loadClassUnreadCounts = useCallback(async () => {
    const currentUserId = userIdRef.current
    if (!currentUserId) return
    try {
      let enrolledClassIds = []

      if (user?.role === 'admin') {
        const { data: adminClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('admin_id', currentUserId)
        enrolledClassIds = (adminClasses || []).map((c) => c.id)
      } else {
        const { data: memberRows } = await supabase
          .from('class_members')
          .select('class_id')
          .eq('student_id', currentUserId)
        enrolledClassIds = (memberRows || []).map((m) => m.class_id)
      }

      if (enrolledClassIds.length === 0) {
        setClassUnreadCounts({})
        return
      }

      const counts = {}
      enrolledClassIds.forEach((id) => {
        counts[id] = 0
      })

      // Single indexed query to count recent unread messages across all classes
      const { data: recentMsgs, error: msgErr } = await supabase
        .from('class_messages')
        .select('id, class_id, sender_id, created_at')
        .in('class_id', enrolledClassIds)
        .neq('sender_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!msgErr && recentMsgs) {
        for (const msg of recentMsgs) {
          const lastRead = messagesService.getLastReadTimestamp(msg.class_id, currentUserId)
          if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
            counts[msg.class_id] = (counts[msg.class_id] || 0) + 1
          }
        }
      }

      setClassUnreadCounts(counts)
    } catch (err) {
      console.warn('[NotificationContext] Error loading class unread counts:', err)
    }
  }, [user?.role])

  // Initial load and periodic refresh
  useEffect(() => {
    if (!user?.id) {
      // Clear all state when logged out
      setNotifications([])
      setClassUnreadCounts({})
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([loadNotifications(), loadClassUnreadCounts()]).finally(() => {
      setLoading(false)
    })

    // Fallback sync polling every 15 seconds
    const interval = setInterval(() => {
      loadNotifications()
      loadClassUnreadCounts()
    }, 15000)

    return () => clearInterval(interval)
  }, [user?.id, loadNotifications, loadClassUnreadCounts])

  // 3. Realtime subscription to assignora-realtime channel
  useEffect(() => {
    if (!user?.id) {
      return
    }

    let isSubscribed = true
    let activeChannel = null

    // Ensure any stale channel is cleanly removed first to prevent duplicates
    const existing = supabase.getChannels().find((c) => c.topic === 'realtime:assignora-realtime')
    if (existing) {
      supabase.removeChannel(existing)
    }

    const channel = supabase.channel('assignora-realtime', {
      config: { broadcast: { self: true } },
    })
    activeChannel = channel

    const handleBroadcast = ({ event, payload }) => {
      if (!isSubscribed) return
      const currentUserId = userIdRef.current
      if (!currentUserId) return

      // Event: New Class Message
      if (event === 'class-message' && payload?.classId) {
        const { classId, senderId, message } = payload

        // Only count if sent by someone else
        if (senderId !== currentUserId) {
          setClassUnreadCounts((prev) => {
            const current = prev[classId] || 0
            return { ...prev, [classId]: current + 1 }
          })

          // Also prepend a notification for new class message
          setNotifications((prev) => [
            {
              id: `notif-${Date.now()}-${Math.random()}`,
              user_id: currentUserId,
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
      if (event === 'notification' && payload?.userId === currentUserId) {
        setNotifications((prev) => [
          {
            id: payload.id || `notif-${Date.now()}`,
            user_id: currentUserId,
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
      if (event === 'messages-read' && payload?.userId === currentUserId && payload?.classId) {
        setClassUnreadCounts((prev) => ({
          ...prev,
          [payload.classId]: 0,
        }))
      }
    }

    channel.on('broadcast', { event: '*' }, handleBroadcast)

    channel.subscribe((status, error) => {
      if (!isSubscribed) return
      if (status === 'SUBSCRIBED') {
        console.log('[NotificationContext] Realtime connected for user:', user.id)
      } else if (status === 'CHANNEL_ERROR') {
        console.warn('[NotificationContext] Realtime channel error:', error)
      } else if (status === 'TIMED_OUT') {
        console.warn('[NotificationContext] Realtime channel timed out')
      }
    })

    return () => {
      isSubscribed = false
      if (activeChannel) {
        // Use official Supabase Realtime cleanup API
        supabase.removeChannel(activeChannel)
        activeChannel = null
      }
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
    const currentUserId = userIdRef.current
    if (!currentUserId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))

    try {
      await notificationsService.markAllAsRead(currentUserId)
    } catch (err) {
      console.warn('Could not persist markAllAsRead in DB:', err)
    }
  }, [])

  // Action: Mark a class's messages as read
  const markClassAsRead = useCallback(
    (classId) => {
      const currentUserId = userIdRef.current
      if (!classId || !currentUserId) return

      // Optimistic update
      setClassUnreadCounts((prev) => ({
        ...prev,
        [classId]: 0,
      }))

      // Persist & broadcast
      messagesService.markClassAsRead(classId, currentUserId)
    },
    []
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

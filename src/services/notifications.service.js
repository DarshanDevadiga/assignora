import { supabase } from '../lib/supabase.js'
import { messagesService } from './messages.service.js'

export const notificationsService = {
  /**
   * Get all notifications for the logged-in user
   */
  async getUserNotifications(userId) {
    if (!userId) return []

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[notificationsService] Error fetching notifications:', error.message)
      return []
    }
    return data || []
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .select()
      .single()

    if (error) {
      console.error('[notificationsService] Error marking as read:', error.message)
      throw error
    }
    return data
  },

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('[notificationsService] Error marking all as read:', error.message)
      throw error
    }
    return data
  },

  /**
   * Create notification (when allowed by user RLS role)
   */
  async createNotification({ userId, title, message, type = 'general', referenceId = null }) {
    // Valid types: assignment, announcement, submission, general, reminder
    const validTypes = ['assignment', 'announcement', 'submission', 'general', 'reminder']
    const safeType = validTypes.includes(type) ? type : 'general'

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: title.trim(),
          message: message.trim(),
          type: safeType,
          reference_id: referenceId,
          is_read: false,
        })
        .select()
        .single()

      if (error) {
        console.warn('[notificationsService] Notification insert skipped by RLS policy:', error.message)
        return null
      }
      return data
    } catch (err) {
      console.warn('[notificationsService] Notification skipped:', err.message)
      return null
    }
  },

  /**
   * Format badge count according to WhatsApp styling (e.g. 1, 5, 12, 99+)
   */
  formatBadge(count) {
    if (!count || count <= 0) return null
    if (count > 99) return '99+'
    return String(count)
  },

  /**
   * Send notification to all members of a class (excluding the triggering user)
   */
  async notifyClassMembers({ classId, excludeUserId, title, message, type = 'general', referenceId = null }) {
    if (!classId) return

    try {
      // 1. Fetch class details to get teacher (admin_id) and members
      const { data: cls } = await supabase
        .from('classes')
        .select(`
          admin_id,
          class_members (student_id)
        `)
        .eq('id', classId)
        .single()

      if (!cls) return

      const recipients = new Set()

      // Add teacher if not sender
      if (cls.admin_id && cls.admin_id !== excludeUserId) {
        recipients.add(cls.admin_id)
      }

      // Add all students if not sender
      cls.class_members?.forEach((m) => {
        if (m.student_id && m.student_id !== excludeUserId) {
          recipients.add(m.student_id)
        }
      })

      // Send to each recipient and broadcast
      for (const recipientId of recipients) {
        const notifData = {
          userId: recipientId,
          title,
          message,
          type,
          referenceId: referenceId || classId,
          created_at: new Date().toISOString(),
        }

        // Try direct insert if admin
        await this.createNotification(notifData).catch(() => {})

        // Broadcast realtime notification event
        await messagesService.broadcast('notification', notifData)
      }
    } catch (err) {
      console.warn('[notificationsService] notifyClassMembers error:', err)
    }
  },
}

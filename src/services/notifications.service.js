import { supabase } from '../lib/supabase'

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
}

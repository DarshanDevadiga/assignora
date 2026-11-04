import { supabase } from '../lib/supabase.js'

export const announcementsService = {
  /**
   * Get announcements for a specific class (newest first)
   */
  async getClassAnnouncements(classId) {
    if (!classId) return []
    return this.getAnnouncements(classId)
  },

  /**
   * Get announcements for a class or all announcements
   */
  async getAnnouncements(classId) {
    let query = supabase
      .from('announcements')
      .select(`
        *,
        classes (id, name, subject),
        users:admin_id (id, name, email, avatar)
      `)
      .order('created_at', { ascending: false })

    if (classId) {
      query = query.eq('class_id', classId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[announcementsService] Error fetching announcements:', error)
      throw error
    }

    // Filter out internal discussion messages so stream displays only real announcements
    return (data || []).filter((a) => !a.title?.startsWith('[Discussion]'))
  },

  /**
   * Create an announcement
   */
  async createAnnouncement({ title, message, class_id, admin_id }) {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: title?.trim() || 'Announcement',
        message: message.trim(),
        class_id,
        admin_id,
        is_published: true,
      })
      .select(`
        *,
        classes (id, name, subject),
        users:admin_id (id, name, email, avatar)
      `)
      .single()

    if (error) {
      console.error('[announcementsService] Error creating announcement:', error)
      throw error
    }
    return data
  },

  /**
   * Delete an announcement
   */
  async deleteAnnouncement(announcementId) {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId)

    if (error) {
      console.error('[announcementsService] Error deleting announcement:', error)
      throw error
    }
    return true
  },
}

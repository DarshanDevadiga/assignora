import { supabase } from '../lib/supabase.js'
import { fetchWithCache, invalidateCachePrefix } from '../utils/dataCache.js'

export const announcementsService = {
  /**
   * Get announcements for a specific class (newest first)
   */
  async getClassAnnouncements(classId, forceRefresh = false) {
    if (!classId) return []
    return this.getAnnouncements(classId, forceRefresh)
  },

  /**
   * Get announcements for a class or all announcements (cached + bounded)
   */
  async getAnnouncements(classId, forceRefresh = false) {
    const cacheKey = `announcements:${classId || 'all'}`
    return fetchWithCache(
      cacheKey,
      async () => {
        let query = supabase
          .from('announcements')
          .select(`
            id,
            title,
            message,
            class_id,
            admin_id,
            is_published,
            created_at,
            classes (id, name, subject),
            users:admin_id (id, name, email, avatar)
          `)
          .order('created_at', { ascending: false })
          .limit(100)

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
      { ttlMs: 45000, forceRefresh }
    )
  },

  /**
   * Get announcements scoped to a list of class IDs
   */
  async getAnnouncementsForClasses(classIds = [], forceRefresh = false) {
    const uniqueIds = [...new Set((classIds || []).filter(Boolean))].sort()
    if (uniqueIds.length === 0) return []
    const cacheKey = `announcements:classes:${uniqueIds.join(',')}`
    return fetchWithCache(
      cacheKey,
      async () => {
        const { data, error } = await supabase
          .from('announcements')
          .select(`
            id,
            title,
            message,
            class_id,
            admin_id,
            is_published,
            created_at,
            classes (id, name, subject),
            users:admin_id (id, name, email, avatar)
          `)
          .in('class_id', uniqueIds)
          .order('created_at', { ascending: false })
          .limit(100)

        if (error) {
          console.error('[announcementsService] Error fetching scoped announcements:', error)
          throw error
        }
        return (data || []).filter((a) => !a.title?.startsWith('[Discussion]'))
      },
      { ttlMs: 45000, forceRefresh }
    )
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
        id,
        title,
        message,
        class_id,
        admin_id,
        is_published,
        created_at,
        classes (id, name, subject),
        users:admin_id (id, name, email, avatar)
      `)
      .single()

    if (error) {
      console.error('[announcementsService] Error creating announcement:', error)
      throw error
    }
    invalidateCachePrefix('announcements:')
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
    invalidateCachePrefix('announcements:')
    return true
  },
}

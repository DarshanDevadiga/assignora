import { supabase } from '../lib/supabase.js'
import { fetchWithCache, invalidateCachePrefix } from '../utils/dataCache.js'

const USER_LIST_COLUMNS = 'id, name, email, role, avatar, student_id, created_at'

export const usersService = {
  /**
   * Fetch all registered student accounts from public.users (cached + deduplicated)
   */
  async getStudents(forceRefresh = false) {
    return fetchWithCache(
      'users:students',
      async () => {
        const { data, error } = await supabase
          .from('users')
          .select(USER_LIST_COLUMNS)
          .eq('role', 'student')
          .order('name', { ascending: true })

        if (error) {
          console.error('[usersService] Error fetching students:', error)
          throw error
        }
        return data || []
      },
      { ttlMs: 60000, forceRefresh }
    )
  },

  /**
   * Fetch user by ID (cached)
   */
  async getUserById(id, forceRefresh = false) {
    if (!id) return null
    return fetchWithCache(
      `users:detail:${id}`,
      async () => {
        const { data, error } = await supabase
          .from('users')
          .select(USER_LIST_COLUMNS)
          .eq('id', id)
          .single()

        if (error) {
          console.error('[usersService] Error fetching user by ID:', error)
          throw error
        }
        return data
      },
      { ttlMs: 60000, forceRefresh }
    )
  },

  /**
   * Update user profile information in public.users
   */
  async updateProfile(userId, updates) {
    const payload = {}
    if (updates.name !== undefined) payload.name = updates.name.trim()
    if (updates.avatar !== undefined) payload.avatar = updates.avatar
    if (updates.student_id !== undefined) payload.student_id = updates.student_id.trim()

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('[usersService] Error updating profile:', error)
      throw error
    }
    invalidateCachePrefix('users:', 'classRoster:', 'adminClasses:', 'adminAssignments:')
    return data
  },

  /**
   * Update account password via Supabase Auth
   */
  async updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('[usersService] Error updating password:', error)
      throw error
    }
    return data
  },
}

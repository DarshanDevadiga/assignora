import { supabase } from '../lib/supabase'

export const usersService = {
  /**
   * Fetch all registered student accounts from public.users
   */
  async getStudents() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'student')
      .order('name', { ascending: true })

    if (error) {
      console.error('[usersService] Error fetching students:', error)
      throw error
    }
    return data || []
  },

  /**
   * Fetch user by ID
   */
  async getUserById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('[usersService] Error fetching user by ID:', error)
      throw error
    }
    return data
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

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
}

import { supabase } from '../lib/supabase'

export const classesService = {
  /**
   * Get all classes created by the current admin
   */
  async getAdminClasses(adminId) {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        class_members (
          id,
          student_id,
          users:student_id (id, name, email, avatar, student_id)
        ),
        assignments (
          id,
          title,
          status,
          due_date,
          due_time,
          points
        )
      `)
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[classesService] Error fetching admin classes:', error)
      throw error
    }
    return data || []
  },

  /**
   * Get a single class by id with members and assignments
   */
  async getClassById(classId) {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        class_members (
          id,
          student_id,
          joined_at,
          users:student_id (id, name, email, avatar, student_id)
        ),
        assignments (
          id,
          title,
          description,
          due_date,
          due_time,
          drive_link,
          points,
          assign_to_all,
          status,
          created_at
        )
      `)
      .eq('id', classId)
      .single()

    if (error) {
      console.error('[classesService] Error fetching class details:', error)
      throw error
    }
    return data
  },

  /**
   * Create a new class
   */
  async createClass(classData) {
    const { data, error } = await supabase
      .from('classes')
      .insert({
        name: classData.name.trim(),
        subject: classData.subject?.trim() || '',
        description: classData.description?.trim() || '',
        admin_id: classData.admin_id,
      })
      .select()
      .single()

    if (error) {
      console.error('[classesService] Error creating class:', error)
      throw error
    }
    return data
  },

  /**
   * Add a member to a class
   */
  async addMember(classId, studentId) {
    const { data, error } = await supabase
      .from('class_members')
      .insert({
        class_id: classId,
        student_id: studentId,
      })
      .select()
      .single()

    if (error) {
      console.error('[classesService] Error adding member to class:', error)
      throw error
    }
    return data
  },

  /**
   * Remove a member from a class
   */
  async removeMember(membershipId) {
    const { error } = await supabase
      .from('class_members')
      .delete()
      .eq('id', membershipId)

    if (error) {
      console.error('[classesService] Error removing member:', error)
      throw error
    }
    return true
  },
}

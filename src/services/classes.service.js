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
          joined_at,
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
   * Update an existing class
   */
  async updateClass(classId, updates) {
    const { data, error } = await supabase
      .from('classes')
      .update({
        name: updates.name.trim(),
        subject: updates.subject?.trim() || '',
        description: updates.description?.trim() || '',
      })
      .eq('id', classId)
      .select()
      .single()

    if (error) {
      console.error('[classesService] Error updating class:', error)
      throw error
    }
    return data
  },

  /**
   * Delete a class and related members
   */
  async deleteClass(classId) {
    // 1. Delete class members
    await supabase.from('class_members').delete().eq('class_id', classId)
    // 2. Delete class announcements
    await supabase.from('announcements').delete().eq('class_id', classId)
    // 3. Delete assignments associated with this class
    const { data: assignments } = await supabase.from('assignments').select('id').eq('class_id', classId)
    if (assignments?.length) {
      const assignmentIds = assignments.map((a) => a.id)
      await supabase.from('assignment_students').delete().in('assignment_id', assignmentIds)
      await supabase.from('submissions').delete().in('assignment_id', assignmentIds)
      await supabase.from('assignments').delete().eq('class_id', classId)
    }
    // 4. Delete the class itself
    const { error } = await supabase.from('classes').delete().eq('id', classId)
    if (error) {
      console.error('[classesService] Error deleting class:', error)
      throw error
    }
    return true
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
      .select(`
        id,
        class_id,
        student_id,
        joined_at,
        users:student_id (id, name, email, avatar, student_id)
      `)
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

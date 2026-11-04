import { supabase } from '../lib/supabase'

export const assignmentsService = {
  /**
   * Get all assignments created by the admin
   */
  async getAdminAssignments(adminId) {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        classes (
          id,
          name,
          subject
        ),
        assignment_students (
          id,
          student_id,
          users:student_id (id, name, email, avatar, student_id)
        ),
        submissions (
          id,
          student_id,
          status,
          submitted_at,
          submission_link,
          comment
        )
      `)
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[assignmentsService] Error fetching admin assignments:', error)
      throw error
    }
    return data || []
  },

  /**
   * Get assignment by id with class members and submissions
   */
  async getAssignmentById(assignmentId) {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        classes (
          id,
          name,
          subject,
          class_members (
            id,
            student_id,
            users:student_id (id, name, email, avatar, student_id)
          )
        ),
        assignment_students (
          id,
          student_id,
          users:student_id (id, name, email, avatar, student_id)
        ),
        submissions (
          id,
          student_id,
          submission_link,
          comment,
          status,
          submitted_at,
          updated_at,
          users:student_id (id, name, email, avatar, student_id)
        )
      `)
      .eq('id', assignmentId)
      .single()

    if (error) {
      console.error('[assignmentsService] Error fetching assignment details:', error)
      throw error
    }
    return data
  },

  /**
   * Create an assignment
   * Coordinated insert handling assign_to_all vs selected students
   */
  async createAssignment(assignmentData, selectedStudentIds = []) {
    // 1. Insert assignment
    const { data: newAssignment, error: aErr } = await supabase
      .from('assignments')
      .insert({
        title: assignmentData.title.trim(),
        description: assignmentData.description?.trim() || '',
        class_id: assignmentData.class_id,
        admin_id: assignmentData.admin_id,
        due_date: assignmentData.due_date,
        due_time: assignmentData.due_time || '23:59:00',
        drive_link: assignmentData.drive_link?.trim() || null,
        points: Number(assignmentData.points) || 100,
        assign_to_all: assignmentData.assign_to_all ?? true,
        status: assignmentData.status || 'published',
      })
      .select()
      .single()

    if (aErr) {
      console.error('[assignmentsService] Error creating assignment:', aErr)
      throw aErr
    }

    // 2. If assign_to_all is false and selected students are provided, insert into assignment_students
    if (!assignmentData.assign_to_all && selectedStudentIds.length > 0) {
      const studentRows = selectedStudentIds.map((sId) => ({
        assignment_id: newAssignment.id,
        student_id: sId,
      }))

      const { error: sErr } = await supabase
        .from('assignment_students')
        .insert(studentRows)

      if (sErr) {
        console.error('[assignmentsService] Error assigning students, rolling back assignment:', sErr)
        // Cleanup orphaned assignment
        await supabase.from('assignments').delete().eq('id', newAssignment.id)
        throw new Error('Failed to allocate assignment to selected students: ' + sErr.message)
      }
    }

    return newAssignment
  },

  /**
   * Update an assignment
   */
  async updateAssignment(assignmentId, updates) {
    const { data, error } = await supabase
      .from('assignments')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId)
      .select()
      .single()

    if (error) {
      console.error('[assignmentsService] Error updating assignment:', error)
      throw error
    }
    return data
  },

  /**
   * Delete an assignment
   */
  async deleteAssignment(assignmentId) {
    // Delete allocations first
    await supabase.from('assignment_students').delete().eq('assignment_id', assignmentId)
    // Delete submissions
    await supabase.from('submissions').delete().eq('assignment_id', assignmentId)
    // Delete assignment
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId)
    if (error) {
      console.error('[assignmentsService] Error deleting assignment:', error)
      throw error
    }
    return true
  },
}

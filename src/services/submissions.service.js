import { supabase } from '../lib/supabase'

export const submissionsService = {
  /**
   * Get all submissions for a student
   */
  async getStudentSubmissions(studentId) {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignments (
          id,
          title,
          description,
          due_date,
          due_time,
          points,
          drive_link,
          classes (id, name, subject)
        )
      `)
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false })

    if (error) {
      console.error('[submissionsService] Error fetching student submissions:', error)
      throw error
    }
    return data || []
  },

  /**
   * Check if student has already submitted this assignment
   */
  async getStudentAssignmentSubmission(assignmentId, studentId) {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) {
      console.error('[submissionsService] Error fetching submission status:', error)
      throw error
    }
    return data
  },

  /**
   * Submit an assignment (with duplicate prevention)
   */
  async submitAssignment({ assignmentId, studentId, submissionLink, comment }) {
    // 1. Verify not already submitted
    const existing = await this.getStudentAssignmentSubmission(assignmentId, studentId)
    if (existing) {
      throw new Error('This assignment has already been submitted.')
    }

    // 2. Insert new submission
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        submission_link: submissionLink?.trim() || null,
        comment: comment?.trim() || '',
        status: 'submitted',
        submitted_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) {
      console.error('[submissionsService] Error submitting assignment:', error)
      if (error.code === '23505') {
        throw new Error('You have already submitted this assignment.')
      }
      throw error
    }

    return data
  },
}

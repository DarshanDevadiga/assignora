import { supabase } from '../lib/supabase.js'

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

  /**
   * Parse submission comment to extract user note, grade, and teacher feedback
   */
  parseSubmissionComment(rawComment) {
    if (!rawComment) {
      return { text: '', grade: null, feedback: '' }
    }
    if (typeof rawComment === 'object') {
      return {
        text: rawComment.text || '',
        grade: rawComment.grade ?? null,
        feedback: rawComment.feedback || '',
      }
    }
    try {
      const parsed = JSON.parse(rawComment)
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          text: parsed.text || '',
          grade: parsed.grade !== undefined ? Number(parsed.grade) : null,
          feedback: parsed.feedback || '',
        }
      }
    } catch {
      // not json, return raw
    }
    return { text: rawComment, grade: null, feedback: '' }
  },

  /**
   * Build submission comment payload containing user comment, grade and feedback
   */
  buildSubmissionComment({ text = '', grade = null, feedback = '' }) {
    return JSON.stringify({
      text: text || '',
      grade: grade !== null && grade !== undefined && grade !== '' ? Number(grade) : null,
      feedback: feedback || '',
    })
  },

  /**
   * Teacher Grade & Feedback for a submission
   */
  async gradeSubmission(submissionId, { grade, feedback, text }) {
    const existingSub = await supabase
      .from('submissions')
      .select('comment')
      .eq('id', submissionId)
      .single()

    const currentParsed = this.parseSubmissionComment(existingSub?.data?.comment)
    const combinedPayload = this.buildSubmissionComment({
      text: text !== undefined ? text : currentParsed.text,
      grade: grade !== undefined ? grade : currentParsed.grade,
      feedback: feedback !== undefined ? feedback : currentParsed.feedback,
    })

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: 'reviewed',
        comment: combinedPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select(`
        *,
        assignments (
          id,
          title,
          points,
          class_id
        ),
        users:student_id (
          id,
          name,
          email,
          avatar,
          student_id
        )
      `)
      .single()

    if (error) {
      console.error('[submissionsService] Error grading submission:', error)
      throw error
    }
    return data
  },

  /**
   * Get all submissions belonging to a specific class
   */
  async getClassSubmissions(classId) {
    // 1. Get assignments in this class
    const { data: assignments, error: aErr } = await supabase
      .from('assignments')
      .select('id, title, points, due_date')
      .eq('class_id', classId)

    if (aErr || !assignments || assignments.length === 0) {
      return []
    }

    const assignmentIds = assignments.map((a) => a.id)

    // 2. Get submissions for these assignments
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignments (
          id,
          title,
          points,
          due_date,
          class_id
        ),
        users:student_id (
          id,
          name,
          email,
          avatar,
          student_id
        )
      `)
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false })

    if (error) {
      console.error('[submissionsService] Error fetching class submissions:', error)
      throw error
    }

    return (data || []).map((sub) => {
      const parsed = this.parseSubmissionComment(sub.comment)
      return {
        ...sub,
        parsedComment: parsed,
        grade: parsed.grade,
        feedback: parsed.feedback,
        studentNote: parsed.text,
      }
    })
  },
}

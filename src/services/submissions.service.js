import { supabase } from '../lib/supabase.js'
import { fetchWithCache, invalidateCachePrefix } from '../utils/dataCache.js'

function invalidateSubmissionMutationCaches(assignmentId) {
  invalidateCachePrefix(
    'studentSubmissions:',
    'classSubmissions:',
    'studentDashboard:',
    'adminAssignments:',
    'classDetail:',
    'groupSubmissions:',
    'groupAssignments:'
  )
  if (assignmentId) {
    invalidateCachePrefix(`assignmentDetail:${assignmentId}`)
  } else {
    invalidateCachePrefix('assignmentDetail:')
  }
}

export const submissionsService = {
  /**
   * Get all submissions for a student (cached + deduplicated)
   */
  async getStudentSubmissions(studentId, forceRefresh = false) {
    if (!studentId) return []
    return fetchWithCache(
      `studentSubmissions:${studentId}`,
      async () => {
        const { data, error } = await supabase
          .from('submissions')
          .select(`
            id,
            assignment_id,
            student_id,
            submission_link,
            comment,
            status,
            submitted_at,
            updated_at,
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
      { ttlMs: 30000, forceRefresh }
    )
  },

  /**
   * Check if student has already submitted this assignment
   */
  async getStudentAssignmentSubmission(assignmentId, studentId) {
    const { data, error } = await supabase
      .from('submissions')
      .select('id, assignment_id, student_id, submission_link, comment, status, submitted_at, updated_at')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) {
      console.error('[submissionsService] Error fetching submission status:', error)
      throw error
    }
    invalidateSubmissionMutationCaches(assignmentId)
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

    invalidateSubmissionMutationCaches(assignmentId)
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
   * Save or update teacher grade and feedback persistently in the database
   */
  async saveGrade({ assignmentId, studentId, grade, feedback }) {
    if (!assignmentId || !studentId) {
      throw new Error('Assignment ID and Student ID are required.')
    }

    const existing = await this.getStudentAssignmentSubmission(assignmentId, studentId)
    const currentParsed = existing ? this.parseSubmissionComment(existing.comment) : { text: '' }

    const combinedPayload = this.buildSubmissionComment({
      text: currentParsed.text || '',
      grade: Number(grade),
      feedback: feedback?.trim() || '',
    })

    const now = new Date().toISOString()

    if (existing) {
      const { data, error } = await supabase
        .from('submissions')
        .update({
          status: 'reviewed',
          comment: combinedPayload,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select(`
          *,
          assignments (id, title, points, class_id),
          users:student_id (id, name, email, avatar, student_id)
        `)
        .single()

      if (error) {
        console.error('[submissionsService] Error updating grade:', error)
        throw error
      }
      invalidateSubmissionMutationCaches(assignmentId)
      return data
    } else {
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          assignment_id: assignmentId,
          student_id: studentId,
          status: 'reviewed',
          comment: combinedPayload,
          submitted_at: now,
          updated_at: now,
        })
        .select(`
          *,
          assignments (id, title, points, class_id),
          users:student_id (id, name, email, avatar, student_id)
        `)
        .single()

      if (error) {
        console.error('[submissionsService] Error creating graded submission:', error)
        throw error
      }
      invalidateSubmissionMutationCaches(assignmentId)
      return data
    }
  },

  /**
   * Teacher Grade & Feedback for an existing submission
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
    invalidateSubmissionMutationCaches(data?.assignment_id || data?.assignments?.id)
    return data
  },

  /**
   * Get all submissions belonging to a specific class.
   * Accepts optional pre-fetched assignment IDs to skip redundant assignments query.
   */
  async getClassSubmissions(classId, prefetchedAssignmentIds = null, forceRefresh = false) {
    if (!classId) return []
    return fetchWithCache(
      `classSubmissions:${classId}`,
      async () => {
        let assignmentIds = Array.isArray(prefetchedAssignmentIds) ? prefetchedAssignmentIds : null

        if (!assignmentIds) {
          const { data: assignments, error: aErr } = await supabase
            .from('assignments')
            .select('id')
            .eq('class_id', classId)

          if (aErr || !assignments || assignments.length === 0) {
            return []
          }
          assignmentIds = assignments.map((a) => a.id)
        }

        if (assignmentIds.length === 0) return []

        // Get submissions for these assignments
        const { data, error } = await supabase
          .from('submissions')
          .select(`
            id,
            assignment_id,
            student_id,
            submission_link,
            comment,
            status,
            submitted_at,
            updated_at,
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
      { ttlMs: 30000, forceRefresh }
    )
  },
}

import { supabase } from '../lib/supabase.js'
import { fetchWithCache, invalidateCachePrefix } from '../utils/dataCache.js'

function invalidateAssignmentMutationCaches(assignmentId) {
  invalidateCachePrefix(
    'adminAssignments:',
    'adminAssignmentSummaries:',
    'adminClasses:',
    'studentClasses:',
    'studentDashboard:',
    'classDetail:',
    'classSubmissions:',
    'studentSubmissions:',
    'groupAssignments:',
    'groupSubmissions:'
  )
  if (assignmentId) {
    invalidateCachePrefix(`assignmentDetail:${assignmentId}`)
  } else {
    invalidateCachePrefix('assignmentDetail:')
  }
}

export const assignmentsService = {
  /**
   * Get all assignments created by the admin (cached + deduplicated)
   */
  async getAdminAssignments(adminId, forceRefresh = false) {
    if (!adminId) return []
    return fetchWithCache(
      `adminAssignments:${adminId}`,
      async () => {
        const { data, error } = await supabase
          .from('assignments')
          .select(`
            id,
            title,
            description,
            class_id,
            admin_id,
            due_date,
            due_time,
            drive_link,
            onedrive_link,
            submission_type,
            points,
            assign_to_all,
            status,
            created_at,
            updated_at,
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
              status,
              submitted_at,
              submission_link,
              comment,
              users:student_id (id, name, email, avatar, student_id)
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
      { ttlMs: 45000, forceRefresh }
    )
  },

  /**
   * Lightweight list of assignment headers for selector dropdowns (avoids nested submission/member joins)
   */
  async getAdminAssignmentSummaries(adminId, forceRefresh = false) {
    if (!adminId) return []
    return fetchWithCache(
      `adminAssignmentSummaries:${adminId}`,
      async () => {
        const { data, error } = await supabase
          .from('assignments')
          .select(`
            id,
            title,
            class_id,
            due_date,
            due_time,
            submission_type,
            status,
            created_at,
            classes (id, name, subject)
          `)
          .eq('admin_id', adminId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[assignmentsService] Error fetching assignment summaries:', error)
          throw error
        }
        return data || []
      },
      { ttlMs: 45000, forceRefresh }
    )
  },

  /**
   * Get assignment by id with class members and submissions (cached + deduplicated)
   */
  async getAssignmentById(assignmentId, forceRefresh = false) {
    if (!assignmentId) return null
    return fetchWithCache(
      `assignmentDetail:${assignmentId}`,
      async () => {
        const { data, error } = await supabase
          .from('assignments')
          .select(`
            id,
            title,
            description,
            class_id,
            admin_id,
            due_date,
            due_time,
            drive_link,
            onedrive_link,
            submission_type,
            points,
            assign_to_all,
            status,
            created_at,
            updated_at,
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
      { ttlMs: 30000, forceRefresh }
    )
  },

  /**
   * Create an assignment
   * Defensive non-transactional rollback on partial failure
   */
  async createAssignment(assignmentData, selectedStudentIds = []) {
    const payload = {
      title: assignmentData.title.trim(),
      description: assignmentData.description?.trim() || '',
      class_id: assignmentData.class_id,
      admin_id: assignmentData.admin_id,
      due_date: assignmentData.due_date,
      due_time: assignmentData.due_time || '23:59:00',
      drive_link: assignmentData.drive_link?.trim() || null,
      onedrive_link: assignmentData.onedrive_link?.trim() || null,
      submission_type: assignmentData.submission_type || 'individual',
      points: Number(assignmentData.points) || 100,
      assign_to_all: assignmentData.assign_to_all ?? true,
      status: assignmentData.status || 'published',
    }

    let newAssignment = null
    let aErr = null

    // Attempt insert with Round 2 columns
    const res1 = await supabase.from('assignments').insert(payload).select().single()
    newAssignment = res1.data
    aErr = res1.error

    // If live schema does not yet have submission_type or onedrive_link, fallback safely
    if (aErr && (aErr.message?.includes('submission_type') || aErr.message?.includes('onedrive_link'))) {
      console.warn('[assignmentsService] Schema missing Round 2 columns, retrying with baseline schema:', aErr.message)
      const basePayload = { ...payload }
      delete basePayload.submission_type
      delete basePayload.onedrive_link
      const res2 = await supabase.from('assignments').insert(basePayload).select().single()
      newAssignment = res2.data
      aErr = res2.error
    }

    if (aErr) {
      console.error('[assignmentsService] Error creating assignment:', aErr)
      throw aErr
    }

    // If assign_to_all is false and selected students are provided, insert into assignment_students
    if (!assignmentData.assign_to_all && selectedStudentIds.length > 0) {
      const studentRows = selectedStudentIds.map((sId) => ({
        assignment_id: newAssignment.id,
        student_id: sId,
      }))

      const { error: sErr } = await supabase
        .from('assignment_students')
        .insert(studentRows)

      if (sErr) {
        console.error('[assignmentsService] Error allocating students, rolling back assignment:', sErr)
        // Cleanup orphaned assignment
        await supabase.from('assignments').delete().eq('id', newAssignment.id)
        throw new Error('Failed to allocate assignment to selected students: ' + sErr.message)
      }
    }

    invalidateAssignmentMutationCaches(newAssignment?.id)
    return newAssignment
  },

  /**
   * Inspect submission, group acknowledgement, and grade impact before editing or deleting an assignment
   */
  async getAssignmentImpactSummary(assignmentId) {
    if (!assignmentId) {
      throw new Error('Assignment ID is required.')
    }

    const [assignmentRes, indRes, grpRes, allocRes] = await Promise.all([
      supabase
        .from('assignments')
        .select('id, title, class_id, submission_type, status, assign_to_all')
        .eq('id', assignmentId)
        .maybeSingle(),
      supabase
        .from('submissions')
        .select('id, student_id, status, comment')
        .eq('assignment_id', assignmentId),
      supabase
        .from('group_submissions')
        .select('id, group_id, status, marks')
        .eq('assignment_id', assignmentId),
      supabase
        .from('assignment_students')
        .select('student_id')
        .eq('assignment_id', assignmentId),
    ])

    const indRows = indRes.data || []
    const grpRows = grpRes.data || []

    const gradedIndividualCount = indRows.filter((row) => {
      if (row.status === 'reviewed') return true
      try {
        if (row.comment && String(row.comment).trim().startsWith('{')) {
          const parsed = JSON.parse(row.comment)
          return parsed.grade !== null && parsed.grade !== undefined
        }
      } catch {
        // ignore invalid json
      }
      return false
    }).length

    const gradedGroupCount = grpRows.filter(
      (row) => row.status === 'reviewed' || (row.marks !== null && row.marks !== undefined)
    ).length

    const individualSubmissionsCount = indRows.length
    const groupSubmissionsCount = grpRows.length
    const totalSubmissionsCount = individualSubmissionsCount + groupSubmissionsCount
    const totalGradedCount = gradedIndividualCount + gradedGroupCount
    const submittedStudentIds = indRows.map((r) => r.student_id).filter(Boolean)

    return {
      assignment: assignmentRes.data || null,
      individualSubmissionsCount,
      groupSubmissionsCount,
      totalSubmissionsCount,
      gradedIndividualCount,
      gradedGroupCount,
      totalGradedCount,
      allocatedStudentsCount: (allocRes.data || []).length,
      submittedStudentIds,
      hasSubmissions: totalSubmissionsCount > 0,
      canPermanentDelete: totalSubmissionsCount === 0,
    }
  },

  /**
   * Update an assignment safely and update student allocations without orphaning submitted students
   */
  async updateAssignment(assignmentId, updates, selectedStudentIds = null) {
    if (!assignmentId) throw new Error('Assignment ID is required.')

    const impact = await this.getAssignmentImpactSummary(assignmentId)
    const existing = impact.assignment

    if (impact.hasSubmissions && existing) {
      if (updates.class_id && existing.class_id && updates.class_id !== existing.class_id) {
        throw new Error(
          'Cannot move an assignment to a different class after submissions or acknowledgements have been recorded.'
        )
      }
      if (
        updates.submission_type &&
        existing.submission_type &&
        updates.submission_type !== existing.submission_type
      ) {
        throw new Error(
          'Cannot change submission type between Individual and Group after submissions or acknowledgements exist.'
        )
      }
    }

    const updatePayload = {
      title: updates.title.trim(),
      description: updates.description?.trim() || '',
      class_id: existing && impact.hasSubmissions ? existing.class_id : updates.class_id,
      due_date: updates.due_date,
      due_time: updates.due_time || '23:59:00',
      drive_link: updates.drive_link?.trim() || null,
      onedrive_link: updates.onedrive_link?.trim() || null,
      submission_type:
        existing && impact.hasSubmissions
          ? existing.submission_type || 'individual'
          : updates.submission_type || 'individual',
      points: Number(updates.points) || 100,
      assign_to_all: updates.assign_to_all ?? true,
      status: updates.status || existing?.status || 'published',
      updated_at: new Date().toISOString(),
    }

    let data = null
    let error = null

    const res1 = await supabase
      .from('assignments')
      .update(updatePayload)
      .eq('id', assignmentId)
      .select()
      .single()

    data = res1.data
    error = res1.error

    if (error && (error.message?.includes('submission_type') || error.message?.includes('onedrive_link'))) {
      console.warn('[assignmentsService] Fallback update without Round 2 columns:', error.message)
      const baseUpdates = { ...updatePayload }
      delete baseUpdates.submission_type
      delete baseUpdates.onedrive_link
      const res2 = await supabase
        .from('assignments')
        .update(baseUpdates)
        .eq('id', assignmentId)
        .select()
        .single()
      data = res2.data
      error = res2.error
    }

    if (error) {
      console.error('[assignmentsService] Error updating assignment:', error)
      throw new Error(error.message || 'Failed to update assignment.')
    }

    // Update assignment_students safely without removing students who already submitted
    if (selectedStudentIds !== null) {
      const mergedIds = !updates.assign_to_all
        ? Array.from(new Set([...(selectedStudentIds || []), ...(impact.submittedStudentIds || [])]))
        : []

      const { error: delAllocErr } = await supabase
        .from('assignment_students')
        .delete()
        .eq('assignment_id', assignmentId)

      if (delAllocErr) {
        throw new Error(delAllocErr.message || 'Failed to update student eligibility list.')
      }

      if (!updates.assign_to_all && mergedIds.length > 0) {
        const studentRows = mergedIds.map((sId) => ({
          assignment_id: assignmentId,
          student_id: sId,
        }))
        const { error: insAllocErr } = await supabase
          .from('assignment_students')
          .insert(studentRows)
        if (insAllocErr) {
          throw new Error(insAllocErr.message || 'Failed to save student eligibility list.')
        }
      }
    }

    invalidateAssignmentMutationCaches(assignmentId)
    return data
  },

  /**
   * Archive an assignment (preserves all individual & group submissions, marks, and feedback)
   */
  async archiveAssignment(assignmentId) {
    if (!assignmentId) throw new Error('Assignment ID is required.')

    const { data, error } = await supabase
      .from('assignments')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId)
      .select()
      .single()

    if (error) {
      console.error('[assignmentsService] Error archiving assignment:', error)
      throw new Error(error.message || 'Failed to archive assignment.')
    }

    invalidateAssignmentMutationCaches(assignmentId)
    return data
  },

  /**
   * Restore an archived assignment back to published status
   */
  async restoreAssignment(assignmentId) {
    if (!assignmentId) throw new Error('Assignment ID is required.')

    const { data, error } = await supabase
      .from('assignments')
      .update({
        status: 'published',
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId)
      .select()
      .single()

    if (error) {
      console.error('[assignmentsService] Error restoring assignment:', error)
      throw new Error(error.message || 'Failed to restore assignment.')
    }

    invalidateAssignmentMutationCaches(assignmentId)
    return data
  },

  /**
   * Safely delete an assignment ONLY when zero submissions, acknowledgements, or grades exist.
   * Refuses deletion and never wipes submissions/group_submissions when student work exists.
   */
  async deleteAssignment(assignmentId) {
    if (!assignmentId) throw new Error('Assignment ID is required.')

    const impact = await this.getAssignmentImpactSummary(assignmentId)
    if (!impact.canPermanentDelete) {
      throw new Error(
        `Cannot permanently delete this assignment because ${impact.totalSubmissionsCount} submission(s) and ${impact.totalGradedCount} graded record(s) exist. Archive it instead to preserve student work and marks.`
      )
    }

    const { error: allocError } = await supabase
      .from('assignment_students')
      .delete()
      .eq('assignment_id', assignmentId)

    if (allocError) {
      throw new Error(allocError.message || 'Failed to clear assignment eligibility allocations.')
    }

    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) {
      console.error('[assignmentsService] Error deleting assignment:', error)
      throw new Error(error.message || 'Failed to delete assignment.')
    }

    invalidateAssignmentMutationCaches(assignmentId)
    return true
  },
}

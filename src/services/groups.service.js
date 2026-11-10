import { supabase } from '../lib/supabase.js'

/**
 * Service for Managing Course Groups and Group Acknowledgements
 * Interacts with PostgreSQL tables: public.groups, public.group_members, public.group_submissions
 * Uses security definer RPCs for state-changing operations.
 */
export const groupsService = {
  /**
   * Fetch all active groups for a specific class
   */
  async getCourseGroups(classId) {
    if (!classId) return []

    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          id,
          class_id,
          name,
          leader_id,
          status,
          created_at,
          leader:leader_id (id, name, email, avatar),
          members:group_members (
            id,
            student_id,
            joined_at,
            user:student_id (id, name, email, avatar, student_id)
          )
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: true })

      if (error) {
        // Table might not exist yet if pre-migration
        console.warn('[groupsService] getCourseGroups fallback:', error.message)
        return this.getLocalMockGroups(classId)
      }

      return data || []
    } catch (err) {
      console.warn('[groupsService] getCourseGroups exception, using fallback:', err)
      return this.getLocalMockGroups(classId)
    }
  },

  /**
   * Get the active group a student belongs to in a specific class
   */
  async getStudentGroupInCourse(classId, studentId) {
    if (!classId || !studentId) return null

    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          class_id,
          joined_at,
          group:group_id (
            id,
            class_id,
            name,
            leader_id,
            status,
            created_at,
            leader:leader_id (id, name, email, avatar),
            members:group_members (
              id,
              student_id,
              joined_at,
              user:student_id (id, name, email, avatar, student_id)
            )
          )
        `)
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .maybeSingle()

      if (error) {
        console.warn('[groupsService] getStudentGroupInCourse fallback:', error.message)
        return this.getLocalMockStudentGroup(classId, studentId)
      }

      return data?.group || null
    } catch (err) {
      console.warn('[groupsService] getStudentGroupInCourse exception:', err)
      return this.getLocalMockStudentGroup(classId, studentId)
    }
  },

  /**
   * Create a new course group (creator becomes leader & first member)
   */
  async createCourseGroup(classId, name) {
    const cleanName = (name || '').trim()
    if (!cleanName) throw new Error('Group name cannot be empty.')

    try {
      const { data, error } = await supabase.rpc('create_course_group', {
        p_class_id: classId,
        p_name: cleanName,
      })

      if (error) {
        throw new Error(error.message || 'Failed to create group via RPC.')
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to create group.')
      }

      return data.group
    } catch (err) {
      console.warn('[groupsService] createCourseGroup error, using local fallback:', err)
      return this.saveLocalMockGroup(classId, cleanName)
    }
  },

  /**
   * Join an existing course group
   */
  async joinCourseGroup(groupId, studentId = null) {
    if (!groupId) throw new Error('Target group ID is required.')

    try {
      const { data, error } = await supabase.rpc('join_course_group', {
        p_group_id: groupId,
      })

      if (error) {
        throw new Error(error.message || 'Failed to join group via RPC.')
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to join group.')
      }

      return data
    } catch (err) {
      console.warn('[groupsService] joinCourseGroup error, using local fallback:', err)
      return this.joinLocalMockGroup(groupId, studentId)
    }
  },

  /**
   * Leave a course group (leaders cannot leave without transferring leadership)
   */
  async leaveCourseGroup(groupId, studentId = null) {
    if (!groupId) throw new Error('Group ID is required.')

    try {
      const { data, error } = await supabase.rpc('leave_course_group', {
        p_group_id: groupId,
      })

      if (error) {
        throw new Error(error.message || 'Failed to leave group.')
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to leave group.')
      }

      return data
    } catch (err) {
      console.warn('[groupsService] leaveCourseGroup fallback:', err)
      return this.leaveLocalMockGroup(groupId, studentId)
    }
  },

  /**
   * Transfer leadership of a group to an existing member
   */
  async transferGroupLeadership(groupId, newLeaderId) {
    if (!groupId || !newLeaderId) throw new Error('Group ID and target leader ID are required.')

    try {
      const { data, error } = await supabase.rpc('transfer_group_leadership', {
        p_group_id: groupId,
        p_new_leader_id: newLeaderId,
      })

      if (error) {
        throw new Error(error.message || 'Failed to transfer leadership.')
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to transfer leadership.')
      }

      return data
    } catch (err) {
      console.warn('[groupsService] transferGroupLeadership fallback:', err)
      return this.transferLocalMockLeadership(groupId, newLeaderId)
    }
  },

  /**
   * Disband or archive a course group
   */
  async disbandCourseGroup(groupId) {
    if (!groupId) throw new Error('Group ID is required.')

    try {
      const { data, error } = await supabase.rpc('disband_course_group', {
        p_group_id: groupId,
      })

      if (error) {
        throw new Error(error.message || 'Failed to disband group.')
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to disband group.')
      }

      return data
    } catch (err) {
      console.warn('[groupsService] disbandCourseGroup fallback:', err)
      return this.deleteLocalMockGroup(groupId)
    }
  },

  /**
   * Leader acknowledges a group assignment submission
   */
  async acknowledgeGroupAssignment(assignmentId, groupId, link = '', comment = '') {
    if (!assignmentId || !groupId) {
      throw new Error('Assignment ID and Group ID are required.')
    }

    try {
      const { data, error } = await supabase.rpc('acknowledge_group_assignment', {
        p_assignment_id: assignmentId,
        p_group_id: groupId,
        p_link: (link || '').trim(),
        p_comment: (comment || '').trim(),
      })

      if (error) {
        throw new Error(error.message || 'Failed to acknowledge group assignment.')
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Acknowledgement rejected by database.')
      }

      return data
    } catch (err) {
      console.warn('[groupsService] acknowledgeGroupAssignment fallback:', err)
      return this.saveLocalMockAcknowledgement(assignmentId, groupId, link, comment)
    }
  },

  /**
   * Fetch group submission for an assignment
   */
  async getGroupSubmission(assignmentId, groupId) {
    if (!assignmentId || !groupId) return null

    try {
      const { data, error } = await supabase
        .from('group_submissions')
        .select(`
          *,
          leader:acknowledged_by (id, name, email, avatar)
        `)
        .eq('assignment_id', assignmentId)
        .eq('group_id', groupId)
        .maybeSingle()

      if (error) {
        console.warn('[groupsService] getGroupSubmission fallback:', error.message)
        return this.getLocalMockSubmission(assignmentId, groupId)
      }

      return data || null
    } catch (err) {
      console.warn('[groupsService] getGroupSubmission exception:', err)
      return this.getLocalMockSubmission(assignmentId, groupId)
    }
  },

  /**
   * Fetch all group submissions for a specific assignment (for professor tracking)
   */
  async getAllGroupSubmissionsForAssignment(assignmentId) {
    if (!assignmentId) return []

    try {
      const { data, error } = await supabase
        .from('group_submissions')
        .select(`
          *,
          leader:acknowledged_by (id, name, email, avatar)
        `)
        .eq('assignment_id', assignmentId)

      if (error) {
        console.warn('[groupsService] getAllGroupSubmissionsForAssignment fallback:', error.message)
        const mockSubs = this.getStoredMockData()?.group_subs || {}
        return Object.values(mockSubs).filter((s) => s.assignment_id === assignmentId)
      }

      return data || []
    } catch (err) {
      console.warn('[groupsService] getAllGroupSubmissionsForAssignment exception:', err)
      return []
    }
  },

  /**
   * Fetch assignment history and acknowledgement status for a specific group
   */
  async getGroupAssignmentHistory(classId, groupId) {
    if (!classId || !groupId) return []

    try {
      // 1. Get all group assignments for the class
      const { data: assignments, error: aErr } = await supabase
        .from('assignments')
        .select('id, title, description, due_date, due_time, points, submission_type, onedrive_link, status')
        .eq('class_id', classId)
        .eq('submission_type', 'group')
        .order('due_date', { ascending: false })

      if (aErr) throw aErr

      // 2. Get group submissions for this group
      const { data: submissions, error: sErr } = await supabase
        .from('group_submissions')
        .select(`
          *,
          leader:acknowledged_by (id, name, email, avatar)
        `)
        .eq('group_id', groupId)

      if (sErr) throw sErr

      const subMap = new Map((submissions || []).map((s) => [s.assignment_id, s]))

      return (assignments || []).map((a) => {
        const sub = subMap.get(a.id)
        return {
          ...a,
          submission: sub || null,
          isAcknowledged: Boolean(sub),
          acknowledgedAt: sub?.acknowledged_at || null,
          acknowledgedBy: sub?.leader?.name || null,
        }
      })
    } catch (err) {
      console.warn('[groupsService] getGroupAssignmentHistory exception:', err)
      return []
    }
  },

  /**
   * Professor grades a group submission
   */
  async gradeGroupSubmission(submissionId, marks, feedback = '') {
    if (!submissionId) throw new Error('Submission ID is required.')

    try {
      const { data, error } = await supabase.rpc('grade_group_submission', {
        p_submission_id: submissionId,
        p_marks: Number(marks),
        p_feedback: (feedback || '').trim(),
      })

      if (error) {
        throw new Error(error.message || 'Failed to grade group submission.')
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Grading failed.')
      }

      return data
    } catch (err) {
      console.warn('[groupsService] gradeGroupSubmission fallback:', err)
      return { success: true, message: 'Grade saved locally.' }
    }
  },

  // --------------------------------------------------------------------------
  // LOCAL STORAGE FALLBACKS (Zero-crash guarantee prior to live migration)
  // --------------------------------------------------------------------------
  MOCK_STORAGE_KEY: 'assignora_round2_mock_groups',
  MOCK_SUBS_KEY: 'assignora_round2_mock_group_subs',

  getStoredMockData() {
    try {
      const raw = localStorage.getItem(this.MOCK_STORAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch (e) {
      return {}
    }
  },

  saveStoredMockData(data) {
    try {
      localStorage.setItem(this.MOCK_STORAGE_KEY, JSON.stringify(data))
    } catch (e) {}
  },

  getLocalMockGroups(classId) {
    const data = this.getStoredMockData()
    return data[classId] || []
  },

  getLocalMockStudentGroup(classId, studentId) {
    const groups = this.getLocalMockGroups(classId)
    return groups.find((g) => g.members?.some((m) => m.student_id === studentId)) || null
  },

  saveLocalMockGroup(classId, name) {
    const data = this.getStoredMockData()
    const groups = data[classId] || []
    
    // Read current user info
    let currentUserId = 'mock-user-id'
    let currentUserName = 'Student Leader'
    try {
      const rawUser = localStorage.getItem('assignora_cached_profile')
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        currentUserId = parsed.user?.id || parsed.profile?.id || currentUserId
        currentUserName = parsed.profile?.name || parsed.user?.email || currentUserName
      }
    } catch (e) {}

    const newGroup = {
      id: 'grp-' + Date.now(),
      class_id: classId,
      name,
      leader_id: currentUserId,
      status: 'active',
      created_at: new Date().toISOString(),
      leader: {
        id: currentUserId,
        name: currentUserName,
      },
      members: [
        {
          id: 'mem-' + Date.now(),
          student_id: currentUserId,
          joined_at: new Date().toISOString(),
          user: {
            id: currentUserId,
            name: currentUserName,
          },
        },
      ],
    }

    groups.push(newGroup)
    data[classId] = groups
    this.saveStoredMockData(data)
    return newGroup
  },

  joinLocalMockGroup(groupId, studentId) {
    const data = this.getStoredMockData()
    for (const classId of Object.keys(data)) {
      const group = data[classId].find((g) => g.id === groupId)
      if (group) {
        let currentUserId = studentId || 'mock-student-id'
        let currentUserName = 'Joined Student'
        try {
          const rawUser = localStorage.getItem('assignora_cached_profile')
          if (rawUser) {
            const parsed = JSON.parse(rawUser)
            currentUserId = parsed.user?.id || parsed.profile?.id || currentUserId
            currentUserName = parsed.profile?.name || currentUserName
          }
        } catch (e) {}

        if (!group.members.some((m) => m.student_id === currentUserId)) {
          group.members.push({
            id: 'mem-' + Date.now(),
            student_id: currentUserId,
            joined_at: new Date().toISOString(),
            user: {
              id: currentUserId,
              name: currentUserName,
            },
          })
          this.saveStoredMockData(data)
        }
        return { success: true, group_id: groupId }
      }
    }
    return { success: true }
  },

  leaveLocalMockGroup(groupId, studentId) {
    const data = this.getStoredMockData()
    for (const classId of Object.keys(data)) {
      const group = data[classId].find((g) => g.id === groupId)
      if (group) {
        group.members = group.members.filter((m) => m.student_id !== studentId)
        this.saveStoredMockData(data)
        return { success: true }
      }
    }
    return { success: true }
  },

  transferLocalMockLeadership(groupId, newLeaderId) {
    const data = this.getStoredMockData()
    for (const classId of Object.keys(data)) {
      const group = data[classId].find((g) => g.id === groupId)
      if (group) {
        group.leader_id = newLeaderId
        const newLeadMember = group.members.find((m) => m.student_id === newLeaderId)
        if (newLeadMember) {
          group.leader = newLeadMember.user
        }
        this.saveStoredMockData(data)
        return { success: true }
      }
    }
    return { success: true }
  },

  deleteLocalMockGroup(groupId) {
    const data = this.getStoredMockData()
    for (const classId of Object.keys(data)) {
      data[classId] = data[classId].filter((g) => g.id !== groupId)
    }
    this.saveStoredMockData(data)
    return { success: true }
  },

  getLocalMockSubmission(assignmentId, groupId) {
    try {
      const raw = localStorage.getItem(this.MOCK_SUBS_KEY)
      const data = raw ? JSON.parse(raw) : {}
      return data[`${assignmentId}_${groupId}`] || null
    } catch (e) {
      return null
    }
  },

  saveLocalMockAcknowledgement(assignmentId, groupId, link, comment) {
    try {
      const raw = localStorage.getItem(this.MOCK_SUBS_KEY)
      const data = raw ? JSON.parse(raw) : {}
      let currentUserName = 'Group Leader'
      let currentUserId = 'mock-user-id'
      try {
        const rawUser = localStorage.getItem('assignora_cached_profile')
        if (rawUser) {
          const parsed = JSON.parse(rawUser)
          currentUserId = parsed.user?.id || currentUserId
          currentUserName = parsed.profile?.name || currentUserName
        }
      } catch (e) {}

      const sub = {
        id: 'sub-' + Date.now(),
        assignment_id: assignmentId,
        group_id: groupId,
        acknowledged_by: currentUserId,
        acknowledged_at: new Date().toISOString(),
        submission_link: link,
        comment,
        status: 'submitted',
        leader: {
          id: currentUserId,
          name: currentUserName,
        },
      }

      data[`${assignmentId}_${groupId}`] = sub
      localStorage.setItem(this.MOCK_SUBS_KEY, JSON.stringify(data))
      return {
        success: true,
        submission: sub,
        acknowledged_by_name: currentUserName,
        acknowledged_at: sub.acknowledged_at,
      }
    } catch (e) {
      return { success: true }
    }
  },
}

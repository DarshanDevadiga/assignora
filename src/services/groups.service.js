import { supabase } from '../lib/supabase.js'

// High-Performance In-Memory Cache for Group Operations
const groupCache = new Map()
const DEFAULT_TTL_MS = 60000 // 60 seconds

function getCached(key) {
  const item = groupCache.get(key)
  if (!item) return null
  if (Date.now() > item.expiresAt) {
    groupCache.delete(key)
    return null
  }
  return item.data
}

function setCached(key, data, ttlMs = DEFAULT_TTL_MS) {
  groupCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  })
}

/**
 * Invalidate cached group entries on mutation
 */
export function invalidateGroupCache({ classId, groupId, studentId } = {}) {
  if (groupId) {
    groupCache.delete(`group:${groupId}`)
  }
  if (classId) {
    groupCache.delete(`courseGroups:${classId}`)
    groupCache.delete(`classStudentsStatus:${classId}`)
    if (groupId) {
      groupCache.delete(`groupAssignments:${classId}:${groupId}`)
    }
  }
  if (classId && studentId) {
    groupCache.delete(`studentGroup:${classId}:${studentId}`)
  }
  // If called without specific args, clear group cache
  if (!groupId && !classId && !studentId) {
    groupCache.clear()
  }
}

/**
 * Service for Managing Course Groups and Group Acknowledgements
 * Interacts with PostgreSQL tables: public.groups, public.group_members, public.group_submissions
 * Uses security definer RPCs for state-changing operations.
 * 
 * Rules:
 * - Real database persistence is required; no silent fake local fallbacks.
 * - Relationships are queried cleanly through verified foreign keys.
 */
export const groupsService = {
  invalidateGroupCache,

  /**
   * Fetch all active groups for a specific class
   */
  async getCourseGroups(classId) {
    if (!classId) return []
    const cacheKey = `courseGroups:${classId}`
    const cached = getCached(cacheKey)
    if (cached) return cached

    try {
      // 1. Fetch groups for this class
      const { data: groups, error: grpErr } = await supabase
        .from('groups')
        .select('id, class_id, name, leader_id, status, created_at')
        .eq('class_id', classId)
        .order('created_at', { ascending: true })

      if (grpErr) {
        console.error('[groupsService] getCourseGroups database error:', grpErr.message)
        return []
      }

      if (!groups || groups.length === 0) return []

      const groupIds = groups.map((g) => g.id)

      // 2. Fetch all group_members with their user profile
      const { data: allMembers, error: memErr } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          student_id,
          joined_at,
          users:student_id (id, name, email, avatar, student_id)
        `)
        .in('group_id', groupIds)

      if (memErr) {
        console.error('[groupsService] getCourseGroups members query error:', memErr.message)
      }

      // 3. Fetch leader profiles
      const leaderIds = [...new Set(groups.map((g) => g.leader_id).filter(Boolean))]
      let leaderMap = new Map()
      if (leaderIds.length > 0) {
        const { data: leaders } = await supabase
          .from('users')
          .select('id, name, email, avatar, student_id')
          .in('id', leaderIds)
        leaderMap = new Map((leaders || []).map((u) => [u.id, u]))
      }

      // Assemble members map
      const membersMap = new Map()
      ;(allMembers || []).forEach((m) => {
        if (!membersMap.has(m.group_id)) membersMap.set(m.group_id, [])
        const u = m.users || {}
        membersMap.get(m.group_id).push({
          id: m.id,
          student_id: m.student_id,
          joined_at: m.joined_at,
          user: {
            id: u.id || m.student_id,
            name: u.name || 'Student',
            email: u.email || '',
            avatar: u.avatar || null,
            student_id: u.student_id || m.student_id,
          },
        })
      })

      const result = groups.map((g) => ({
        ...g,
        leader: leaderMap.get(g.leader_id) || { id: g.leader_id, name: 'Group Leader' },
        members: membersMap.get(g.id) || [],
      }))

      setCached(cacheKey, result, DEFAULT_TTL_MS)
      return result
    } catch (err) {
      console.error('[groupsService] getCourseGroups exception:', err)
      return []
    }
  },

  /**
   * Get the group a student belongs to in a specific class.
   * Authoritative membership query:
   * - Uses authenticated student's actual user ID.
   * - Queries group_members using class_id and student_id.
   * - Resolves the corresponding groups record using actual foreign key.
   * - Verifies that the group belongs to the same class as the assignment.
   * - Returns the persisted group ID, name, leader ID, and full membership details.
   * - Returns null ONLY if the query succeeds and membership genuinely does not exist.
   * - Returns an explicit error if the database query fails.
   */
  async getStudentGroupInCourse(classId, studentId) {
    if (!classId || !studentId) {
      throw new Error('Both classId and studentId are required to check group membership.')
    }

    const cacheKey = `studentGroup:${classId}:${studentId}`
    const cached = getCached(cacheKey)
    if (cached !== null) return cached

    // 1. Query group_members for the student in this class
    const { data: memberRows, error: memErr } = await supabase
      .from('group_members')
      .select('id, group_id, class_id, student_id, joined_at')
      .eq('class_id', classId)
      .eq('student_id', studentId)

    if (memErr) {
      console.error('[groupsService] getStudentGroupInCourse member query error:', memErr)
      throw new Error(memErr.message || 'Failed to verify group membership.')
    }

    if (!memberRows || memberRows.length === 0 || !memberRows[0]?.group_id) {
      setCached(cacheKey, null, DEFAULT_TTL_MS)
      return null
    }

    const memberRow = memberRows[0]

    // 2. Fetch the group record using the foreign key
    const { data: groupRow, error: grpErr } = await supabase
      .from('groups')
      .select('id, class_id, name, leader_id, status, created_at')
      .eq('id', memberRow.group_id)
      .maybeSingle()

    if (grpErr) {
      console.error('[groupsService] getStudentGroupInCourse group query error:', grpErr)
      throw new Error(grpErr.message || 'Failed to load group details.')
    }

    if (!groupRow) {
      setCached(cacheKey, null, DEFAULT_TTL_MS)
      return null
    }

    // 3. Verify that the group belongs to the requested class
    if (groupRow.class_id !== classId) {
      console.warn('[groupsService] Group class_id mismatch:', {
        groupClassId: groupRow.class_id,
        requestedClassId: classId,
      })
      setCached(cacheKey, null, DEFAULT_TTL_MS)
      return null
    }

    // 4. Fetch all members of this group with full user profiles
    const { data: allMembers, error: allMemErr } = await supabase
      .from('group_members')
      .select(`
        id,
        group_id,
        class_id,
        student_id,
        joined_at,
        users:student_id (id, name, email, avatar, student_id, role)
      `)
      .eq('group_id', groupRow.id)

    if (allMemErr) {
      console.warn('[groupsService] getStudentGroupInCourse allMembers warning:', allMemErr)
    }

    // 5. Fetch leader profile (check members first before extra roundtrip)
    let leaderUser = null
    const matchedMemberLeader = (allMembers || []).find((m) => m.student_id === groupRow.leader_id && m.users)
    if (matchedMemberLeader) {
      leaderUser = matchedMemberLeader.users
    } else if (groupRow.leader_id) {
      const { data: leaderData, error: leaderErr } = await supabase
        .from('users')
        .select('id, name, email, avatar, student_id, role')
        .eq('id', groupRow.leader_id)
        .maybeSingle()
      if (!leaderErr && leaderData) {
        leaderUser = leaderData
      }
    }

    const formattedMembers = (allMembers || []).map((m) => {
      const u = m.users || {}
      return {
        id: m.id,
        group_id: m.group_id,
        class_id: m.class_id,
        student_id: m.student_id,
        joined_at: m.joined_at,
        user: {
          id: u.id || m.student_id,
          name: u.name || 'Student',
          email: u.email || '',
          avatar: u.avatar || null,
          student_id: u.student_id || m.student_id,
          role: u.role || 'student',
        },
      }
    })

    const finalGroup = {
      id: groupRow.id,
      class_id: groupRow.class_id,
      name: groupRow.name,
      leader_id: groupRow.leader_id,
      status: groupRow.status,
      created_at: groupRow.created_at,
      leader: leaderUser || { id: groupRow.leader_id, name: 'Group Leader' },
      members: formattedMembers,
      currentUserMembership: memberRow,
    }

    setCached(cacheKey, finalGroup, DEFAULT_TTL_MS)
    return finalGroup
  },

  /**
   * Fetch a single group by ID with full course, leader, and member details
   * Uses parallel queries and in-memory caching for high responsiveness
   */
  async getGroupById(groupId) {
    if (!groupId) return null

    const cacheKey = `group:${groupId}`
    const cached = getCached(cacheKey)
    if (cached) return cached

    // 1. Fetch group record and members in parallel
    const [groupRes, memRes] = await Promise.all([
      supabase
        .from('groups')
        .select(`
          id,
          class_id,
          name,
          leader_id,
          status,
          created_at,
          classes:class_id (id, name, subject, admin_id)
        `)
        .eq('id', groupId)
        .maybeSingle(),
      supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          student_id,
          joined_at,
          users:student_id (id, name, email, avatar, student_id, role)
        `)
        .eq('group_id', groupId),
    ])

    const { data: groupRow, error: grpErr } = groupRes
    const { data: allMembers, error: memErr } = memRes

    if (grpErr) {
      console.error('[groupsService] getGroupById error:', grpErr)
      throw new Error(grpErr.message || 'Failed to fetch group details.')
    }

    if (!groupRow) return null

    if (memErr) {
      console.warn('[groupsService] getGroupById members warning:', memErr)
    }

    // 2. Resolve leader profile (first from members, else fallback query)
    let leaderProfile = null
    const leaderInMembers = (allMembers || []).find((m) => m.student_id === groupRow.leader_id && m.users)
    if (leaderInMembers) {
      leaderProfile = leaderInMembers.users
    } else if (groupRow.leader_id) {
      const { data: leaderUser } = await supabase
        .from('users')
        .select('id, name, email, avatar, student_id, role')
        .eq('id', groupRow.leader_id)
        .maybeSingle()
      leaderProfile = leaderUser
    }

    const formattedMembers = (allMembers || []).map((m) => {
      const u = m.users || {}
      return {
        id: m.id,
        student_id: m.student_id,
        joined_at: m.joined_at,
        user: {
          id: u.id || m.student_id,
          name: u.name || 'Student',
          email: u.email || '',
          avatar: u.avatar || null,
          student_id: u.student_id || m.student_id,
          role: u.role || 'student',
        },
      }
    })

    const result = {
      ...groupRow,
      className: groupRow.classes?.name || 'Course',
      classSubject: groupRow.classes?.subject || '',
      classAdminId: groupRow.classes?.admin_id || null,
      leader: leaderProfile || { id: groupRow.leader_id, name: 'Group Leader' },
      members: formattedMembers,
    }

    setCached(cacheKey, result, DEFAULT_TTL_MS)
    return result
  },

  /**
   * Create a new course group (creator becomes leader & first member)
   */
  async createCourseGroup(classId, name) {
    const cleanName = (name || '').trim()
    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      throw new Error('Group name must be between 2 and 80 characters.')
    }

    const { data, error } = await supabase.rpc('create_course_group', {
      p_class_id: classId,
      p_name: cleanName,
    })

    if (error) {
      throw new Error(error.message || 'Failed to create group via database.')
    }

    if (data && !data.success) {
      throw new Error(data.error || 'Failed to create group.')
    }

    invalidateGroupCache({ classId })
    return data.group
  },

  /**
   * Join an existing course group
   */
  async joinCourseGroup(groupId, studentId = null) {
    if (!groupId) throw new Error('Target group ID is required.')

    const { data, error } = await supabase.rpc('join_course_group', {
      p_group_id: groupId,
    })

    if (error) {
      throw new Error(error.message || 'Failed to join group via database.')
    }

    if (data && !data.success) {
      throw new Error(data.error || 'Failed to join group.')
    }

    invalidateGroupCache({ groupId })
    return data
  },

  /**
   * Leave a course group (leaders cannot leave without transferring leadership)
   */
  async leaveCourseGroup(groupId, studentId = null) {
    if (!groupId) throw new Error('Group ID is required.')

    const { data, error } = await supabase.rpc('leave_course_group', {
      p_group_id: groupId,
    })

    if (error) {
      throw new Error(error.message || 'Failed to leave group.')
    }

    if (data && !data.success) {
      throw new Error(data.error || 'Failed to leave group.')
    }

    invalidateGroupCache({ groupId })
    return data
  },

  /**
   * Transfer leadership of a group to an existing member
   */
  async transferGroupLeadership(groupId, newLeaderId) {
    if (!groupId || !newLeaderId) throw new Error('Group ID and target leader ID are required.')

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

    invalidateGroupCache({ groupId })
    return data
  },

  /**
   * Disband or archive a course group
   */
  async disbandCourseGroup(groupId) {
    if (!groupId) throw new Error('Group ID is required.')

    const { data, error } = await supabase.rpc('disband_course_group', {
      p_group_id: groupId,
    })

    if (error) {
      throw new Error(error.message || 'Failed to disband group.')
    }

    if (data && !data.success) {
      throw new Error(data.error || 'Failed to disband group.')
    }

    invalidateGroupCache({ groupId })
    return data
  },

  /**
   * Leader acknowledges a group assignment submission
   */
  async acknowledgeGroupAssignment(assignmentId, groupId, link = '', comment = '') {
    if (!assignmentId || !groupId) {
      throw new Error('Assignment ID and Group ID are required.')
    }

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

    invalidateGroupCache({ groupId })
    return data
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
        console.error('[groupsService] getGroupSubmission error:', error.message)
        return null
      }

      return data || null
    } catch (err) {
      console.error('[groupsService] getGroupSubmission exception:', err)
      return null
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
        console.error('[groupsService] getAllGroupSubmissionsForAssignment error:', error.message)
        return []
      }

      return data || []
    } catch (err) {
      console.error('[groupsService] getAllGroupSubmissionsForAssignment exception:', err)
      return []
    }
  },

  /**
   * Fetch assignment history and acknowledgement status for a specific group.
   * Strictly filters:
   * 1. Only assignments belonging to this specific class.
   * 2. Only assignments designated with submission_type = 'group'.
   * 3. Respects selective allocation (assignment_students): if assign_to_all = false,
   *    every group member must be assigned. If not allocated, the assignment is excluded.
   * 4. Excludes other groups' submissions; displays only this group's acknowledgement status.
   */
  async getGroupAssignmentHistory(classId, groupId) {
    if (!classId || !groupId) return []

    const cacheKey = `groupAssignments:${classId}:${groupId}`
    const cached = getCached(cacheKey)
    if (cached) return cached

    try {
      // 1. Fetch group members for this group to check allocation eligibility
      const { data: memberRows, error: mErr } = await supabase
        .from('group_members')
        .select('student_id')
        .eq('group_id', groupId)

      if (mErr) throw mErr
      const memberStudentIds = (memberRows || []).map((m) => m.student_id).filter(Boolean)

      // 2. Query assignments for this specific class with submission_type = 'group'
      const { data: assignments, error: aErr } = await supabase
        .from('assignments')
        .select('id, class_id, title, description, due_date, due_time, points, submission_type, assign_to_all, onedrive_link, status')
        .eq('class_id', classId)
        .eq('submission_type', 'group')
        .order('due_date', { ascending: false })

      if (aErr) throw aErr
      if (!assignments || assignments.length === 0) return []

      // 3. Check selective assignment allocation where assign_to_all is false
      const selectiveAssignments = assignments.filter((a) => !a.assign_to_all)
      const allocatedMap = new Map() // assignment_id -> Set of student_ids

      if (selectiveAssignments.length > 0) {
        const selectiveIds = selectiveAssignments.map((a) => a.id)
        const { data: astRows, error: astErr } = await supabase
          .from('assignment_students')
          .select('assignment_id, student_id')
          .in('assignment_id', selectiveIds)

        if (astErr) throw astErr

        for (const row of astRows || []) {
          if (!allocatedMap.has(row.assignment_id)) {
            allocatedMap.set(row.assignment_id, new Set())
          }
          allocatedMap.get(row.assignment_id).add(row.student_id)
        }
      }

      // Filter eligible assignments:
      // Group is eligible if assign_to_all is true, OR if every group member is in assignment_students
      const eligibleAssignments = assignments.filter((a) => {
        if (a.assign_to_all) return true
        if (memberStudentIds.length === 0) return false
        const studentSet = allocatedMap.get(a.id)
        if (!studentSet) return false
        return memberStudentIds.every((mId) => studentSet.has(mId))
      })

      if (eligibleAssignments.length === 0) return []

      const eligibleIds = eligibleAssignments.map((a) => a.id)

      // 4. Fetch group submissions belonging strictly to this group
      const { data: submissions, error: sErr } = await supabase
        .from('group_submissions')
        .select(`
          *,
          leader:acknowledged_by (id, name, email, avatar)
        `)
        .eq('group_id', groupId)
        .in('assignment_id', eligibleIds)

      if (sErr) throw sErr

      const subMap = new Map((submissions || []).map((s) => [s.assignment_id, s]))

      const result = eligibleAssignments.map((a) => {
        const sub = subMap.get(a.id)
        return {
          ...a,
          submission: sub || null,
          isAcknowledged: Boolean(sub),
          acknowledgedAt: sub?.acknowledged_at || null,
          acknowledgedBy: sub?.leader?.name || null,
        }
      })

      setCached(cacheKey, result, DEFAULT_TTL_MS)
      return result
    } catch (err) {
      console.error('[groupsService] getGroupAssignmentHistory exception:', err)
      return []
    }
  },

  /**
   * Fetch private discussion messages for a specific group
   */
  async getGroupMessages(groupId) {
    if (!groupId) return []
    try {
      // 1. Fetch messages ordered by created_at ascending
      const { data: rows, error: msgErr } = await supabase
        .from('group_messages')
        .select('id, group_id, sender_id, message, created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })

      if (msgErr) {
        if (
          msgErr.code === '42P01' || 
          msgErr.message?.includes('does not exist') || 
          msgErr.message?.includes('404') || 
          msgErr.code === 'PGRST204'
        ) {
          const tableMissingErr = new Error('Database table "group_messages" does not exist yet. Migration pending.')
          tableMissingErr.code = 'TABLE_MISSING'
          throw tableMissingErr
        }
        console.error('[groupsService] getGroupMessages error:', msgErr)
        throw msgErr
      }

      if (!rows || rows.length === 0) return []

      // 2. Resolve sender user profiles using separate query to avoid foreign key ambiguity
      const senderIds = [...new Set(rows.map((r) => r.sender_id).filter(Boolean))]
      let userMap = new Map()
      if (senderIds.length > 0) {
        const { data: users, error: userErr } = await supabase
          .from('users')
          .select('id, name, email, avatar, role')
          .in('id', senderIds)

        if (!userErr && users) {
          userMap = new Map(users.map((u) => [u.id, u]))
        }
      }

      return rows.map((r) => {
        const u = userMap.get(r.sender_id) || {}
        return {
          id: r.id,
          groupId: r.group_id,
          senderId: r.sender_id,
          senderName: u.name || 'Member',
          senderRole: u.role || 'student',
          senderEmail: u.email || '',
          senderAvatar: u.avatar || null,
          text: r.message,
          createdAt: r.created_at,
        }
      })
    } catch (err) {
      console.error('[groupsService] getGroupMessages exception:', err)
      throw err
    }
  },

  /**
   * Send a private discussion message inside a group
   */
  async sendGroupMessage({ groupId, senderId, senderName, senderRole, senderAvatar = '', text }) {
    if (!groupId || !senderId || !text?.trim()) {
      throw new Error('Group ID, Sender ID, and message text are required.')
    }
    const trimmed = text.trim()

    const { data: newRow, error } = await supabase
      .from('group_messages')
      .insert({
        group_id: groupId,
        sender_id: senderId,
        message: trimmed,
      })
      .select(`
        id,
        group_id,
        sender_id,
        message,
        created_at,
        users:sender_id (id, name, email, avatar, role)
      `)
      .single()

    if (error) {
      throw new Error(error.message || 'Failed to send group message.')
    }

    const saved = {
      id: newRow.id,
      groupId: newRow.group_id,
      senderId: newRow.sender_id,
      senderName: newRow.users?.name || senderName || 'Member',
      senderRole: newRow.users?.role || senderRole || 'student',
      senderAvatar: newRow.users?.avatar || senderAvatar || null,
      text: newRow.message,
      createdAt: newRow.created_at,
    }

    // Broadcast over group-specific channel
    try {
      const topic = `group-discussion:${groupId}`
      const existingCh = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
      if (existingCh) {
        await existingCh.send({
          type: 'broadcast',
          event: 'group-message',
          payload: { groupId, message: saved, senderId },
        })
      }
    } catch (bErr) {
      console.warn('[groupsService] Group broadcast failed:', bErr)
    }

    return saved
  },

  /**
   * Professor grades a group submission
   */
  async gradeGroupSubmission(submissionId, marks, feedback = '') {
    if (!submissionId) throw new Error('Submission ID is required.')

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
  },

  /**
   * Professor creates a group and assigns selected members and a designated leader
   */
  async professorCreateGroup(classId, name, memberIds, leaderId) {
    const cleanName = (name || '').trim()
    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      throw new Error('Group name must be between 2 and 80 characters.')
    }
    if (!classId) throw new Error('Course ID is required.')
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      throw new Error('Please select at least one student for the group.')
    }
    if (!leaderId || !memberIds.includes(leaderId)) {
      throw new Error('Please designate one of the selected members as the group leader.')
    }

    const { data, error } = await supabase.rpc('professor_create_group', {
      p_class_id: classId,
      p_name: cleanName,
      p_member_ids: memberIds,
      p_leader_id: leaderId,
    })

    if (error) {
      throw new Error(error.message || 'Failed to create group as professor.')
    }

    if (data && !data.success) {
      throw new Error(data.error || 'Failed to create group.')
    }

    // Authoritatively resolve and return the newly persisted database group record
    let persistedGroup = null
    const createdGroupId = data?.group_id
    if (createdGroupId) {
      try {
        persistedGroup = await this.getGroupById(createdGroupId)
      } catch (fetchErr) {
        console.warn('[groupsService] professorCreateGroup persisted record fetch warning:', fetchErr)
      }
    }

    invalidateGroupCache({ classId })

    return {
      ...data,
      group: persistedGroup,
    }
  },

  /**
   * Group Leader (or Instructor) adds eligible enrolled students to an active group
   */
  async addGroupMembers(groupId, studentIds) {
    if (!groupId || !studentIds?.length) {
      throw new Error('Group ID and student selections are required.')
    }

    const { data, error } = await supabase.rpc('add_group_members', {
      p_group_id: groupId,
      p_student_ids: studentIds,
    })

    if (error) {
      throw new Error(error.message || 'Failed to add members.')
    }

    if (data && !data.success) {
      throw new Error(data.error || 'Failed to add members.')
    }

    invalidateGroupCache({ groupId })
    return data
  },

  /**
   * Fetch all class students with their group assignment status
   * to power member selection checkboxes
   */
  async getClassStudentsGroupStatus(classId) {
    if (!classId) return []

    const cacheKey = `classStudentsStatus:${classId}`
    const cached = getCached(cacheKey)
    if (cached) return cached

    try {
      const { data: members, error: memErr } = await supabase
        .from('class_members')
        .select(`
          id,
          student_id,
          joined_at,
          users:student_id (id, name, email, avatar, student_id, role)
        `)
        .eq('class_id', classId)

      if (memErr) {
        console.error('[groupsService] getClassStudentsGroupStatus error:', memErr)
        return []
      }

      const groups = await this.getCourseGroups(classId)
      const studentGroupMap = {}

      groups.forEach((g) => {
        if (g.status === 'active') {
          (g.members || []).forEach((m) => {
            const sid = m.student_id || m.user?.id
            if (sid) {
              studentGroupMap[sid] = {
                groupId: g.id,
                groupName: g.name,
                isLeader: g.leader_id === sid,
              }
            }
          })
        }
      })

      const result = (members || [])
        .filter((m) => m.users && m.users.role !== 'admin')
        .map((m) => {
          const u = m.users || {}
          const assigned = studentGroupMap[m.student_id]
          return {
            id: m.student_id,
            name: u.name || 'Student',
            email: u.email || '',
            avatar: u.avatar || null,
            student_id: u.student_id || m.student_id,
            isAssigned: Boolean(assigned),
            groupName: assigned?.groupName || null,
            groupId: assigned?.groupId || null,
            isLeader: Boolean(assigned?.isLeader),
          }
        })

      setCached(cacheKey, result, 30000) // 30s cache
      return result
    } catch (err) {
      console.error('[groupsService] getClassStudentsGroupStatus exception:', err)
      return []
    }
  },
}

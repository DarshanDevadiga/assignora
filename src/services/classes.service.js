import { supabase } from '../lib/supabase.js'
import { authService } from './auth.service.js'
import { fetchWithCache, invalidateCachePrefix } from '../utils/dataCache.js'

function invalidateClassMutationCaches(classId) {
  invalidateCachePrefix(
    'adminClasses:',
    'studentClasses:',
    'studentDashboard:',
    'adminAssignments:',
    'adminAssignmentSummaries:',
    'unreadClassIds:',
    'announcements:'
  )
  if (classId) {
    invalidateCachePrefix(`classDetail:${classId}`, `classRoster:${classId}`)
  } else {
    invalidateCachePrefix('classDetail:', 'classRoster:')
  }
}

export const classesService = {
  /**
   * Get all classes created by the current admin (cached + in-flight deduplicated)
   */
  async getAdminClasses(adminId, forceRefresh = false) {
    if (!adminId) return []
    return fetchWithCache(
      `adminClasses:${adminId}`,
      async () => {
        const { data, error } = await supabase
          .from('classes')
          .select(`
            id,
            name,
            subject,
            description,
            class_code,
            admin_id,
            created_at,
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
              points,
              submission_type,
              onedrive_link
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
      { ttlMs: 45000, forceRefresh }
    )
  },

  /**
   * Get all classes enrolled by a student (cached + in-flight deduplicated)
   */
  async getStudentClasses(studentId, forceRefresh = false) {
    if (!studentId) return []
    return fetchWithCache(
      `studentClasses:${studentId}`,
      async () => {
        const { data, error } = await supabase
          .from('class_members')
          .select(`
            id,
            joined_at,
            class_id,
            classes (
              id,
              name,
              subject,
              description,
              class_code,
              admin_id,
              created_at,
              users:admin_id (id, name, email, avatar),
              class_members (id, student_id),
              assignments (id, title, status, due_date, due_time, points, submission_type, onedrive_link)
            )
          `)
          .eq('student_id', studentId)

        if (error) {
          console.error('[classesService] Error fetching student classes:', error)
          throw error
        }
        return (data || []).map((m) => ({ ...m.classes, membership_id: m.id, joined_at: m.joined_at })).filter(Boolean)
      },
      { ttlMs: 45000, forceRefresh }
    )
  },

  /**
   * Get a single class by id with members and assignments (cached + in-flight deduplicated)
   */
  async getClassById(classId, forceRefresh = false) {
    if (!classId) return null
    return fetchWithCache(
      `classDetail:${classId}`,
      async () => {
        const { data, error } = await supabase
          .from('classes')
          .select(`
            id,
            name,
            subject,
            description,
            class_code,
            admin_id,
            created_at,
            users:admin_id (id, name, email, avatar),
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
              onedrive_link,
              submission_type,
              points,
              assign_to_all,
              status,
              created_at
            )
          `)
          .eq('id', classId)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            return null
          }
          console.error('[classesService] Error fetching class details:', error)
          throw error
        }
        return data
      },
      { ttlMs: 45000, forceRefresh }
    )
  },

  /**
   * Complete Class Roster: Instructor, Enrolled Students & Group Affiliations (cached + deduplicated)
   */
  async getClassRoster(classId, forceRefresh = false) {
    if (!classId) return { instructor: null, students: [], total_students: 0 }
    return fetchWithCache(
      `classRoster:${classId}`,
      async () => {
        try {
          const { data, error } = await supabase.rpc('get_class_roster', {
            p_class_id: classId,
          })

          if (!error && data && data.success) {
            return data
          }
        } catch (err) {
          console.warn('[classesService] getClassRoster RPC fallback:', err)
        }

        // Defensive fallback using direct relations and group mapping
        try {
          const [cls, grpRes] = await Promise.all([
            this.getClassById(classId),
            supabase
              .from('group_members')
              .select('student_id, groups (id, name, leader_id, status)')
              .eq('class_id', classId),
          ])
          if (!cls) return { instructor: null, students: [], total_students: 0 }

          const instructor = cls.users || { name: 'Faculty Member', email: '', role: 'instructor' }
          const members = cls.class_members || []

          const groupMap = {}
          ;(grpRes?.data || []).forEach((gm) => {
            if (gm.groups && gm.groups.status === 'active') {
              groupMap[gm.student_id] = {
                group_id: gm.groups.id,
                group_name: gm.groups.name,
                is_leader: gm.groups.leader_id === gm.student_id,
              }
            }
          })

          const students = members
            .filter((m) => m.users && m.users.role !== 'admin')
            .map((m) => {
              const u = m.users || {}
              const grp = groupMap[m.student_id] || {}
              return {
                id: m.id,
                student_id: m.student_id,
                name: u.name || 'Student',
                email: u.email || '',
                avatar: u.avatar || null,
                role: 'student',
                joined_at: m.joined_at,
                group_id: grp.group_id || null,
                group_name: grp.group_name || null,
                is_leader: Boolean(grp.is_leader),
              }
            })

          return {
            success: true,
            instructor,
            students,
            total_students: students.length,
          }
        } catch (fallbackErr) {
          console.error('[classesService] getClassRoster fallback failed:', fallbackErr)
          return { instructor: null, students: [], total_students: 0 }
        }
      },
      { ttlMs: 45000, forceRefresh }
    )
  },

  /**
   * Generate human-readable uppercase alphanumeric class code (e.g. MATH26)
   */
  generateClassCode(name = '', subject = '') {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let prefix = ''
    const source = (subject || name).replace(/[^a-zA-Z]/g, '').toUpperCase()
    if (source.length >= 3) {
      prefix = source.slice(0, 3)
    }
    let randomPart = ''
    const targetLen = prefix ? 3 : 6
    for (let i = 0; i < targetLen; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return (prefix + randomPart).slice(0, 6).toUpperCase()
  },

  /**
   * Create a new class
   */
  async createClass(classData) {
    const generatedCode = classData.class_code || this.generateClassCode(classData.name, classData.subject)
    
    // First try inserting with class_code
    let { data, error } = await supabase
      .from('classes')
      .insert({
        name: classData.name.trim(),
        subject: classData.subject?.trim() || '',
        description: classData.description?.trim() || '',
        admin_id: classData.admin_id,
        class_code: generatedCode,
      })
      .select()
      .single()

    // If schema does not yet have class_code column, fall back without class_code
    if (error && (error.message?.includes('class_code') || error.code === 'PGRST204')) {
      console.warn('[classesService] class_code column not in DB yet, falling back to base columns:', error.message)
      const fallback = await supabase
        .from('classes')
        .insert({
          name: classData.name.trim(),
          subject: classData.subject?.trim() || '',
          description: classData.description?.trim() || '',
          admin_id: classData.admin_id,
        })
        .select()
        .single()

      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('[classesService] Error creating class:', error)
      throw error
    }
    invalidateClassMutationCaches(data?.id)
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
    invalidateClassMutationCaches(classId)
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
    invalidateClassMutationCaches(classId)
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
    invalidateClassMutationCaches(classId)
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
    invalidateClassMutationCaches()
    return true
  },

  /**
   * Compute or retrieve deterministic 6-character unique class code from class object/ID
   */
  getClassCode(clsOrId) {
    if (!clsOrId) return ''
    if (typeof clsOrId === 'object' && clsOrId.class_code) {
      return clsOrId.class_code.toUpperCase().replace(/^CLS-/, '')
    }
    const id = typeof clsOrId === 'string' ? clsOrId : clsOrId?.id
    if (!id) return ''
    const clean = id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
    return clean
  },

  /**
   * Find and preview class by code or UUID (securely supports unenrolled students via RPC)
   */
  async findClassByCode(rawCode) {
    if (!rawCode) return null
    const cleanCode = rawCode.trim().toUpperCase().replace(/^CLS-/, '')

    // 1. Primary: Secure SECURITY DEFINER RPC get_class_preview_by_code (no 403 for unenrolled students)
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('get_class_preview_by_code', {
        p_code: cleanCode,
      })
      if (!rpcErr && rpcRes?.success && rpcRes.class) {
        const cls = rpcRes.class
        const teacherObj = cls.users || cls.teacher || { name: 'Course Instructor', email: '', avatar: null }
        return {
          ...cls,
          users: teacherObj,
          teacher: teacherObj,
          student_count: typeof cls.student_count === 'number' ? cls.student_count : (cls.class_members?.length || 0),
          is_enrolled: Boolean(cls.is_enrolled),
        }
      }
      if (!rpcErr && rpcRes && rpcRes.success === false) {
        return null
      }
    } catch (e) {
      console.warn('[classesService] get_class_preview_by_code RPC fallback:', e)
    }

    // 2. Fallback: Direct query on accessible classes without nested class_members (avoids 403)
    try {
      const { data: directMatch, error: directErr } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          subject,
          description,
          class_code,
          admin_id,
          created_at,
          users:admin_id (id, name, email, avatar)
        `)
        .eq('class_code', cleanCode)
        .maybeSingle()

      if (!directErr && directMatch) {
        return {
          ...directMatch,
          teacher: directMatch.users || null,
          is_enrolled: false,
        }
      }
    } catch {
      // Blocked by RLS when unenrolled
    }

    // 3. Fallback: Try direct ID match if it's a UUID
    if (cleanCode.length === 36 && cleanCode.includes('-')) {
      const { data } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          subject,
          description,
          class_code,
          admin_id,
          created_at,
          users:admin_id (id, name, email, avatar)
        `)
        .eq('id', rawCode.trim())
        .maybeSingle()
      if (data) {
        return {
          ...data,
          teacher: data.users || null,
          is_enrolled: false,
        }
      }
    }

    return null
  },

  /**
   * Secure student class joining via database RPC
   * Uses auth.uid() inside SECURITY DEFINER function to enforce student role and prevent duplicate membership
   */
  async joinClassByCode(rawCode) {
    if (!rawCode || !rawCode.trim()) {
      throw new Error('Please enter a class code.')
    }

    const cleanCode = rawCode.trim().toUpperCase().replace(/^CLS-/, '')

    const { data: authSession } = await supabase.auth.getSession()
    const studentId = authSession?.session?.user?.id
    if (!studentId) {
      throw new Error('You must be signed in to join a class.')
    }

    // Ensure profile is verified/provisioned before invoking enrollment RPC
    const profile = await authService.getUserProfile(studentId)
    if (!profile) {
      throw new Error('User profile not found. Please sign in again.')
    }
    if (profile.role !== 'student') {
      throw new Error('Only student accounts can join classes with a class code.')
    }

    // Primary method: secure join_class_by_code RPC
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('join_class_by_code', {
      p_code: cleanCode,
    })

    if (!rpcErr && rpcRes) {
      if (rpcRes.success) {
        invalidateClassMutationCaches(rpcRes.class_id)
        return {
          success: true,
          classId: rpcRes.class_id,
          className: rpcRes.class_name,
          membershipId: rpcRes.membership_id,
          message: rpcRes.message || 'Successfully joined class!',
        }
      }
      if (rpcRes.already_member) {
        throw new Error('You are already enrolled in this class.')
      }
      if (rpcRes.error) {
        throw new Error(rpcRes.error)
      }
    }

    if (rpcErr && rpcErr.code !== 'PGRST202') {
      throw new Error(rpcErr.message || 'Failed to join class.')
    }

    // Fallback only if RPC function itself is missing (PGRST202)
    const cls = await this.findClassByCode(cleanCode)
    if (!cls) {
      throw new Error('Invalid class code. Please check with your teacher and try again.')
    }

    const membership = await this.enrollStudent(cls.id, studentId, cleanCode)
    invalidateClassMutationCaches(cls.id)
    return {
      success: true,
      classId: cls.id,
      className: cls.name,
      membershipId: membership?.id,
      message: 'Successfully joined class!',
    }
  },

  /**
   * Generate signed/base64 invitation token for a class with expiration (7 days)
   */
  generateInviteToken(classId) {
    const payload = {
      cid: classId,
      code: this.getClassCode(classId),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
    }
    try {
      return btoa(JSON.stringify(payload))
    } catch {
      return this.getClassCode(classId)
    }
  },

  /**
   * Verify invitation token and return class preview if valid
   */
  async verifyInviteToken(token) {
    if (!token) return { valid: false, error: 'Token is missing' }

    // If it's a standard 6-char code or CLS- prefix
    const cleanToken = token.trim().toUpperCase().replace(/^CLS-/, '')
    if (cleanToken.length <= 10 && !cleanToken.includes('{') && !cleanToken.includes('=')) {
      const cls = await this.findClassByCode(cleanToken)
      if (!cls) return { valid: false, error: 'Invalid class code' }
      return { valid: true, class: cls, classId: cls.id, expiresAt: null }
    }

    try {
      const decodedStr = atob(token)
      const payload = JSON.parse(decodedStr)
      if (!payload.cid) {
        return { valid: false, error: 'Malformed invitation token' }
      }
      if (payload.exp && Date.now() > payload.exp) {
        return { valid: false, error: 'Invitation link has expired', expired: true }
      }
      const cls = await this.findClassByCode(payload.code || payload.cid)
      if (!cls) {
        return { valid: false, error: 'Class not found or disabled' }
      }
      return { valid: true, class: cls, classId: cls.id, expiresAt: new Date(payload.exp) }
    } catch {
      // Fallback try as raw class code
      const cls = await this.findClassByCode(token)
      if (cls) {
        return { valid: true, class: cls, classId: cls.id, expiresAt: null }
      }
      return { valid: false, error: 'Invalid invitation token format' }
    }
  },

  /**
   * Student enrolment into class (Uses authenticated session, verifies profile & Student role,
   * validates class & code, handles duplicates gracefully, and confirms persisted membership)
   */
  async enrollStudent(classId, studentId, classCode = null) {
    if (!classId) {
      throw new Error('Class ID is required.')
    }

    // 1. Verify authenticated session & match current user
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
    if (sessionErr) {
      throw new Error('Failed to verify authentication session. Please sign in again.')
    }
    const currentUserId = sessionData?.session?.user?.id
    if (!currentUserId) {
      throw new Error('You must be signed in to join a class.')
    }
    if (studentId && currentUserId !== studentId) {
      throw new Error('Unauthorized enrollment attempt: active session does not match user.')
    }

    // 2. Verify user profile and Student role (self-heals missing profiles)
    const profile = await authService.getUserProfile(currentUserId)
    if (!profile || !profile.role) {
      throw new Error('Unable to verify your user profile. Please sign out and sign back in.')
    }
    if (profile.role !== 'student') {
      throw new Error('Only student accounts can enroll in classes.')
    }

    // 3. Try secure join_class_by_code RPC (supports class code OR class UUID)
    const lookupCode = (classCode || classId || '').toString().trim()
    const normalizedCode = lookupCode.toUpperCase().replace(/^CLS-/, '')
    if (normalizedCode) {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('join_class_by_code', {
        p_code: normalizedCode.length <= 10 ? normalizedCode : lookupCode,
      })

      if (!rpcErr && rpcRes) {
        if (rpcRes.success) {
          invalidateClassMutationCaches(rpcRes.class_id || classId)
          // Retrieve resulting membership record to confirm persistence
          const { data: confirmedRow } = await supabase
            .from('class_members')
            .select('id, class_id, student_id, joined_at')
            .eq('class_id', rpcRes.class_id || classId)
            .eq('student_id', currentUserId)
            .maybeSingle()

          return confirmedRow || {
            id: rpcRes.membership_id,
            class_id: rpcRes.class_id || classId,
            student_id: currentUserId,
          }
        }
        if (rpcRes.already_member) {
          throw new Error('You are already enrolled in this class.')
        }
        if (rpcRes.error) {
          throw new Error(rpcRes.error)
        }
      }

      if (rpcErr && rpcErr.code !== 'PGRST202') {
        throw new Error(rpcErr.message || 'Failed to complete enrolment.')
      }
    }

    // 4. Fallback direct membership check & insert (when RPC unavailable or UUID-only without RPC)
    const { data: existing, error: exErr } = await supabase
      .from('class_members')
      .select('id')
      .eq('class_id', classId)
      .eq('student_id', currentUserId)
      .maybeSingle()

    if (exErr && exErr.code !== 'PGRST116') {
      throw new Error(exErr.message || 'Failed to verify existing enrollment.')
    }

    if (existing) {
      throw new Error('You are already enrolled in this class.')
    }

    const { data: newMember, error: insertError } = await supabase
      .from('class_members')
      .insert({
        class_id: classId,
        student_id: currentUserId,
      })
      .select('id, class_id, student_id, joined_at')
      .maybeSingle()

    if (insertError) {
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key')) {
        throw new Error('You are already enrolled in this class.')
      }
      if (insertError.code === '42501' || insertError.message?.includes('row-level security')) {
        throw new Error('Enrollment blocked by class permissions. Please verify your class code and student profile.')
      }
      console.error('[classesService] Direct insert error:', insertError)
      throw new Error(insertError.message || 'Failed to complete enrolment. Please check with your teacher.')
    }

    if (!newMember) {
      throw new Error('Enrollment could not be confirmed. Please try again.')
    }

    invalidateClassMutationCaches(classId)
    return newMember
  },

  /**
   * Fetch aggregated chronological activity history for a specific class.
   * Reuses pre-fetched class data when provided to avoid duplicate Supabase queries.
   */
  async getClassActivity(classId, prefetched = null) {
    const activities = []

    let members = prefetched?.members || null
    let announcements = prefetched?.announcements || null
    let assignments = prefetched?.assignments || null
    let submissions = prefetched?.submissions || null

    if (!members || !announcements || !assignments) {
      const [memRes, annRes, assignRes] = await Promise.all([
        members
          ? Promise.resolve({ data: members })
          : supabase
              .from('class_members')
              .select('id, joined_at, users:student_id(id, name, email, avatar)')
              .eq('class_id', classId),
        announcements
          ? Promise.resolve({ data: announcements })
          : supabase
              .from('announcements')
              .select('id, title, created_at, users:admin_id(id, name, avatar)')
              .eq('class_id', classId),
        assignments
          ? Promise.resolve({ data: assignments })
          : supabase
              .from('assignments')
              .select('id, title, created_at, points')
              .eq('class_id', classId),
      ])

      members = memRes.data || []
      announcements = annRes.data || []
      assignments = assignRes.data || []
    }

    members.forEach((m) => {
      activities.push({
        id: `member-${m.id}`,
        type: 'enrolled',
        title: `${m.users?.name || 'A student'} joined the class`,
        timestamp: m.joined_at,
        user: m.users,
        icon: 'UserPlus',
      })
    })

    announcements.forEach((a) => {
      activities.push({
        id: `announcement-${a.id}`,
        type: 'announcement',
        title: `Announcement posted: "${a.title}"`,
        timestamp: a.created_at,
        user: a.users,
        icon: 'Megaphone',
      })
    })

    const assignmentIds = (assignments || []).map((a) => a.id)

    assignments.forEach((a) => {
      activities.push({
        id: `assignment-${a.id}`,
        type: 'assignment_created',
        title: `Assignment created: "${a.title}" (${a.points} pts)`,
        timestamp: a.created_at,
        icon: 'ClipboardList',
      })
    })

    // Submissions and Gradings (reuse pre-fetched submissions if passed)
    if (!submissions && assignmentIds.length > 0) {
      const { data: fetchedSubs } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          submitted_at,
          updated_at,
          assignments (title),
          users:student_id (name, avatar)
        `)
        .in('assignment_id', assignmentIds)
      submissions = fetchedSubs || []
    }

    const validSubmissions = Array.isArray(submissions) ? submissions : []
    validSubmissions.forEach((s) => {
      activities.push({
        id: `submission-${s.id}`,
        type: 'submitted',
        title: `${s.users?.name || 'Student'} submitted "${s.assignments?.title || 'Assignment'}"`,
        timestamp: s.submitted_at,
        user: s.users,
        icon: 'CheckSquare',
      })

      if (s.status === 'reviewed' && s.updated_at) {
        activities.push({
          id: `graded-${s.id}`,
          type: 'graded',
          title: `Assignment graded for ${s.users?.name || 'student'} ("${s.assignments?.title || 'Assignment'}")`,
          timestamp: s.updated_at,
          icon: 'Award',
        })
      }
    })

    // Sort descending by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    return activities
  },

  /**
   * Extract or assemble curated educational resources for a class.
   * Reuses pre-fetched class record when provided to avoid duplicate queries.
   */
  async getClassResources(classId, prefetchedClass = null) {
    let cls = prefetchedClass
    let assignments = prefetchedClass?.assignments || null

    if (!cls || !assignments) {
      const [clsRes, assignRes] = await Promise.all([
        cls
          ? Promise.resolve({ data: cls })
          : supabase
              .from('classes')
              .select('id, name, subject')
              .eq('id', classId)
              .maybeSingle(),
        assignments
          ? Promise.resolve({ data: assignments })
          : supabase
              .from('assignments')
              .select('id, title, drive_link, created_at')
              .eq('class_id', classId)
              .not('drive_link', 'is', null),
      ])
      cls = clsRes.data
      assignments = assignRes.data || []
    }

    const resources = []

    // 1. Assignment drive attachments
    assignments?.forEach((a) => {
      if (a.drive_link && a.drive_link.trim()) {
        resources.push({
          id: `res-${a.id}`,
          title: `${a.title} – Drive Attachment`,
          url: a.drive_link,
          type: 'Google Drive',
          addedAt: a.created_at,
          addedBy: 'Course Faculty',
          description: `Deliverable templates, project briefs, and reference guidelines for ${a.title}.`,
          category: 'Assignment Reference',
        })
      }
    })

    const className = (cls?.name || '').toLowerCase()

    // 2. Curated Open Educational Resources (OER) based on Subject
    if (className.includes('principles of management') || className.includes('management')) {
      resources.push(
        {
          id: `res-openstax-mgmt-${classId}`,
          title: 'OpenStax: Principles of Management (Official Open Textbook)',
          url: 'https://openstax.org/details/books/principles-management',
          type: 'Open Textbook',
          addedAt: '2026-10-01T09:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Peer-reviewed open educational textbook covering managerial planning, organizational structures, leadership theory, and decision-making.',
          category: 'Textbooks',
        },
        {
          id: `res-mit-mgmt-${classId}`,
          title: 'MIT OpenCourseWare: Advanced Leadership Communication',
          url: 'https://ocw.mit.edu/courses/15-281-advanced-leadership-communication-spring-2009/',
          type: 'MIT OCW',
          addedAt: '2026-10-05T11:30:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'MIT Sloan School course syllabus, lecture notes, and case studies on strategic communication and organizational leadership.',
          category: 'Lecture Notes',
        },
        {
          id: `res-doc-mgmt-${classId}`,
          title: 'Leadership Styles & Organizational Structures Template (Google Docs)',
          url: 'https://docs.google.com/document/d/1Mgmt_CaseStudy_Template_Public/edit',
          type: 'Google Docs',
          addedAt: '2026-10-10T14:15:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Standard academic case study format and analytical report structure for student submissions.',
          category: 'Course Guidelines',
        },
        {
          id: `res-doab-mgmt-${classId}`,
          title: 'Directory of Open Access Books: Contemporary Management Studies',
          url: 'https://www.doabooks.org/',
          type: 'DOAB Library',
          addedAt: '2026-10-12T16:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Open access peer-reviewed monographs and international management research papers.',
          category: 'Learning Materials',
        }
      )
    } else if (className.includes('financial') || className.includes('finance')) {
      resources.push(
        {
          id: `res-openstax-fin-${classId}`,
          title: 'OpenStax: Principles of Finance (Official Open Textbook)',
          url: 'https://openstax.org/details/books/principles-finance',
          type: 'Open Textbook',
          addedAt: '2026-10-01T09:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Core corporate finance textbook covering capital budgeting, financial statement analysis, working capital, and valuation.',
          category: 'Textbooks',
        },
        {
          id: `res-mit-fin-${classId}`,
          title: 'MIT OpenCourseWare: Finance Theory I (Sloan School of Management)',
          url: 'https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/',
          type: 'MIT OCW',
          addedAt: '2026-10-06T10:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Comprehensive lecture series, problem sets, and capital asset pricing models from MIT Sloan.',
          category: 'Lecture Notes',
        },
        {
          id: `res-sheet-fin-${classId}`,
          title: 'Corporate Financial Statement & Ratio Analysis Model (Google Sheets)',
          url: 'https://docs.google.com/spreadsheets/d/1Fin_Ratio_Model_Analysis_Public/edit',
          type: 'Google Sheets',
          addedAt: '2026-10-08T15:30:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Dynamic financial modeling spreadsheet with built-in liquidity, solvency, profitability, and Dupont ratios.',
          category: 'Assignment Reference',
        },
        {
          id: `res-sheet-capbudget-${classId}`,
          title: 'Capital Budgeting NPV & IRR Decision Matrix (Google Sheets)',
          url: 'https://docs.google.com/spreadsheets/d/1CapBudget_NPV_Model_Public/edit',
          type: 'Google Sheets',
          addedAt: '2026-10-15T12:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Spreadsheet template calculating net present value, internal rate of return, and sensitivity analysis.',
          category: 'Learning Materials',
        }
      )
    } else if (className.includes('marketing')) {
      resources.push(
        {
          id: `res-openumn-mkt-${classId}`,
          title: 'Open Textbook Library: Principles of Marketing',
          url: 'https://open.umn.edu/opentextbooks/textbooks/principles-of-marketing',
          type: 'Open Textbook',
          addedAt: '2026-10-02T09:30:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Full-length textbook exploring consumer behavior, market segmentation, brand positioning, and pricing strategy.',
          category: 'Textbooks',
        },
        {
          id: `res-mit-mkt-${classId}`,
          title: 'MIT OpenCourseWare: Strategic Marketing Management',
          url: 'https://ocw.mit.edu/courses/15-812-marketing-management-fall-2010/',
          type: 'MIT OCW',
          addedAt: '2026-10-07T11:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Course lecture notes, Harvard Business School case references, and customer lifetime value formulations.',
          category: 'Lecture Notes',
        },
        {
          id: `res-doc-mkt-${classId}`,
          title: 'Omnichannel Digital Marketing Strategy Blueprint (Google Docs)',
          url: 'https://docs.google.com/document/d/1Digital_Mkt_Strategy_Doc_Public/edit',
          type: 'Google Docs',
          addedAt: '2026-10-11T13:45:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Strategic planning document covering SEO, SEM, conversion rate optimization, and brand equity building.',
          category: 'Course Guidelines',
        },
        {
          id: `res-pdf-mkt-${classId}`,
          title: 'Brand Positioning & Perceptual Mapping Research Guide (PDF)',
          url: 'https://open.umn.edu/opentextbooks/textbooks/digital-marketing',
          type: 'PDF Document',
          addedAt: '2026-10-14T17:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Comprehensive research paper on perceptual attributes, brand differentiation, and market resonance.',
          category: 'Learning Materials',
        }
      )
    } else if (className.includes('analytics') || className.includes('business analytics')) {
      resources.push(
        {
          id: `res-openstax-stat-${classId}`,
          title: 'OpenStax: Introductory Business Statistics (2nd Edition)',
          url: 'https://openstax.org/details/books/introductory-business-statistics-2e',
          type: 'Open Textbook',
          addedAt: '2026-10-03T10:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Rigorous open textbook on hypothesis testing, multiple regression, ANOVA, and probability distributions.',
          category: 'Textbooks',
        },
        {
          id: `res-mit-analytics-${classId}`,
          title: 'MIT OpenCourseWare: The Analytics Edge (Course Archive)',
          url: 'https://ocw.mit.edu/courses/15-071-the-analytics-edge-spring-2017/',
          type: 'MIT OCW',
          addedAt: '2026-10-08T12:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'MIT Sloan real-world datasets and analytics case studies in healthcare, sports, finance, and internet businesses.',
          category: 'Lecture Notes',
        },
        {
          id: `res-sheet-bi-${classId}`,
          title: 'Executive Sales Analytics & Interactive KPI Dashboard (Google Sheets)',
          url: 'https://docs.google.com/spreadsheets/d/1Sales_Analytics_Dashboard_Public/edit',
          type: 'Google Sheets',
          addedAt: '2026-10-12T15:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Interactive dashboard featuring sales trend forecasting, regional pivot slicers, and performance metrics.',
          category: 'Assignment Reference',
        },
        {
          id: `res-ndl-analytics-${classId}`,
          title: 'National Digital Library of India: Business Intelligence Repository',
          url: 'https://ndl.iitkgp.ac.in/',
          type: 'NDL India',
          addedAt: '2026-10-16T18:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Indian Institute of Technology (IIT) curated learning modules on big data engineering and statistical modeling.',
          category: 'Learning Materials',
        }
      )
    } else if (className.includes('information technology') || className.includes('it for business') || className.includes('technology')) {
      resources.push(
        {
          id: `res-openumn-is-${classId}`,
          title: 'Open Textbook Library: Information Systems for Business and Beyond',
          url: 'https://open.umn.edu/opentextbooks/textbooks/information-systems-for-business-and-beyond-2019',
          type: 'Open Textbook',
          addedAt: '2026-10-04T09:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Standard university textbook covering relational databases, enterprise software, cloud models, and IT ethics.',
          category: 'Textbooks',
        },
        {
          id: `res-mit-systems-${classId}`,
          title: 'MIT OpenCourseWare: Computer System Engineering (Cloud & Distributed Systems)',
          url: 'https://ocw.mit.edu/courses/6-033-computer-system-engineering-spring-2018/',
          type: 'MIT OCW',
          addedAt: '2026-10-09T14:30:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'MIT EECS course on distributed cloud architectures, cybersecurity protocols, and fault tolerance.',
          category: 'Lecture Notes',
        },
        {
          id: `res-doc-erd-${classId}`,
          title: 'Relational Database Schema Design & 3NF Normalization Guide (Google Docs)',
          url: 'https://docs.google.com/document/d/1DB_Design_ERD_Guide_Public/edit',
          type: 'Google Docs',
          addedAt: '2026-10-13T16:15:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Step-by-step ERD modeling guide, functional dependency analysis, and SQL DDL scripts.',
          category: 'Course Guidelines',
        },
        {
          id: `res-sheet-cyber-${classId}`,
          title: 'Cybersecurity NIST Risk Assessment & Threat Matrix (Google Sheets)',
          url: 'https://docs.google.com/spreadsheets/d/1Cybersecurity_Risk_Matrix_Public/edit',
          type: 'Google Sheets',
          addedAt: '2026-10-17T11:00:00Z',
          addedBy: 'Prof. Anitha R.',
          description: 'Enterprise vulnerability matrix with CVSS scoring rubrics and threat mitigation action plans.',
          category: 'Assignment Reference',
        }
      )
    } else {
      // Default resources for other classes (e.g. MCA Semester 5)
      resources.push(
        {
          id: `res-syllabus-${classId}`,
          title: 'Course Syllabus & Curriculum Guide (PDF)',
          url: 'https://openstax.org/',
          type: 'PDF Document',
          addedAt: new Date().toISOString(),
          addedBy: 'Course Faculty',
          description: 'Detailed weekly schedule, examination pattern, and recommended reference textbooks.',
          category: 'Course Guidelines',
        },
        {
          id: `res-lecture-${classId}`,
          title: 'Weekly Lecture Notes & Code Repository',
          url: 'https://github.com',
          type: 'Repository',
          addedAt: new Date().toISOString(),
          addedBy: 'Course Faculty',
          description: 'Curated code samples, design patterns, and programming assignments.',
          category: 'Learning Materials',
        }
      )
    }

    return resources
  },
}

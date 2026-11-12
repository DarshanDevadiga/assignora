import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Search,
  ExternalLink,
  Eye,
  Filter,
  Check,
  AlertCircle,
  FileText,
  Award,
  ChevronDown,
  Layers,
  Cloud,
  Crown,
  Edit2,
  Trash2,
  Archive,
  RotateCcw
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { assignmentsService } from '../../services/assignments.service'
import { submissionsService } from '../../services/submissions.service'
import { groupsService } from '../../services/groups.service'
import { notificationsService } from '../../services/notifications.service'
import { messagesService } from '../../services/messages.service'
import {
  calculateCompletionRate,
  isOverdue,
  isSubmissionLate,
  formatDisplayDate,
  calculateLetterGrade,
  exportToCSV,
  sanitizeUrl,
  resolveDeliverableUrl
} from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import ProgressBar from '../../components/common/ProgressBar'
import Modal from '../../components/common/Modal'
import ActionMenu from '../../components/common/ActionMenu'
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal'
import { Input, Textarea } from '../../components/common/Input'
import SubmittedWorkViewerModal from '../../components/submission/SubmittedWorkViewerModal'
import GroupSubmissionCard from '../../components/submission/GroupSubmissionCard'

export default function SubmissionTracking() {
  const { id: paramAssignmentId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [deleteAssignmentOpen, setDeleteAssignmentOpen] = useState(false)
  const [assignmentImpact, setAssignmentImpact] = useState(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [manageLoading, setManageLoading] = useState(false)
  const [manageError, setManageError] = useState('')

  const [assignments, setAssignments] = useState([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    paramAssignmentId || searchParams.get('id') || ''
  )
  const [currentAssignment, setCurrentAssignment] = useState(null)
  const [courseGroups, setCourseGroups] = useState([])
  const [groupSubmissions, setGroupSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtering, Search & Sort
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all, submitted, pending, late, graded
  const [sortOrder, setSortOrder] = useState('nameAsc')

  // Individual Grading Modal State
  const [inspectedStudent, setInspectedStudent] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [modalMarks, setModalMarks] = useState('')
  const [modalFeedback, setModalFeedback] = useState('')
  const [savingGrade, setSavingGrade] = useState(false)
  const [gradeError, setGradeError] = useState('')

  // Group Grading Modal State
  const [inspectedGroup, setInspectedGroup] = useState(null)
  const [isGroupDetailModalOpen, setIsGroupDetailModalOpen] = useState(false)
  const [groupModalMarks, setGroupModalMarks] = useState('')
  const [groupModalFeedback, setGroupModalFeedback] = useState('')
  const [savingGroupGrade, setSavingGroupGrade] = useState(false)
  const [groupGradeError, setGroupGradeError] = useState('')

  // Dedicated Submitted Work Viewer State (Separate from Grading Modal)
  const [isSubmittedWorkModalOpen, setIsSubmittedWorkModalOpen] = useState(false)
  const [submittedWorkData, setSubmittedWorkData] = useState(null)

  // Sync parameter assignment ID if route changes
  useEffect(() => {
    if (paramAssignmentId && paramAssignmentId !== selectedAssignmentId) {
      setSelectedAssignmentId(paramAssignmentId)
    }
  }, [paramAssignmentId])

  useEffect(() => {
    loadAssignments()
  }, [user?.id])

  async function loadAssignments() {
    if (!user?.id) return
    try {
      setLoading(true)
      const list = await assignmentsService.getAdminAssignmentSummaries(user.id)
      setAssignments(list)

      const targetId = paramAssignmentId || searchParams.get('id')
      if (targetId) {
        setSelectedAssignmentId(targetId)
      } else if (list.length > 0) {
        setSelectedAssignmentId(list[0].id)
      }
    } catch (err) {
      console.error('[SubmissionTracking] Error loading assignments:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load detailed assignment data whenever selectedAssignmentId changes
  useEffect(() => {
    if (!selectedAssignmentId) return
    loadAssignmentDetails(selectedAssignmentId)
  }, [selectedAssignmentId])

  async function loadAssignmentDetails(id) {
    try {
      const details = await assignmentsService.getAssignmentById(id)
      let grps = []
      let gSubs = []
      if (details?.class_id) {
        const [loadedGrps, loadedSubs] = await Promise.all([
          groupsService.getCourseGroups(details.class_id),
          details.submission_type === 'group'
            ? groupsService.getAllGroupSubmissionsForAssignment(id)
            : Promise.resolve([])
        ])
        grps = loadedGrps || []
        gSubs = loadedSubs || []
      }
      setCurrentAssignment(details)
      setCourseGroups(grps)
      setGroupSubmissions(gSubs)
    } catch (err) {
      console.error('[SubmissionTracking] Error loading assignment details:', err)
    }
  }

  const handleSwitchAssignment = (newId) => {
    setIsGroupDetailModalOpen(false)
    setInspectedGroup(null)
    setIsDetailModalOpen(false)
    setInspectedStudent(null)
    setIsSubmittedWorkModalOpen(false)
    setSubmittedWorkData(null)
    setSelectedAssignmentId(newId)
    navigate(`/admin/assignments/${newId}`)
  }

  // Open dedicated submitted work viewer (Separate from grading modal)
  const handleOpenSubmittedWork = (row, isGroup = true) => {
    const leaderName = isGroup ? (row.leaderName || row.leader?.name || row.sub?.leader?.name || 'Group Leader') : null
    const submitterName = isGroup
      ? (row.acknowledged_by || row.sub?.leader?.name || leaderName)
      : (row.name || row.users?.name || 'Student')

    setSubmittedWorkData({
      assignment: currentAssignment,
      group: isGroup ? { ...row, leaderName, acknowledged_by: submitterName } : null,
      student: !isGroup ? row : null,
      submission: {
        ...(row.sub || row.submission || row),
        acknowledged_by_name: submitterName,
      },
      isGroup,
    })
    setIsSubmittedWorkModalOpen(true)
  }

  // Derive all assigned students and their submission records
  const studentRows = useMemo(() => {
    if (!currentAssignment) return []

    let eligible = []
    if (currentAssignment.assign_to_all) {
      eligible =
        currentAssignment.classes?.class_members?.map((m) => m.users).filter(Boolean) || []
    } else {
      eligible =
        currentAssignment.assignment_students?.map((s) => s.users).filter(Boolean) || []
      if (eligible.length === 0 && currentAssignment.classes?.class_members) {
        eligible = currentAssignment.classes.class_members.map((m) => m.users).filter(Boolean)
      }
    }

    const pastDeadline = isOverdue(currentAssignment.due_date, currentAssignment.due_time)
    const submissionsList = currentAssignment.submissions || []
    const submissionByStudent = new Map(
      submissionsList.filter((s) => s?.student_id).map((s) => [s.student_id, s])
    )

    return eligible.map((student, idx) => {
      const sub = submissionByStudent.get(student.id)
      const parsed = sub
        ? submissionsService.parseSubmissionComment(sub.comment)
        : { text: '', grade: null, feedback: '' }

      const rawMarks =
        parsed.grade !== null && parsed.grade !== undefined
          ? parsed.grade
          : sub?.grade !== null && sub?.grade !== undefined
          ? sub.grade
          : null

      const isGraded = Boolean(
        sub && (sub.status === 'reviewed' || (rawMarks !== null && rawMarks !== undefined))
      )
      const isSubmitted = Boolean(sub && (sub.submission_link || sub.submitted_at || sub.comment))
      const isLateSubmission = Boolean(
        sub?.submitted_at &&
          isSubmissionLate(currentAssignment.due_date, currentAssignment.due_time, sub.submitted_at)
      )
      const isOverdueWithoutSub = Boolean(!isSubmitted && pastDeadline)

      let status = 'pending'
      if (isGraded) {
        status = 'graded'
      } else if (isSubmitted) {
        status = isLateSubmission ? 'late' : 'submitted'
      } else if (isOverdueWithoutSub) {
        status = 'not_submitted'
      } else {
        status = 'pending'
      }

      const letterGrade = isGraded
        ? calculateLetterGrade(rawMarks, currentAssignment.points)
        : '—'

      return {
        id: student.id,
        name: student.name || `Student ${idx + 1}`,
        email: student.email || '',
        avatar: student.avatar || '',
        student_id: student.student_id || `MCA2600${idx + 1}`,
        submission: sub || null,
        status,
        isGraded,
        isSubmitted,
        isLateSubmission,
        isOverdueWithoutSub,
        submitted_at: sub?.submitted_at || null,
        submission_link: sub?.submission_link || null,
        studentNote: parsed.text || '',
        marks: rawMarks,
        letterGrade,
        feedback: parsed.feedback || '',
      }
    })
  }, [currentAssignment])

  // Summary Metrics (memoized single-pass)
  const {
    totalEligible,
    submittedCount,
    pendingCount,
    lateCount,
    gradedCount,
    awaitingGradingCount,
    completionRate,
  } = useMemo(() => {
    let subCount = 0
    let pendCount = 0
    let ltCount = 0
    let gradCount = 0
    let awaitCount = 0

    for (const r of studentRows) {
      if (r.isSubmitted) subCount += 1
      if (!r.isSubmitted && !r.isOverdueWithoutSub) pendCount += 1
      if (r.isLateSubmission || (!r.isSubmitted && r.isOverdueWithoutSub)) ltCount += 1
      if (r.isGraded) gradCount += 1
      if (r.isSubmitted && !r.isGraded) awaitCount += 1
    }

    const total = studentRows.length
    return {
      totalEligible: total,
      submittedCount: subCount,
      pendingCount: pendCount,
      lateCount: ltCount,
      gradedCount: gradCount,
      awaitingGradingCount: awaitCount,
      completionRate: calculateCompletionRate(subCount, total),
    }
  }, [studentRows])

  const isGroupAssignment = currentAssignment?.submission_type === 'group'
  const isAssignmentOverdue = currentAssignment
    ? isOverdue(currentAssignment.due_date, currentAssignment.due_time)
    : false

  // Derive group submissions into SUBMITTED and NOT SUBMITTED categories
  const groupRows = useMemo(() => {
    if (!isGroupAssignment || !courseGroups) return { submitted: [], notSubmitted: [], eligibleGroups: [] }

    const submitted = []
    const notSubmitted = []

    // Respect selective assignment allocation
    const allocatedStudentIds = new Set(
      (currentAssignment?.assignment_students || []).map((ast) => ast.student_id).filter(Boolean)
    )

    const eligibleGroups = courseGroups.filter((group) => {
      if (currentAssignment?.assign_to_all) return true
      const mIds = (group.members || []).map((m) => m.student_id || m.user?.id).filter(Boolean)
      if (mIds.length === 0) return false
      return mIds.every((id) => allocatedStudentIds.has(id))
    })

    eligibleGroups.forEach((group) => {
      const sub = groupSubmissions.find((s) => s.group_id === group.id)
      const hasAcknowledged = Boolean(
        sub && (sub.acknowledged_at || sub.status === 'submitted' || sub.status === 'reviewed')
      )
      const hasDeliverable = Boolean(
        sub && sub.submission_link && sub.submission_link.trim() !== ''
      )
      const isGraded = Boolean(
        sub && (sub.status === 'reviewed' || (sub.marks !== null && sub.marks !== undefined))
      )
      const rawMarks = sub?.marks !== null && sub?.marks !== undefined ? sub.marks : null
      const letterGrade = isGraded
        ? calculateLetterGrade(rawMarks, currentAssignment.points)
        : '—'
      const isLate = Boolean(
        sub?.acknowledged_at &&
          isSubmissionLate(currentAssignment.due_date, currentAssignment.due_time, sub.acknowledged_at)
      )

      const memberList = group.members?.map((m) => m.user?.name || m.users?.name || m.name).filter(Boolean) || []
      const leaderName = group.leader?.name || sub?.leader?.name || 'Group Leader'
      const acknowledgedByName = sub?.leader?.name || group.leader?.name || leaderName

      if (sub) {
        sub.acknowledged_by_name = acknowledgedByName
      }

      let submissionStatus = 'pending'
      if (isGraded) {
        submissionStatus = 'graded'
      } else if (hasAcknowledged) {
        submissionStatus = isLate ? 'late' : hasDeliverable ? 'submitted' : 'acknowledged'
      } else if (isAssignmentOverdue) {
        submissionStatus = 'overdue'
      }

      const rowData = {
        id: group.id,
        name: group.name,
        leader: group.leader,
        leaderName,
        members: group.members || [],
        memberNames: memberList,
        sub,
        isSubmitted: hasAcknowledged,
        hasDeliverable,
        isGraded,
        isLate,
        acknowledged_by: acknowledgedByName,
        acknowledged_by_name: acknowledgedByName,
        acknowledged_at: sub?.acknowledged_at || null,
        submission_link: sub?.submission_link || null,
        marks: rawMarks,
        letterGrade,
        feedback: sub?.feedback || '',
        comment: sub?.comment || '',
        status: submissionStatus,
      }

      if (hasAcknowledged) {
        submitted.push(rowData)
      } else {
        notSubmitted.push(rowData)
      }
    })

    return { submitted, notSubmitted }
  }, [isGroupAssignment, courseGroups, groupSubmissions, currentAssignment, isAssignmentOverdue])

  // Summary Metrics for Group Assignment
  const acknowledgedGroupsCount = groupRows.submitted.length
  const unacknowledgedGroupsCount = groupRows.notSubmitted.length
  const totalEligibleGroups = acknowledgedGroupsCount + unacknowledgedGroupsCount
  const groupGradedCount = groupRows.submitted.filter((r) => r.isGraded).length
  const groupAwaitingCount = groupRows.submitted.filter((r) => !r.isGraded).length
  const groupCompletionRate = calculateCompletionRate(acknowledgedGroupsCount, totalEligibleGroups)

  // Filtered Group Rows based on search query
  const filteredGroupRows = useMemo(() => {
    const filterFn = (row) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        row.name.toLowerCase().includes(q) ||
        row.leaderName.toLowerCase().includes(q) ||
        row.memberNames.some((m) => m.toLowerCase().includes(q))
      )
    }

    return {
      submitted: groupRows.submitted.filter(filterFn),
      notSubmitted: groupRows.notSubmitted.filter(filterFn),
    }
  }, [groupRows, searchQuery])

  // Explicitly Open Group Grading Modal (Deliberate user action only)
  const openGroupGradingModal = (groupRow) => {
    if (!groupRow) return
    setInspectedGroup(groupRow)
    setGroupModalMarks(
      groupRow.marks !== null && groupRow.marks !== undefined && groupRow.marks !== '—'
        ? String(groupRow.marks)
        : ''
    )
    setGroupModalFeedback(groupRow.feedback || '')
    setGroupGradeError('')
    setIsGroupDetailModalOpen(true)
  }

  // Explicitly Close Group Grading Modal
  const handleCloseGroupModal = () => {
    setIsGroupDetailModalOpen(false)
    setInspectedGroup(null)
    setGroupGradeError('')
    if (searchParams.get('groupId')) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('groupId')
      setSearchParams(newParams, { replace: true })
    }
  }

  // Save / Update Group Grade in Supabase
  const handleSaveGroupGrade = async (e) => {
    e.preventDefault()
    if (!inspectedGroup?.sub?.id || !currentAssignment) return

    const numMarks = Number(groupModalMarks)
    if (isNaN(numMarks) || numMarks < 0 || numMarks > (currentAssignment.points || 100)) {
      setGroupGradeError(
        `Please enter a valid numeric score between 0 and ${currentAssignment.points || 100}.`
      )
      return
    }

    try {
      setSavingGroupGrade(true)
      setGroupGradeError('')

      await groupsService.gradeGroupSubmission(
        inspectedGroup.sub.id,
        numMarks,
        groupModalFeedback.trim()
      )

      await loadAssignmentDetails(currentAssignment.id)
      handleCloseGroupModal()
    } catch (err) {
      console.error('[SubmissionTracking] Error saving group grade:', err)
      setGroupGradeError(err.message || 'Failed to save group grade.')
    } finally {
      setSavingGroupGrade(false)
    }
  }

  // Filtered and Sorted Rows
  const filteredRows = useMemo(() => {
    return studentRows
      .filter((row) => {
        if (statusFilter === 'submitted' && !row.isSubmitted) return false
        if (statusFilter === 'pending' && (row.isSubmitted || row.isOverdueWithoutSub)) return false
        if (
          statusFilter === 'late' &&
          !(row.isLateSubmission || (!row.isSubmitted && row.isOverdueWithoutSub))
        )
          return false
        if (statusFilter === 'graded' && !row.isGraded) return false

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          return (
            row.name.toLowerCase().includes(q) ||
            row.email.toLowerCase().includes(q) ||
            row.student_id.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        if (sortOrder === 'nameAsc') return a.name.localeCompare(b.name)
        if (sortOrder === 'nameDesc') return b.name.localeCompare(a.name)
        if (sortOrder === 'submittedDesc') {
          if (!a.submitted_at && !b.submitted_at) return 0
          if (!a.submitted_at) return 1
          if (!b.submitted_at) return -1
          return new Date(b.submitted_at) - new Date(a.submitted_at)
        }
        if (sortOrder === 'scoreDesc') {
          const scoreA = a.marks ?? -1
          const scoreB = b.marks ?? -1
          return scoreB - scoreA
        }
        if (sortOrder === 'scoreAsc') {
          const scoreA = a.marks ?? 99999
          const scoreB = b.marks ?? 99999
          return scoreA - scoreB
        }
        return 0
      })
  }, [studentRows, statusFilter, searchQuery, sortOrder])

  const openDeleteCurrentAssignment = async () => {
    if (!currentAssignment?.id) return
    setDeleteAssignmentOpen(true)
    setManageError('')
    setAssignmentImpact(null)
    setImpactLoading(true)
    try {
      const impact = await assignmentsService.getAssignmentImpactSummary(currentAssignment.id)
      setAssignmentImpact(impact)
    } catch (err) {
      setManageError(err.message || 'Failed to inspect assignment submission impact.')
    } finally {
      setImpactLoading(false)
    }
  }

  const handleArchiveCurrentAssignment = async () => {
    if (!currentAssignment?.id) return
    try {
      setManageLoading(true)
      setManageError('')
      await assignmentsService.archiveAssignment(currentAssignment.id)
      setDeleteAssignmentOpen(false)
      toast.success(
        `Archived "${currentAssignment.title}". Submissions and grades remain preserved.`,
        'Assignment Archived'
      )
      await loadAssignmentDetails(currentAssignment.id)
    } catch (err) {
      const msg = err.message || 'Failed to archive assignment.'
      setManageError(msg)
      toast.error(msg, 'Archive Failed')
    } finally {
      setManageLoading(false)
    }
  }

  const handleRestoreCurrentAssignment = async () => {
    if (!currentAssignment?.id) return
    try {
      await assignmentsService.restoreAssignment(currentAssignment.id)
      toast.success(`Restored "${currentAssignment.title}" to published status.`, 'Assignment Restored')
      await loadAssignmentDetails(currentAssignment.id)
    } catch (err) {
      toast.error(err.message || 'Failed to restore assignment.')
    }
  }

  const handleConfirmDeleteCurrentAssignment = async () => {
    if (!currentAssignment?.id) return
    try {
      setManageLoading(true)
      setManageError('')
      await assignmentsService.deleteAssignment(currentAssignment.id)
      const title = currentAssignment.title
      setDeleteAssignmentOpen(false)
      toast.success(`Deleted assignment "${title}".`, 'Assignment Deleted')
      navigate(backNavigation.path)
    } catch (err) {
      const msg = err.message || 'Unable to delete assignment.'
      setManageError(msg)
      toast.error(msg, 'Delete Blocked')
    } finally {
      setManageLoading(false)
    }
  }

  // Open Teacher Grading Modal
  const openGradingModal = (row) => {
    setInspectedStudent(row)
    setModalMarks(
      row.marks !== null && row.marks !== undefined && row.marks !== '—'
        ? String(row.marks)
        : ''
    )
    setModalFeedback(row.feedback || '')
    setGradeError('')
    setIsDetailModalOpen(true)
  }

  // Save / Update Grade persistently in Supabase
  const handleSaveGrade = async (e) => {
    e.preventDefault()
    if (!inspectedStudent || !currentAssignment) return

    const numMarks = Number(modalMarks)
    if (isNaN(numMarks) || numMarks < 0 || numMarks > (currentAssignment.points || 100)) {
      setGradeError(
        `Please enter a valid numeric score between 0 and ${currentAssignment.points || 100}.`
      )
      return
    }

    try {
      setSavingGrade(true)
      setGradeError('')

      // 1. Persist to submissions table
      await submissionsService.saveGrade({
        assignmentId: currentAssignment.id,
        studentId: inspectedStudent.id,
        grade: numMarks,
        feedback: modalFeedback.trim(),
      })

      const letter = calculateLetterGrade(numMarks, currentAssignment.points)

      // 2. Insert notification record for the student
      await notificationsService.createNotification({
        userId: inspectedStudent.id,
        title: `Assignment Graded: ${currentAssignment.title}`,
        message: `Your score: ${numMarks}/${currentAssignment.points} pts (${letter}). Feedback: "${modalFeedback.trim() || 'Good work'}"`,
        type: 'submission',
        referenceId: currentAssignment.id,
      })

      // 3. Broadcast realtime update for live counter badge
      await messagesService.broadcast('notification', {
        userId: inspectedStudent.id,
        title: `Assignment Graded: ${currentAssignment.title}`,
        message: `Your score: ${numMarks}/${currentAssignment.points} pts (${letter}).`,
        type: 'submission',
        referenceId: currentAssignment.id,
        created_at: new Date().toISOString(),
      })

      // 4. Reload assignment details to refresh table and summary counters
      await loadAssignmentDetails(currentAssignment.id)
      setIsDetailModalOpen(false)
    } catch (err) {
      console.error('[SubmissionTracking] Error saving grade:', err)
      setGradeError(err.message || 'Failed to save grade.')
    } finally {
      setSavingGrade(false)
    }
  }

  // Export CSV handler
  const handleExportCSV = () => {
    if (!currentAssignment) return

    if (isGroupAssignment) {
      const allGroupData = [...groupRows.submitted, ...groupRows.notSubmitted]
      const exportData = allGroupData.map((g, i) => ({
        index: i + 1,
        group_name: g.name,
        leader: g.leaderName,
        members: g.memberNames.join(', '),
        status: g.isGraded
          ? 'GRADED'
          : g.isSubmitted
          ? g.isLate
            ? 'SUBMITTED LATE'
            : 'SUBMITTED'
          : isAssignmentOverdue
          ? 'OVERDUE'
          : 'PENDING',
        acknowledged_by: g.acknowledged_by || 'N/A',
        acknowledged_at: g.acknowledged_at ? new Date(g.acknowledged_at).toLocaleString() : 'N/A',
        submission_link: g.submission_link || 'N/A',
        marks: g.marks !== null ? `${g.marks} / ${currentAssignment.points}` : 'N/A',
        letter_grade: g.letterGrade,
        feedback: g.feedback || 'N/A',
      }))

      const headers = [
        { key: 'index', label: '#' },
        { key: 'group_name', label: 'Group Name' },
        { key: 'leader', label: 'Group Leader' },
        { key: 'members', label: 'Members' },
        { key: 'status', label: 'Status' },
        { key: 'acknowledged_by', label: 'Acknowledged By' },
        { key: 'acknowledged_at', label: 'Acknowledgement Timestamp' },
        { key: 'submission_link', label: 'Deliverable Link' },
        { key: 'marks', label: 'Marks' },
        { key: 'letter_grade', label: 'Grade' },
        { key: 'feedback', label: 'Instructor Feedback' },
      ]

      exportToCSV(
        `Group_Submissions_${currentAssignment.title.replace(/\s+/g, '_')}`,
        exportData,
        headers
      )
      return
    }

    if (studentRows.length === 0) return

    const exportData = studentRows.map((r, i) => ({
      index: i + 1,
      name: r.name,
      email: r.email,
      student_id: r.student_id,
      status: r.isGraded
        ? 'GRADED'
        : r.isSubmitted
        ? r.isLateSubmission
          ? 'SUBMITTED LATE'
          : 'SUBMITTED'
        : r.isOverdueWithoutSub
        ? 'OVERDUE'
        : 'PENDING',
      submitted_on: r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'N/A',
      submission_link: r.submission_link || 'N/A',
      marks: r.marks !== null ? `${r.marks} / ${currentAssignment.points}` : 'N/A',
      letter_grade: r.letterGrade,
      feedback: r.feedback || 'N/A',
      notes: r.studentNote || 'N/A',
    }))

    const headers = [
      { key: 'index', label: '#' },
      { key: 'name', label: 'Student Name' },
      { key: 'email', label: 'Email' },
      { key: 'student_id', label: 'Student ID' },
      { key: 'status', label: 'Status' },
      { key: 'submitted_on', label: 'Submitted On' },
      { key: 'submission_link', label: 'Deliverable Link' },
      { key: 'marks', label: 'Marks' },
      { key: 'letter_grade', label: 'Grade' },
      { key: 'feedback', label: 'Instructor Feedback' },
      { key: 'notes', label: 'Student Notes' },
    ]

    exportToCSV(
      `Submissions_${currentAssignment.title.replace(/\s+/g, '_')}`,
      exportData,
      headers
    )
  }

  // Context-aware back navigation
  const backNavigation = useMemo(() => {
    const navState = location.state || {}
    const qGroupId = searchParams.get('groupId')
    const qClassId = searchParams.get('classId')
    const effectiveClassId = navState.classId || qClassId || currentAssignment?.class_id
    const effectiveGroupId = navState.groupId || qGroupId

    // 1. Opened from a group or group tracking context
    if (navState.from === 'group' || navState.from === 'group_tracking' || qGroupId) {
      if (effectiveClassId && effectiveGroupId) {
        return {
          path: `/admin/classes/${effectiveClassId}/groups/${effectiveGroupId}?tab=assignments`,
          label: 'Back to Group',
        }
      }
      if (effectiveClassId) {
        return {
          path: `/admin/classes/${effectiveClassId}?tab=groups`,
          label: 'Back to Group Submissions',
        }
      }
    }

    // 2. Opened from a class assignments tab or direct URL with class
    if (navState.from === 'class' || qClassId || (!navState.from && currentAssignment?.class_id)) {
      if (effectiveClassId) {
        return {
          path: `/admin/classes/${effectiveClassId}?tab=assignments`,
          label: 'Back to Class Assignments',
        }
      }
    }

    // 3. Opened from global assignments
    if (navState.from === 'assignments') {
      return {
        path: '/admin/assignments',
        label: 'Back to Assignments',
      }
    }

    // 4. Safe fallback
    if (currentAssignment?.class_id) {
      return {
        path: `/admin/classes/${currentAssignment.class_id}?tab=assignments`,
        label: 'Back to Class Assignments',
      }
    }

    return {
      path: '/admin/assignments',
      label: 'Back to Assignments',
    }
  }, [location.state, searchParams, currentAssignment?.class_id])

  return (
    <div className="space-y-6">
      {/* Back button and page title */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate(backNavigation.path)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-brand-primary hover:text-brand-hover cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backNavigation.label}</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-brand-heading tracking-tight">
              Assignment Details & Submissions
            </h1>
            <p className="text-xs sm:text-sm text-brand-muted mt-1 max-w-2xl">
              Evaluate student deliverables, record scores and feedback, and monitor class completion.
            </p>
          </div>

          {/* Assignment Switcher Dropdown */}
          {assignments.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 w-full lg:w-auto">
              <label className="text-xs font-bold text-brand-heading shrink-0">
                Switch Assignment:
              </label>
              <select
                value={selectedAssignmentId}
                onChange={(e) => handleSwitchAssignment(e.target.value)}
                className="w-full sm:w-auto min-w-[220px] max-w-full sm:max-w-xs rounded-input border border-brand-line bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-brand-heading focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer shadow-2xs"
              >
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.classes?.name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {currentAssignment && (
        <>
          {/* Assignment Header Summary Banner */}
          <Card padding="p-5 sm:p-6" className="shadow-card space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-brand-line/60 pb-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-brand-light text-brand-primary flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-brand-heading truncate">
                    {currentAssignment.title}
                  </h2>
                  <div className="text-xs text-brand-muted mt-1 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-brand-heading">
                      {currentAssignment.classes?.name}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Due:{' '}
                      {currentAssignment.due_date
                        ? `${formatDisplayDate(currentAssignment.due_date)} at ${
                            currentAssignment.due_time?.substring(0, 5) || '23:59'
                          }`
                        : 'No deadline'}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-brand-primary">
                      {currentAssignment.points} Total Points
                    </span>
                    <span>•</span>
                    <Badge variant={currentAssignment.submission_type === 'group' ? 'primary' : 'neutral'} size="sm">
                      {currentAssignment.submission_type === 'group' ? 'Group Assignment' : 'Individual Assignment'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={handleExportCSV}
                >
                  Export (CSV)
                </Button>
                {currentAssignment.drive_link && (
                  <a
                    href={sanitizeUrl(currentAssignment.drive_link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary bg-brand-light hover:bg-brand-border/60 px-3 py-2 rounded-btn transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Google Drive</span>
                  </a>
                )}
                {currentAssignment.onedrive_link && (
                  <a
                    href={sanitizeUrl(currentAssignment.onedrive_link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100/60 px-3 py-2 rounded-btn transition-colors"
                  >
                    <Cloud className="w-3.5 h-3.5 text-blue-600" />
                    <span>OneDrive</span>
                  </a>
                )}
                {user?.role === 'admin' && currentAssignment.admin_id === user?.id && (
                  <ActionMenu
                    label={`Manage ${currentAssignment.title}`}
                    items={[
                      {
                        id: 'edit',
                        label: 'Edit Assignment',
                        icon: Edit2,
                        onClick: () =>
                          navigate(`/admin/assignments/${currentAssignment.id}/edit`, {
                            state: { from: 'assignments', classId: currentAssignment.class_id },
                          }),
                      },
                      currentAssignment.status === 'archived'
                        ? {
                            id: 'restore',
                            label: 'Restore Assignment',
                            icon: RotateCcw,
                            onClick: () => handleRestoreCurrentAssignment(),
                          }
                        : {
                            id: 'archive',
                            label: 'Archive Assignment',
                            icon: Archive,
                            variant: 'warning',
                            onClick: () => handleArchiveCurrentAssignment(),
                          },
                      {
                        id: 'delete',
                        label: 'Delete Assignment',
                        icon: Trash2,
                        variant: 'danger',
                        dividerBefore: true,
                        onClick: () => openDeleteCurrentAssignment(),
                      },
                    ]}
                  />
                )}
              </div>
            </div>

            {/* Summary Cards & Progress (Group vs Individual) */}
            {isGroupAssignment ? (
              <div className="space-y-4 pt-1">
                <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-brand-heading flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-brand-primary" />
                      <span>Group Assignment Progress</span>
                    </span>
                    <span className="text-brand-primary font-bold">
                      {groupCompletionRate}% ({acknowledgedGroupsCount} of {totalEligibleGroups} Groups Submitted)
                    </span>
                  </div>
                  <ProgressBar
                    value={acknowledgedGroupsCount}
                    max={totalEligibleGroups || 1}
                    size="md"
                    color="purple"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Total Eligible Groups */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-brand-line/60 flex items-center gap-3 h-full shadow-2xs">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 text-brand-primary flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-extrabold text-brand-heading leading-none">
                        {totalEligibleGroups}
                      </div>
                      <div className="text-[11px] font-medium text-brand-muted mt-1 truncate">
                        Total Groups
                      </div>
                    </div>
                  </div>

                  {/* Acknowledged Groups */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3 h-full shadow-2xs">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-extrabold text-emerald-700 leading-none">
                        {acknowledgedGroupsCount}
                      </div>
                      <div className="text-[11px] font-medium text-emerald-600 mt-1 truncate">
                        Acknowledged
                      </div>
                    </div>
                  </div>

                  {/* Unacknowledged Groups */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center gap-3 h-full shadow-2xs">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-extrabold text-amber-700 leading-none">
                        {unacknowledgedGroupsCount}
                      </div>
                      <div className="text-[11px] font-medium text-amber-600 mt-1 truncate">
                        Unacknowledged
                      </div>
                    </div>
                  </div>

                  {/* Graded Groups */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center gap-3 h-full shadow-2xs">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 text-brand-primary flex items-center justify-center shrink-0">
                      <Award className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-extrabold text-purple-700 leading-none">
                        {groupGradedCount}
                      </div>
                      <div className="text-[11px] font-medium text-purple-600 mt-1 truncate">
                        Graded Groups
                      </div>
                    </div>
                  </div>

                  {/* Awaiting Grading */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center gap-3 h-full shadow-2xs col-span-2 sm:col-span-1">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-extrabold text-indigo-700 leading-none">
                        {groupAwaitingCount}
                      </div>
                      <div className="text-[11px] font-medium text-indigo-600 mt-1 truncate">
                        Awaiting Grading
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 6 Summary Cards: Total, Submitted, Pending, Late, Graded, Awaiting Grading */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                {/* Total Enrolled */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-brand-line/60 flex items-center gap-3 h-full shadow-2xs">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 text-brand-primary flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-extrabold text-brand-heading leading-none">
                      {totalEligible}
                    </div>
                    <div className="text-[11px] font-medium text-brand-muted mt-1 truncate">
                      Enrolled
                    </div>
                  </div>
                </div>

                {/* Submitted */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-3 h-full shadow-2xs">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-extrabold text-emerald-700 leading-none">
                      {submittedCount}
                    </div>
                    <div className="text-[11px] font-medium text-emerald-600 mt-1 truncate">
                      Submitted
                    </div>
                  </div>
                </div>

                {/* Pending */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center gap-3 h-full shadow-2xs">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-extrabold text-amber-700 leading-none">
                      {pendingCount}
                    </div>
                    <div className="text-[11px] font-medium text-amber-600 mt-1 truncate">
                      Pending
                    </div>
                  </div>
                </div>

                {/* Late Submissions */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center gap-3 h-full shadow-2xs">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-extrabold text-rose-700 leading-none">
                      {lateCount}
                    </div>
                    <div className="text-[11px] font-medium text-rose-600 mt-1 truncate">
                      Late Submissions
                    </div>
                  </div>
                </div>

                {/* Graded */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center gap-3 h-full shadow-2xs">
                  <div className="w-9 h-9 rounded-lg bg-purple-100 text-brand-primary flex items-center justify-center shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-extrabold text-purple-700 leading-none">
                      {gradedCount}
                    </div>
                    <div className="text-[11px] font-medium text-purple-600 mt-1 truncate">
                      Graded
                    </div>
                  </div>
                </div>

                {/* Awaiting Grading */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center gap-3 h-full shadow-2xs">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-extrabold text-indigo-700 leading-none">
                      {awaitingGradingCount}
                    </div>
                    <div className="text-[11px] font-medium text-indigo-600 mt-1 truncate">
                      Awaiting Grading
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {isGroupAssignment ? (
            /* =========================================================================
               GROUP ASSIGNMENT DUAL LIST: SUBMITTED GROUPS & NOT SUBMITTED GROUPS
            ========================================================================= */
            <div className="space-y-6">
              {/* Group Search Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search groups by name, leader, or member..."
                    className="w-full rounded-full border border-brand-line bg-white pl-9 pr-4 py-1.5 text-xs sm:text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 shadow-xs"
                  />
                </div>
                <div className="text-xs text-brand-muted font-medium">
                  Showing <strong>{filteredGroupRows.submitted.length + filteredGroupRows.notSubmitted.length}</strong> total course groups
                </div>
              </div>

              {/* LIST 1: SUBMITTED GROUPS (MODERN CARD LAYOUT) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="text-sm sm:text-base font-bold text-brand-heading uppercase tracking-wide">
                      Submitted Groups ({filteredGroupRows.submitted.length})
                    </h3>
                  </div>
                  <Badge variant="success" size="sm">
                    Acknowledged Deliverables
                  </Badge>
                </div>

                {filteredGroupRows.submitted.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {filteredGroupRows.submitted.map((row) => (
                      <GroupSubmissionCard
                        key={row.id}
                        group={row}
                        submission={row.sub}
                        assignment={currentAssignment}
                        userRole={user?.role || 'admin'}
                        isSubmitted={true}
                        onViewWork={() => handleOpenSubmittedWork(row, true)}
                        onGrade={() => openGroupGradingModal(row)}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="p-8 text-center bg-slate-50 border border-brand-line/80 rounded-2xl">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-brand-heading mb-1">No group submissions recorded yet</h4>
                    <p className="text-xs text-brand-muted max-w-sm mx-auto">
                      When groups acknowledge and submit deliverables for this assignment, their submission cards will appear here.
                    </p>
                  </Card>
                )}
              </div>

              {/* LIST 2: NOT SUBMITTED GROUPS (MODERN CARD LAYOUT) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <h3 className="text-sm sm:text-base font-bold text-brand-heading uppercase tracking-wide">
                      Not Submitted Groups ({filteredGroupRows.notSubmitted.length})
                    </h3>
                  </div>
                  <Badge variant="warning" size="sm">
                    Pending Acknowledgement
                  </Badge>
                </div>

                {filteredGroupRows.notSubmitted.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {filteredGroupRows.notSubmitted.map((row) => (
                      <GroupSubmissionCard
                        key={row.id}
                        group={row}
                        submission={row.sub}
                        assignment={currentAssignment}
                        userRole={user?.role || 'admin'}
                        isSubmitted={false}
                        onViewWork={() => handleOpenSubmittedWork(row, true)}
                        onGrade={() => openGroupGradingModal(row)}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="p-8 text-center bg-emerald-50/50 border border-emerald-200/80 rounded-2xl">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-emerald-950 mb-1">All course groups have submitted!</h4>
                    <p className="text-xs text-emerald-800 max-w-sm mx-auto">
                      Every enrolled group in this course has completed and acknowledged their submission for this assignment.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            /* =========================================================================
               INDIVIDUAL ASSIGNMENT: STUDENT SUBMISSION TABLE & FILTERS
            ========================================================================= */
            <>
              {/* Status Tabs / Filters */}
              <div className="flex items-center gap-2 border-b border-brand-line/80 pb-2 text-xs sm:text-sm font-semibold overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-brand-primary text-white shadow-xs'
                      : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
                  }`}
                >
                  All Submissions ({totalEligible})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('submitted')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    statusFilter === 'submitted'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
                  }`}
                >
                  Submitted ({submittedCount})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    statusFilter === 'pending'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
                  }`}
                >
                  Pending ({pendingCount})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('late')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    statusFilter === 'late'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
                  }`}
                >
                  Late ({lateCount})
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter('graded')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    statusFilter === 'graded'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
                  }`}
                >
                  Graded ({gradedCount})
                </button>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search students by name, email, ID..."
                    className="w-full rounded-full border border-brand-line bg-white pl-9 pr-4 py-1.5 text-xs sm:text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 shadow-xs"
                  />
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-xs text-brand-muted font-medium">Sort by:</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="rounded-lg border border-brand-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-heading focus:border-brand-primary focus:outline-none cursor-pointer"
                  >
                    <option value="nameAsc">Student Name (A – Z)</option>
                    <option value="nameDesc">Student Name (Z – A)</option>
                    <option value="submittedDesc">Submission Date (Newest first)</option>
                    <option value="scoreDesc">Marks (Highest first)</option>
                    <option value="scoreAsc">Marks (Lowest first)</option>
                  </select>
                </div>
              </div>

              {/* Student Submission Table */}
              <Card padding="p-0" className="overflow-hidden shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-50/80 border-b border-brand-line/60 text-brand-muted uppercase text-[11px] font-bold">
                      <tr>
                        <th className="py-3 px-4 text-left w-12">#</th>
                        <th className="py-3 px-4 text-left min-w-[180px]">Student</th>
                        <th className="py-3 px-4 text-left min-w-[120px]">Status</th>
                        <th className="py-3 px-4 text-left min-w-[150px]">Submitted At</th>
                        <th className="py-3 px-4 text-left min-w-[160px]">Work / Deliverable</th>
                        <th className="py-3 px-4 text-center min-w-[90px]">Marks Obtained</th>
                        <th className="py-3 px-4 text-center min-w-[80px]">Total Marks</th>
                        <th className="py-3 px-4 text-center min-w-[80px]">Grade</th>
                        <th className="py-3 px-4 text-left min-w-[140px]">Feedback</th>
                        <th className="py-3 px-4 text-right min-w-[130px]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-line/50">
                      {filteredRows.map((row, idx) => {
                        const initials = row.name
                          ? row.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .substring(0, 2)
                          : 'ST'

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-slate-400">
                              {idx + 1}
                            </td>

                            {/* Student Name & Email */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-brand-light text-brand-primary font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                                  {row.avatar ? (
                                    <img
                                      src={row.avatar}
                                      alt={row.name}
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    initials
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-brand-heading truncate">
                                    {row.name}
                                  </p>
                                  <p className="text-[11px] text-brand-muted truncate">
                                    {row.email} • {row.student_id}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              {row.isGraded ? (
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="success" size="sm" dot>
                                    Graded
                                  </Badge>
                                  {row.isLateSubmission && (
                                    <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-bold border border-rose-200">
                                      Late
                                    </span>
                                  )}
                                </div>
                              ) : row.isSubmitted ? (
                                row.isLateSubmission ? (
                                  <Badge variant="warning" size="sm" dot>
                                    Submitted Late
                                  </Badge>
                                ) : (
                                  <Badge variant="primary" size="sm" dot>
                                    Submitted
                                  </Badge>
                                )
                              ) : row.isOverdueWithoutSub ? (
                                <Badge variant="danger" size="sm" dot>
                                  Missing (Overdue)
                                </Badge>
                              ) : (
                                <Badge variant="warning" size="sm" dot>
                                  Pending
                                </Badge>
                              )}
                            </td>

                            {/* Submission Date & Time */}
                            <td className="py-3.5 px-4 text-brand-muted text-xs whitespace-nowrap">
                              {row.submitted_at ? (
                                <span>
                                  {formatDisplayDate(row.submitted_at)},{' '}
                                  {new Date(row.submitted_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">—</span>
                              )}
                            </td>

                            {/* Submitted Deliverable / Work */}
                            <td className="py-3.5 px-4">
                              {(() => {
                                const rowDeliverable = resolveDeliverableUrl({
                                  submissionLink: row.submission_link,
                                  onedriveLink: currentAssignment?.onedrive_link,
                                  driveLink: currentAssignment?.drive_link,
                                  assignmentId: currentAssignment?.id,
                                  classId: currentAssignment?.class_id,
                                  userRole: user?.role || 'admin',
                                })
                                return (
                                  <div className="flex items-center gap-2">
                                    {row.isSubmitted ? (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        icon={Eye}
                                        onClick={() => handleOpenSubmittedWork(row, false)}
                                        className="font-semibold text-xs shadow-purple-glow cursor-pointer"
                                      >
                                        View Work
                                      </Button>
                                    ) : (
                                      <span className="text-slate-400 italic text-xs">Not submitted</span>
                                    )}
                                    {rowDeliverable.url && (
                                      <a
                                        href={rowDeliverable.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary hover:text-brand-hover p-1.5 rounded-lg hover:bg-brand-light transition-colors"
                                        title={rowDeliverable.label}
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                    {row.studentNote && (
                                      <span
                                        className="text-xs text-brand-heading truncate block max-w-[130px] italic"
                                        title={row.studentNote}
                                      >
                                        "{row.studentNote}"
                                      </span>
                                    )}
                                  </div>
                                )
                              })()}
                            </td>

                            {/* Marks Obtained */}
                            <td className="py-3.5 px-4 font-bold text-center">
                              {row.marks !== null ? (
                                <span className="text-emerald-700 text-sm">{row.marks}</span>
                              ) : (
                                <span className="text-slate-400 font-normal italic">—</span>
                              )}
                            </td>

                            {/* Total Marks */}
                            <td className="py-3.5 px-4 font-semibold text-brand-muted text-center">
                              {currentAssignment.points}
                            </td>

                            {/* Letter Grade */}
                            <td className="py-3.5 px-4 text-center">
                              {row.isGraded ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800">
                                  {row.letterGrade}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal italic">—</span>
                              )}
                            </td>

                            {/* Feedback */}
                            <td className="py-3.5 px-4 text-xs">
                              {row.feedback ? (
                                <span
                                  className="text-brand-heading truncate block max-w-[140px] italic"
                                  title={row.feedback}
                                >
                                  "{row.feedback}"
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="py-3.5 px-4 text-right">
                              <Button
                                variant={row.isGraded ? 'outline' : row.isSubmitted ? 'primary' : 'ghost'}
                                size="sm"
                                icon={Award}
                                className={row.isSubmitted && !row.isGraded ? 'shadow-purple-glow font-semibold' : ''}
                                onClick={() => openGradingModal(row)}
                              >
                                {row.isGraded ? 'Edit Grade' : row.isSubmitted ? 'Grade' : 'Review'}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}

                      {filteredRows.length === 0 && (
                        <tr>
                          <td colSpan={10} className="py-12 text-center text-xs text-brand-muted">
                            No student submissions found matching the criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                <div className="px-6 py-3.5 border-t border-brand-line/60 bg-slate-50/50 flex items-center justify-between text-xs text-brand-muted font-medium">
                  <span>
                    Showing 1–{filteredRows.length} of {totalEligible} enrolled students
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="w-7 h-7 rounded-lg bg-brand-primary text-white font-bold flex items-center justify-center">
                      1
                    </span>
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* Individual Student Submission & Grading Modal */}
      {inspectedStudent && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Grade: ${inspectedStudent.name}`}
          subtitle={`${inspectedStudent.email} • ID: ${inspectedStudent.student_id}`}
        >
          <form onSubmit={handleSaveGrade} className="space-y-4">
            {gradeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{gradeError}</span>
              </div>
            )}

            {/* Student & Deliverable Info Card */}
            <div className="rounded-xl p-4 bg-slate-50 border border-brand-line space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Assignment:</span>
                <strong className="text-brand-heading">{currentAssignment?.title}</strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Submission Status:</span>
                {inspectedStudent.isGraded ? (
                  <Badge variant="success" size="sm" dot>
                    Graded ({inspectedStudent.marks} / {currentAssignment?.points})
                  </Badge>
                ) : inspectedStudent.isSubmitted ? (
                  inspectedStudent.isLateSubmission ? (
                    <Badge variant="warning" size="sm" dot>
                      Submitted Late
                    </Badge>
                  ) : (
                    <Badge variant="primary" size="sm" dot>
                      Submitted
                    </Badge>
                  )
                ) : inspectedStudent.isOverdueWithoutSub ? (
                  <Badge variant="danger" size="sm" dot>
                    Missing (Overdue)
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm" dot>
                    Pending Submission
                  </Badge>
                )}
              </div>

              {inspectedStudent.submitted_at && (
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted">Submitted At:</span>
                  <span className="text-brand-heading font-medium">
                    {formatDisplayDate(inspectedStudent.submitted_at)} at{' '}
                    {new Date(inspectedStudent.submitted_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {(() => {
                const studentDeliverable = resolveDeliverableUrl({
                  submissionLink: inspectedStudent.submission_link,
                  onedriveLink: currentAssignment?.onedrive_link,
                  driveLink: currentAssignment?.drive_link,
                  assignmentId: currentAssignment?.id,
                  classId: currentAssignment?.class_id,
                  userRole: user?.role || 'admin',
                })

                return (
                  <>
                    <div className="pt-2 border-t border-brand-line/60 flex items-center justify-between gap-3">
                      <span className="text-brand-muted">Deliverable Link:</span>
                      {studentDeliverable.url ? (
                        <a
                          href={studentDeliverable.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-white font-bold hover:bg-brand-primaryHover transition-all shadow-xs text-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{studentDeliverable.label}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          No deliverable link submitted (Acknowledgement record only)
                        </span>
                      )}
                    </div>
                    {studentDeliverable.note && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        {studentDeliverable.note}
                      </p>
                    )}
                  </>
                )
              })()}

              {inspectedStudent.studentNote && (
                <div className="pt-2 border-t border-brand-line/60 space-y-1">
                  <span className="text-brand-muted block font-medium">Student Note:</span>
                  <p className="text-brand-heading bg-white p-2.5 rounded-lg border border-brand-line leading-relaxed">
                    "{inspectedStudent.studentNote}"
                  </p>
                </div>
              )}
            </div>

            {/* Grading Controls */}
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-heading">
                    Score / Marks (Max: {currentAssignment?.points || 100})
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max={currentAssignment?.points || 100}
                    placeholder={`0 – ${currentAssignment?.points || 100}`}
                    value={modalMarks}
                    onChange={(e) => setModalMarks(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-heading">Calculated Grade</label>
                  <div className="h-10 px-3 py-2 rounded-xl border border-brand-line bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-brand-muted font-medium">Grade preview:</span>
                    <span className="text-sm font-black text-brand-primary">
                      {modalMarks !== '' && !isNaN(Number(modalMarks))
                        ? calculateLetterGrade(Number(modalMarks), currentAssignment?.points)
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-brand-heading">
                  Instructor Feedback & Comments
                </label>
                <Textarea
                  placeholder="Provide constructive feedback, suggestions or remarks for the student..."
                  value={modalFeedback}
                  onChange={(e) => setModalFeedback(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-line/60">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={savingGrade}
                icon={Award}
                className="shadow-purple-glow font-semibold"
              >
                Save & Publish Grade
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Group Submission & Grading Modal */}
      {inspectedGroup && (
        <Modal
          isOpen={isGroupDetailModalOpen}
          onClose={handleCloseGroupModal}
          title={`Group Submission Work: ${inspectedGroup.name}`}
          subtitle={`Leader: ${inspectedGroup.leaderName} • ${inspectedGroup.memberNames.length} Members`}
          size="lg"
        >
          <form onSubmit={handleSaveGroupGrade} className="space-y-4">
            {groupGradeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{groupGradeError}</span>
              </div>
            )}

            {/* Group & Deliverable Info Card */}
            <div className="rounded-xl p-4 bg-slate-50 border border-brand-line space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Assignment:</span>
                <strong className="text-brand-heading text-sm">{currentAssignment?.title}</strong>
              </div>

              {currentAssignment?.description && (
                <div className="space-y-1 pt-1 border-t border-brand-line/60">
                  <span className="text-brand-muted block font-medium">Assignment Description:</span>
                  <p className="text-brand-heading bg-white p-2.5 rounded-lg border border-brand-line leading-relaxed text-[11px]">
                    {currentAssignment.description}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-brand-line/60">
                <span className="text-brand-muted">Submission Status:</span>
                <Badge
                  variant={
                    inspectedGroup.isGraded
                      ? 'success'
                      : inspectedGroup.isSubmitted
                      ? inspectedGroup.hasDeliverable
                        ? 'primary'
                        : 'info'
                      : 'warning'
                  }
                  size="sm"
                  dot
                >
                  {inspectedGroup.isGraded
                    ? `Graded (${inspectedGroup.marks} / ${currentAssignment?.points || 100})`
                    : inspectedGroup.isSubmitted
                    ? inspectedGroup.hasDeliverable
                      ? 'Deliverable Submitted'
                      : 'Acknowledged (No Deliverable Attached)'
                    : 'Pending Submission'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Group Leader:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  {inspectedGroup.leaderName}
                </span>
              </div>

              {inspectedGroup.acknowledged_by && (
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted">Acknowledged By:</span>
                  <span className="font-semibold text-emerald-700">
                    {inspectedGroup.acknowledged_by_name ||
                      (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inspectedGroup.acknowledged_by)
                        ? inspectedGroup.acknowledged_by
                        : inspectedGroup.leaderName || 'Group Leader')}
                  </span>
                </div>
              )}

              {inspectedGroup.acknowledged_at && (
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted">Submitted At:</span>
                  <span className="text-brand-heading font-medium">
                    {formatDisplayDate(inspectedGroup.acknowledged_at)} at{' '}
                    {new Date(inspectedGroup.acknowledged_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {(() => {
                const groupDeliverable = resolveDeliverableUrl({
                  submissionLink: inspectedGroup.submission_link,
                  onedriveLink: currentAssignment?.onedrive_link,
                  driveLink: currentAssignment?.drive_link,
                  assignmentId: currentAssignment?.id,
                  groupId: inspectedGroup.id,
                  classId: currentAssignment?.class_id,
                  userRole: user?.role || 'admin',
                })

                return (
                  <>
                    <div className="pt-2 border-t border-brand-line/60 flex items-center justify-between gap-3">
                      <span className="text-brand-muted font-medium">Submitted Deliverable:</span>
                      {groupDeliverable.url ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={groupDeliverable.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-white font-bold hover:bg-brand-primaryHover transition-all shadow-xs text-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{groupDeliverable.label}</span>
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          No deliverable link submitted (Acknowledgement record only)
                        </span>
                      )}
                    </div>
                    {groupDeliverable.note && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        {groupDeliverable.note}
                      </p>
                    )}
                  </>
                )
              })()}

              {currentAssignment?.onedrive_link && (
                <div className="pt-2 border-t border-brand-line/60 flex items-center justify-between gap-3">
                  <span className="text-brand-muted font-medium">Course OneDrive:</span>
                  <a
                    href={sanitizeUrl(currentAssignment.onedrive_link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 font-bold hover:underline"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Open OneDrive Folder</span>
                  </a>
                </div>
              )}

              {inspectedGroup.comment && (
                <div className="pt-2 border-t border-brand-line/60 space-y-1">
                  <span className="text-brand-muted block font-medium">Leader Submission Note:</span>
                  <p className="text-brand-heading bg-white p-2.5 rounded-lg border border-brand-line leading-relaxed">
                    "{inspectedGroup.comment}"
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-brand-line/60">
                <span className="text-brand-muted block font-medium mb-1">Roster Members:</span>
                <div className="flex flex-wrap gap-1">
                  {inspectedGroup.memberNames.map((m, mIdx) => (
                    <span
                      key={mIdx}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-light text-brand-primary"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Grading Controls */}
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-heading">
                    Group Score / Marks (Max: {currentAssignment?.points || 100})
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max={currentAssignment?.points || 100}
                    placeholder={`0 – ${currentAssignment?.points || 100}`}
                    value={groupModalMarks}
                    onChange={(e) => setGroupModalMarks(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-heading">Calculated Grade</label>
                  <div className="h-10 px-3 py-2 rounded-xl border border-brand-line bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-brand-muted font-medium">Grade preview:</span>
                    <span className="text-sm font-black text-brand-primary">
                      {groupModalMarks !== '' && !isNaN(Number(groupModalMarks))
                        ? calculateLetterGrade(Number(groupModalMarks), currentAssignment?.points)
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-brand-heading">
                  Group Feedback & Evaluation Remarks
                </label>
                <Textarea
                  placeholder="Provide feedback and remarks for the entire group..."
                  value={groupModalFeedback}
                  onChange={(e) => setGroupModalFeedback(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-line/60">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={handleCloseGroupModal}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={savingGroupGrade}
                icon={Award}
                className="shadow-purple-glow font-semibold"
              >
                Save & Publish Group Grade
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Dedicated Submitted Work Viewer Modal (View real deliverables, PDF previews, OneDrive & documents) */}
      <SubmittedWorkViewerModal
        isOpen={isSubmittedWorkModalOpen}
        onClose={() => {
          setIsSubmittedWorkModalOpen(false)
          setSubmittedWorkData(null)
        }}
        data={submittedWorkData}
        onOpenGrading={(target) => {
          if (submittedWorkData?.isGroup) {
            openGroupGradingModal(target)
          } else {
            openGradingModal(target)
          }
        }}
      />

      {/* Safe Delete / Archive Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteAssignmentOpen}
        onClose={() => {
          setDeleteAssignmentOpen(false)
          setManageError('')
        }}
        entityLabel="Assignment"
        entityName={currentAssignment?.title || ''}
        entityMeta={
          currentAssignment?.submission_type === 'group'
            ? 'Group Assignment'
            : 'Individual Assignment'
        }
        impactLoading={impactLoading}
        stats={
          assignmentImpact
            ? [
                {
                  label: 'Individual Subs',
                  value: assignmentImpact.individualSubmissionsCount,
                  highlight: assignmentImpact.individualSubmissionsCount > 0,
                },
                {
                  label: 'Group Subs',
                  value: assignmentImpact.groupSubmissionsCount,
                  highlight: assignmentImpact.groupSubmissionsCount > 0,
                },
                {
                  label: 'Graded Records',
                  value: assignmentImpact.totalGradedCount,
                  highlight: assignmentImpact.totalGradedCount > 0,
                },
              ]
            : []
        }
        canPermanentDelete={Boolean(assignmentImpact?.canPermanentDelete)}
        blockReason="Student or group submissions and grades already exist for this assignment. Archive it instead to keep all records intact."
        archiveSupported={currentAssignment?.status !== 'archived'}
        archiveLabel="Archive Assignment"
        loading={manageLoading}
        error={manageError}
        onConfirmArchive={handleArchiveCurrentAssignment}
        onConfirmDelete={handleConfirmDeleteCurrentAssignment}
      />
    </div>
  )
}

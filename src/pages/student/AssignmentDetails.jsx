import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Clock,
  ExternalLink,
  Send,
  CheckCircle2,
  AlertCircle,
  Link2,
  FolderOpen,
  Lock,
  Cloud,
  Users,
  Crown,
  Layers,
  UserPlus,
  UploadCloud,
  Eye,
  X
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { assignmentsService } from '../../services/assignments.service'
import { submissionsService } from '../../services/submissions.service'
import { groupsService } from '../../services/groups.service'
import {
  formatDisplayDate,
  formatDeadlineBadge,
  calculateLetterGrade,
  sanitizeUrl
} from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { Input, Textarea } from '../../components/common/Input'
import TwoStepSubmissionModal from '../../components/student/TwoStepSubmissionModal'
import GroupManagementModal from '../../components/group/GroupManagementModal'
import SubmittedWorkViewerModal from '../../components/submission/SubmittedWorkViewerModal'
import GroupSubmissionCard from '../../components/submission/GroupSubmissionCard'

export default function AssignmentDetails() {
  const { id: assignmentId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [assignment, setAssignment] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [studentGroup, setStudentGroup] = useState(null)
  const [groupSubmission, setGroupSubmission] = useState(null)
  const [loading, setLoading] = useState(true)

  // Explicit 4-state machine for group membership
  // 'loading_membership' | 'membership_found' | 'membership_not_found' | 'membership_error'
  const [membershipState, setMembershipState] = useState('loading_membership')
  const [membershipError, setMembershipError] = useState('')

  // Group modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [groupModalInitialTab, setGroupModalInitialTab] = useState('create')
  const [isConfirmLeaderModalOpen, setIsConfirmLeaderModalOpen] = useState(false)

  // Submission inputs
  const [submissionLink, setSubmissionLink] = useState('')
  const [comment, setComment] = useState('')
  const [submissionMode, setSubmissionMode] = useState('link') // 'link' | 'file'
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileReading, setFileReading] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [submittingGroup, setSubmittingGroup] = useState(false)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds 15 MB limit. Please provide a OneDrive or Google Drive link for larger files.')
      return
    }
    setFileReading(true)
    const reader = new FileReader()
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type,
      })
      setSubmissionLink(reader.result)
      setFileReading(false)
      setErrorMessage('')
    }
    reader.onerror = () => {
      setErrorMessage('Failed to read file from your device. Please try again or provide a cloud link.')
      setFileReading(false)
    }
    reader.readAsDataURL(file)
  }

  const handleClearSelectedFile = () => {
    setSelectedFile(null)
    setSubmissionLink('')
  }

  // Context-aware back navigation (must execute at top level before any conditional return)
  const backNavigation = useMemo(() => {
    const navState = location.state || {}
    const queryParams = new URLSearchParams(location.search)
    const effectiveClassId = navState.classId || queryParams.get('classId') || assignment?.class_id

    // 1. Opened from a group
    if (navState.from === 'group' || queryParams.get('groupId')) {
      const gid = navState.groupId || queryParams.get('groupId') || studentGroup?.id
      if (effectiveClassId && gid) {
        return {
          path: `/student/classes/${effectiveClassId}/groups/${gid}?tab=assignments`,
          label: 'Back to Group',
        }
      }
      if (effectiveClassId) {
        return {
          path: `/student/classes/${effectiveClassId}?tab=groups`,
          label: 'Back to Group',
        }
      }
    }

    // 2. Opened from a class or direct URL / refresh with assignment.class_id
    if (navState.from === 'class' || queryParams.get('classId') || (!navState.from && assignment?.class_id)) {
      if (effectiveClassId) {
        return {
          path: `/student/classes/${effectiveClassId}?tab=assignments`,
          label: 'Back to Class Assignments',
        }
      }
    }

    // 3. Opened from global assignments
    if (navState.from === 'assignments') {
      return {
        path: '/student',
        label: 'Back to Assignments',
      }
    }

    // 4. Safe fallback
    if (assignment?.class_id) {
      return {
        path: `/student/classes/${assignment.class_id}?tab=assignments`,
        label: 'Back to Class Assignments',
      }
    }

    return {
      path: '/student',
      label: 'Back to Assignments',
    }
  }, [location.state, location.search, assignment?.class_id, studentGroup?.id])

  const loadAssignmentAndSubmission = useCallback(async () => {
    if (!assignmentId || !user?.id) return
    try {
      setLoading(true)
      setErrorMessage('')
      setMembershipError('')

      const assignmentData = await assignmentsService.getAssignmentById(assignmentId)
      setAssignment(assignmentData)

      const isGroup = assignmentData?.submission_type === 'group'

      if (isGroup && assignmentData?.class_id) {
        setMembershipState('loading_membership')
        try {
          // Authoritative lookup using class_id and user.id (auth user UUID)
          let grp = await groupsService.getStudentGroupInCourse(assignmentData.class_id, user.id)

          // Fallback: If not found by course lookup, check if groupId was passed in navigation state/query
          const routeGroupId = location.state?.groupId || new URLSearchParams(location.search).get('groupId')
          if (!grp && routeGroupId) {
            try {
              const explicitGrp = await groupsService.getGroupById(routeGroupId)
              if (
                explicitGrp &&
                explicitGrp.class_id === assignmentData.class_id &&
                explicitGrp.members?.some((m) => (m.student_id || m.user?.id) === user.id)
              ) {
                grp = explicitGrp
              }
            } catch (fallbackErr) {
              console.warn('[AssignmentDetails] Fallback group lookup notice:', fallbackErr)
            }
          }

          if (grp && grp.id) {
            setStudentGroup(grp)
            setMembershipState('membership_found')

            const grpSub = await groupsService.getGroupSubmission(assignmentId, grp.id)
            setGroupSubmission(grpSub)
            if (grpSub) {
              setSubmissionLink(grpSub.submission_link || '')
              setComment(grpSub.comment || '')
            }
          } else {
            setStudentGroup(null)
            setMembershipState('membership_not_found')
          }
        } catch (grpErr) {
          console.error('[AssignmentDetails] Group membership lookup failed:', grpErr)
          setMembershipState('membership_error')
          setMembershipError(grpErr.message || 'Failed to verify course group membership.')
          setStudentGroup(null)
        }
      } else {
        // Individual submission
        const existingSub = await submissionsService.getStudentAssignmentSubmission(assignmentId, user.id)
        setSubmission(existingSub)
        if (existingSub) {
          setSubmissionLink(existingSub.submission_link || '')
          setComment(existingSub.comment || '')
        }
      }
    } catch (err) {
      console.error('[AssignmentDetails] Error loading assignment:', err)
      setErrorMessage('Failed to load assignment details.')
    } finally {
      setLoading(false)
    }
  }, [assignmentId, user?.id, location.state, location.search])

  useEffect(() => {
    loadAssignmentAndSubmission()
  }, [loadAssignmentAndSubmission])

  // Individual Step 1: Open Two-Step Confirmation Modal
  const handleOpenConfirmModal = (e) => {
    e.preventDefault()
    if (!submissionLink.trim()) {
      setErrorMessage('Please upload a deliverable file or provide a cloud link (Google Drive / GitHub / OneDrive).')
      return
    }
    setErrorMessage('')
    setIsModalOpen(true)
  }

  // Individual Step 2: Final submission
  const handleFinalSubmit = async () => {
    const result = await submissionsService.submitAssignment({
      assignmentId,
      studentId: user.id,
      submissionLink,
      comment,
    })
    setSubmission(result)
    return result
  }

  // Group Leader Acknowledgement - Step 1: Open Confirmation Modal
  const handleOpenLeaderConfirmModal = (e) => {
    e.preventDefault()
    if (!studentGroup) {
      setErrorMessage('You must be in a group to submit this assignment.')
      return
    }
    if (studentGroup.leader_id !== user.id) {
      setErrorMessage('Only the group leader is authorized to acknowledge this assignment.')
      return
    }
    if (!submissionLink.trim()) {
      setErrorMessage('Please upload a deliverable file or provide a project submission link (OneDrive, Google Drive, or GitHub).')
      return
    }
    setErrorMessage('')
    setIsConfirmLeaderModalOpen(true)
  }

  // Group Leader Acknowledgement - Step 2: Final RPC execution
  const handleConfirmGroupSubmit = async () => {
    try {
      setSubmittingGroup(true)
      setErrorMessage('')
      const res = await groupsService.acknowledgeGroupAssignment(
        assignmentId,
        studentGroup.id,
        submissionLink.trim(),
        comment.trim()
      )

      setIsConfirmLeaderModalOpen(false)
      if (res?.submission) {
        setGroupSubmission(res.submission)
      } else {
        await loadAssignmentAndSubmission()
      }
    } catch (err) {
      console.error('[AssignmentDetails] Group ack error:', err)
      setErrorMessage(err.message || 'Failed to acknowledge group assignment.')
    } finally {
      setSubmittingGroup(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-36 skeleton-shimmer rounded-md border border-brand-border/40" />
        <div className="h-28 skeleton-shimmer rounded-2xl border border-brand-border/40 shadow-xs" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 skeleton-shimmer rounded-2xl border border-brand-border/40 shadow-xs" />
          <div className="h-72 skeleton-shimmer rounded-2xl border border-brand-border/40 shadow-xs" />
        </div>
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="py-20 text-center space-y-3">
        <h3 className="text-lg font-bold text-brand-heading">Assignment Not Found</h3>
        <Button variant="primary" onClick={() => navigate('/student')}>
          Return to Dashboard
        </Button>
      </div>
    )
  }

  const isGroup = assignment.submission_type === 'group'
  const isLeader = Boolean(isGroup && studentGroup && studentGroup.leader_id === user.id)
  const isGroupAcknowledged = Boolean(isGroup && groupSubmission)

  const deadlineBadge = formatDeadlineBadge(assignment.due_date, assignment.due_time)
  const isIndividualSubmitted = Boolean(!isGroup && submission)
  const isSubmitted = isGroup ? isGroupAcknowledged : isIndividualSubmitted

  // Graded calculations for group vs individual
  const activeSubmission = isGroup ? groupSubmission : submission
  const parsedSub = activeSubmission
    ? submissionsService.parseSubmissionComment(activeSubmission.comment)
    : { text: '', grade: null, feedback: '' }
  
  const rawMarks = isGroup ? activeSubmission?.marks : activeSubmission?.grade
  const awardedMarks = rawMarks !== null && rawMarks !== undefined ? rawMarks : parsedSub.grade
  const isGraded = Boolean(
    activeSubmission &&
      (activeSubmission.status === 'reviewed' || (awardedMarks !== null && awardedMarks !== undefined))
  )
  const letterGrade = isGraded ? calculateLetterGrade(awardedMarks, assignment.points) : null

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => navigate(backNavigation.path)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-brand-primary hover:text-brand-hover cursor-pointer mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backNavigation.label}</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
              {assignment.title}
            </h1>
            <p className="text-xs sm:text-sm text-brand-muted mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-brand-heading">{assignment.classes?.name}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Due {assignment.due_date ? `${formatDisplayDate(assignment.due_date)} at ${assignment.due_time?.substring(0, 5) || '23:59'}` : 'No deadline'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge variant={isGroup ? 'purple' : 'neutral'} size="lg">
              {isGroup ? (
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Group Assignment</span>
                </span>
              ) : (
                <span>Individual Assignment</span>
              )}
            </Badge>

            <Badge variant="purple" size="lg">
              {assignment.points} Points
            </Badge>

            {isGraded ? (
              <Badge variant="success" size="lg" dot>
                Graded: {awardedMarks}/{assignment.points} ({letterGrade})
              </Badge>
            ) : isSubmitted ? (
              <Badge variant="success" size="lg" dot>
                {isGroup ? 'Group Acknowledged' : 'Submitted'}
              </Badge>
            ) : deadlineBadge ? (
              <Badge variant={deadlineBadge.variant} size="lg">
                {deadlineBadge.text}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Grid: Details on Left + Submission Card on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (7 cols): Instructions & Resources */}
        <div className="lg:col-span-7 space-y-6">
          <Card padding="p-6" className="space-y-5">
            <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-primary" />
              <span>Assignment Instructions</span>
            </h3>

            <div className="text-xs sm:text-sm text-brand-body leading-relaxed whitespace-pre-line bg-slate-50/60 p-4 rounded-xl border border-brand-line/60">
              {assignment.description || 'No detailed instructions provided.'}
            </div>

            {/* Resources Section (Google Drive + OneDrive) */}
            {(assignment.drive_link || assignment.onedrive_link) && (
              <div className="space-y-2.5 pt-2 border-t border-brand-line/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                  Attached Reference Resources
                </h4>

                {assignment.drive_link && (
                  <div className="p-3.5 rounded-xl border border-brand-line bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center shrink-0">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-brand-heading truncate">
                          Google Drive Materials
                        </p>
                        <span className="text-[11px] text-brand-muted truncate block">
                          Shared reference folder
                        </span>
                      </div>
                    </div>

                    <a
                      href={assignment.drive_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline bg-brand-light px-3 py-1.5 rounded-lg shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Drive</span>
                    </a>
                  </div>
                )}

                {assignment.onedrive_link && (
                  <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50/60 transition-colors flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-white border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                        <Cloud className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-brand-heading truncate">
                          Microsoft OneDrive Materials
                        </p>
                        <span className="text-[11px] text-blue-600 truncate block">
                          Cloud documents and project files
                        </span>
                      </div>
                    </div>

                    <a
                      href={assignment.onedrive_link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline bg-white border border-blue-200 px-3 py-1.5 rounded-lg shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in OneDrive</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (5 cols): Submit Your Work / Group Acknowledgement Card */}
        <div className="lg:col-span-5">
          {isGroup ? (
            /* GROUP ASSIGNMENT WORKFLOW */
            <Card padding="p-6" className="space-y-5 shadow-card">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
                  <Layers className="w-5 h-5 text-brand-primary" />
                  <span>Group Acknowledgement</span>
                </h3>
                {isGroupAcknowledged && (
                  <Badge variant="success" size="sm" dot>
                    Acknowledged
                  </Badge>
                )}
              </div>

              {/* Allocation Guard: If assignment is selectively assigned and student not included */}
              {!assignment?.assign_to_all &&
              !(assignment?.assignment_students || []).some((ast) => ast.student_id === user?.id) ? (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold">Assignment Not Allocated</h4>
                      <p className="text-xs text-amber-800 mt-1">
                        This assignment was selectively allocated to specific students or groups in this course. You or your group are not currently designated to submit this assignment.
                      </p>
                    </div>
                  </div>
                </div>
              ) : membershipState === 'loading_membership' ? (
                /* State 1: loading_membership - Skeleton display (no Create/Join actions shown) */
                <div className="p-6 rounded-2xl border border-brand-line/80 bg-slate-50/50 space-y-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-200" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 bg-slate-200 rounded w-1/3" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-10 bg-slate-200 rounded-xl w-full" />
                  <p className="text-xs text-brand-muted text-center">
                    Verifying course group membership...
                  </p>
                </div>
              ) : membershipState === 'membership_error' ? (
                /* State 2: membership_error - Explicit database error with retry */
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold">Group Verification Error</h4>
                      <p className="text-xs text-rose-800 mt-1">
                        {membershipError || 'Could not verify your course group membership due to a database connection issue.'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-1 flex items-center gap-2 flex-wrap">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={loadAssignmentAndSubmission}
                    >
                      Retry Verification
                    </Button>
                    {assignment.class_id && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/student/classes/${assignment.class_id}?tab=groups`)}
                      >
                        View Course Groups
                      </Button>
                    )}
                  </div>
                </div>
              ) : !studentGroup || membershipState === 'membership_not_found' ? (
                /* State 3: membership_not_found - EXACT REQUIRED TEXT */
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                        You are not part of any group. Create or join one to submit this assignment.
                      </p>
                      <p className="text-[11px] text-amber-700 mt-1">
                        Group assignments require teamwork. Once in a group, your group leader can submit on behalf of all members.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1 flex-wrap">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={UserPlus}
                      onClick={() => {
                        setGroupModalInitialTab('create')
                        setIsGroupModalOpen(true)
                      }}
                    >
                      Create Group
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Users}
                      onClick={() => {
                        setGroupModalInitialTab('join')
                        setIsGroupModalOpen(true)
                      }}
                    >
                      Join Group
                    </Button>
                    {assignment.class_id && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/student/classes/${assignment.class_id}?tab=groups`)}
                      >
                        View Course Groups
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                /* State 4: membership_found - Student is in a group */
                <div className="space-y-4">
                  {/* Team Banner */}
                  <div className="p-3.5 rounded-xl bg-brand-light/40 border border-brand-border/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center font-bold text-xs">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-brand-heading">
                            {studentGroup.name}
                          </span>
                          {isLeader && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                              <Crown className="w-2.5 h-2.5" /> Leader
                            </span>
                          )}
                          {studentGroup.status === 'archived' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                              Archived
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-brand-muted">
                          Leader: {studentGroup.leader?.name || 'Group Leader'} • {studentGroup.members?.length || 1} members
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setGroupModalInitialTab('myGroup')
                        setIsGroupModalOpen(true)
                      }}
                      className="text-xs font-semibold text-brand-primary hover:underline cursor-pointer"
                    >
                      Manage Team
                    </button>
                  </div>

                  {isGroupAcknowledged ? (
                    /* Unified Group Submission Card for Student */
                    <div className="space-y-3">
                      <GroupSubmissionCard
                        group={{
                          ...studentGroup,
                          leaderName:
                            groupSubmission.leader?.name ||
                            groupSubmission.leader_name ||
                            studentGroup.leader?.name ||
                            user?.name,
                          acknowledged_by_name:
                            groupSubmission.leader?.name ||
                            groupSubmission.leader_name ||
                            studentGroup.leader?.name ||
                            user?.name,
                        }}
                        submission={groupSubmission}
                        assignment={assignment}
                        userRole="student"
                        isSubmitted={true}
                        onViewWork={() => setIsViewerOpen(true)}
                      />
                      <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        <span>All group members share this verified acknowledgement record.</span>
                      </div>
                    </div>
                  ) : studentGroup?.status === 'archived' ? (
                    /* Group is archived and not acknowledged */
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                      <Badge variant="neutral" size="md">
                        Group Archived
                      </Badge>
                      <p className="text-xs text-brand-muted max-w-xs mx-auto">
                        This group has been archived by the course instructor or leader. Further submissions for this group are closed.
                      </p>
                    </div>
                  ) : isLeader ? (
                    /* Current user is the leader and hasn't submitted yet */
                    <form onSubmit={handleOpenLeaderConfirmModal} className="space-y-4">
                      {errorMessage && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                          {errorMessage}
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-800 flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>You are the Group Leader. You are authorized to submit for your entire team.</span>
                      </div>

                      {/* Mode Selector: Cloud Link vs File Upload */}
                      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                        <button
                          type="button"
                          onClick={() => {
                            setSubmissionMode('link')
                            if (selectedFile) handleClearSelectedFile()
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            submissionMode === 'link'
                              ? 'bg-white text-brand-primary shadow-xs'
                              : 'text-brand-muted hover:text-brand-heading'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" />
                            <span>OneDrive / Cloud Link</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubmissionMode('file')
                            setSubmissionLink('')
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            submissionMode === 'file'
                              ? 'bg-white text-brand-primary shadow-xs'
                              : 'text-brand-muted hover:text-brand-heading'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Upload Document (PDF / Office)</span>
                          </span>
                        </button>
                      </div>

                      {submissionMode === 'link' ? (
                        <Input
                          label="Project Submission Link"
                          placeholder="https://1drv.ms/... or https://drive.google.com/..."
                          required
                          icon={Link2}
                          value={submissionLink}
                          onChange={(e) => setSubmissionLink(e.target.value)}
                          helperText="Provide the OneDrive, Google Drive, or repository link for your group work."
                        />
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-brand-heading">
                            Attach Deliverable Document (PDF, Word, Excel, PPT)
                          </label>
                          {selectedFile ? (
                            <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2.5 truncate">
                                <FileText className="w-5 h-5 text-brand-primary shrink-0" />
                                <div className="truncate">
                                  <span className="font-bold text-brand-heading block truncate">{selectedFile.name}</span>
                                  <span className="text-[11px] text-brand-muted">
                                    {(selectedFile.size / 1024).toFixed(1)} KB • Document Attached
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={X}
                                onClick={handleClearSelectedFile}
                                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-brand-border/70 hover:border-brand-primary rounded-xl cursor-pointer bg-slate-50/60 hover:bg-brand-light/20 transition-all text-center">
                              <UploadCloud className="w-7 h-7 text-brand-primary mb-2" />
                              <span className="text-xs font-bold text-brand-heading">
                                {fileReading ? 'Reading document...' : 'Click to select or drop deliverable file'}
                              </span>
                              <span className="text-[11px] text-brand-muted mt-1">
                                Supports PDF, DOCX, PPTX, XLSX, TXT up to 15 MB
                              </span>
                              <input
                                type="file"
                                onChange={handleFileSelect}
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      )}

                      <Textarea
                        label="Group Submission Comments (Optional)"
                        placeholder="Notes on member contributions or project highlights..."
                        rows={3}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />

                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        loading={submittingGroup}
                        className="w-full justify-center shadow-purple-glow font-semibold mt-2 cursor-pointer"
                        icon={Send}
                      >
                        Yes, I have submitted
                      </Button>
                    </form>
                  ) : (
                    /* Current user is an ordinary member (not leader) */
                    <div className="p-5 rounded-xl bg-slate-50 border border-brand-line space-y-3 text-center py-6">
                      <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <Badge variant="warning" size="md">
                          Not submitted by group leader
                        </Badge>
                        <h4 className="text-xs sm:text-sm font-bold text-brand-heading pt-1">
                          Not submitted by group leader
                        </h4>
                      </div>
                      <p className="text-xs text-brand-muted max-w-xs mx-auto leading-relaxed">
                        Only your group leader, <strong>{studentGroup.leader?.name || 'Group Leader'}</strong>, can acknowledge and submit this assignment on behalf of the group.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Once submitted, the timestamp and grading will appear here for all team members.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ) : (
            /* INDIVIDUAL ASSIGNMENT WORKFLOW */
            <Card padding="p-6" className="space-y-5 shadow-card">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
                  <Send className="w-5 h-5 text-brand-primary" />
                  <span>Submit Your Work</span>
                </h3>
                {isSubmitted && (
                  <Badge variant="success" size="sm" dot>
                    Submitted
                  </Badge>
                )}
              </div>

              {isSubmitted ? (
                /* Already submitted state: Duplicate submission prevented */
                <div className="space-y-4 py-2">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Assignment Submitted</span>
                    </div>
                    <p className="text-xs text-emerald-700">
                      Submitted on {formatDisplayDate(submission.submitted_at)} at {new Date(submission.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                    </p>
                  </div>

                  {/* Graded Score and Instructor Feedback Card */}
                  {isGraded && (
                    <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-brand-primary" />
                          <span>Awarded Marks: {awardedMarks} / {assignment.points} pts</span>
                        </span>
                        <span className="text-xs font-black bg-purple-200 text-purple-900 px-2.5 py-0.5 rounded-full">
                          Grade {letterGrade}
                        </span>
                      </div>
                      {parsedSub.feedback && (
                        <div className="pt-2 border-t border-purple-200/80">
                          <span className="text-[11px] font-bold text-purple-700 block">Instructor Feedback:</span>
                          <p className="text-xs text-purple-900 italic mt-0.5">
                            "{parsedSub.feedback}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-brand-heading">Submitted Deliverable:</span>
                    <div className="p-3 rounded-xl bg-slate-50 border border-brand-line text-xs font-medium text-brand-primary flex items-center justify-between gap-2">
                      <span className="truncate">{submission.submission_link?.startsWith('data:') ? 'Attached Deliverable File' : submission.submission_link}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          icon={Eye}
                          onClick={() => setIsViewerOpen(true)}
                          className="font-semibold text-xs shadow-purple-glow cursor-pointer"
                        >
                          View Deliverable
                        </Button>
                        {!submission.submission_link?.startsWith('data:') && (
                          <a
                            href={sanitizeUrl(submission.submission_link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-brand-heading shrink-0"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {(parsedSub.text || submission.comment) && (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-brand-heading">Student Notes:</span>
                      <p className="text-xs text-brand-muted bg-slate-50 p-3 rounded-xl border border-brand-line">
                        {parsedSub.text || submission.comment}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Submission is locked and final. Duplicate submissions are disabled.</span>
                  </div>
                </div>
              ) : (
                /* Submission Form */
                <form onSubmit={handleOpenConfirmModal} className="space-y-4">
                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      {errorMessage}
                    </div>
                  )}

                  {/* Mode Selector: Cloud Link vs File Upload */}
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmissionMode('link')
                        if (selectedFile) handleClearSelectedFile()
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        submissionMode === 'link'
                          ? 'bg-white text-brand-primary shadow-xs'
                          : 'text-brand-muted hover:text-brand-heading'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Cloud Link (Drive / GitHub / Live)</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmissionMode('file')
                        setSubmissionLink('')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        submissionMode === 'file'
                          ? 'bg-white text-brand-primary shadow-xs'
                          : 'text-brand-muted hover:text-brand-heading'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload Document (PDF / Office)</span>
                      </span>
                    </button>
                  </div>

                  {submissionMode === 'link' ? (
                    <Input
                      label="Submission Link (Google Drive / GitHub / Deployment)"
                      placeholder="https://drive.google.com/... or https://myproject.vercel.app"
                      required
                      icon={Link2}
                      value={submissionLink}
                      onChange={(e) => setSubmissionLink(e.target.value)}
                      helperText="Paste your completed project link or shared Drive folder."
                    />
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-brand-heading">
                        Attach Deliverable Document (PDF, Word, Excel, PPT)
                      </label>
                      {selectedFile ? (
                        <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 truncate">
                            <FileText className="w-5 h-5 text-brand-primary shrink-0" />
                            <div className="truncate">
                              <span className="font-bold text-brand-heading block truncate">{selectedFile.name}</span>
                              <span className="text-[11px] text-brand-muted">
                                {(selectedFile.size / 1024).toFixed(1)} KB • Document Attached
                              </span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon={X}
                            onClick={handleClearSelectedFile}
                            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-brand-border/70 hover:border-brand-primary rounded-xl cursor-pointer bg-slate-50/60 hover:bg-brand-light/20 transition-all text-center">
                          <UploadCloud className="w-7 h-7 text-brand-primary mb-2" />
                          <span className="text-xs font-bold text-brand-heading">
                            {fileReading ? 'Reading document...' : 'Click to select or drop deliverable file'}
                          </span>
                          <span className="text-[11px] text-brand-muted mt-1">
                            Supports PDF, DOCX, PPTX, XLSX, TXT up to 15 MB
                          </span>
                          <input
                            type="file"
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  )}

                  <Textarea
                    label="Additional Comments / Notes (Optional)"
                    placeholder="Notes for your professor regarding this submission..."
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full justify-center shadow-purple-glow font-semibold mt-2 cursor-pointer"
                    icon={Send}
                  >
                    Yes, I have submitted
                  </Button>
                </form>
              )}
            </Card>
          )}
        </div>

      </div>

      {/* Two Step Confirmation Modal (Individual) */}
      <TwoStepSubmissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        assignment={assignment}
        submissionData={{ submissionLink, comment }}
        onFinalSubmit={handleFinalSubmit}
        onSuccessDone={() => loadAssignmentAndSubmission()}
      />

      {/* Group Management Modal */}
      {isGroup && (
        <GroupManagementModal
          isOpen={isGroupModalOpen}
          onClose={() => setIsGroupModalOpen(false)}
          classId={assignment?.class_id}
          className={assignment?.classes?.name}
          currentUser={user}
          currentGroup={studentGroup}
          initialTab={groupModalInitialTab}
          onGroupUpdated={(updatedGroup) => {
            setStudentGroup(updatedGroup)
            loadAssignmentAndSubmission()
          }}
        />
      )}

      {/* Group Leader Submission Confirmation Modal */}
      {isGroup && (
        <Modal
          isOpen={isConfirmLeaderModalOpen}
          onClose={() => !submittingGroup && setIsConfirmLeaderModalOpen(false)}
          title="Confirm Group Submission"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-brand-light border border-brand-border/80 text-brand-heading space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-brand-primary">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>Submitting for {studentGroup?.name}</span>
              </div>
              <p className="text-xs text-brand-body leading-relaxed">
                As the group leader, you are submitting this assignment on behalf of all members in <strong>{studentGroup?.name}</strong>.
              </p>
            </div>

            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-brand-line text-xs">
              <span className="font-semibold text-brand-heading block">Project Submission Link:</span>
              <span className="text-brand-primary font-mono break-all">{submissionLink}</span>
              {comment && (
                <div className="pt-2 mt-2 border-t border-brand-line/60">
                  <span className="font-semibold text-brand-heading block">Submission Notes:</span>
                  <span className="text-brand-muted">{comment}</span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Once confirmed, all group members will see this submission marked as acknowledged by you with an official timestamp.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-brand-line/60">
              <Button
                variant="secondary"
                size="sm"
                disabled={submittingGroup}
                onClick={() => setIsConfirmLeaderModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={submittingGroup}
                icon={CheckCircle2}
                onClick={handleConfirmGroupSubmit}
              >
                Confirm & Submit
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Dedicated Submitted Work Viewer Modal for Student Inspection */}
      <SubmittedWorkViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        data={{
          assignment,
          group: studentGroup
            ? { ...studentGroup, leaderName: studentGroup.leader?.name || user?.name }
            : null,
          student: user,
          submission: {
            ...((assignment?.submission_type === 'group' ? groupSubmission : submission) || {}),
            acknowledged_by_name:
              groupSubmission?.leader?.name ||
              groupSubmission?.leader_name ||
              studentGroup?.leader?.name ||
              user?.name,
          },
          isGroup: assignment?.submission_type === 'group',
        }}
      />
    </div>
  )
}

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  ClipboardList,
  CheckCircle2,
  BarChart2,
  Calendar,
  Plus,
  ChevronDown,
  MessageSquare,
  FileText,
  Share2,
  ExternalLink,
  MoreVertical,
  Send,
  Sparkles,
  Laptop,
  FolderOpen,
  AlertCircle,
  Clock,
  ArrowRight,
  Edit2,
  Trash2,
  Archive,
  Eye,
  RotateCcw
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { classesService } from '../../services/classes.service'
import { assignmentsService } from '../../services/assignments.service'
import { announcementsService } from '../../services/announcements.service'
import { calculateCompletionRate, formatDisplayDate, formatTimeAgo, formatDeadlineBadge } from '../../utils/calculations'
import StatCard from '../../components/common/StatCard'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Card from '../../components/common/Card'
import Modal from '../../components/common/Modal'
import ActionMenu from '../../components/common/ActionMenu'
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal'
import EditClassModal from '../../components/class/EditClassModal'
import { Input, Textarea } from '../../components/common/Input'
import NotificationBadge from '../../components/common/NotificationBadge'
import { useNotifications } from '../../context/NotificationContext'
import { useToast } from '../../context/ToastContext'
import { getCached } from '../../utils/dataCache'

export default function AdminDashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const { classUnreadCounts = {} } = useNotifications()
  const navigate = useNavigate()

  const cachedClasses = user?.id ? getCached(`adminClasses:${user.id}`, { allowStale: true }) : null
  const cachedAssignments = user?.id ? getCached(`adminAssignments:${user.id}`, { allowStale: true }) : null
  const cachedAllAnnouncements = getCached('announcements:all', { allowStale: true })
  const hasWarmSnapshot = Boolean(cachedClasses && cachedAssignments)

  // State
  const [classes, setClasses] = useState(() => cachedClasses || [])
  const [selectedClass, setSelectedClass] = useState(() => (cachedClasses && cachedClasses.length > 0 ? cachedClasses[0] : null))
  const [assignments, setAssignments] = useState(() => cachedAssignments || [])
  const [announcements, setAnnouncements] = useState(() => {
    if (cachedAllAnnouncements && cachedClasses && cachedClasses.length > 0) {
      return cachedAllAnnouncements.filter((a) => a.class_id === cachedClasses[0].id)
    }
    return []
  })
  const [loading, setLoading] = useState(() => !hasWarmSnapshot)
  const [activeTab, setActiveTab] = useState('stream')

  // Announcement posting state
  const [announcementText, setAnnouncementText] = useState('')
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false)
  const [announcementExpanded, setAnnouncementExpanded] = useState(false)

  // Create menu dropdown state
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)
  const createDropdownRef = useRef(null)

  useEffect(() => {
    if (!createDropdownOpen) return undefined
    const handleOutsideClick = (e) => {
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target)) {
        setCreateDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [createDropdownOpen])

  // Quick Create Class Modal
  const [isCreateClassModalOpen, setIsCreateClassModalOpen] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassSubject, setNewClassSubject] = useState('')
  const [newClassDescription, setNewClassDescription] = useState('')
  const [creatingClass, setCreatingClass] = useState(false)

  // Class Edit & Safe Delete Management State
  const [editClassTarget, setEditClassTarget] = useState(null)
  const [deleteClassTarget, setDeleteClassTarget] = useState(null)
  const [classImpact, setClassImpact] = useState(null)
  const [classImpactLoading, setClassImpactLoading] = useState(false)
  const [classDeleteLoading, setClassDeleteLoading] = useState(false)
  const [classDeleteError, setClassDeleteError] = useState('')

  // Assignment Safe Delete / Archive State
  const [deleteAssignmentTarget, setDeleteAssignmentTarget] = useState(null)
  const [assignmentImpact, setAssignmentImpact] = useState(null)
  const [assignmentImpactLoading, setAssignmentImpactLoading] = useState(false)
  const [assignmentActionLoading, setAssignmentActionLoading] = useState(false)
  const [assignmentActionError, setAssignmentActionError] = useState('')

  // State for all announcements to enable instant class switching without network round-trips
  const [allAnnouncementsCache, setAllAnnouncementsCache] = useState(() => cachedAllAnnouncements || [])

  const loadDashboardData = useCallback(async ({ force = false, silent = false } = {}) => {
    if (!user?.id) return
    try {
      if (!silent) setLoading(true)
      const [fetchedClasses, fetchedAssignments, fetchedAnnouncements] = await Promise.all([
        classesService.getAdminClasses(user.id, force),
        assignmentsService.getAdminAssignments(user.id, force),
        announcementsService.getAnnouncements(force).catch(() => []),
      ])

      setClasses(fetchedClasses)
      setAssignments(fetchedAssignments)
      setAllAnnouncementsCache(fetchedAnnouncements)

      if (fetchedClasses.length > 0) {
        setSelectedClass((prev) => {
          const active = prev ? fetchedClasses.find((c) => c.id === prev.id) || fetchedClasses[0] : fetchedClasses[0]
          setAnnouncements(fetchedAnnouncements.filter((a) => a.class_id === active.id))
          return active
        })
      } else {
        setSelectedClass(null)
        setAnnouncements([])
      }
    } catch (err) {
      console.error('[AdminDashboard] Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Fetch initial dashboard data (with synchronous SWR hydration)
  useEffect(() => {
    if (!user?.id) return
    const freshClasses = getCached(`adminClasses:${user.id}`)
    const freshAssignments = getCached(`adminAssignments:${user.id}`)
    const freshAnns = getCached('announcements:all')
    if (freshClasses && freshAssignments && freshAnns) {
      setClasses(freshClasses)
      setAssignments(freshAssignments)
      setAllAnnouncementsCache(freshAnns)
      const active = freshClasses[0] || null
      setSelectedClass(active)
      setAnnouncements(active ? freshAnns.filter((a) => a.class_id === active.id) : [])
      setLoading(false)
      return
    }
    const staleClasses = getCached(`adminClasses:${user.id}`, { allowStale: true })
    const staleAssignments = getCached(`adminAssignments:${user.id}`, { allowStale: true })
    if (staleClasses && staleAssignments) {
      loadDashboardData({ force: false, silent: true })
    } else {
      loadDashboardData()
    }
  }, [user?.id, loadDashboardData])

  // Handle active class change with instantaneous in-memory filter
  const handleSelectClass = useCallback((cls) => {
    setSelectedClass(cls)
    setAnnouncements(allAnnouncementsCache.filter((a) => a.class_id === cls.id))
  }, [allAnnouncementsCache])

  // Post announcement
  const handlePostAnnouncement = async (e) => {
    e.preventDefault()
    if (!announcementText.trim() || !selectedClass) return

    try {
      setIsPostingAnnouncement(true)
      const newAnn = await announcementsService.createAnnouncement({
        title: 'Class Announcement',
        message: announcementText,
        class_id: selectedClass.id,
        admin_id: user.id,
      })
      setAnnouncements([newAnn, ...announcements])
      setAnnouncementText('')
      setAnnouncementExpanded(false)
    } catch (err) {
      console.error('[AdminDashboard] Error posting announcement:', err)
    } finally {
      setIsPostingAnnouncement(false)
    }
  }

  // Create new class
  const handleCreateClassSubmit = async (e) => {
    e.preventDefault()
    if (!newClassName.trim()) return

    try {
      setCreatingClass(true)
      const created = await classesService.createClass({
        name: newClassName,
        subject: newClassSubject,
        description: newClassDescription,
        admin_id: user.id,
      })
      setIsCreateClassModalOpen(false)
      setNewClassName('')
      setNewClassSubject('')
      setNewClassDescription('')
      toast.success(`Created class "${created?.name || newClassName}".`, 'Class Created')
      await loadDashboardData({ force: true })
    } catch (err) {
      console.error('[AdminDashboard] Error creating class:', err)
      toast.error(err.message || 'Failed to create class.')
    } finally {
      setCreatingClass(false)
    }
  }

  const openDeleteClassModal = async (cls) => {
    setDeleteClassTarget(cls)
    setClassDeleteError('')
    setClassImpact(null)
    setClassImpactLoading(true)
    try {
      const summary = await classesService.getClassImpactSummary(cls.id)
      setClassImpact(summary)
    } catch (err) {
      setClassDeleteError(err.message || 'Failed to inspect associated class records.')
    } finally {
      setClassImpactLoading(false)
    }
  }

  const handleConfirmDeleteClass = async () => {
    if (!deleteClassTarget?.id) return
    try {
      setClassDeleteLoading(true)
      setClassDeleteError('')
      await classesService.deleteClass(deleteClassTarget.id)
      const removedName = deleteClassTarget.name
      setDeleteClassTarget(null)
      toast.success(`Deleted empty class "${removedName}".`, 'Class Deleted')
      await loadDashboardData({ force: true })
    } catch (err) {
      const msg = err.message || 'Unable to delete class.'
      setClassDeleteError(msg)
      toast.error(msg, 'Delete Blocked')
    } finally {
      setClassDeleteLoading(false)
    }
  }

  const openDeleteAssignmentModal = async (assignment) => {
    setDeleteAssignmentTarget(assignment)
    setAssignmentActionError('')
    setAssignmentImpact(null)
    setAssignmentImpactLoading(true)
    try {
      const summary = await assignmentsService.getAssignmentImpactSummary(assignment.id)
      setAssignmentImpact(summary)
    } catch (err) {
      setAssignmentActionError(err.message || 'Failed to inspect assignment submission history.')
    } finally {
      setAssignmentImpactLoading(false)
    }
  }

  const handleConfirmArchiveAssignment = async (targetAssignment) => {
    const item = targetAssignment || deleteAssignmentTarget
    if (!item?.id) return
    try {
      setAssignmentActionLoading(true)
      setAssignmentActionError('')
      await assignmentsService.archiveAssignment(item.id)
      setDeleteAssignmentTarget(null)
      toast.success(`Archived "${item.title}". All submissions and marks remain preserved.`, 'Assignment Archived')
      await loadDashboardData({ force: true })
    } catch (err) {
      const msg = err.message || 'Failed to archive assignment.'
      setAssignmentActionError(msg)
      toast.error(msg, 'Archive Failed')
    } finally {
      setAssignmentActionLoading(false)
    }
  }

  const handleRestoreAssignment = async (assignment) => {
    if (!assignment?.id) return
    try {
      await assignmentsService.restoreAssignment(assignment.id)
      toast.success(`Restored "${assignment.title}" to published status.`, 'Assignment Restored')
      await loadDashboardData({ force: true })
    } catch (err) {
      toast.error(err.message || 'Failed to restore assignment.')
    }
  }

  const handleConfirmDeleteAssignment = async () => {
    if (!deleteAssignmentTarget?.id) return
    try {
      setAssignmentActionLoading(true)
      setAssignmentActionError('')
      await assignmentsService.deleteAssignment(deleteAssignmentTarget.id)
      const title = deleteAssignmentTarget.title
      setDeleteAssignmentTarget(null)
      toast.success(`Deleted assignment "${title}".`, 'Assignment Deleted')
      await loadDashboardData({ force: true })
    } catch (err) {
      const msg = err.message || 'Unable to delete assignment.'
      setAssignmentActionError(msg)
      toast.error(msg, 'Delete Blocked')
    } finally {
      setAssignmentActionLoading(false)
    }
  }

  // Aggregate statistics across admin classes and assignments (memoized)
  const totalClassesCount = classes.length
  const totalAssignmentsCount = assignments.length

  const { totalSubmissionsCount, avgCompletionRate } = useMemo(() => {
    const classMembersById = new Map(classes.map((c) => [c.id, c.class_members || []]))
    let subsCount = 0
    let allocatedSlots = 0

    assignments.forEach((a) => {
      const classMembers = a.classes?.class_members || classMembersById.get(a.class_id) || []
      const eligibleSet = new Set(
        a.assign_to_all
          ? classMembers.map((m) => m.student_id).filter(Boolean)
          : (a.assignment_students || []).map((s) => s.student_id).filter(Boolean)
      )

      const validSubmittedStudentIds = new Set()
      ;(a.submissions || []).forEach((sub) => {
        if (
          sub?.student_id &&
          eligibleSet.has(sub.student_id) &&
          ['submitted', 'reviewed'].includes(sub.status)
        ) {
          validSubmittedStudentIds.add(sub.student_id)
        }
      })

      subsCount += validSubmittedStudentIds.size
      allocatedSlots += eligibleSet.size
    })

    return {
      totalSubmissionsCount: subsCount,
      avgCompletionRate: calculateCompletionRate(subsCount, allocatedSlots),
    }
  }, [assignments, classes])

  // Current class specific stats (memoized)
  const currentClassStudentsCount = selectedClass?.class_members?.length || 0
  const { currentClassAssignments, classSubmissionsCount, currentClassCompletion } = useMemo(() => {
    const classAssignments = assignments.filter((a) => a.class_id === selectedClass?.id)
    let subsCount = 0
    let classAllocatedSlots = 0

    classAssignments.forEach((a) => {
      const classMembers = a.classes?.class_members || selectedClass?.class_members || []
      const eligibleSet = new Set(
        a.assign_to_all
          ? classMembers.map((m) => m.student_id).filter(Boolean)
          : (a.assignment_students || []).map((s) => s.student_id).filter(Boolean)
      )

      const validSubmittedStudentIds = new Set()
      ;(a.submissions || []).forEach((sub) => {
        if (
          sub?.student_id &&
          eligibleSet.has(sub.student_id) &&
          ['submitted', 'reviewed'].includes(sub.status)
        ) {
          validSubmittedStudentIds.add(sub.student_id)
        }
      })

      subsCount += validSubmittedStudentIds.size
      classAllocatedSlots += eligibleSet.size
    })

    return {
      currentClassAssignments: classAssignments,
      classSubmissionsCount: subsCount,
      currentClassCompletion: calculateCompletionRate(subsCount, classAllocatedSlots),
    }
  }, [assignments, selectedClass])

  // Upcoming assignments sorted by due date
  const upcomingAssignments = [...assignments]
    .filter((a) => a.due_date)
    .sort((a, b) => new Date(`${a.due_date}T${a.due_time || '23:59:00'}`) - new Date(`${b.due_date}T${b.due_time || '23:59:00'}`))
    .slice(0, 3)

  const adminDisplayName = user?.name || 'Prof. Anitha'

  return (
    <div className="space-y-6">
      {/* Top Greeting & Date Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight flex items-center gap-2">
            Good morning, {adminDisplayName}! <span className="inline-block animate-pulse">👋</span>
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Manage your classes, create assignments, and track student progress.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start sm:self-auto bg-white border border-brand-line/80 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-brand-body shadow-xs">
          <Calendar className="w-4 h-4 text-brand-primary" />
          <span>{formatDisplayDate(new Date())}</span>
        </div>
      </div>

      {/* 4 Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          value={totalClassesCount}
          label="Classes"
          color="purple"
          onClick={() => navigate('/admin/classes')}
        />
        <StatCard
          icon={ClipboardList}
          value={totalAssignmentsCount}
          label="Assignments"
          color="amber"
          onClick={() => navigate('/admin/assignments')}
        />
        <StatCard
          icon={CheckCircle2}
          value={totalSubmissionsCount}
          label="Submissions"
          color="green"
          onClick={() => navigate('/admin/assignments')}
        />
        <StatCard
          icon={BarChart2}
          value={`${avgCompletionRate}%`}
          label="Avg. Completion"
          color="blue"
          onClick={() => navigate('/admin/assignments')}
        />
      </div>

      {/* Courses Taught Cards Grid (Clicking one opens that course's Assignments page) */}
      {classes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-heading flex items-center gap-2">
              <Laptop className="w-5 h-5 text-brand-primary" />
              <span>Courses Taught ({classes.length})</span>
            </h2>
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateClassModalOpen(true)}
              className="text-xs"
            >
              New Course
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => {
              const classAssignments = assignments.filter((a) => a.class_id === cls.id)
              const studentsCount = cls.class_members?.length || 0
              return (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/admin/classes/${cls.id}`)}
                  className={`group p-5 rounded-2xl bg-white border shadow-card hover:shadow-card-hover transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    selectedClass?.id === cls.id
                      ? 'border-brand-primary/80 ring-2 ring-brand-primary/10'
                      : 'border-brand-line hover:border-brand-primary/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary bg-brand-light px-2.5 py-0.5 rounded-full inline-block">
                        {cls.subject || 'Course'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {classUnreadCounts[cls.id] > 0 && (
                          <NotificationBadge count={classUnreadCounts[cls.id]} />
                        )}
                        {user?.role === 'admin' && cls.admin_id === user?.id && (
                          <ActionMenu
                            label={`Actions for ${cls.name}`}
                            items={[
                              {
                                id: 'view',
                                label: 'View Class',
                                icon: Eye,
                                onClick: () => navigate(`/admin/classes/${cls.id}`),
                              },
                              {
                                id: 'edit',
                                label: 'Edit Class',
                                icon: Edit2,
                                onClick: () => setEditClassTarget(cls),
                              },
                              {
                                id: 'delete',
                                label: 'Delete Class',
                                icon: Trash2,
                                variant: 'danger',
                                dividerBefore: true,
                                onClick: () => openDeleteClassModal(cls),
                              },
                            ]}
                          />
                        )}
                      </div>
                    </div>
                    <h3 className="font-bold text-base text-brand-heading mt-2 group-hover:text-brand-primary transition-colors line-clamp-1">
                      {cls.name}
                    </h3>
                    <p className="text-xs text-brand-muted mt-1 flex items-center gap-3">
                      <span>{studentsCount} Students</span>
                      <span>•</span>
                      <span>{classAssignments.length} Assignments</span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-brand-line/60 flex items-center justify-between text-xs">
                    <span className="text-brand-primary font-semibold group-hover:underline flex items-center gap-1">
                      <span>Open Class Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Left Stream/Banner + Right Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Center 8 Columns */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Class Hero Banner */}
          {selectedClass ? (
            <div className="relative overflow-hidden rounded-2xl purple-gradient-banner p-6 text-white shadow-xl">
              <div className="relative z-10 flex flex-col justify-between min-h-[140px]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* Class Selector Dropdown if multiple classes */}
                    {classes.length > 1 ? (
                      <div className="relative inline-block max-w-full mb-1">
                        <select
                          value={selectedClass.id}
                          onChange={(e) => {
                            const found = classes.find((c) => c.id === e.target.value)
                            if (found) handleSelectClass(found)
                          }}
                          className="max-w-full bg-white/20 hover:bg-white/30 text-white font-bold text-lg sm:text-2xl rounded-lg px-2 py-1 border border-white/20 focus:outline-none cursor-pointer appearance-none pr-8 truncate"
                        >
                          {classes.map((c) => (
                            <option key={c.id} value={c.id} className="text-brand-heading">
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-5 h-5 absolute right-2 top-2 text-white pointer-events-none" />
                      </div>
                    ) : (
                      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                        {selectedClass.name}
                      </h2>
                    )}
                    <p className="text-white/80 text-sm font-medium">
                      {selectedClass.subject || 'Academic Course'}
                    </p>
                  </div>

                  <button
                    type="button"
                    title="Class Settings"
                    onClick={() => navigate('/admin/settings')}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-white/90 pt-4">
                  <span className="flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full">
                    <Users className="w-3.5 h-3.5" />
                    {currentClassStudentsCount} Students
                  </span>
                  <span className="flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full">
                    <Calendar className="w-3.5 h-3.5" />
                    Semester 2026
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/classes/${selectedClass.id}`)}
                    className="flex items-center gap-1.5 bg-white text-brand-primary px-3 py-1 rounded-full text-xs font-bold shadow-md hover:bg-slate-50 transition-all cursor-pointer ml-auto"
                  >
                    <span>Open Class Page</span>
                    {classUnreadCounts[selectedClass.id] > 0 && (
                      <NotificationBadge count={classUnreadCounts[selectedClass.id]} />
                    )}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Decorative 3D graphic badge */}
              <div className="absolute -right-4 -bottom-6 opacity-25 lg:opacity-40 pointer-events-none">
                <Laptop className="w-44 h-44 text-white" />
              </div>
            </div>
          ) : (
            /* Empty state when no classes created yet */
            <Card className="text-center py-10 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-light text-brand-primary flex items-center justify-center mx-auto">
                <FolderOpen className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-brand-heading">No classes created yet</h3>
                <p className="text-sm text-brand-muted max-w-sm mx-auto mt-1">
                  Create your first class to start assigning projects and tracking submissions.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setIsCreateClassModalOpen(true)}
                icon={Plus}
              >
                Create Class
              </Button>
            </Card>
          )}

          {/* Navigation Tabs (Stream / Classwork / People / Grades) */}
          {selectedClass && (
            <div className="border-b border-brand-line/80 flex items-center gap-6 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('stream')}
                className={`flex items-center gap-2 pb-3.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'stream'
                    ? 'border-brand-primary text-brand-primary font-bold'
                    : 'border-transparent text-brand-muted hover:text-brand-heading'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Stream</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('classwork')}
                className={`flex items-center gap-2 pb-3.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'classwork'
                    ? 'border-brand-primary text-brand-primary font-bold'
                    : 'border-transparent text-brand-muted hover:text-brand-heading'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Classwork</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('people')}
                className={`flex items-center gap-2 pb-3.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'people'
                    ? 'border-brand-primary text-brand-primary font-bold'
                    : 'border-transparent text-brand-muted hover:text-brand-heading'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>People</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('grades')}
                className={`flex items-center gap-2 pb-3.5 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'grades'
                    ? 'border-brand-primary text-brand-primary font-bold'
                    : 'border-transparent text-brand-muted hover:text-brand-heading'
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>Grades</span>
              </button>
            </div>
          )}

          {/* Tab 1: Stream View */}
          {activeTab === 'stream' && selectedClass && (
            <div className="space-y-4">
              {/* Share Announcement Input Bar */}
              <Card padding="p-4" className="shadow-xs">
                {!announcementExpanded ? (
                  <div
                    onClick={() => setAnnouncementExpanded(true)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-brand-light text-brand-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {adminDisplayName.charAt(0)}
                    </div>
                    <div className="flex-1 bg-slate-50 border border-brand-line/80 rounded-full px-4 py-2.5 text-xs sm:text-sm text-brand-muted hover:bg-white hover:border-brand-border transition-all">
                      Share an announcement with your class...
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePostAnnouncement} className="space-y-3">
                    <Textarea
                      rows={3}
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="Share an announcement with your class..."
                      autoFocus
                    />
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-brand-muted">
                        Posting to <strong className="text-brand-heading">{selectedClass.name}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAnnouncementExpanded(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          loading={isPostingAnnouncement}
                          disabled={!announcementText.trim()}
                          icon={Send}
                        >
                          Post
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </Card>

              {/* Feed: Announcements & Assignments */}
              <div className="space-y-3">
                {/* Announcements */}
                {announcements.map((ann) => (
                  <Card key={ann.id} padding="p-5" className="hover:border-brand-border transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-light text-brand-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {ann.users?.name?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-semibold text-brand-heading leading-tight">
                            {ann.users?.name || 'Prof. Anitha'}
                          </p>
                          <span className="text-[11px] text-brand-muted">
                            {formatTimeAgo(ann.created_at)}
                          </span>
                        </div>
                      </div>
                      <Badge variant="purple" size="sm">Announcement</Badge>
                    </div>

                    <p className="mt-3 text-xs sm:text-sm text-brand-body leading-relaxed whitespace-pre-line">
                      {ann.message}
                    </p>
                  </Card>
                ))}

                {/* Assignments in Stream */}
                {currentClassAssignments.map((assignment) => (
                  <Card
                    key={assignment.id}
                    padding="p-5"
                    className="hover:border-brand-border transition-all cursor-pointer"
                    onClick={() => navigate(`/admin/assignments`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-brand-primary flex items-center justify-center shrink-0 mt-0.5">
                          <ClipboardList className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-brand-heading truncate">
                            New Assignment: {assignment.title}
                          </h4>
                          <p className="text-xs text-brand-muted mt-0.5 line-clamp-2">
                            {assignment.description || 'No description provided.'}
                          </p>
                        </div>
                      </div>

                      {assignment.due_date && (
                        <div className="shrink-0 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200/50">
                            <Clock className="w-3.5 h-3.5" />
                            Due {assignment.due_date}
                          </span>
                        </div>
                      )}
                    </div>

                    {assignment.drive_link && (
                      <div className="mt-4 pt-3 border-t border-brand-line/60 flex items-center justify-between">
                        <span className="text-xs text-brand-muted">External Reference Drive</span>
                        <a
                          href={assignment.drive_link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline bg-brand-light px-2.5 py-1 rounded-lg"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open in Drive</span>
                        </a>
                      </div>
                    )}
                  </Card>
                ))}

                {announcements.length === 0 && currentClassAssignments.length === 0 && (
                  <div className="text-center py-8 text-xs text-brand-muted bg-white rounded-card border border-brand-line/70">
                    No posts or assignments in this stream yet. Click "+ Create" to get started!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Classwork View */}
          {activeTab === 'classwork' && selectedClass && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-brand-heading">Classwork & Materials</h3>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => navigate('/admin/assignments/create')}
                >
                  Create Assignment
                </Button>
              </div>

              <div className="space-y-3">
                {currentClassAssignments.map((a) => (
                  <Card key={a.id} padding="p-4" className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center shrink-0">
                        <ClipboardList className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-heading truncate">{a.title}</p>
                        <p className="text-xs text-brand-muted">
                          {a.points} Points • Due {a.due_date || 'No deadline'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {a.status === 'archived' && (
                        <Badge variant="neutral" size="sm">
                          Archived
                        </Badge>
                      )}
                      <Badge variant="purple" size="sm">
                        {a.submissions?.length || 0} Submissions
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(`/admin/assignments/${a.id}`, {
                            state: { from: 'class', classId: selectedClass?.id, tab: 'assignments' },
                          })
                        }
                      >
                        Track
                      </Button>
                      {user?.role === 'admin' && a.admin_id === user?.id && (
                        <ActionMenu
                          label={`Actions for ${a.title}`}
                          items={[
                            {
                              id: 'view',
                              label: 'View Submissions',
                              icon: Eye,
                              onClick: () =>
                                navigate(`/admin/assignments/${a.id}`, {
                                  state: { from: 'class', classId: selectedClass?.id, tab: 'assignments' },
                                }),
                            },
                            {
                              id: 'edit',
                              label: 'Edit Assignment',
                              icon: Edit2,
                              onClick: () => navigate(`/admin/assignments/${a.id}/edit`),
                            },
                            a.status === 'archived'
                              ? {
                                  id: 'restore',
                                  label: 'Restore Assignment',
                                  icon: RotateCcw,
                                  onClick: () => handleRestoreAssignment(a),
                                }
                              : {
                                  id: 'archive',
                                  label: 'Archive Assignment',
                                  icon: Archive,
                                  variant: 'warning',
                                  onClick: () => handleConfirmArchiveAssignment(a),
                                },
                            {
                              id: 'delete',
                              label: 'Delete Assignment',
                              icon: Trash2,
                              variant: 'danger',
                              dividerBefore: true,
                              onClick: () => openDeleteAssignmentModal(a),
                            },
                          ]}
                        />
                      )}
                    </div>
                  </Card>
                ))}

                {currentClassAssignments.length === 0 && (
                  <div className="text-center py-8 text-xs text-brand-muted bg-white rounded-card border border-brand-line/70">
                    No assignments published yet for this class.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: People View */}
          {activeTab === 'people' && selectedClass && (
            <div className="space-y-5">
              {/* Teacher section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted mb-2">
                  Teachers
                </h4>
                <Card padding="p-3.5" className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-primary text-white font-bold text-xs flex items-center justify-center">
                      {adminDisplayName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-brand-heading">{adminDisplayName}</p>
                      <p className="text-xs text-brand-muted">{user?.email}</p>
                    </div>
                  </div>
                  <Badge variant="purple" size="sm">Course Admin</Badge>
                </Card>
              </div>

              {/* Classmates / Students section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                    Students ({currentClassStudentsCount})
                  </h4>
                  <Button
                    variant="light"
                    size="sm"
                    icon={Plus}
                    onClick={() => navigate('/admin/students')}
                  >
                    Manage Roster
                  </Button>
                </div>

                <div className="space-y-2">
                  {selectedClass.class_members?.map((member) => (
                    <Card key={member.id} padding="p-3" className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center">
                          {member.users?.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-semibold text-brand-heading">
                            {member.users?.name || 'Student'}
                          </p>
                          <p className="text-[11px] text-brand-muted">{member.users?.email}</p>
                        </div>
                      </div>
                      <Badge variant="neutral" size="sm">Enrolled</Badge>
                    </Card>
                  ))}

                  {currentClassStudentsCount === 0 && (
                    <div className="text-center py-6 text-xs text-brand-muted bg-white rounded-card border border-brand-line/70">
                      No students enrolled yet. Navigate to Students Management to add students.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Grades View */}
          {activeTab === 'grades' && selectedClass && (
            <Card padding="p-5" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-brand-heading">Class Gradebook</h3>
                  <p className="text-xs text-brand-muted">Overall performance and submission records</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/admin/grades')}
                >
                  Open Full Gradebook
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-brand-bg border border-brand-line flex items-center justify-between">
                <span className="text-xs font-medium text-brand-heading">Class Completion</span>
                <span className="text-base font-bold text-brand-primary">{currentClassCompletion}%</span>
              </div>
            </Card>
          )}

        </div>

        {/* Right 4 Columns: Actions, Upcoming, Insights */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Solid Purple "+ Create" Button with Dropdown */}
          <div className="relative" ref={createDropdownRef}>
            <div className="flex rounded-xl shadow-purple-glow">
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-between px-5 font-semibold"
                onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
              >
                <span className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  <span>Create</span>
                </span>
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {createDropdownOpen && (
              <div className="absolute right-0 left-0 mt-2 bg-white rounded-2xl shadow-modal border border-brand-line py-2 z-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    setCreateDropdownOpen(false)
                    navigate('/admin/assignments/create')
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-medium text-brand-heading hover:bg-brand-activeNav flex items-center gap-3 cursor-pointer"
                >
                  <ClipboardList className="w-4 h-4 text-brand-primary" />
                  <span>Assignment</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreateDropdownOpen(false)
                    setIsCreateClassModalOpen(true)
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-medium text-brand-heading hover:bg-brand-activeNav flex items-center gap-3 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-brand-primary" />
                  <span>New Class</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreateDropdownOpen(false)
                    setActiveTab('stream')
                    setAnnouncementExpanded(true)
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-medium text-brand-heading hover:bg-brand-activeNav flex items-center gap-3 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-brand-primary" />
                  <span>Announcement</span>
                </button>
              </div>
            )}
          </div>

          {/* Upcoming Widget */}
          <Card padding="p-5" className="space-y-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-brand-heading">
                <Calendar className="w-4 h-4 text-brand-primary" />
                <span>Upcoming</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/assignments')}
                className="text-xs font-semibold text-brand-primary hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="space-y-3">
              {upcomingAssignments.map((item) => (
                <div
                  key={item.id}
                  onClick={() =>
                    navigate(`/admin/assignments/${item.id}`, {
                      state: { from: 'dashboard', classId: item.class_id },
                    })
                  }
                  className="p-3 rounded-xl bg-slate-50 border-l-4 border-l-brand-primary border-y border-r border-brand-line/60 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <h5 className="text-xs font-semibold text-brand-heading truncate">
                    {item.title}
                  </h5>
                  <p className="text-[11px] text-brand-muted mt-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Due {item.due_date}, {item.due_time?.substring(0, 5) || '23:59'}
                  </p>
                </div>
              ))}

              {upcomingAssignments.length === 0 && (
                <p className="text-xs text-brand-muted text-center py-4">
                  No upcoming deadlines right now.
                </p>
              )}
            </div>
          </Card>

          {/* Class Insights Widget */}
          <Card padding="p-5" className="space-y-4 shadow-card">
            <div className="flex items-center gap-2 font-bold text-sm text-brand-heading">
              <BarChart2 className="w-4 h-4 text-brand-primary" />
              <span>Class Insights</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-brand-line/60">
                <div className="text-xl font-extrabold text-brand-heading">
                  {currentClassStudentsCount}
                </div>
                <div className="text-[11px] font-medium text-brand-muted mt-0.5">
                  Students
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-brand-line/60">
                <div className="text-xl font-extrabold text-brand-heading">
                  {classSubmissionsCount}
                </div>
                <div className="text-[11px] font-medium text-brand-muted mt-0.5">
                  Submitted
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-brand-line/60">
                <div className="text-xl font-extrabold text-brand-primary">
                  {currentClassCompletion}%
                </div>
                <div className="text-[11px] font-medium text-brand-muted mt-0.5">
                  Completion
                </div>
              </div>
            </div>
          </Card>

        </div>

      </div>

      {/* Modal: Create Class */}
      <Modal
        isOpen={isCreateClassModalOpen}
        onClose={() => setIsCreateClassModalOpen(false)}
        title="Create New Class"
        subtitle="Set up a new class to start creating assignments and adding students."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsCreateClassModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={creatingClass}
              onClick={handleCreateClassSubmit}
            >
              Create Class
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateClassSubmit} className="space-y-4">
          <Input
            label="Class Name"
            placeholder="e.g. MCA – Semester 5"
            required
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          />

          <Input
            label="Subject / Code"
            placeholder="e.g. Computer Applications"
            value={newClassSubject}
            onChange={(e) => setNewClassSubject(e.target.value)}
          />

          <Textarea
            label="Description"
            placeholder="Brief overview of the syllabus or class objectives..."
            rows={3}
            value={newClassDescription}
            onChange={(e) => setNewClassDescription(e.target.value)}
          />
        </form>
      </Modal>

      {/* Modal: Edit Class */}
      <EditClassModal
        isOpen={Boolean(editClassTarget)}
        onClose={() => setEditClassTarget(null)}
        classData={editClassTarget}
        onSuccess={() => loadDashboardData({ force: true })}
      />

      {/* Modal: Safe Delete Class Confirmation */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteClassTarget)}
        onClose={() => {
          setDeleteClassTarget(null)
          setClassDeleteError('')
        }}
        entityLabel="Class"
        entityName={deleteClassTarget?.name || ''}
        entityMeta={deleteClassTarget?.class_code ? `Code: ${deleteClassTarget.class_code}` : ''}
        impactLoading={classImpactLoading}
        stats={
          classImpact
            ? [
                { label: 'Students', value: classImpact.studentsCount, highlight: classImpact.studentsCount > 0 },
                { label: 'Assignments', value: classImpact.assignmentsCount, highlight: classImpact.assignmentsCount > 0 },
                { label: 'Groups', value: classImpact.groupsCount, highlight: classImpact.groupsCount > 0 },
                { label: 'Submissions', value: classImpact.totalSubmissionsCount, highlight: classImpact.totalSubmissionsCount > 0 },
                { label: 'Graded Records', value: classImpact.totalGradedCount, highlight: classImpact.totalGradedCount > 0 },
              ]
            : []
        }
        canPermanentDelete={Boolean(classImpact?.canPermanentDelete)}
        blockReason="This class contains enrolled students, assignments, groups, or recorded submissions/grades. Permanent deletion is disabled so Round 1 and Round 2 historical records remain intact."
        requireTypedDelete
        loading={classDeleteLoading}
        error={classDeleteError}
        onConfirmDelete={handleConfirmDeleteClass}
      />

      {/* Modal: Safe Delete / Archive Assignment Confirmation */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteAssignmentTarget)}
        onClose={() => {
          setDeleteAssignmentTarget(null)
          setAssignmentActionError('')
        }}
        entityLabel="Assignment"
        entityName={deleteAssignmentTarget?.title || ''}
        entityMeta={deleteAssignmentTarget?.submission_type === 'group' ? 'Group Assignment' : 'Individual Assignment'}
        impactLoading={assignmentImpactLoading}
        stats={
          assignmentImpact
            ? [
                { label: 'Individual Subs', value: assignmentImpact.individualSubmissionsCount, highlight: assignmentImpact.individualSubmissionsCount > 0 },
                { label: 'Group Subs', value: assignmentImpact.groupSubmissionsCount, highlight: assignmentImpact.groupSubmissionsCount > 0 },
                { label: 'Graded Records', value: assignmentImpact.totalGradedCount, highlight: assignmentImpact.totalGradedCount > 0 },
              ]
            : []
        }
        canPermanentDelete={Boolean(assignmentImpact?.canPermanentDelete)}
        blockReason="Student or group submissions and grades have already been recorded for this assignment. Archive it instead to protect academic history."
        archiveSupported={deleteAssignmentTarget?.status !== 'archived'}
        archiveLabel="Archive Assignment"
        loading={assignmentActionLoading}
        error={assignmentActionError}
        onConfirmArchive={() => handleConfirmArchiveAssignment(deleteAssignmentTarget)}
        onConfirmDelete={handleConfirmDeleteAssignment}
      />
    </div>
  )
}

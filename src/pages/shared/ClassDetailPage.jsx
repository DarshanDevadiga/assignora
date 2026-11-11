import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  Users,
  ClipboardList,
  CheckSquare,
  BarChart2,
  FolderOpen,
  History,
  Plus,
  UserPlus,
  Copy,
  Check,
  Send,
  Eye,
  ExternalLink,
  Trash2,
  MoreVertical,
  Calendar,
  Clock,
  Sparkles,
  Award,
  AlertCircle,
  FileText,
  Megaphone,
  Download,
  KeyRound,
  Shield,
  GraduationCap,
  MessageSquare,
  Search,
  Crown
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { classesService } from '../../services/classes.service'
import { submissionsService } from '../../services/submissions.service'
import { announcementsService } from '../../services/announcements.service'
import { messagesService, addMessageOnce, addOrUpdateMessage, mergeMessages } from '../../services/messages.service'
import { notificationsService } from '../../services/notifications.service'
import { useNotifications } from '../../context/NotificationContext'
import { supabase } from '../../lib/supabase.js'
import {
  calculateCompletionRate,
  isOverdue,
  formatDisplayDate,
  formatDeadlineBadge,
  calculateLetterGrade,
  formatMessageDateSeparator,
  formatMessageTime,
  isDifferentDay,
  sanitizeUrl,
} from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { Input, Textarea } from '../../components/common/Input'
import NotificationBadge from '../../components/common/NotificationBadge'
import InviteStudentModal from '../../components/class/InviteStudentModal'
import StudentProfileModal from '../../components/class/StudentProfileModal'
import TwoStepSubmissionModal from '../../components/student/TwoStepSubmissionModal'
import ClassGroupsTab from '../../components/class/ClassGroupsTab'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'people', label: 'People', icon: GraduationCap },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'resources', label: 'Resources', icon: FolderOpen },
]

export default function ClassDetailPage() {
  const { id: classId } = useParams()
  const { user } = useAuth()
  const { classUnreadCounts = {}, markClassAsRead } = useNotifications()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const role = user?.role === 'admin' ? 'admin' : 'student'
  const isTeacher = role === 'admin'

  const activeTab = searchParams.get('tab') || 'overview'
  const setActiveTab = (tabId) => {
    setSearchParams({ tab: tabId })
  }

  // Core Data States
  const [currentClass, setCurrentClass] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [activities, setActivities] = useState([])
  const [resources, setResources] = useState([])
  const [messages, setMessages] = useState([])
  const [newMessageText, setNewMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [lastReadTimestamp, setLastReadTimestamp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [classRoster, setClassRoster] = useState({ instructor: null, students: [], total_students: 0 })
  const [peopleFilter, setPeopleFilter] = useState('all') // all, leaders, inGroup, noGroup
  const [peopleSearch, setPeopleSearch] = useState('')

  // Modals & Action States
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState(null)
  const [studentToRemove, setStudentToRemove] = useState(null)
  const [removingStudent, setRemovingStudent] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Teacher Inline Announcement Composer
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementMsg, setAnnouncementMsg] = useState('')
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)

  // Teacher Grading Modal / Action State
  const [gradingSubmission, setGradingSubmission] = useState(null)
  const [gradeScore, setGradeScore] = useState('')
  const [gradeFeedback, setGradeFeedback] = useState('')
  const [savingGrade, setSavingGrade] = useState(false)

  // Student Submission Modal
  const [submittingAssignment, setSubmittingAssignment] = useState(null)

  // Add Resource Modal (Teacher)
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false)
  const [resTitle, setResTitle] = useState('')
  const [resUrl, setResUrl] = useState('')
  const [resCategory, setResCategory] = useState('Learning Materials')

  // Menu toggles
  const [activeMenuMemberId, setActiveMenuMemberId] = useState(null)

  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const refreshClassDetails = () => setRefreshTrigger((prev) => prev + 1)

  // Stable references for realtime listener closures to prevent stale state and unnecessary channel reconnects
  const userRef = useRef(user)
  const currentClassRef = useRef(currentClass)
  const activeTabRef = useRef(activeTab)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    currentClassRef.current = currentClass
  }, [currentClass])

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Resolve sender metadata (name, role, avatar) accurately from class roster and teacher info
  const resolveSenderProfile = useCallback((senderId) => {
    if (!senderId) return { name: 'Member', role: 'student', avatar: null }

    const currentUser = userRef.current
    if (currentUser && currentUser.id === senderId) {
      return {
        name: currentUser.name || 'You',
        role: currentUser.role || 'student',
        avatar: currentUser.avatar || null,
      }
    }

    const cls = currentClassRef.current
    if (cls) {
      // Check if sender is class instructor/admin
      if (cls.admin_id === senderId || cls.users?.id === senderId) {
        return {
          name: cls.users?.name || 'Professor',
          role: 'admin',
          avatar: cls.users?.avatar || null,
        }
      }
      // Check if sender is an enrolled student member
      const member = cls.class_members?.find(
        (m) => m.student_id === senderId || m.users?.id === senderId
      )
      if (member?.users) {
        return {
          name: member.users.name || 'Student',
          role: member.users.role || 'student',
          avatar: member.users.avatar || null,
        }
      }
    }

    return { name: 'Student', role: 'student', avatar: null }
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function loadData() {
      if (!classId) return
      // Wait until user session is resolved to evaluate permissions
      if (!user?.id) return

      try {
        setLoading(true)
        setError(null)

        // 1. Fetch class details with members and assignments
        const cls = await classesService.getClassById(classId)
        if (isCancelled) return

        if (!cls) {
          setError('Class not found.')
          setCurrentClass(null)
          return
        }

        // 1b. Verify role-based access authorization
        if (isTeacher) {
          // Allow class owner or global administrator
          if (cls.admin_id !== user.id && user.role !== 'admin') {
            setError('You do not have administrative permission to view this class.')
            setCurrentClass(null)
            return
          }
        } else {
          // Verify student is enrolled in this class
          const isEnrolled = cls.class_members?.some((m) => m.student_id === user.id)
          if (!isEnrolled) {
            setError('You are not currently enrolled in this class. Please join using an invitation link or valid class code.')
            setCurrentClass(null)
            return
          }
        }

        setCurrentClass(cls)

        // 2. Fetch class sub-resources in parallel for maximum speed & resilience
        const [subsRes, annRes, actsRes, resRes, msgsRes, rosterRes] = await Promise.allSettled([
          submissionsService.getClassSubmissions(classId),
          announcementsService.getClassAnnouncements(classId),
          classesService.getClassActivity(classId),
          classesService.getClassResources(classId),
          messagesService.getClassMessages(classId),
          classesService.getClassRoster(classId),
        ])

        if (isCancelled) return

        if (rosterRes.status === 'fulfilled' && rosterRes.value) {
          setClassRoster(rosterRes.value)
        }

        if (subsRes.status === 'fulfilled') {
          setSubmissions(subsRes.value || [])
        } else {
          console.warn('[ClassDetailPage] Could not load submissions:', subsRes.reason)
        }

        if (annRes.status === 'fulfilled') {
          setAnnouncements(annRes.value || [])
        } else {
          console.warn('[ClassDetailPage] Could not load announcements:', annRes.reason)
        }

        if (actsRes.status === 'fulfilled') {
          setActivities(actsRes.value || [])
        } else {
          console.warn('[ClassDetailPage] Could not load activities:', actsRes.reason)
        }

        if (resRes.status === 'fulfilled') {
          setResources(resRes.value || [])
        } else {
          console.warn('[ClassDetailPage] Could not load resources:', resRes.reason)
        }

        if (msgsRes.status === 'fulfilled') {
          setMessages((prev) => mergeMessages(prev, msgsRes.value || []))
        } else {
          console.warn('[ClassDetailPage] Could not load messages:', msgsRes.reason)
        }

        const prevRead = messagesService.getLastReadTimestamp(classId, user.id)
        setLastReadTimestamp(prevRead)
      } catch (err) {
        if (!isCancelled) {
          console.error('[ClassDetailPage] Error loading class details:', err)
          setError(err.message || 'Failed to load class information.')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isCancelled = true
    }
  }, [classId, user?.id, isTeacher, refreshTrigger])

  // Clear unread badge whenever user opens or is on messages tab
  useEffect(() => {
    if (activeTab === 'messages' && classId && markClassAsRead) {
      markClassAsRead(classId)
    }
  }, [activeTab, classId, markClassAsRead])

  // Listen for realtime broadcast messages
  useEffect(() => {
    if (!classId) return

    let isSubscribed = true
    let classChannel = null

    // Clean up any pre-existing channel for this specific class
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:class-discussion:${classId}`)
    if (existing) {
      supabase.removeChannel(existing)
    }

    // Configure channel with self: false so sender never receives self-broadcast echo
    const channel = supabase.channel(`class-discussion:${classId}`, {
      config: { broadcast: { self: false } },
    })
    classChannel = channel

    const handleBroadcast = ({ event, payload }) => {
      if (!isSubscribed) return
      if (event === 'class-message' && payload?.classId === classId && payload?.message) {
        // Ignore self-broadcast if senderId matches current user (sender handles own state update on send completion)
        if (payload.senderId && payload.senderId === userRef.current?.id) return

        setMessages((prev) => addOrUpdateMessage(prev, payload.message))
        if (activeTabRef.current === 'messages' && markClassAsRead) {
          markClassAsRead(classId)
        }
      }
    }

    channel.on('broadcast', { event: '*' }, handleBroadcast)

    // Also listen to database-level INSERT events on class_messages for real-time Postgres synchronization
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'class_messages',
        filter: `class_id=eq.${classId}`,
      },
      (payload) => {
        if (!isSubscribed || !payload?.new) return
        const newRow = payload.new
        const profileInfo = resolveSenderProfile(newRow.sender_id)

        const incomingMsg = {
          id: newRow.id,
          classId: newRow.class_id,
          senderId: newRow.sender_id,
          senderName: profileInfo.name,
          senderRole: profileInfo.role,
          senderAvatar: profileInfo.avatar,
          text: newRow.message,
          createdAt: newRow.created_at,
          isDiscussion: true,
        }
        setMessages((prev) => addOrUpdateMessage(prev, incomingMsg))
        if (activeTabRef.current === 'messages' && markClassAsRead) {
          markClassAsRead(classId)
        }
      }
    )

    channel.subscribe((status, error) => {
      if (!isSubscribed) return
      if (status === 'CHANNEL_ERROR') {
        console.warn(`[ClassDetailPage] Realtime channel error for class ${classId}:`, error)
      }
    })

    // Also register with messagesService in-memory bus for instant same-client updates
    const unsubscribeBus = messagesService.subscribe(({ event, payload }) => {
      handleBroadcast({ event, payload })
    })

    return () => {
      isSubscribed = false
      unsubscribeBus()
      if (classChannel) {
        // Use official Supabase Realtime cleanup API
        supabase.removeChannel(classChannel)
        classChannel = null
      }
    }
  }, [classId, markClassAsRead, resolveSenderProfile])

  // Copy Enrolment Code Shortcut
  const handleCopyCode = async () => {
    if (!currentClass) return
    const code = `CLS-${classesService.getClassCode(currentClass)}`
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  // Teacher Remove Student with Real DB Confirmation
  const handleConfirmRemoveStudent = async () => {
    if (!studentToRemove) return
    try {
      setRemovingStudent(true)
      await classesService.removeMember(studentToRemove.id)

      // Update state immediately
      setCurrentClass((prev) => ({
        ...prev,
        class_members: prev.class_members.filter((m) => m.id !== studentToRemove.id),
      }))

      // Reload activities
      const acts = await classesService.getClassActivity(classId)
      setActivities(acts)

      setStudentToRemove(null)
    } catch (err) {
      console.error('[ClassDetailPage] Error removing student:', err)
      alert(err.message || 'Failed to remove student.')
    } finally {
      setRemovingStudent(false)
    }
  }

  // Teacher Post Announcement
  const handlePostAnnouncement = async (e) => {
    e.preventDefault()
    if (!announcementTitle.trim() || !announcementMsg.trim() || !user?.id) return

    try {
      setPostingAnnouncement(true)
      const created = await announcementsService.createAnnouncement({
        title: announcementTitle.trim(),
        message: announcementMsg.trim(),
        class_id: classId,
        admin_id: user.id,
      })

      setAnnouncements([created, ...announcements])
      setAnnouncementTitle('')
      setAnnouncementMsg('')

      // Refresh activity timeline
      const acts = await classesService.getClassActivity(classId)
      setActivities(acts)

      // Notify class members in real-time
      await notificationsService.notifyClassMembers({
        classId,
        excludeUserId: user.id,
        title: `Announcement in ${currentClass?.name || 'Class'}`,
        message: announcementTitle.trim(),
        type: 'announcement',
        referenceId: classId,
      })
    } catch (err) {
      console.error('[ClassDetailPage] Error posting announcement:', err)
      alert(err.message || 'Failed to post announcement.')
    } finally {
      setPostingAnnouncement(false)
    }
  }

  // Teacher Save Grade & Feedback
  const handleSaveGrade = async (e) => {
    e.preventDefault()
    if (!gradingSubmission) return

    try {
      setSavingGrade(true)
      const updated = await submissionsService.gradeSubmission(gradingSubmission.id, {
        grade: Number(gradeScore),
        feedback: gradeFeedback.trim(),
      })

      // Update local submissions state
      setSubmissions((prev) =>
        prev.map((s) => (s.id === gradingSubmission.id ? { ...s, ...updated, grade: Number(gradeScore), feedback: gradeFeedback.trim() } : s))
      )

      // Refresh activity
      const acts = await classesService.getClassActivity(classId)
      setActivities(acts)

      // Notify the student that their submission has been graded
      await messagesService.broadcast('notification', {
        userId: gradingSubmission.student_id,
        title: `Grade Posted: ${gradingSubmission.assignments?.title || 'Assignment'}`,
        message: `Your instructor awarded ${Number(gradeScore)} pts. Feedback: "${gradeFeedback.trim() || 'Good job'}"`,
        type: 'submission',
        referenceId: gradingSubmission.assignment_id,
        created_at: new Date().toISOString(),
      })

      setGradingSubmission(null)
      setGradeScore('')
      setGradeFeedback('')
    } catch (err) {
      console.error('[ClassDetailPage] Error saving grade:', err)
      alert(err.message || 'Failed to save grade.')
    } finally {
      setSavingGrade(false)
    }
  }

  // Teacher Add Resource
  const handleAddResource = (e) => {
    e.preventDefault()
    if (!resTitle.trim() || !resUrl.trim()) return

    const newRes = {
      id: `custom-res-${Date.now()}`,
      title: resTitle.trim(),
      url: resUrl.trim(),
      type: resUrl.includes('drive.google') ? 'drive' : 'link',
      addedAt: new Date().toISOString(),
      category: resCategory,
    }

    setResources([newRes, ...resources])
    setResTitle('')
    setResUrl('')
    setIsAddResourceOpen(false)
  }

  // Send New Message in Class Discussion
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (sendingMessage) return
    const textToSend = newMessageText.trim()
    if (!textToSend || !user?.id || !currentClass) return

    try {
      setSendingMessage(true)
      setNewMessageText('') // Clear immediately to prevent double submissions

      const createdMsg = await messagesService.sendMessage({
        classId,
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        senderAvatar: user.avatar || '',
        text: textToSend,
      })

      if (createdMsg) {
        setMessages((prev) => addOrUpdateMessage(prev, createdMsg))
      }

      // Notify other class members (teachers and students)
      await notificationsService.notifyClassMembers({
        classId,
        excludeUserId: user.id,
        title: `New Discussion Message in ${currentClass.name}`,
        message: `${user.name || 'Member'}: "${createdMsg.text.slice(0, 80)}"`,
        type: 'announcement',
        referenceId: classId,
      })
    } catch (err) {
      console.error('[ClassDetailPage] Error sending message:', err)
      // Restore input text on error so user doesn't lose typed message
      setNewMessageText(textToSend)
      alert(err.message || 'Failed to send message.')
    } finally {
      setSendingMessage(false)
    }
  }

  // Derived metrics
  const classCode = currentClass ? classesService.getClassCode(currentClass) : ''
  const members = classRoster.students?.length > 0 ? classRoster.students : (currentClass?.class_members || [])
  const totalEnrolledStudents = classRoster.total_students || members.length
  const assignments = currentClass?.assignments || []

  // People tab filtering and metrics
  const filteredStudents = useMemo(() => {
    return members.filter((s) => {
      if (peopleFilter === 'leaders' && !s.is_leader) return false
      if (peopleFilter === 'inGroup' && !s.group_name) return false
      if (peopleFilter === 'noGroup' && s.group_name) return false

      if (peopleSearch.trim()) {
        const q = peopleSearch.toLowerCase().trim()
        const matchName = (s.name || '').toLowerCase().includes(q)
        const matchEmail = (s.email || '').toLowerCase().includes(q)
        const matchGroup = (s.group_name || '').toLowerCase().includes(q)
        return matchName || matchEmail || matchGroup
      }
      return true
    })
  }, [members, peopleFilter, peopleSearch])

  const leaderCount = useMemo(() => members.filter((s) => s.is_leader).length, [members])
  const inGroupCount = useMemo(() => members.filter((s) => s.group_name).length, [members])
  const withoutGroupCount = useMemo(() => members.filter((s) => !s.group_name).length, [members])

  // Student specific data
  const mySubmissions = useMemo(() => {
    if (isTeacher) return []
    return submissions.filter((s) => s.student_id === user?.id)
  }, [submissions, isTeacher, user?.id])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 rounded-3xl bg-slate-200" />
        <div className="h-12 w-96 rounded-xl bg-slate-200" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 rounded-2xl bg-slate-200 col-span-2" />
          <div className="h-64 rounded-2xl bg-slate-200" />
        </div>
      </div>
    )
  }

  if (error || !currentClass) {
    return (
      <Card className="text-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-brand-heading">Class Not Found</h3>
        <p className="text-sm text-brand-muted max-w-md mx-auto">
          {error || "The requested class does not exist or you don't have permission to access it."}
        </p>
        <Button
          variant="primary"
          onClick={() => navigate(isTeacher ? '/admin/classes' : '/student/classes')}
          className="shadow-purple-glow font-semibold"
        >
          Back to My Classes
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* =========================================================================
          HERO CLASS HEADER BANNER (Google Classroom + Modern Purple Gradient)
      ========================================================================= */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-700 via-indigo-700 to-brand-primary p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-xs px-3 py-1 rounded-full text-white">
                {currentClass.subject || 'Course'}
              </span>
              <span className="text-xs text-white/80 font-medium">
                • {totalEnrolledStudents} Enrolled {totalEnrolledStudents === 1 ? 'Student' : 'Students'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              {currentClass.name}
            </h1>

            {currentClass.description && (
              <p className="text-xs sm:text-sm text-white/85 line-clamp-2 max-w-xl">
                {currentClass.description}
              </p>
            )}
          </div>

          {/* Quick Enrolment Pill & Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Class Code Pill */}
            <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 text-white">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70 block">
                  Class Code
                </span>
                <span className="font-mono text-base font-black tracking-wider text-white">
                  CLS-{classCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy Class Code"
                className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Teacher Actions */}
            {isTeacher && (
              <Button
                variant="white"
                icon={UserPlus}
                onClick={() => setIsInviteOpen(true)}
                className="font-bold text-brand-primary shadow-lg"
              >
                Invite Students
              </Button>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* =========================================================================
          CLASS NAVIGATION TABS (Overview, Assignments, Submissions, Grades, Resources, History, People)
      ========================================================================= */}
      <div className="flex items-center gap-1.5 border-b border-brand-line overflow-x-auto pb-0.5 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-brand-primary text-brand-primary bg-brand-activeNav/60 rounded-t-xl'
                  : 'border-transparent text-brand-muted hover:text-brand-heading hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-primary' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.id === 'messages' && classUnreadCounts[classId] > 0 && (
                <NotificationBadge count={classUnreadCounts[classId]} className="ml-1" />
              )}
              {tab.id === 'assignments' && assignments.length > 0 && (
                <span className="text-[10px] bg-brand-light text-brand-primary px-1.5 py-0.2 rounded-full font-bold">
                  {assignments.length}
                </span>
              )}
              {tab.id === 'people' && totalEnrolledStudents > 0 && (
                <span className="text-[10px] bg-slate-100 text-brand-muted px-1.5 py-0.2 rounded-full font-bold">
                  {totalEnrolledStudents}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW
      ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Announcements Stream & Teacher Composer */}
          <div className="lg:col-span-8 space-y-6">
            {/* Teacher Announcement Composer */}
            {isTeacher && (
              <Card className="space-y-4 shadow-card">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center font-bold">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-brand-heading">
                      Announce something to your class
                    </h3>
                    <p className="text-[11px] text-brand-muted">
                      Post updates, reminders, or academic guidelines
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePostAnnouncement} className="space-y-3">
                  <Input
                    placeholder="Announcement Title..."
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    required
                  />
                  <Textarea
                    placeholder="Type your announcement or instructions for the class..."
                    value={announcementMsg}
                    onChange={(e) => setAnnouncementMsg(e.target.value)}
                    rows={3}
                    required
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      loading={postingAnnouncement}
                      disabled={!announcementTitle.trim() || !announcementMsg.trim() || postingAnnouncement}
                      icon={Send}
                      className="shadow-purple-glow font-semibold"
                    >
                      Post to Class
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {/* Class Announcements Feed */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-brand-heading flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-brand-primary" />
                  <span>Class Announcements ({announcements.length})</span>
                </h3>
              </div>

              {announcements.length > 0 ? (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <Card key={ann.id} padding="p-5" className="space-y-3 shadow-card hover:border-brand-border transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-brand-light text-brand-primary flex items-center justify-center font-bold text-sm">
                            {ann.users?.name?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-brand-heading">{ann.title}</h4>
                            <span className="text-[11px] text-brand-muted">
                              {ann.users?.name || 'Instructor'} • {formatDisplayDate(ann.created_at)}
                            </span>
                          </div>
                        </div>
                        <Badge variant="primary" size="sm">
                          Announcement
                        </Badge>
                      </div>
                      <p className="text-xs text-brand-body whitespace-pre-line leading-relaxed">
                        {ann.message}
                      </p>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-10 space-y-2">
                  <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-brand-muted">
                    No announcements posted in this class yet.
                  </p>
                </Card>
              )}
            </div>
          </div>

          {/* Right Column (4 cols): Teacher Card & Recent Activity */}
          <div className="lg:col-span-4 space-y-6">
            {/* Instructor Card */}
            <Card padding="p-5" className="space-y-4 shadow-card">
              <h3 className="text-xs font-bold text-brand-heading uppercase tracking-wider">
                Course Instructor
              </h3>
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-hover text-white flex items-center justify-center font-bold text-base shadow-purple-glow">
                  {currentClass.users?.avatar ? (
                    <img src={currentClass.users.avatar} alt={currentClass.users?.name || 'Instructor'} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <span>{currentClass.users?.name?.charAt(0) || 'P'}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-brand-heading truncate">
                    {currentClass.users?.name || 'Prof. Anitha R.'}
                  </h4>
                  <p className="text-xs text-brand-muted truncate">
                    {currentClass.users?.email || 'admin@assignora.demo'}
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-semibold text-brand-primary bg-brand-light px-2 py-0.5 rounded-full">
                    Lead Faculty
                  </span>
                </div>
              </div>
            </Card>

            {/* Recent Activity Widget */}
            <Card padding="p-5" className="space-y-4 shadow-card">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-brand-heading uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Recent Class Activity</span>
                </h3>
                <span className="text-[11px] font-semibold text-brand-muted">
                  Latest updates
                </span>
              </div>

              {activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.slice(0, 5).map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 text-xs">
                      <div className="w-2 h-2 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-brand-heading font-medium truncate">{act.title}</p>
                        <span className="text-[10px] text-brand-muted">{formatDisplayDate(act.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-brand-muted">No recent activity logged.</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DISCUSSION / MESSAGES (WhatsApp-style real-time class chat)
      ========================================================================= */}
      {activeTab === 'messages' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-primary" />
                <span>Class Discussion & Messages ({messages.length})</span>
              </h3>
              <p className="text-xs text-brand-muted">
                Real-time collaborative discussion thread for all students and faculty in {currentClass.name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Channel Connected
              </span>
            </div>
          </div>

          {/* Messages Thread Container */}
          <Card padding="p-5 sm:p-6" className="shadow-card space-y-4 min-h-[360px] flex flex-col justify-between">
            {/* Messages List */}
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2">
              {messages.length > 0 ? (
                messages.map((msg, idx) => {
                  const currentMsgDate = msg.createdAt || msg.created_at
                  const prevMsgDate = idx > 0 ? (messages[idx - 1].createdAt || messages[idx - 1].created_at) : null
                  const showDateSeparator = idx === 0 || isDifferentDay(prevMsgDate, currentMsgDate)

                  const isMe = msg.senderId === user?.id
                  const isTeacherSender = msg.senderRole === 'admin'
                  const isNew = lastReadTimestamp && msg.senderId !== user?.id && new Date(currentMsgDate) > new Date(lastReadTimestamp)

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateSeparator && (
                        <div className="flex items-center justify-center my-3.5">
                          <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-100/90 border border-brand-line text-[11px] font-semibold text-brand-muted shadow-xs">
                            <Calendar className="w-3 h-3 text-brand-primary" />
                            <span>{formatMessageDateSeparator(currentMsgDate)}</span>
                          </div>
                        </div>
                      )}

                      <div
                        className={`p-4 rounded-2xl transition-all ${
                          isNew
                            ? 'border-2 border-brand-primary/60 bg-brand-light/30 shadow-xs'
                            : isMe
                            ? 'bg-slate-50 border border-brand-line ml-4 sm:ml-12'
                            : 'bg-white border border-brand-line/80 shadow-xs mr-4 sm:mr-12'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-brand-light text-brand-primary flex items-center justify-center font-bold text-sm ring-2 ring-brand-border/60 overflow-hidden shrink-0">
                              {msg.senderAvatar ? (
                                <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                              ) : (
                                <span>{msg.senderName?.charAt(0) || 'U'}</span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-brand-heading">
                                  {msg.senderName}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                                  isTeacherSender
                                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                                    : 'bg-blue-100 text-blue-700 border-blue-200'
                                }`}>
                                  {isTeacherSender ? 'Professor' : 'Student'}
                                </span>
                                {isNew && (
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider bg-rose-500 text-white px-1.5 py-0.2 rounded-full">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-brand-muted flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
                                <span>{formatMessageTime(currentMsgDate)}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-brand-body mt-2.5 whitespace-pre-line leading-relaxed pl-12">
                          {msg.text}
                        </p>
                      </div>
                    </React.Fragment>
                  )
                })
              ) : (
                <div className="text-center py-16 space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-brand-muted">
                    No discussion messages yet in this class. Start the conversation below!
                  </p>
                </div>
              )}
            </div>

            {/* Message Input Box at bottom */}
            <form onSubmit={handleSendMessage} className="pt-3 border-t border-brand-line/60 space-y-2.5">
              <Textarea
                placeholder="Type your message, query, or update for the class..."
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                rows={2}
                required
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-brand-muted">
                  Press <strong>Send</strong> to instantly broadcast to all enrolled members
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={sendingMessage}
                  disabled={!newMessageText.trim() || sendingMessage}
                  icon={Send}
                  className="shadow-purple-glow font-semibold"
                >
                  Send Message
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ASSIGNMENTS (Belonging ONLY to this class)
      ========================================================================= */}
      {activeTab === 'assignments' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-heading">
                Course Assignments ({assignments.length})
              </h3>
              <p className="text-xs text-brand-muted">
                All assignments assigned specifically to {currentClass.name}
              </p>
            </div>

            {isTeacher && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() =>
                  navigate(`/admin/assignments/create?classId=${currentClass?.id || classId}`, {
                    state: {
                      from: 'class',
                      classId: currentClass?.id || classId,
                      tab: 'assignments',
                    },
                  })
                }
                className="shadow-purple-glow font-semibold"
              >
                Create Assignment
              </Button>
            )}
          </div>

          {assignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {assignments.map((assignment) => {
                const deadlineBadge = formatDeadlineBadge(assignment.due_date, assignment.due_time)
                const isPastDue = isOverdue(assignment.due_date, assignment.due_time)

                // Submission calculations for this assignment
                const assignmentSubs = submissions.filter((s) => s.assignment_id === assignment.id)
                const totalEnrolled = members.length
                const submittedCount = assignmentSubs.length
                const pendingCount = Math.max(0, totalEnrolled - submittedCount)
                const gradedSubs = assignmentSubs.filter((s) => s.grade !== null && s.grade !== undefined)
                const gradedCount = gradedSubs.length
                const awaitingGradingCount = Math.max(0, submittedCount - gradedCount)

                // For student view
                const mySub = mySubmissions.find((s) => s.assignment_id === assignment.id)
                const isSubmitted = Boolean(mySub)
                const isGraded = isSubmitted && mySub.grade !== null && mySub.grade !== undefined
                const letterGrade = isGraded ? calculateLetterGrade(mySub.grade, assignment.points) : null

                return (
                  <Card
                    key={assignment.id}
                    padding="p-5 sm:p-6"
                    className="space-y-4 shadow-card hover:border-brand-border transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top Badges & Status */}
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-brand-primary bg-brand-light px-2.5 py-0.5 rounded-full shrink-0">
                            {assignment.points} pts
                          </span>
                          {isPastDue ? (
                            <Badge variant="danger" size="sm">
                              Past Due
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              Active
                            </Badge>
                          )}
                          {deadlineBadge && (
                            <Badge variant={deadlineBadge.variant} size="sm">
                              {deadlineBadge.text}
                            </Badge>
                          )}
                        </div>

                        {/* Student submission indicator badge */}
                        {!isTeacher && (
                          isGraded ? (
                            <Badge variant="success" size="sm" dot>
                              Graded: {mySub.grade}/{assignment.points} ({letterGrade})
                            </Badge>
                          ) : isSubmitted ? (
                            <Badge variant="primary" size="sm" dot>
                              Submitted
                            </Badge>
                          ) : (
                            <Badge variant={isPastDue ? 'danger' : 'warning'} size="sm" dot>
                              {isPastDue ? 'Missing' : 'Not Submitted'}
                            </Badge>
                          )
                        )}
                      </div>

                      {/* Assignment Title & Description */}
                      <div>
                        <h4 className="font-bold text-base text-brand-heading leading-snug">
                          {assignment.title}
                        </h4>
                        <p className="text-xs text-brand-body line-clamp-2 mt-1 leading-relaxed">
                          {assignment.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* Dates and Attachment Metadata */}
                      <div className="space-y-1.5 pt-1 text-xs text-brand-muted">
                        <div className="flex items-center gap-4 flex-wrap">
                          {assignment.created_at && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Created: {formatDisplayDate(assignment.created_at)}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 font-medium text-brand-heading">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              Due: {assignment.due_date ? `${formatDisplayDate(assignment.due_date)} at ${assignment.due_time?.substring(0, 5) || '23:59'}` : 'No deadline'}
                            </span>
                          </span>
                        </div>

                        {/* Attachment info */}
                        <div className="pt-0.5">
                          {assignment.drive_link ? (
                            <a
                              href={assignment.drive_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-semibold hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Reference Attachment (Drive)</span>
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No attachments attached</span>
                          )}
                        </div>
                      </div>

                      {/* Teacher Submission Stats Counters */}
                      {isTeacher && (
                        <div className="grid grid-cols-5 gap-2 pt-2 border-t border-brand-line/60 text-center">
                          <div className="p-2 rounded-xl bg-slate-50 border border-brand-line/60">
                            <span className="text-[10px] text-brand-muted block font-medium">Enrolled</span>
                            <span className="text-sm font-bold text-brand-heading">{totalEnrolled}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
                            <span className="text-[10px] text-emerald-700 block font-medium">Submitted</span>
                            <span className="text-sm font-bold text-emerald-700">{submittedCount}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-100">
                            <span className="text-[10px] text-amber-700 block font-medium">Pending</span>
                            <span className="text-sm font-bold text-amber-700">{pendingCount}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-purple-50/60 border border-purple-100">
                            <span className="text-[10px] text-purple-700 block font-medium">Graded</span>
                            <span className="text-sm font-bold text-purple-700">{gradedCount}</span>
                          </div>
                          <div className="p-2 rounded-xl bg-rose-50/60 border border-rose-100">
                            <span className="text-[10px] text-rose-700 block font-medium">Awaiting</span>
                            <span className="text-sm font-bold text-rose-700">{awaitingGradingCount}</span>
                          </div>
                        </div>
                      )}

                      {/* Student Graded Feedback Panel */}
                      {!isTeacher && mySub && (
                        <div className="rounded-xl p-3 bg-slate-50 border border-brand-line space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-brand-muted">
                              Submitted on {formatDisplayDate(mySub.submitted_at)}
                            </span>
                            {mySub.submission_link && (
                              <a
                                href={sanitizeUrl(mySub.submission_link)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brand-primary font-semibold hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>View Work</span>
                              </a>
                            )}
                          </div>

                          {isGraded ? (
                            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                              <div className="flex items-center justify-between font-bold">
                                <span className="flex items-center gap-1.5">
                                  <Award className="w-4 h-4 text-emerald-600" />
                                  <span>Marks: {mySub.grade} / {assignment.points} pts</span>
                                </span>
                                <span className="text-xs bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-black">
                                  Grade {letterGrade}
                                </span>
                              </div>
                              {mySub.feedback && (
                                <p className="text-[11px] text-emerald-800 pt-1 border-t border-emerald-200/60">
                                  <strong>Feedback:</strong> "{mySub.feedback}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                              ⏳ Submission received. Your instructor has not evaluated this deliverable yet.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-brand-line/60 flex items-center justify-end">
                      {isTeacher ? (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Eye}
                          onClick={() =>
                            navigate(`/admin/assignments/${assignment.id}`, {
                              state: {
                                from: 'class',
                                classId: currentClass?.id || classId,
                                tab: 'assignments',
                              },
                            })
                          }
                          className="shadow-purple-glow font-semibold"
                        >
                          View Submissions
                        </Button>
                      ) : isSubmitted ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-brand-muted">Deliverable locked</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`/student/assignments/${assignment.id}`, {
                                state: {
                                  from: 'class',
                                  classId: currentClass?.id || classId,
                                  tab: 'assignments',
                                },
                              })
                            }
                          >
                            View Details
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Send}
                          className="shadow-purple-glow font-semibold"
                          onClick={() =>
                            navigate(`/student/assignments/${assignment.id}`, {
                              state: {
                                from: 'class',
                                classId: currentClass?.id || classId,
                                tab: 'assignments',
                              },
                            })
                          }
                        >
                          Submit Work
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="text-center py-14 space-y-3">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-brand-heading">No assignments yet</h4>
              <p className="text-xs text-brand-muted max-w-sm mx-auto">
                {isTeacher
                  ? 'Get started by creating the first coursework assignment for this class.'
                  : 'Your instructor has not published any assignments for this course yet.'}
              </p>
              {isTeacher && (
                <Button
                  variant="primary"
                  icon={Plus}
                  size="sm"
                  onClick={() => navigate('/admin/assignments/create')}
                  className="shadow-purple-glow font-semibold"
                >
                  Create First Assignment
                </Button>
              )}
            </Card>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: RESOURCES
      ========================================================================= */}
      {activeTab === 'resources' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-heading">
                Class Documents & Learning Materials
              </h3>
              <p className="text-xs text-brand-muted">
                Reference files, Drive links, and course guides for {currentClass.name}
              </p>
            </div>

            {isTeacher && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setIsAddResourceOpen(true)}
                className="shadow-purple-glow font-semibold"
              >
                Add Resource Link
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((res) => (
              <Card key={res.id} padding="p-5" className="space-y-3 shadow-card hover:border-brand-border transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <Badge variant="primary" size="sm">
                    {res.category}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-brand-heading line-clamp-1">{res.title}</h4>
                  {res.description && (
                    <p className="text-xs text-brand-muted line-clamp-2 mt-1 leading-relaxed">
                      {res.description}
                    </p>
                  )}
                  <span className="text-[11px] text-brand-muted mt-1 block">
                    Added: {formatDisplayDate(res.addedAt)} {res.addedBy ? `• ${res.addedBy}` : ''}
                  </span>
                </div>

                <div className="pt-2 border-t border-brand-line/60 flex items-center justify-between">
                  {res.url && res.url !== '#' ? (
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-semibold hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{res.type ? `Open ${res.type}` : 'Open Resource'}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-brand-muted italic">Archived in Classroom</span>
                  )}
                  <span className="text-[10px] text-slate-400 font-medium uppercase">
                    {res.type || 'Link'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 7: PEOPLE (Student Management, Role Separation, Group Affiliations)
      ========================================================================= */}
      {activeTab === 'people' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-heading">
                Class Members ({totalEnrolledStudents + 1})
              </h3>
              <p className="text-xs text-brand-muted">
                Complete class directory: course instructors, administrators, and enrolled student teams
              </p>
            </div>

            {isTeacher && (
              <Button
                variant="primary"
                icon={UserPlus}
                onClick={() => setIsInviteOpen(true)}
                className="shadow-purple-glow font-semibold cursor-pointer"
              >
                Invite Student
              </Button>
            )}
          </div>

          {/* Section 1: Course Instructor */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-brand-primary" />
              <span>Course Instructor</span>
            </h4>
            <Card padding="p-4" className="shadow-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-light text-brand-primary flex items-center justify-center font-bold">
                  {classRoster.instructor?.avatar || currentClass.users?.avatar ? (
                    <img
                      src={classRoster.instructor?.avatar || currentClass.users?.avatar}
                      alt="Teacher"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span>{(classRoster.instructor?.name || currentClass.users?.name || 'P').charAt(0)}</span>
                  )}
                </div>
                <div>
                  <strong className="text-sm text-brand-heading block">
                    {classRoster.instructor?.name || currentClass.users?.name || 'Faculty Member'}
                  </strong>
                  <span className="text-xs text-brand-muted">
                    {classRoster.instructor?.email || currentClass.users?.email || 'admin@assignora.demo'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="purple" size="sm">
                  Faculty
                </Badge>
                <Badge variant="primary" size="sm">
                  Class Owner
                </Badge>
              </div>
            </Card>
          </div>

          {/* Section 2: Enrolled Students & Group Affiliations */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Enrolled Students ({totalEnrolledStudents})</span>
                </h4>
                <p className="text-[11px] text-brand-muted">
                  All active student participants enrolled in this course
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold scrollbar-none">
                <button
                  type="button"
                  onClick={() => setPeopleFilter('all')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    peopleFilter === 'all'
                      ? 'bg-brand-primary text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({members.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPeopleFilter('leaders')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    peopleFilter === 'leaders'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Leaders ({leaderCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPeopleFilter('inGroup')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    peopleFilter === 'inGroup'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  In a Group ({inGroupCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPeopleFilter('noGroup')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    peopleFilter === 'noGroup'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Without Group ({withoutGroupCount})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                placeholder="Search enrolled students by name, email, or group name..."
                className="w-full rounded-xl border border-brand-line bg-white pl-9 pr-4 py-2 text-xs focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 shadow-xs"
              />
            </div>

            {filteredStudents.length > 0 ? (
              <div className="bg-white rounded-2xl border border-brand-line shadow-card divide-y divide-brand-line/60 overflow-hidden">
                {filteredStudents.map((member) => {
                  const studentName = member.name || member.users?.name || 'Student Name'
                  const studentEmail = member.email || member.users?.email || ''
                  const studentAvatar = member.avatar || member.users?.avatar || null
                  const joinedDate = member.joined_at
                  const groupName = member.group_name
                  const isLeader = member.is_leader

                  return (
                    <div
                      key={member.id || member.student_id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-brand-heading flex items-center justify-center font-bold text-sm ring-2 ring-brand-border/60 overflow-hidden shrink-0">
                          {studentAvatar ? (
                            <img src={studentAvatar} alt={studentName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{studentName.charAt(0) || 'S'}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h5 className="font-bold text-sm text-brand-heading truncate">
                              {studentName}
                            </h5>
                            {member.student_id === user?.id && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-brand-muted truncate block">
                            {studentEmail}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                        {/* Group Status Badge */}
                        {isLeader ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300/70">
                            <Crown className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Leader • {groupName}</span>
                          </span>
                        ) : groupName ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            <Users className="w-3 h-3 text-brand-primary shrink-0" />
                            <span>{groupName}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                            No Group Yet
                          </span>
                        )}

                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] text-brand-muted block uppercase">Enrolled</span>
                          <span className="text-xs font-semibold text-brand-heading">
                            {joinedDate ? formatDisplayDate(joinedDate) : 'Active'}
                          </span>
                        </div>

                        {/* Action 3-dots Menu for Teacher */}
                        {isTeacher && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMenuMemberId(activeMenuMemberId === member.id ? null : member.id)
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-heading hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeMenuMemberId === member.id && (
                              <div
                                className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-modal border border-brand-line py-1 z-30 text-left"
                                onClick={() => setActiveMenuMemberId(null)}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudentForProfile(member)}
                                  className="w-full px-4 py-2 text-xs font-medium text-brand-body hover:bg-brand-secondaryBg flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="w-4 h-4 text-slate-400" />
                                  <span>View Profile</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStudentToRemove(member)}
                                  className="w-full px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border-t border-brand-line/60"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Remove from Class</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Card className="text-center py-12 space-y-3">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-brand-heading">
                  {peopleSearch ? 'No matching students found' : 'No students enrolled yet'}
                </h4>
                <p className="text-xs text-brand-muted max-w-sm mx-auto">
                  {peopleSearch
                    ? `No enrolled students matched "${peopleSearch}". Try a different name or email.`
                    : 'Invite students using your unique class code or share the invitation link.'}
                </p>
                {isTeacher && !peopleSearch && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={UserPlus}
                    onClick={() => setIsInviteOpen(true)}
                    className="shadow-purple-glow font-semibold"
                  >
                    Invite Students
                  </Button>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 8: GROUPS (Class-scoped Group Management)
      ========================================================================= */}
      {activeTab === 'groups' && (
        <ClassGroupsTab
          classId={classId}
          className={currentClass?.name || 'Course'}
          currentUser={user}
          isTeacher={isTeacher}
          onGroupChanged={refreshClassDetails}
        />
      )}

      {/* =========================================================================
          MODALS & DIALOGS
      ========================================================================= */}

      {/* 1. Invite Students Dialog */}
      <InviteStudentModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        currentClass={currentClass}
      />

      {/* 2. View Student Profile Modal */}
      <StudentProfileModal
        isOpen={Boolean(selectedStudentForProfile)}
        onClose={() => setSelectedStudentForProfile(null)}
        member={selectedStudentForProfile}
      />

      {/* 3. Confirmation Dialog for Removing a Student */}
      <Modal
        isOpen={Boolean(studentToRemove)}
        onClose={() => setStudentToRemove(null)}
        title="Remove Student from Class"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl p-3.5 bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
            <strong className="block font-bold">Important Notice:</strong>
            <p>
              Removing <strong>{studentToRemove?.users?.name || 'this student'}</strong> will only remove them from <em>{currentClass.name}</em>. Their Assignora user account and submissions in other classes will NOT be deleted.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-line/60">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStudentToRemove(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={removingStudent}
              onClick={handleConfirmRemoveStudent}
              icon={Trash2}
            >
              Confirm Removal
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Teacher Grade & Feedback Modal */}
      <Modal
        isOpen={Boolean(gradingSubmission)}
        onClose={() => setGradingSubmission(null)}
        title="Grade Submission"
        size="md"
      >
        {gradingSubmission && (
          <form onSubmit={handleSaveGrade} className="space-y-4">
            <div className="rounded-xl p-3 bg-slate-50 border border-brand-line text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Student:</span>
                <strong className="text-brand-heading">{gradingSubmission.users?.name}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Assignment:</span>
                <strong className="text-brand-heading">{gradingSubmission.assignments?.title}</strong>
              </div>
              {gradingSubmission.submission_link && (
                <div className="flex items-center justify-between pt-1 border-t border-brand-line/60">
                  <span className="text-brand-muted">Deliverable:</span>
                  <a
                    href={sanitizeUrl(gradingSubmission.submission_link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open Work</span>
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-heading">
                Awarded Marks / Points (Max: {gradingSubmission.assignments?.points || 100})
              </label>
              <Input
                type="number"
                min="0"
                max={gradingSubmission.assignments?.points || 100}
                placeholder="e.g. 95"
                value={gradeScore}
                onChange={(e) => setGradeScore(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-heading">
                Instructor Feedback
              </label>
              <Textarea
                placeholder="Provide constructive feedback for the student..."
                value={gradeFeedback}
                onChange={(e) => setGradeFeedback(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-line/60">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setGradingSubmission(null)}
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
                Save Grade & Feedback
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 5. Student Submit Assignment Modal */}
      {submittingAssignment && (
        <TwoStepSubmissionModal
          isOpen={Boolean(submittingAssignment)}
          onClose={() => setSubmittingAssignment(null)}
          assignment={submittingAssignment}
          onFinalSubmit={async () => {
            if (!submittingAssignment?.id || !user?.id) return null
            return await submissionsService.submitAssignment({
              assignmentId: submittingAssignment.id,
              studentId: user.id,
              submissionLink: '',
              comment: 'Submitted from Class Coursework',
            })
          }}
          onSuccessDone={() => {
            setSubmittingAssignment(null)
            refreshClassDetails()
          }}
        />
      )}

      {/* 6. Teacher Add Resource Modal */}
      <Modal
        isOpen={isAddResourceOpen}
        onClose={() => setIsAddResourceOpen(false)}
        title="Add Learning Resource"
        size="sm"
      >
        <form onSubmit={handleAddResource} className="space-y-4">
          <Input
            label="Resource Title"
            placeholder="e.g. Chapter 4 Slide Deck"
            value={resTitle}
            onChange={(e) => setResTitle(e.target.value)}
            required
          />
          <Input
            label="Resource URL (Drive link, GitHub, or Web Doc)"
            placeholder="https://drive.google.com/..."
            value={resUrl}
            onChange={(e) => setResUrl(e.target.value)}
            required
          />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-heading">Category</label>
            <select
              value={resCategory}
              onChange={(e) => setResCategory(e.target.value)}
              className="w-full text-xs rounded-xl border border-brand-line px-3 py-2.5 focus:ring-2 focus:ring-brand-primary"
            >
              <option value="Learning Materials">Learning Materials</option>
              <option value="Course Guidelines">Course Guidelines</option>
              <option value="Assignment Reference">Assignment Reference</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-brand-line/60">
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsAddResourceOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" className="shadow-purple-glow font-semibold">
              Add Resource
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
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
  MessageSquare
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { classesService } from '../../services/classes.service'
import { submissionsService } from '../../services/submissions.service'
import { announcementsService } from '../../services/announcements.service'
import { messagesService } from '../../services/messages.service'
import { notificationsService } from '../../services/notifications.service'
import { useNotifications } from '../../context/NotificationContext'
import { calculateCompletionRate, isOverdue, formatDisplayDate, formatDeadlineBadge } from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { Input, Textarea } from '../../components/common/Input'
import NotificationBadge from '../../components/common/NotificationBadge'
import InviteStudentModal from '../../components/class/InviteStudentModal'
import StudentProfileModal from '../../components/class/StudentProfileModal'
import TwoStepSubmissionModal from '../../components/student/TwoStepSubmissionModal'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'messages', label: 'Discussion', icon: MessageSquare },
  { id: 'assignments', label: 'Assignments', icon: ClipboardList },
  { id: 'submissions', label: 'Submissions', icon: CheckSquare },
  { id: 'grades', label: 'Scores & Grades', icon: BarChart2 },
  { id: 'resources', label: 'Resources', icon: FolderOpen },
  { id: 'history', label: 'Activity History', icon: History },
  { id: 'people', label: 'People', icon: Users },
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

  useEffect(() => {
    loadClassDetails()
  }, [classId, user?.id])

  async function loadClassDetails() {
    if (!classId) return
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch class details with members and assignments
      const cls = await classesService.getClassById(classId)
      if (!cls) {
        setError('Class not found.')
        return
      }
      setCurrentClass(cls)

      // 2. Fetch class submissions
      const subs = await submissionsService.getClassSubmissions(classId)
      setSubmissions(subs)

      // 3. Fetch announcements for this class
      const ann = await announcementsService.getClassAnnouncements(classId)
      setAnnouncements(ann)

      // 4. Fetch activity history
      const acts = await classesService.getClassActivity(classId)
      setActivities(acts)

      // 5. Fetch resources
      const res = await classesService.getClassResources(classId)
      setResources(res)

      // 6. Fetch class discussion messages
      const msgs = await messagesService.getClassMessages(classId)
      setMessages(msgs)
      const prevRead = messagesService.getLastReadTimestamp(classId, user?.id)
      setLastReadTimestamp(prevRead)

      // If already on messages tab, mark as read immediately
      if (activeTab === 'messages' && markClassAsRead) {
        markClassAsRead(classId)
      }
    } catch (err) {
      console.error('[ClassDetailPage] Error loading class details:', err)
      setError(err.message || 'Failed to load class information.')
    } finally {
      setLoading(false)
    }
  }

  // Clear unread badge whenever user opens or is on messages tab
  useEffect(() => {
    if (activeTab === 'messages' && classId && markClassAsRead) {
      markClassAsRead(classId)
    }
  }, [activeTab, classId, markClassAsRead])

  // Listen for realtime broadcast messages
  useEffect(() => {
    if (!classId) return
    const channel = messagesService.getChannel()

    const handleBroadcast = ({ event, payload }) => {
      if (event === 'class-message' && payload?.classId === classId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message.id)) return prev
          return [...prev, payload.message]
        })
        if (activeTab === 'messages' && markClassAsRead) {
          markClassAsRead(classId)
        }
      }
    }

    channel.on('broadcast', { event: '*' }, handleBroadcast)
    return () => {
      channel.off('broadcast', { event: '*' }, handleBroadcast)
    }
  }, [classId, activeTab, markClassAsRead])

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
    if (!newMessageText.trim() || !user?.id || !currentClass) return

    try {
      setSendingMessage(true)
      const createdMsg = await messagesService.sendMessage({
        classId,
        senderId: user.id,
        senderName: user.name,
        senderRole: user.role,
        senderAvatar: user.avatar || '',
        text: newMessageText.trim(),
      })

      setMessages((prev) => [...prev, createdMsg])
      setNewMessageText('')

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
      alert(err.message || 'Failed to send message.')
    } finally {
      setSendingMessage(false)
    }
  }

  // Derived metrics
  const classCode = currentClass ? classesService.getClassCode(currentClass) : ''
  const members = currentClass?.class_members || []
  const assignments = currentClass?.assignments || []

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
                • {members.length} Enrolled {members.length === 1 ? 'Student' : 'Students'}
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
              {tab.id === 'people' && members.length > 0 && (
                <span className="text-[10px] bg-slate-100 text-brand-muted px-1.5 py-0.2 rounded-full font-bold">
                  {members.length}
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
                    <img src={currentClass.users.avatar} alt={currentClass.users.name} className="w-full h-full object-cover rounded-2xl" />
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
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-semibold text-brand-primary hover:underline"
                >
                  View All
                </button>
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
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.id
                  const isTeacherSender = msg.senderRole === 'admin'
                  const isNew = lastReadTimestamp && msg.senderId !== user?.id && new Date(msg.createdAt) > new Date(lastReadTimestamp)

                  return (
                    <div
                      key={msg.id}
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
                              <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                                isTeacherSender
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {isTeacherSender ? 'Professor' : 'Student'}
                              </span>
                              {isNew && (
                                <span className="text-[9px] font-extrabold uppercase tracking-wider bg-rose-500 text-white px-1.5 py-0.2 rounded-full">
                                  NEW
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-brand-muted block mt-0.5">
                              {formatDisplayDate(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-brand-body mt-2.5 whitespace-pre-line leading-relaxed pl-12">
                        {msg.text}
                      </p>
                    </div>
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
                onClick={() => navigate('/admin/assignments/create')}
                className="shadow-purple-glow font-semibold"
              >
                Create Assignment
              </Button>
            )}
          </div>

          {assignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map((assignment) => {
                const deadlineBadge = formatDeadlineBadge(assignment.due_date, assignment.due_time)
                const mySub = mySubmissions.find((s) => s.assignment_id === assignment.id)
                const isSubmitted = Boolean(mySub)

                return (
                  <Card
                    key={assignment.id}
                    padding="p-5"
                    className="space-y-4 shadow-card hover:border-brand-border transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-base text-brand-heading line-clamp-1">
                          {assignment.title}
                        </h4>
                        <span className="text-xs font-bold text-brand-primary bg-brand-light px-2.5 py-0.5 rounded-full shrink-0">
                          {assignment.points} pts
                        </span>
                      </div>

                      <p className="text-xs text-brand-body line-clamp-2 leading-relaxed">
                        {assignment.description || 'No description provided.'}
                      </p>

                      {assignment.drive_link && (
                        <div className="pt-1">
                          <a
                            href={assignment.drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-brand-primary hover:underline font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Resource Attachment Link</span>
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-brand-line/60 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <span className="text-brand-muted block text-[11px]">Due Date:</span>
                        <strong className="text-brand-heading">
                          {assignment.due_date ? `${formatDisplayDate(assignment.due_date)} at ${assignment.due_time?.substring(0, 5) || '23:59'}` : 'No deadline'}
                        </strong>
                      </div>

                      <div className="flex items-center gap-2">
                        {isTeacher ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab('submissions')}
                          >
                            Track Submissions
                          </Button>
                        ) : isSubmitted ? (
                          <Badge variant="success" size="sm" dot>
                            Submitted
                          </Badge>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Send}
                            className="shadow-purple-glow font-semibold"
                            onClick={() => setSubmittingAssignment(assignment)}
                          >
                            Submit
                          </Button>
                        )}
                      </div>
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
          TAB 3: SUBMISSIONS (Teacher Grade Controls & Student Submission View)
      ========================================================================= */}
      {activeTab === 'submissions' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-heading">
                {isTeacher ? 'Class Submission Tracker' : 'My Course Submissions'}
              </h3>
              <p className="text-xs text-brand-muted">
                {isTeacher
                  ? 'Review deliverable links, inspect student notes, and enter grades and feedback'
                  : 'Track your submitted work, review grades, and read instructor feedback'}
              </p>
            </div>
          </div>

          {/* TEACHER SUBMISSIONS TABLE */}
          {isTeacher && (
            submissions.length > 0 ? (
              <div className="bg-white rounded-2xl border border-brand-line shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-brand-muted uppercase font-semibold text-[11px] border-b border-brand-line">
                      <tr>
                        <th className="px-5 py-3.5">Student</th>
                        <th className="px-5 py-3.5">Assignment</th>
                        <th className="px-5 py-3.5">Deliverable</th>
                        <th className="px-5 py-3.5">Submitted At</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5">Score / Grade</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-line/60">
                      {submissions.map((sub) => {
                        const isGraded = sub.status === 'reviewed' && sub.grade !== null

                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-brand-light text-brand-primary flex items-center justify-center font-bold">
                                  {sub.users?.name?.charAt(0) || 'S'}
                                </div>
                                <div>
                                  <span className="font-bold text-brand-heading block">{sub.users?.name || 'Student'}</span>
                                  <span className="text-[11px] text-brand-muted">{sub.users?.email}</span>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4 font-semibold text-brand-heading">
                              {sub.assignments?.title || 'Assignment'}
                            </td>

                            <td className="px-5 py-4">
                              {sub.submission_link ? (
                                <a
                                  href={sub.submission_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-brand-primary font-medium hover:underline"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>View Work</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">No link</span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-brand-muted">
                              {formatDisplayDate(sub.submitted_at)}
                            </td>

                            <td className="px-5 py-4">
                              <Badge
                                variant={isGraded ? 'success' : 'primary'}
                                size="sm"
                              >
                                {isGraded ? 'Graded & Reviewed' : 'Submitted'}
                              </Badge>
                            </td>

                            <td className="px-5 py-4">
                              {isGraded ? (
                                <div>
                                  <span className="font-bold text-emerald-700">
                                    {sub.grade} / {sub.assignments?.points || 100} pts
                                  </span>
                                  {sub.feedback && (
                                    <p className="text-[11px] text-brand-muted truncate max-w-[150px]" title={sub.feedback}>
                                      "{sub.feedback}"
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Not graded</span>
                              )}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                icon={Award}
                                onClick={() => {
                                  setGradingSubmission(sub)
                                  setGradeScore(sub.grade !== null && sub.grade !== undefined ? String(sub.grade) : '')
                                  setGradeFeedback(sub.feedback || '')
                                }}
                              >
                                {isGraded ? 'Edit Grade' : 'Grade & Feedback'}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Card className="text-center py-14 space-y-3">
                <CheckSquare className="w-12 h-12 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-brand-heading">No submissions yet</h4>
                <p className="text-xs text-brand-muted max-w-sm mx-auto">
                  Enrolled students have not submitted work for any assignments in this class yet.
                </p>
              </Card>
            )
          )}

          {/* STUDENT SUBMISSIONS VIEW */}
          {!isTeacher && (
            assignments.length > 0 ? (
              <div className="space-y-4">
                {assignments.map((assignment) => {
                  const sub = mySubmissions.find((s) => s.assignment_id === assignment.id)
                  const isSubmitted = Boolean(sub)
                  const isGraded = sub?.status === 'reviewed' && sub?.grade !== null

                  return (
                    <Card key={assignment.id} padding="p-5" className="space-y-4 shadow-card">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-brand-heading">{assignment.title}</h4>
                            <span className="text-xs font-semibold text-brand-primary bg-brand-light px-2 py-0.5 rounded-full">
                              {assignment.points} pts
                            </span>
                          </div>
                          <p className="text-xs text-brand-muted mt-0.5">
                            Due: {assignment.due_date ? `${formatDisplayDate(assignment.due_date)} at ${assignment.due_time?.substring(0, 5) || '23:59'}` : 'No deadline'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {isSubmitted ? (
                            <Badge variant={isGraded ? 'success' : 'primary'} size="sm" dot>
                              {isGraded ? 'Graded' : 'Submitted'}
                            </Badge>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Send}
                              className="shadow-purple-glow font-semibold"
                              onClick={() => setSubmittingAssignment(assignment)}
                            >
                              Submit Assignment
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Submission Details Card if submitted */}
                      {sub && (
                        <div className="rounded-xl p-4 bg-slate-50 border border-brand-line space-y-3 text-xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="text-[11px] text-brand-muted block">Submitted on:</span>
                              <strong className="text-brand-heading">{formatDisplayDate(sub.submitted_at)}</strong>
                            </div>
                            {sub.submission_link && (
                              <a
                                href={sub.submission_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-brand-primary font-semibold hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Inspect Submitted Link</span>
                              </a>
                            )}
                          </div>

                          {/* Grade & Feedback Highlight */}
                          {isGraded ? (
                            <div className="rounded-lg p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold flex items-center gap-1.5">
                                  <Award className="w-4 h-4 text-emerald-600" />
                                  <span>Grade Awarded: {sub.grade} / {assignment.points} pts</span>
                                </span>
                                <span className="font-black text-sm">
                                  {Math.round((sub.grade / (assignment.points || 100)) * 100)}%
                                </span>
                              </div>
                              {sub.feedback && (
                                <p className="text-xs text-emerald-800 pt-1 border-t border-emerald-200/60">
                                  <strong>Teacher Feedback:</strong> "{sub.feedback}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                              ⏳ Submission received. Your instructor has not graded this deliverable yet.
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card className="text-center py-12 space-y-2">
                <p className="text-xs text-brand-muted">No assignments found for this class.</p>
              </Card>
            )
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: SCORES AND GRADES
      ========================================================================= */}
      {activeTab === 'grades' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-bold text-brand-heading">
              {isTeacher ? 'Class Gradebook' : 'My Grades & Performance'}
            </h3>
            <p className="text-xs text-brand-muted">
              Summary of total marks, individual assignments, and instructor comments
            </p>
          </div>

          {/* Teacher Grade Matrix */}
          {isTeacher ? (
            members.length > 0 ? (
              <div className="bg-white rounded-2xl border border-brand-line shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-brand-muted uppercase font-semibold text-[11px] border-b border-brand-line">
                      <tr>
                        <th className="px-5 py-3.5">Student</th>
                        <th className="px-5 py-3.5">Assignments Submitted</th>
                        <th className="px-5 py-3.5">Graded Count</th>
                        <th className="px-5 py-3.5">Total Points</th>
                        <th className="px-5 py-3.5">Average %</th>
                        <th className="px-5 py-3.5 text-right">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-line/60">
                      {members.map((member) => {
                        const studentSubs = submissions.filter((s) => s.student_id === member.student_id)
                        const gradedSubs = studentSubs.filter((s) => s.status === 'reviewed' && s.grade !== null)
                        const totalScore = gradedSubs.reduce((acc, curr) => acc + (curr.grade || 0), 0)
                        const totalPossible = gradedSubs.reduce((acc, curr) => acc + (curr.assignments?.points || 100), 0)
                        const pct = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0

                        return (
                          <tr key={member.id} className="hover:bg-slate-50/60">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-brand-light text-brand-primary flex items-center justify-center font-bold">
                                  {member.users?.name?.charAt(0) || 'S'}
                                </div>
                                <div>
                                  <strong className="text-brand-heading block">{member.users?.name || 'Student'}</strong>
                                  <span className="text-[11px] text-brand-muted">{member.users?.email}</span>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4 font-semibold text-brand-heading">
                              {studentSubs.length} / {assignments.length}
                            </td>

                            <td className="px-5 py-4 text-brand-muted">
                              {gradedSubs.length} Graded
                            </td>

                            <td className="px-5 py-4 font-bold text-brand-primary">
                              {totalScore} pts
                            </td>

                            <td className="px-5 py-4 font-bold text-brand-heading">
                              {pct}%
                            </td>

                            <td className="px-5 py-4 text-right">
                              <Badge
                                variant={pct >= 85 ? 'success' : pct >= 70 ? 'primary' : 'warning'}
                                size="sm"
                              >
                                {pct >= 85 ? 'Excellent (A)' : pct >= 70 ? 'Good (B)' : 'Passing (C)'}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Card className="text-center py-12 space-y-2">
                <p className="text-xs text-brand-muted">No students enrolled to calculate grades.</p>
              </Card>
            )
          ) : (
            /* Student Personal Scores View */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card padding="p-4" className="shadow-card">
                  <span className="text-[11px] text-brand-muted block">Assignments Completed</span>
                  <strong className="text-xl font-black text-brand-heading mt-1 block">
                    {mySubmissions.length} / {assignments.length}
                  </strong>
                </Card>
                <Card padding="p-4" className="shadow-card">
                  <span className="text-[11px] text-brand-muted block">Total Points Earned</span>
                  <strong className="text-xl font-black text-brand-primary mt-1 block">
                    {mySubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0)} pts
                  </strong>
                </Card>
                <Card padding="p-4" className="shadow-card">
                  <span className="text-[11px] text-brand-muted block">Course Status</span>
                  <strong className="text-xl font-black text-emerald-600 mt-1 block">
                    Active Scholar
                  </strong>
                </Card>
              </div>

              {/* Assignments breakdown table */}
              <div className="bg-white rounded-2xl border border-brand-line shadow-card overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-brand-muted uppercase font-semibold text-[11px] border-b border-brand-line">
                    <tr>
                      <th className="px-5 py-3.5">Assignment</th>
                      <th className="px-5 py-3.5">Points Possible</th>
                      <th className="px-5 py-3.5">Score Awarded</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Teacher Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-line/60">
                    {assignments.map((a) => {
                      const sub = mySubmissions.find((s) => s.assignment_id === a.id)
                      const isGraded = sub?.status === 'reviewed' && sub?.grade !== null

                      return (
                        <tr key={a.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-4 font-bold text-brand-heading">{a.title}</td>
                          <td className="px-5 py-4 text-brand-muted">{a.points} pts</td>
                          <td className="px-5 py-4 font-bold text-emerald-700">
                            {isGraded ? `${sub.grade} pts` : sub ? 'Pending Review' : '—'}
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant={isGraded ? 'success' : sub ? 'primary' : 'danger'} size="sm">
                              {isGraded ? 'Graded' : sub ? 'Submitted' : 'Missing'}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-brand-muted italic">
                            {sub?.feedback ? `"${sub.feedback}"` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: RESOURCES
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
                  <span className="text-[11px] text-brand-muted mt-0.5 block">
                    Added: {formatDisplayDate(res.addedAt)}
                  </span>
                </div>

                <div className="pt-2 border-t border-brand-line/60">
                  {res.url && res.url !== '#' ? (
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-semibold hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Document</span>
                    </a>
                  ) : (
                    <span className="text-xs text-brand-muted italic">Archived in Classroom</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: ACTIVITY HISTORY (Chronological Audit Trail)
      ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-base font-bold text-brand-heading">
              Class Activity History
            </h3>
            <p className="text-xs text-brand-muted">
              Audit log of assignments, submissions, gradings, announcements and student enrolments
            </p>
          </div>

          {activities.length > 0 ? (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-brand-line">
              {activities.map((act) => (
                <div key={act.id} className="relative flex items-start gap-4">
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-brand-primary ring-4 ring-white flex items-center justify-center text-white text-[10px]">
                    •
                  </div>

                  <Card padding="p-4" className="flex-1 shadow-card space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-brand-heading">{act.title}</h4>
                      <span className="text-[10px] text-brand-muted shrink-0">
                        {formatDisplayDate(act.timestamp)}
                      </span>
                    </div>
                    {act.user && (
                      <p className="text-[11px] text-brand-muted">
                        Associated user: {act.user.name} ({act.user.email})
                      </p>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12 space-y-2">
              <History className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs text-brand-muted">No activity has been recorded yet.</p>
            </Card>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 7: PEOPLE (Student Management, Action Menu, Removal Dialog, Invite Dialog)
      ========================================================================= */}
      {activeTab === 'people' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-brand-heading">
                Class Members ({members.length})
              </h3>
              <p className="text-xs text-brand-muted">
                Manage enrolled students, review member profiles, and invite new students
              </p>
            </div>

            {isTeacher && (
              <Button
                variant="primary"
                icon={UserPlus}
                onClick={() => setIsInviteOpen(true)}
                className="shadow-purple-glow font-semibold"
              >
                Invite Student
              </Button>
            )}
          </div>

          {/* Teacher Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              Teachers
            </h4>
            <Card padding="p-4" className="shadow-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-light text-brand-primary flex items-center justify-center font-bold">
                  {currentClass.users?.avatar ? (
                    <img src={currentClass.users.avatar} alt="Teacher" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span>{currentClass.users?.name?.charAt(0) || 'P'}</span>
                  )}
                </div>
                <div>
                  <strong className="text-sm text-brand-heading block">
                    {currentClass.users?.name || 'Faculty Member'}
                  </strong>
                  <span className="text-xs text-brand-muted">
                    {currentClass.users?.email || 'admin@assignora.demo'}
                  </span>
                </div>
              </div>
              <Badge variant="primary" size="sm">
                Class Owner
              </Badge>
            </Card>
          </div>

          {/* Students Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              Students ({members.length})
            </h4>

            {members.length > 0 ? (
              <div className="bg-white rounded-2xl border border-brand-line shadow-card divide-y divide-brand-line/60 overflow-hidden">
                {members.map((member) => {
                  const student = member.users || {}

                  return (
                    <div
                      key={member.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-brand-heading flex items-center justify-center font-bold text-sm ring-2 ring-brand-border/60 overflow-hidden shrink-0">
                          {student.avatar ? (
                            <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{student.name?.charAt(0) || 'S'}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h5 className="font-bold text-sm text-brand-heading truncate">
                            {student.name || 'Student Name'}
                          </h5>
                          <span className="text-xs text-brand-muted truncate block">
                            {student.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                          <span className="text-[11px] text-brand-muted block">Enrolled Date</span>
                          <span className="text-xs font-semibold text-brand-heading">
                            {formatDisplayDate(member.joined_at)}
                          </span>
                        </div>

                        <Badge variant="success" size="sm" dot>
                          Enrolled
                        </Badge>

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
                <h4 className="text-sm font-bold text-brand-heading">No students enrolled yet</h4>
                <p className="text-xs text-brand-muted max-w-sm mx-auto">
                  Invite students using your unique class code or share the invitation link.
                </p>
                {isTeacher && (
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
                    href={gradingSubmission.submission_link}
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
          onSuccess={() => {
            setSubmittingAssignment(null)
            loadClassDetails()
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

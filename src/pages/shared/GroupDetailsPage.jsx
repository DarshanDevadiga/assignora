import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { useParams, useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  Users,
  Crown,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  FileText,
  UserPlus,
  Sparkles,
  Award,
  LogOut,
  ArrowRightLeft,
  Trash2,
  MessageSquare,
  Send,
  Lock,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  BookOpen,
  Edit2,
  Archive
} from 'lucide-react'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import ActionMenu from '../../components/common/ActionMenu'
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal'

const AddGroupMembersModal = lazy(() => import('../../components/group/AddGroupMembersModal'))
const EditGroupModal = lazy(() => import('../../components/group/EditGroupModal'))
import { groupsService } from '../../services/groups.service'
import { reconcileAndDeduplicateMessages } from '../../services/messages.service'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase.js'
import {
  formatDisplayDate,
  formatMessageTime,
  formatMessageDateSeparator,
  isDifferentDay,
  sanitizeUrl
} from '../../utils/calculations'

export default function GroupDetailsPage() {
  const { classId: routeClassId, groupId } = useParams()
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const initialTabFromNav = searchParams.get('tab') || location.state?.tab || 'overview'

  // Main Page State
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(initialTabFromNav) // 'overview', 'members', 'assignments', 'chat'
  
  // Dedicated State Machine for Group Assignments
  const [assignmentHistory, setAssignmentHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const historyReqIdRef = useRef(0)

  const [pageFeedback, setPageFeedback] = useState({ type: '', text: '' })
  const [actionLoading, setActionLoading] = useState(false)

  // Group Chat State
  const [chatMessages, setChatMessages] = useState([])
  const [loadingChat, setLoadingChat] = useState(false)
  const [newChatMessage, setNewChatMessage] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const [chatError, setChatError] = useState('')
  const messagesEndRef = useRef(null)

  // Sub-modals
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false)
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false)
  const [memberToTransfer, setMemberToTransfer] = useState(null)
  const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false)
  const [isConfirmDisbandOpen, setIsConfirmDisbandOpen] = useState(false)
  const [groupImpact, setGroupImpact] = useState(null)
  const [groupImpactLoading, setGroupImpactLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const effectiveClassId = routeClassId || group?.class_id

  // Derived membership and permission states (initialized before any hook or callback references them)
  const members = useMemo(() => group?.members || [], [group?.members])
  const isLeader = Boolean(currentUser?.id && group?.leader_id && currentUser.id === group.leader_id)
  const isTeacher = Boolean(currentUser?.role === 'admin')
  const isMember = useMemo(() => {
    if (!currentUser?.id || !members.length) return false
    return members.some((m) => (m.student_id || m.user?.id) === currentUser.id)
  }, [currentUser?.id, members])
  const canManage = Boolean(isLeader || isTeacher)
  const hasChatAccess = Boolean(isMember || isTeacher)

  // 1. Initial Load of Group Details
  useEffect(() => {
    loadGroupData()
  }, [groupId, routeClassId])

  function getMessageSenderMeta(msg) {
    const senderRole = msg.senderRole || 'student'
    const isLeader = msg.senderId === group?.leader_id
    const isClassAdmin = group?.classAdminId && msg.senderId === group.classAdminId

    const isProfessor =
      senderRole === 'admin' &&
      (isClassAdmin ||
        (msg.senderEmail &&
          (msg.senderEmail.toLowerCase().includes('prof') ||
            msg.senderEmail.toLowerCase().includes('faculty') ||
            msg.senderEmail.toLowerCase().includes('darshan') ||
            msg.senderEmail.toLowerCase().includes('teacher'))) ||
        (msg.senderName &&
          (msg.senderName.toLowerCase().includes('prof') ||
            msg.senderName.toLowerCase().includes('dr.') ||
            msg.senderName.toLowerCase().includes('faculty') ||
            msg.senderName.toLowerCase().includes('instructor'))))

    const isAdmin = senderRole === 'admin' && !isProfessor

    if (isProfessor) {
      return {
        roleType: 'professor',
        badgeLabel: 'Professor',
        badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200 font-bold',
        avatarBg: 'bg-purple-700 text-white',
        bubbleClass: 'bg-purple-50/70 border border-purple-200/80 text-purple-950 shadow-2xs',
        nameClass: 'text-purple-900 font-bold',
        icon: 'Shield',
      }
    }

    if (isAdmin) {
      return {
        roleType: 'admin',
        badgeLabel: 'Admin',
        badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200 font-bold',
        avatarBg: 'bg-blue-600 text-white',
        bubbleClass: 'bg-blue-50/60 border border-blue-200/80 text-blue-950 shadow-2xs',
        nameClass: 'text-blue-900 font-bold',
        icon: 'Shield',
      }
    }

    if (isLeader) {
      return {
        roleType: 'leader',
        badgeLabel: 'Leader',
        badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200 font-bold',
        avatarBg: 'bg-amber-500 text-white',
        bubbleClass: 'bg-amber-50/40 border border-amber-200/60 text-slate-900 shadow-2xs',
        nameClass: 'text-brand-heading font-semibold',
        icon: 'Crown',
      }
    }

    return {
      roleType: 'member',
      badgeLabel: null,
      badgeClass: '',
      avatarBg: 'bg-slate-500 text-white',
      bubbleClass: 'bg-white text-slate-800 border border-brand-line/80 shadow-2xs',
      nameClass: 'text-brand-heading font-semibold',
      icon: null,
    }
  }

  async function loadGroupData() {
    if (!groupId) return
    try {
      setLoading(true)
      setError(null)
      const data = await groupsService.getGroupById(groupId)
      if (!data) {
        setError('Group not found or has been disbanded.')
        setGroup(null)
        return
      }
      setGroup(data)
    } catch (err) {
      console.error('[GroupDetailsPage] Error loading group:', err)
      setError(err.message || 'Failed to load group details.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Load Assignment History for this group (with generation tracking to prevent race conditions)
  const loadHistory = useCallback(async (cid, gid, forceRefresh = false) => {
    if (!cid || !gid) return
    const currentReqId = ++historyReqIdRef.current
    try {
      setLoadingHistory(true)
      setHistoryError(null)
      const list = await groupsService.getGroupAssignmentHistory(cid, gid, forceRefresh)
      // Discard older out-of-order responses
      if (currentReqId !== historyReqIdRef.current) return
      setAssignmentHistory(list || [])
      setHistoryLoaded(true)
    } catch (err) {
      if (currentReqId !== historyReqIdRef.current) return
      console.error('[GroupDetailsPage] Error loading assignment history:', err)
      setHistoryError(err.message || 'Failed to load group assignment records.')
      setHistoryLoaded(false)
    } finally {
      if (currentReqId === historyReqIdRef.current) {
        setLoadingHistory(false)
      }
    }
  }, [])

  // Immediate load: Fetch group assignments as soon as class & group IDs are known (do NOT wait for tab click!)
  useEffect(() => {
    if (effectiveClassId && groupId) {
      loadHistory(effectiveClassId, groupId)
    }
  }, [effectiveClassId, groupId, loadHistory])

  // Reset assignment state when navigating to a different group
  useEffect(() => {
    setAssignmentHistory([])
    setLoadingHistory(true)
    setHistoryLoaded(false)
    setHistoryError(null)
  }, [groupId])

  // Lazy-load chat messages when chat tab is opened
  useEffect(() => {
    if (activeTab === 'chat' && group?.id && hasChatAccess) {
      loadChatMessages(group.id)
    }
  }, [activeTab, group?.id, hasChatAccess])

  // 3. Load Group Chat Messages
  async function loadChatMessages(gid) {
    if (!gid) return
    try {
      setLoadingChat(true)
      const msgs = await groupsService.getGroupMessages(gid)
      setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, msgs))
    } catch (err) {
      console.error('[GroupDetailsPage] Error loading chat:', err)
    } finally {
      setLoadingChat(false)
    }
  }

  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom()
    }
  }, [activeTab, chatMessages, scrollToBottom])

  const membersRef = useRef(members)
  const currentUserRef = useRef(currentUser)
  useEffect(() => {
    membersRef.current = members
    currentUserRef.current = currentUser
  }, [members, currentUser])

  // 4. Realtime Subscription for Group Chat (active only when chat tab is active)
  useEffect(() => {
    if (activeTab !== 'chat' || !group?.id || !hasChatAccess) return

    const topic = `group-discussion:${group.id}`
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
    if (existing) {
      supabase.removeChannel(existing)
    }

    const channel = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: 'group-message' }, (payload) => {
      if (payload?.payload?.message) {
        setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, [payload.payload.message]))
      }
    })

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${group.id}`,
      },
      (payload) => {
        if (!payload?.new) return
        const newRow = payload.new
        const matchedMember = membersRef.current.find(
          (m) => (m.student_id || m.user?.id) === newRow.sender_id
        )
        const incoming = {
          id: newRow.id,
          groupId: newRow.group_id,
          senderId: newRow.sender_id,
          senderName:
            matchedMember?.user?.name ||
            (newRow.sender_id === currentUserRef.current?.id ? currentUserRef.current.name : 'Group Member'),
          senderRole: matchedMember?.user?.role || 'student',
          senderEmail: matchedMember?.user?.email || '',
          senderAvatar: matchedMember?.user?.avatar || null,
          text: newRow.message,
          createdAt: newRow.created_at,
        }
        setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, [incoming]))
      }
    )

    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn(`[GroupDetailsPage] Realtime status for group ${group.id}:`, status, err)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeTab, group?.id, hasChatAccess])

  // 5. Send Chat Message
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (sendingChat) return
    const textToSend = newChatMessage.trim()
    if (!textToSend || !currentUser?.id || !group?.id) return

    const tempId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const optimisticMsg = {
      id: tempId,
      groupId: group.id,
      senderId: currentUser.id,
      senderName: currentUser.name || 'You',
      senderRole: currentUser.role || 'student',
      senderAvatar: currentUser.avatar || null,
      text: textToSend,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    }

    try {
      setSendingChat(true)
      setChatError('')
      setNewChatMessage('')

      setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, [optimisticMsg]))

      const saved = await groupsService.sendGroupMessage({
        groupId: group.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar || '',
        text: textToSend,
      })

      setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, [saved]))
    } catch (err) {
      console.error('[GroupDetailsPage] Send chat error:', err)
      setChatError(err.message || 'Failed to send message.')
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewChatMessage(textToSend)
    } finally {
      setSendingChat(false)
    }
  }

  // 6. Transfer Leadership
  const handleConfirmTransferLeadership = async () => {
    if (!memberToTransfer) return
    try {
      setActionLoading(true)
      setPageFeedback({ type: '', text: '' })

      const newLeaderId = memberToTransfer.student_id || memberToTransfer.user?.id
      await groupsService.transferGroupLeadership(group.id, newLeaderId)

      setPageFeedback({
        type: 'success',
        text: `Leadership successfully transferred to ${memberToTransfer.user?.name || 'new leader'}!`,
      })
      setMemberToTransfer(null)
      await loadGroupData()
    } catch (err) {
      setPageFeedback({ type: 'error', text: err.message || 'Failed to transfer leadership.' })
    } finally {
      setActionLoading(false)
    }
  }

  // 7. Leave Group
  const handleConfirmLeaveGroup = async () => {
    try {
      setActionLoading(true)
      setPageFeedback({ type: '', text: '' })

      await groupsService.leaveCourseGroup(group.id, currentUser?.id)
      setIsConfirmLeaveOpen(false)

      const backPath = currentUser?.role === 'admin'
        ? `/admin/classes/${effectiveClassId}`
        : `/student/classes/${effectiveClassId}`
      navigate(backPath)
    } catch (err) {
      setPageFeedback({ type: 'error', text: err.message || 'Failed to leave group.' })
    } finally {
      setActionLoading(false)
    }
  }

  // 8. Safe Delete / Archive Group (Admin / Professor only)
  const openDeleteDialog = async () => {
    if (!group?.id || !isTeacher) return
    setIsConfirmDisbandOpen(true)
    setDeleteError('')
    setGroupImpact(null)
    setGroupImpactLoading(true)
    try {
      const summary = await groupsService.getGroupImpactSummary(group.id)
      setGroupImpact(summary)
    } catch (err) {
      setDeleteError(err.message || 'Failed to inspect group history.')
    } finally {
      setGroupImpactLoading(false)
    }
  }

  const handleArchiveGroup = async () => {
    if (!group?.id || !isTeacher) return
    try {
      setActionLoading(true)
      setDeleteError('')
      await groupsService.archiveCourseGroup(group.id)
      setIsConfirmDisbandOpen(false)
      toast.success(`Archived group "${group.name}". Historical submissions and grades preserved.`, 'Group Archived')
      await loadGroupData()
    } catch (err) {
      const msg = err.message || 'Failed to archive group.'
      setDeleteError(msg)
      toast.error(msg, 'Archive Failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmDisbandGroup = async () => {
    try {
      setActionLoading(true)
      setDeleteError('')

      const res = await groupsService.disbandCourseGroup(group.id)
      setIsConfirmDisbandOpen(false)
      toast.success(
        res?.message || `Group "${group.name}" updated.`,
        res?.action === 'archived' ? 'Group Archived' : 'Group Deleted'
      )

      const backPath = currentUser?.role === 'admin'
        ? `/admin/classes/${effectiveClassId}?tab=groups`
        : `/student/classes/${effectiveClassId}?tab=groups`
      navigate(backPath)
    } catch (err) {
      const msg = err.message || 'Failed to disband group.'
      setDeleteError(msg)
      toast.error(msg, 'Delete Failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Navigation helpers
  const handleBackToGroups = () => {
    const rolePrefix = currentUser?.role === 'admin' ? '/admin' : '/student'
    navigate(`${rolePrefix}/classes/${effectiveClassId}?tab=groups`)
  }

  // Loading Skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb Skeleton */}
        <div className="h-5 w-64 skeleton-shimmer rounded-md border border-brand-border/40" />
        {/* Header Banner Skeleton */}
        <div className="h-32 skeleton-shimmer rounded-2xl border border-brand-border/40 shadow-xs" />
        {/* Quick Stats Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 skeleton-shimmer rounded-xl border border-brand-border/40 shadow-xs" />
          ))}
        </div>
        {/* Content Skeleton */}
        <div className="h-72 skeleton-shimmer rounded-2xl border border-brand-border/40 shadow-xs" />
      </div>
    )
  }

  // Error / Not Found State
  if (error || !group) {
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-brand-heading">Group Unavailable</h3>
        <p className="text-xs sm:text-sm text-brand-muted max-w-md mx-auto">
          {error || 'The requested group could not be found or may have been disbanded.'}
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={ArrowLeft}
            onClick={() => {
              const rolePrefix = currentUser?.role === 'admin' ? '/admin' : '/student'
              if (effectiveClassId) {
                navigate(`${rolePrefix}/classes/${effectiveClassId}?tab=groups`)
              } else {
                navigate(`${rolePrefix}/classes`)
              }
            }}
            className="shadow-purple-glow font-bold cursor-pointer"
          >
            Back to Groups
          </Button>
          <Button
            variant="outline"
            size="md"
            icon={RefreshCw}
            onClick={loadGroupData}
            className="cursor-pointer"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const acknowledgedCount = assignmentHistory.filter((a) => Boolean(a.submission)).length
  const pendingCount = Math.max(0, assignmentHistory.length - acknowledgedCount)
  const gradedCount = assignmentHistory.filter(
    (a) =>
      a.submission &&
      (a.submission.status === 'reviewed' ||
        (a.submission.marks !== null && a.submission.marks !== undefined))
  ).length

  const rolePrefix = currentUser?.role === 'admin' ? '/admin' : '/student'

  return (
    <div className="space-y-6 pb-6">
      {/* 1. Breadcrumbs & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-brand-muted flex-wrap">
          <Link to={`${rolePrefix}/classes`} className="hover:text-brand-heading transition-colors">
            Classes
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <Link
            to={`${rolePrefix}/classes/${effectiveClassId}?tab=groups`}
            className="hover:text-brand-heading transition-colors truncate max-w-[160px]"
          >
            {group.className}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="font-semibold text-brand-heading truncate max-w-[200px]">
            {group.name}
          </span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={ArrowLeft}
          onClick={handleBackToGroups}
          className="self-start sm:self-auto cursor-pointer font-semibold text-xs"
        >
          Back to Course Groups
        </Button>
      </div>

      {/* Top Feedback Alert */}
      {pageFeedback.text && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all ${
            pageFeedback.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {pageFeedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            )}
            <span>{pageFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setPageFeedback({ type: '', text: '' })}
            className="text-xs font-semibold underline cursor-pointer hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Group Header Banner */}
      <Card padding="p-5 sm:p-6" className="shadow-card border-brand-line">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-brand-primary to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-purple-glow shrink-0">
              {group.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-brand-heading break-words">
                  {group.name}
                </h1>
                <Badge variant="primary" size="md">
                  {members.length} {members.length === 1 ? 'Member' : 'Members'}
                </Badge>
                {group.status === 'archived' ? (
                  <Badge variant="warning" size="md">
                    Archived
                  </Badge>
                ) : (
                  <Badge variant="success" size="md" dot>
                    Active Group
                  </Badge>
                )}
                {isMember && (
                  <Badge variant="purple" size="md" dot>
                    Your Group
                  </Badge>
                )}
                {isLeader && (
                  <Badge variant="purple" size="md">
                    <Crown className="w-3.5 h-3.5 text-amber-500 mr-1" />
                    You are Leader
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs sm:text-sm text-brand-muted mt-1.5 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium">
                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    Leader:{' '}
                    <strong className="text-brand-heading font-semibold">
                      {group.leader?.name || 'Assigned Leader'}
                    </strong>
                  </span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                  <span>Course: <strong>{group.className}</strong></span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {canManage && group.status === 'active' && (
              <Button
                variant="outline"
                size="sm"
                icon={UserPlus}
                onClick={() => setIsAddMembersOpen(true)}
                className="cursor-pointer font-semibold text-xs"
              >
                Add Members
              </Button>
            )}

            {isMember && !isLeader && group.status === 'active' && (
              <Button
                variant="secondary"
                size="sm"
                icon={LogOut}
                onClick={() => setIsConfirmLeaveOpen(true)}
                className="text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer font-semibold text-xs"
              >
                Leave Group
              </Button>
            )}

            {isTeacher && (
              <ActionMenu
                label={`Actions for ${group.name}`}
                items={[
                  {
                    id: 'edit-group',
                    label: 'Edit Group',
                    icon: Edit2,
                    disabled: group.status === 'archived',
                    onClick: () => setIsEditGroupOpen(true),
                  },
                  ...(group.status !== 'archived'
                    ? [
                        {
                          id: 'archive-group',
                          label: 'Archive Group',
                          icon: Archive,
                          variant: 'warning',
                          onClick: handleArchiveGroup,
                        },
                      ]
                    : []),
                  {
                    id: 'delete-group',
                    label: 'Delete Group',
                    icon: Trash2,
                    variant: 'danger',
                    dividerBefore: true,
                    onClick: openDeleteDialog,
                  },
                ]}
              />
            )}
          </div>
        </div>
      </Card>

      {/* 3. Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-brand-line/80 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'overview'
              ? 'bg-brand-primary text-white shadow-purple-glow'
              : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'members'
              ? 'bg-brand-primary text-white shadow-purple-glow'
              : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Members ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'assignments'
              ? 'bg-brand-primary text-white shadow-purple-glow'
              : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>
            Group Assignments{' '}
            {loadingHistory && !historyLoaded ? (
              <span
                className={`inline-block w-2 h-2 rounded-full align-middle ml-1 ${
                  activeTab === 'assignments' ? 'bg-white' : 'bg-purple-500'
                } animate-ping`}
              />
            ) : (
              `(${assignmentHistory.length})`
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 relative ${
            activeTab === 'chat'
              ? 'bg-brand-primary text-white shadow-purple-glow'
              : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Private Discussion</span>
          {chatMessages.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'chat'
                  ? 'bg-white/20 text-white'
                  : 'bg-brand-light text-brand-primary'
              }`}
            >
              {chatMessages.length}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW
          ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="p-5" className="border-brand-line">
              <span className="text-xs text-brand-muted uppercase font-bold tracking-wider block">
                Team Members
              </span>
              <p className="text-2xl sm:text-3xl font-black text-brand-heading mt-1">
                {members.length}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">One group per class rule</span>
            </Card>

            <Card padding="p-5" className="border-purple-100 bg-purple-50/40">
              <span className="text-xs text-brand-primary uppercase font-bold tracking-wider block">
                Eligible Tasks
              </span>
              <p className="text-2xl sm:text-3xl font-black text-brand-primary mt-1">
                {loadingHistory && !historyLoaded ? (
                  <span className="inline-block w-8 h-7 bg-purple-200/60 rounded animate-pulse" />
                ) : (
                  assignmentHistory.length
                )}
              </p>
              <span className="text-[11px] text-purple-600/80 mt-1 block">Coursework deliverables</span>
            </Card>

            <Card padding="p-5" className="border-emerald-100 bg-emerald-50/40">
              <span className="text-xs text-emerald-700 uppercase font-bold tracking-wider block">
                Submitted
              </span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">
                {loadingHistory && !historyLoaded ? (
                  <span className="inline-block w-8 h-7 bg-emerald-200/60 rounded animate-pulse" />
                ) : (
                  acknowledgedCount
                )}
              </p>
              <span className="text-[11px] text-emerald-600/80 mt-1 block">
                {gradedCount > 0 ? `${gradedCount} reviewed` : 'Acknowledged by leader'}
              </span>
            </Card>

            <Card padding="p-5" className="border-amber-100 bg-amber-50/40">
              <span className="text-xs text-amber-700 uppercase font-bold tracking-wider block">
                Pending
              </span>
              <p className="text-2xl sm:text-3xl font-black text-amber-800 mt-1">
                {loadingHistory && !historyLoaded ? (
                  <span className="inline-block w-8 h-7 bg-amber-200/60 rounded animate-pulse" />
                ) : (
                  pendingCount
                )}
              </p>
              <span className="text-[11px] text-amber-600/80 mt-1 block">Awaiting submission</span>
            </Card>
          </div>

          {/* Group Leader Spotlight Card */}
          <Card padding="p-5 sm:p-6" className="border-amber-200/80 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 block">
                    Designated Group Leader
                  </span>
                  <h4 className="text-base font-bold text-brand-heading">
                    {group.leader?.name || 'Assigned Leader'}
                  </h4>
                  <p className="text-xs text-brand-muted mt-0.5">
                    {group.leader?.email || 'Leader is authorized to submit group deliverables'}
                  </p>
                </div>
              </div>

              {canManage && members.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={ArrowRightLeft}
                  onClick={() => setActiveTab('members')}
                  className="text-amber-800 border-amber-300 hover:bg-amber-100 font-bold text-xs cursor-pointer self-start sm:self-auto"
                >
                  Manage Leadership
                </Button>
              )}
            </div>
          </Card>

          {/* Team Collaboration Banner */}
          <Card padding="p-5 sm:p-6" className="border-brand-line">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-brand-heading flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-brand-primary" />
                  <span>Private Discussion Workspace</span>
                </h4>
                <p className="text-xs text-brand-muted leading-relaxed max-w-xl">
                  Coordinate task assignments, exchange feedback, and keep all group members aligned. All messages are securely isolated to your group.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={MessageSquare}
                onClick={() => setActiveTab('chat')}
                className="shadow-purple-glow font-bold text-xs cursor-pointer self-start sm:self-auto shrink-0"
              >
                Open Group Chat
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MEMBERS ROSTER
          ========================================================================= */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-muted flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-primary" />
              <span>Enrolled Members ({members.length})</span>
            </h3>
            <span className="text-xs text-slate-400">
              {canManage ? 'Leaders can transfer leadership or manage members' : 'One group per course'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {members.map((m, idx) => {
              const u = m.user || {}
              const memberId = m.student_id || u.id
              const isGroupLeader = memberId === group.leader_id
              const isCurrentUser = memberId === currentUser?.id

              return (
                <div
                  key={m.id || idx}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    isGroupLeader
                      ? 'bg-amber-50/50 border-amber-200/90 shadow-xs'
                      : 'bg-white border-brand-line hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isGroupLeader
                          ? 'bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isGroupLeader ? <Crown className="w-5 h-5" /> : (u.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-brand-heading truncate">
                          {u.name || `Student ${idx + 1}`}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-brand-light text-brand-primary font-bold px-1.5 py-0.2 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-brand-muted truncate mt-0.5">
                        {u.email || u.student_id || 'Enrolled Student'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-brand-line/60">
                    <div>
                      {isGroupLeader ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300/60">
                          <Crown className="w-3 h-3 text-amber-600" />
                          Leader
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Member
                        </span>
                      )}
                    </div>

                    {canManage && !isGroupLeader && (
                      <button
                        type="button"
                        onClick={() => setMemberToTransfer(m)}
                        title="Transfer Leadership to this member"
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Make Leader</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: GROUP ASSIGNMENTS
          ========================================================================= */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-muted flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-primary" />
              <span>
                Eligible Group Deliverables{' '}
                {loadingHistory && !historyLoaded ? (
                  <span className="text-xs font-normal text-slate-400 lowercase">(loading...)</span>
                ) : (
                  `(${assignmentHistory.length})`
                )}
              </span>
            </h3>
            <span className="text-xs text-slate-400">Filtered by course & selective allocation</span>
          </div>

          {loadingHistory && !historyLoaded ? (
            <GroupAssignmentSkeleton />
          ) : historyError ? (
            <Card padding="p-8" className="text-center space-y-3 border-rose-200 bg-rose-50/40">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <h4 className="text-sm font-bold text-rose-900">Failed to Load Group Assignments</h4>
              <p className="text-xs text-rose-700 max-w-sm mx-auto">{historyError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadHistory(effectiveClassId, groupId, true)}
                className="text-xs font-semibold mt-2 cursor-pointer mx-auto"
                icon={RefreshCw}
              >
                Retry Loading
              </Button>
            </Card>
          ) : assignmentHistory.length === 0 ? (
            <Card padding="p-12" className="text-center space-y-2 border-brand-line">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-brand-heading">No Group Assignments Found</h4>
              <p className="text-xs text-brand-muted max-w-sm mx-auto">
                This course does not currently have any published group assignments that this team is eligible to submit.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {assignmentHistory.map((item) => {
                const hasSub = Boolean(item.submission)
                const isGraded =
                  item.submission?.status === 'reviewed' ||
                  (item.submission?.marks !== null && item.submission?.marks !== undefined)

                return (
                  <Card
                    key={item.id}
                    padding="p-5"
                    className="border-brand-line hover:border-slate-300 transition-colors shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-brand-heading truncate">
                            {item.title}
                          </h4>
                          <span className="text-xs font-semibold text-brand-primary">
                            ({item.points} pts)
                          </span>
                        </div>
                        <p className="text-xs text-brand-muted mt-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Due:{' '}
                            {item.due_date
                              ? `${formatDisplayDate(item.due_date)} at ${item.due_time?.substring(0, 5) || '23:59'}`
                              : 'No deadline'}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        {isGraded ? (
                          <Badge variant="success" size="md" dot>
                            Graded: {item.submission.marks} / {item.points}
                          </Badge>
                        ) : hasSub ? (
                          <div className="text-right">
                            <Badge variant="success" size="md" dot>
                              Submitted
                            </Badge>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              by {item.submission.leader?.name || group.leader?.name} on{' '}
                              {formatDisplayDate(item.submission.acknowledged_at)}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="warning" size="md" dot>
                            Not Submitted
                          </Badge>
                        )}

                        {isTeacher ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              navigate(
                                `/admin/assignments/${item.id}?groupId=${group.id}&classId=${group.class_id}`,
                                {
                                  state: {
                                    from: 'group',
                                    classId: group.class_id,
                                    groupId: group.id,
                                    tab: 'assignments',
                                  },
                                }
                              )
                            }}
                            className="font-semibold text-xs shadow-purple-glow cursor-pointer"
                            icon={FileText}
                          >
                            Open Work
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            {item.submission?.submission_link && (
                              <a
                                href={sanitizeUrl(item.submission.submission_link)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary hover:underline bg-brand-light px-2.5 py-1 rounded-lg cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Deliverable</span>
                              </a>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                navigate(`/student/assignments/${item.id}`, {
                                  state: {
                                    from: 'group',
                                    classId: group.class_id,
                                    groupId: group.id,
                                    tab: 'assignments',
                                  },
                                })
                              }}
                              className="font-semibold text-xs shadow-purple-glow cursor-pointer"
                              icon={FileText}
                            >
                              Open Work
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: GROUP DISCUSSION CHAT
          ========================================================================= */}
      {activeTab === 'chat' && (
        <div>
          {!hasChatAccess ? (
            <Card padding="p-12" className="text-center space-y-3 border-brand-line">
              <Lock className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-base font-bold text-brand-heading">Private Group Workspace</h4>
              <p className="text-xs text-brand-muted max-w-sm mx-auto">
                Only active members of <strong>{group.name}</strong> and course instructors have permission to view or participate in this group discussion.
              </p>
            </Card>
          ) : (
            <Card padding="p-0" className="border-brand-line overflow-hidden flex flex-col h-[520px] shadow-card">
              {/* Chat Header */}
              <div className="p-4 border-b border-brand-line bg-slate-50/70 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center font-bold text-xs">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-brand-heading block leading-tight">
                      {group.name} Discussion
                    </span>
                    <span className="text-[11px] text-brand-muted font-normal">
                      {members.length} team members • Private workspace channel
                    </span>
                  </div>
                </div>
                <Badge variant="purple" size="sm">
                  Live Channel
                </Badge>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30">
                {loadingChat ? (
                  <div className="h-full flex items-center justify-center text-xs text-brand-muted animate-pulse">
                    Loading discussion thread...
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-brand-light text-brand-primary flex items-center justify-center mx-auto">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <h5 className="text-sm font-bold text-brand-heading">No messages yet</h5>
                    <p className="text-xs text-brand-muted max-w-xs">
                      Start the conversation! Coordinate project tasks, share resources, or discuss milestones with your teammates.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => {
                    const currentMsgDate = msg.createdAt || msg.created_at
                    const prevMsgDate =
                      idx > 0 ? chatMessages[idx - 1].createdAt || chatMessages[idx - 1].created_at : null
                    const showDateSeparator = idx === 0 || isDifferentDay(prevMsgDate, currentMsgDate)
                    const isMe = msg.senderId === currentUser?.id
                    const meta = getMessageSenderMeta(msg)

                    return (
                      <div key={msg.id || idx} className="space-y-2">
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-3">
                            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100/90 px-3 py-0.5 rounded-full border border-slate-200/50">
                              {formatMessageDateSeparator(currentMsgDate)}
                            </div>
                          </div>
                        )}

                        <div className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isMe ? 'bg-brand-primary text-white' : meta.avatarBg
                            }`}
                          >
                            {meta.icon === 'Crown' ? (
                              <Crown className="w-4 h-4" />
                            ) : meta.icon === 'Shield' ? (
                              <Shield className="w-4 h-4" />
                            ) : (
                              (msg.senderName || 'S').charAt(0).toUpperCase()
                            )}
                          </div>

                          <div className={`max-w-[78%] space-y-1 ${isMe ? 'items-end text-right' : 'items-start text-left'}`}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs ${isMe ? 'font-bold text-brand-heading' : meta.nameClass}`}>
                                {isMe ? 'You' : msg.senderName || 'Member'}
                              </span>
                              {meta.badgeLabel && (
                                <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded-md ${meta.badgeClass}`}>
                                  {meta.icon === 'Crown' && <Crown className="w-2.5 h-2.5 text-amber-600 inline" />}
                                  {meta.icon === 'Shield' && <Shield className="w-2.5 h-2.5 inline" />}
                                  {meta.badgeLabel}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400">
                                {formatMessageTime(currentMsgDate)}
                              </span>
                            </div>

                            <div
                              className={`p-3 rounded-xl text-xs sm:text-sm leading-relaxed break-words text-left ${
                                isMe
                                  ? 'bg-brand-primary text-white rounded-tr-xs shadow-xs'
                                  : `${meta.bubbleClass} rounded-tl-xs`
                              }`}
                            >
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Footer */}
              <form onSubmit={handleSendMessage} className="p-3.5 border-t border-brand-line bg-white space-y-2">
                {chatError && (
                  <p className="text-[11px] text-rose-600 font-medium">{chatError}</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type a message to your group..."
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    disabled={sendingChat}
                    className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-brand-line focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                    required
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={Send}
                    loading={sendingChat}
                    disabled={!newChatMessage.trim() || sendingChat}
                    className="shadow-purple-glow font-bold cursor-pointer shrink-0"
                  >
                    Send
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}

      {/* SUB-MODAL 1: Add Members Modal */}
      {isAddMembersOpen && (
        <Suspense fallback={null}>
          <AddGroupMembersModal
            isOpen={isAddMembersOpen}
            onClose={() => setIsAddMembersOpen(false)}
            group={group}
            classId={effectiveClassId}
            className={group.className}
            onMembersAdded={async () => {
              setIsAddMembersOpen(false)
              setPageFeedback({ type: 'success', text: 'New members successfully added to the group!' })
              await loadGroupData()
            }}
          />
        </Suspense>
      )}

      {/* SUB-MODAL 2: Transfer Leadership Confirmation */}
      {memberToTransfer && (
        <Modal
          isOpen={Boolean(memberToTransfer)}
          onClose={() => setMemberToTransfer(null)}
          title="Transfer Group Leadership"
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <strong className="block font-bold flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-600" />
                <span>Confirm Leadership Transfer</span>
              </strong>
              <p>
                Are you sure you want to transfer leadership of <strong>{group.name}</strong> to{' '}
                <strong>{memberToTransfer.user?.name || 'this member'}</strong>?
              </p>
              <p className="text-[11px] text-amber-800">
                • They will become the group leader with submission and roster permissions.<br />
                • You will become an ordinary team member.<br />
                • Historical assignment records will remain intact.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-line">
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading}
                onClick={() => setMemberToTransfer(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                icon={Crown}
                onClick={handleConfirmTransferLeadership}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
              >
                Confirm Transfer
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* SUB-MODAL 3: Leave Group Confirmation */}
      <Modal
        isOpen={isConfirmLeaveOpen}
        onClose={() => setIsConfirmLeaveOpen(false)}
        title="Leave Group"
        size="sm"
      >
        <div className="space-y-4">
          {isLeader && members.length > 1 ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
              <strong className="block font-bold">Leader Action Required</strong>
              <p>
                As the group leader, you cannot leave the group directly while other members remain. You must first transfer leadership to another member.
              </p>
              <p className="text-[11px] text-rose-700">
                Click "Make Leader" next to any team member above to transfer leadership.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <strong className="block font-bold">Leave {group.name}?</strong>
              <p>
                You will be removed from this group. You will become eligible to create a new group or join another team in <strong>{group.className}</strong>.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-line">
            <Button
              variant="secondary"
              size="sm"
              disabled={actionLoading}
              onClick={() => setIsConfirmLeaveOpen(false)}
            >
              Cancel
            </Button>
            {(!isLeader || members.length <= 1) && (
              <Button
                variant="primary"
                size="sm"
                loading={actionLoading}
                icon={LogOut}
                onClick={handleConfirmLeaveGroup}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                Confirm Leave
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* SUB-MODAL 3.5: Edit Group Modal (Admin / Professor only) */}
      {isEditGroupOpen && (
        <Suspense fallback={null}>
          <EditGroupModal
            isOpen={isEditGroupOpen}
            onClose={() => setIsEditGroupOpen(false)}
            group={group}
            classId={effectiveClassId}
            currentUser={currentUser}
            onSuccess={() => loadGroupData()}
          />
        </Suspense>
      )}

      {/* SUB-MODAL 4: Safe Delete / Archive Group Confirmation */}
      <ConfirmDeleteModal
        isOpen={isConfirmDisbandOpen}
        onClose={() => {
          setIsConfirmDisbandOpen(false)
          setDeleteError('')
        }}
        entityLabel="Group"
        entityName={group?.name || ''}
        entityMeta={group?.status === 'archived' ? 'Archived Group' : 'Active Group'}
        impactLoading={groupImpactLoading}
        stats={
          groupImpact
            ? [
                { label: 'Members', value: groupImpact.membersCount, highlight: groupImpact.membersCount > 0 },
                { label: 'Group Subs', value: groupImpact.groupSubmissionsCount, highlight: groupImpact.groupSubmissionsCount > 0 },
                { label: 'Graded Records', value: groupImpact.gradedCount, highlight: groupImpact.gradedCount > 0 },
                { label: 'Chat Messages', value: groupImpact.messagesCount },
              ]
            : []
        }
        canPermanentDelete={Boolean(groupImpact?.canPermanentDelete)}
        blockReason="This group has historical group submissions or graded records. Permanent deletion is blocked; archive it instead to preserve member and grading history."
        archiveSupported={group?.status !== 'archived'}
        archiveLabel="Archive Group"
        loading={actionLoading}
        error={deleteError}
        onConfirmArchive={handleArchiveGroup}
        onConfirmDelete={handleConfirmDisbandGroup}
      />
    </div>
  )
}

function GroupAssignmentSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading group assignments">
      {[1, 2, 3].map((n) => (
        <Card
          key={n}
          padding="p-5"
          className="border-brand-line/80 bg-white animate-pulse"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-48 bg-slate-200 rounded-md" />
                <div className="h-4 w-16 bg-purple-100 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 bg-slate-200 rounded-full" />
                <div className="h-3 w-40 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="h-7 w-24 bg-slate-100 rounded-full" />
              <div className="h-8 w-24 bg-purple-100 rounded-lg" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

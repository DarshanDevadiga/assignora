import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
  MessageCircle,
  ChevronRight,
  Info,
  RefreshCw,
  Edit2,
  Archive
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import ActionMenu from '../common/ActionMenu'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'
import { Textarea } from '../common/Input'
import AddGroupMembersModal from './AddGroupMembersModal'
import EditGroupModal from './EditGroupModal'
import { groupsService } from '../../services/groups.service'
import { useToast } from '../../context/ToastContext'
import { reconcileAndDeduplicateMessages } from '../../services/messages.service'
import { supabase } from '../../lib/supabase.js'
import {
  formatDisplayDate,
  formatMessageTime,
  formatMessageDateSeparator,
  isDifferentDay,
  sanitizeUrl
} from '../../utils/calculations'

export default function GroupDetailsModal({
  isOpen,
  onClose,
  group,
  courseName = 'Course',
  currentUser,
  onJoinGroup,
  isUserInAnyGroup = false,
  onGroupUpdated
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const [currentGroup, setCurrentGroup] = useState(group)
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'members', 'assignments', 'chat'
  const [assignmentHistory, setAssignmentHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const historyReqIdRef = useRef(0)
  const [actionLoading, setActionLoading] = useState(false)
  const [modalFeedback, setModalFeedback] = useState({ type: '', text: '' })

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

  const members = currentGroup?.members || []
  const isLeader = currentUser?.id === currentGroup?.leader_id
  const isTeacher = currentUser?.role === 'admin'
  const isMember = members.some((m) => (m.student_id || m.user?.id) === currentUser?.id)
  const canJoin = !isUserInAnyGroup && !isMember && currentUser?.role === 'student'
  const canManage = isLeader || isTeacher
  const hasChatAccess = isMember || isTeacher

  const membersRef = useRef(members)
  membersRef.current = members
  const currentUserRef = useRef(currentUser)
  currentUserRef.current = currentUser

  function getMessageSenderMeta(msg) {
    const senderRole = msg.senderRole || 'student'
    const isLeader = msg.senderId === currentGroup?.leader_id
    const isClassAdmin = currentGroup?.classAdminId && msg.senderId === currentGroup.classAdminId

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

  useEffect(() => {
    setCurrentGroup(group)
    if (isOpen) {
      setModalFeedback({ type: '', text: '' })
      setChatError('')
    }
  }, [isOpen, group])

  // 1. Load Assignment History for this group (with generation tracking to prevent race conditions)
  const loadHistory = useCallback(async (forceRefresh = false) => {
    if (!currentGroup?.class_id || !currentGroup?.id) return
    const currentReqId = ++historyReqIdRef.current
    try {
      setLoadingHistory(true)
      setHistoryError(null)
      const list = await groupsService.getGroupAssignmentHistory(
        currentGroup.class_id,
        currentGroup.id,
        forceRefresh
      )
      if (currentReqId !== historyReqIdRef.current) return
      setAssignmentHistory(list || [])
      setHistoryLoaded(true)
    } catch (err) {
      if (currentReqId !== historyReqIdRef.current) return
      console.error('[GroupDetailsModal] Error loading assignment history:', err)
      setHistoryError(err.message || 'Failed to load group assignment records.')
      setHistoryLoaded(false)
    } finally {
      if (currentReqId === historyReqIdRef.current) {
        setLoadingHistory(false)
      }
    }
  }, [currentGroup?.class_id, currentGroup?.id])

  // Load assignment history immediately when modal is opened (do NOT wait for user to click tab!)
  useEffect(() => {
    if (isOpen && currentGroup?.id && currentGroup?.class_id) {
      loadHistory()
    } else if (!isOpen) {
      // Clean reset on close
      setAssignmentHistory([])
      setHistoryLoaded(false)
      setHistoryError(null)
      setLoadingHistory(false)
    }
  }, [isOpen, currentGroup?.id, currentGroup?.class_id, loadHistory])

  // Lazy-load chat messages only when chat tab is opened
  useEffect(() => {
    if (isOpen && activeTab === 'chat' && currentGroup?.id && hasChatAccess) {
      loadChatMessages(currentGroup.id)
    }
  }, [isOpen, activeTab, currentGroup?.id, hasChatAccess])

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

  // 2. Load Group Discussion Chat Messages
  async function loadChatMessages(groupId) {
    if (!groupId) return
    try {
      setLoadingChat(true)
      setChatError('')
      const msgs = await groupsService.getGroupMessages(groupId)
      setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, msgs))
    } catch (err) {
      console.error('[GroupDetailsModal] Error loading group chat messages:', err)
      setChatError(err.message || 'Failed to load group chat messages.')
    } finally {
      setLoadingChat(false)
    }
  }

  // 3. Realtime Subscription for Group Chat (active only when on chat tab)
  useEffect(() => {
    if (!isOpen || activeTab !== 'chat' || !currentGroup?.id || !hasChatAccess) return

    const groupId = currentGroup.id
    const topic = `group-discussion:${groupId}`

    // Clean up any pre-existing channel for this group
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
    if (existing) {
      supabase.removeChannel(existing)
    }

    const channel = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    })

    // Broadcast listener
    channel.on('broadcast', { event: 'group-message' }, (payload) => {
      if (payload?.payload?.message) {
        setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, [payload.payload.message]))
      }
    })

    // Postgres changes on group_messages
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        if (!payload?.new) return
        const newRow = payload.new
        // Resolve sender from current group members ref
        const currentMembers = membersRef.current || []
        const currentSessionUser = currentUserRef.current
        const matchedMember = currentMembers.find(
          (m) => (m.student_id || m.user?.id) === newRow.sender_id
        )
        const incoming = {
          id: newRow.id,
          groupId: newRow.group_id,
          senderId: newRow.sender_id,
          senderName: matchedMember?.user?.name || (newRow.sender_id === currentSessionUser?.id ? currentSessionUser.name : 'Group Member'),
          senderRole: matchedMember?.user?.role || 'student',
          senderEmail: matchedMember?.user?.email || '',
          senderAvatar: matchedMember?.user?.avatar || null,
          text: newRow.message,
          createdAt: newRow.created_at,
        }
        setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, [incoming]))
      }
    )

    channel.subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn(`[GroupDetailsModal] Realtime channel error for group ${groupId}:`, error)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, activeTab, currentGroup?.id, hasChatAccess])

  if (!currentGroup) return null

  // 4. Send Message Handler
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (sendingChat) return
    const textToSend = newChatMessage.trim()
    if (!textToSend || !currentUser?.id || !currentGroup?.id) return

    const tempId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const optimisticMsg = {
      id: tempId,
      groupId: currentGroup.id,
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
      setNewChatMessage('') // Clear immediately to prevent double submissions

      // Add optimistic message safely
      setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, [optimisticMsg]))

      const saved = await groupsService.sendGroupMessage({
        groupId: currentGroup.id,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar || '',
        text: textToSend,
      })

      // Reconcile and replace optimistic tempId with real DB id
      setChatMessages((prev) => reconcileAndDeduplicateMessages(prev, [saved]))
    } catch (err) {
      console.error('[GroupDetailsModal] Send chat error:', err)
      setChatError(err.message || 'Failed to send message.')
      // Remove failed optimistic message
      setChatMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewChatMessage(textToSend) // Restore user text so they don't lose it
    } finally {
      setSendingChat(false)
    }
  }

  // 5. Join Group
  const handleJoinClick = async () => {
    if (!onJoinGroup) return
    try {
      setActionLoading(true)
      await onJoinGroup(currentGroup.id, currentGroup.name)
      if (onGroupUpdated) onGroupUpdated()
    } finally {
      setActionLoading(false)
    }
  }

  // 6. Transfer Leadership
  const handleConfirmTransferLeadership = async () => {
    if (!memberToTransfer) return
    try {
      setActionLoading(true)
      setModalFeedback({ type: '', text: '' })

      const newLeaderId = memberToTransfer.student_id || memberToTransfer.user?.id
      await groupsService.transferGroupLeadership(currentGroup.id, newLeaderId)

      setModalFeedback({
        type: 'success',
        text: `Leadership successfully transferred to ${memberToTransfer.user?.name || 'new leader'}!`,
      })
      setMemberToTransfer(null)
      if (onGroupUpdated) onGroupUpdated()
    } catch (err) {
      setModalFeedback({ type: 'error', text: err.message || 'Failed to transfer leadership.' })
    } finally {
      setActionLoading(false)
    }
  }

  // 7. Leave Group
  const handleConfirmLeaveGroup = async () => {
    try {
      setActionLoading(true)
      setModalFeedback({ type: '', text: '' })

      await groupsService.leaveCourseGroup(currentGroup.id, currentUser?.id)
      setIsConfirmLeaveOpen(false)

      if (onGroupUpdated) onGroupUpdated()
      onClose()
    } catch (err) {
      setModalFeedback({ type: 'error', text: err.message || 'Failed to leave group.' })
    } finally {
      setActionLoading(false)
    }
  }

  // 8. Safe Delete / Archive Group (Admin / Professor only)
  const openDeleteDialog = async () => {
    if (!currentGroup?.id || !isTeacher) return
    setIsConfirmDisbandOpen(true)
    setDeleteError('')
    setGroupImpact(null)
    setGroupImpactLoading(true)
    try {
      const summary = await groupsService.getGroupImpactSummary(currentGroup.id)
      setGroupImpact(summary)
    } catch (err) {
      setDeleteError(err.message || 'Failed to inspect group history.')
    } finally {
      setGroupImpactLoading(false)
    }
  }

  const handleArchiveGroup = async () => {
    if (!currentGroup?.id || !isTeacher) return
    try {
      setActionLoading(true)
      setDeleteError('')
      await groupsService.archiveCourseGroup(currentGroup.id)
      setIsConfirmDisbandOpen(false)
      toast.success(`Archived group "${currentGroup.name}". Historical submissions and grades preserved.`, 'Group Archived')
      if (onGroupUpdated) onGroupUpdated()
      onClose()
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
      const res = await groupsService.disbandCourseGroup(currentGroup.id)
      setIsConfirmDisbandOpen(false)
      toast.success(
        res?.message || `Group "${currentGroup.name}" updated.`,
        res?.action === 'archived' ? 'Group Archived' : 'Group Deleted'
      )
      if (onGroupUpdated) onGroupUpdated()
      onClose()
    } catch (err) {
      const msg = err.message || 'Failed to disband group.'
      setDeleteError(msg)
      toast.error(msg, 'Delete Failed')
    } finally {
      setActionLoading(false)
    }
  }

  const acknowledgedCount = assignmentHistory.filter((a) => Boolean(a.submission)).length
  const pendingCount = Math.max(0, assignmentHistory.length - acknowledgedCount)
  const gradedCount = assignmentHistory.filter(
    (a) =>
      a.submission &&
      (a.submission.status === 'reviewed' ||
        (a.submission.marks !== null && a.submission.marks !== undefined))
  ).length

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center gap-3 min-w-0 pr-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-primary to-purple-500 text-white flex items-center justify-center font-bold shrink-0 shadow-purple-glow">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-brand-heading leading-tight break-words truncate">
                {currentGroup.name}
              </h3>
              <p className="text-xs text-brand-muted font-normal mt-0.5 truncate">
                Course: <span className="font-semibold text-brand-heading">{courseName}</span>
              </p>
            </div>
          </div>
        }
        size="xl"
      >
        <div className="space-y-5">
          {/* Top Feedback Alert */}
          {modalFeedback.text && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all ${
                modalFeedback.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {modalFeedback.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                )}
                <span>{modalFeedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalFeedback({ type: '', text: '' })}
                className="text-xs font-semibold underline cursor-pointer hover:opacity-80"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* GROUP SUMMARY CARD */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-brand-light/80 via-purple-50/40 to-white border border-brand-line flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-brand-primary to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-purple-glow shrink-0">
                {currentGroup.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-bold text-brand-heading break-words">
                    {currentGroup.name}
                  </h4>
                  <Badge variant="primary" size="sm">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </Badge>
                  {isMember && (
                    <Badge variant="success" size="sm" dot>
                      Your Group
                    </Badge>
                  )}
                  {isLeader && (
                    <Badge variant="purple" size="sm">
                      <Crown className="w-3 h-3 text-amber-500 mr-1" />
                      You are Leader
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-brand-muted mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>
                      Leader:{' '}
                      <strong className="text-brand-heading font-semibold">
                        {currentGroup.leader?.name || 'Assigned Leader'}
                      </strong>
                    </span>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>Class: <strong>{courseName}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {canJoin && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={UserPlus}
                  loading={actionLoading}
                  onClick={handleJoinClick}
                  className="shadow-purple-glow font-bold cursor-pointer"
                >
                  Join Group
                </Button>
              )}

              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={UserPlus}
                  onClick={() => setIsAddMembersOpen(true)}
                  className="cursor-pointer font-medium"
                >
                  Add Members
                </Button>
              )}

              {isMember && !isLeader && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={LogOut}
                  onClick={() => setIsConfirmLeaveOpen(true)}
                  className="text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer"
                >
                  Leave Group
                </Button>
              )}

              {isTeacher && (
                <ActionMenu
                  label={`Actions for ${currentGroup.name}`}
                  items={[
                    {
                      id: 'edit-group',
                      label: 'Edit Group',
                      icon: Edit2,
                      disabled: currentGroup.status === 'archived',
                      onClick: () => setIsEditGroupOpen(true),
                    },
                    ...(currentGroup.status !== 'archived'
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

          {/* TABS NAVIGATION */}
          <div className="flex items-center gap-1.5 border-b border-brand-line/80 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-brand-primary text-white shadow-purple-glow'
                  : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'members'
                  ? 'bg-brand-primary text-white shadow-purple-glow'
                  : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Members ({members.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('assignments')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'assignments'
                  ? 'bg-brand-primary text-white shadow-purple-glow'
                  : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
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
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shrink-0 relative ${
                activeTab === 'chat'
                  ? 'bg-brand-primary text-white shadow-purple-glow'
                  : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Group Chat</span>
              {chatMessages.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'chat' ? 'bg-white/20 text-white' : 'bg-brand-light text-brand-primary'
                }`}>
                  {chatMessages.length}
                </span>
              )}
            </button>
          </div>

          {/* =========================================================================
              TAB 1: OVERVIEW
              ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line">
                  <span className="text-[11px] text-brand-muted uppercase font-bold tracking-wider block">
                    Team Members
                  </span>
                  <p className="text-xl font-black text-brand-heading mt-1">{members.length}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100">
                  <span className="text-[11px] text-brand-primary uppercase font-bold tracking-wider block">
                    Group Tasks
                  </span>
                  <p className="text-xl font-black text-brand-primary mt-1">
                    {loadingHistory && !historyLoaded ? (
                      <span className="inline-block w-6 h-5 bg-purple-200/60 rounded animate-pulse" />
                    ) : (
                      assignmentHistory.length
                    )}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[11px] text-emerald-700 uppercase font-bold tracking-wider block">
                    Submitted
                  </span>
                  <p className="text-xl font-black text-emerald-800 mt-1">
                    {loadingHistory && !historyLoaded ? (
                      <span className="inline-block w-6 h-5 bg-emerald-200/60 rounded animate-pulse" />
                    ) : (
                      acknowledgedCount
                    )}
                  </p>
                  {gradedCount > 0 && !loadingHistory && (
                    <span className="text-[10px] text-emerald-600 block mt-0.5">{gradedCount} reviewed</span>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
                  <span className="text-[11px] text-amber-700 uppercase font-bold tracking-wider block">
                    Pending
                  </span>
                  <p className="text-xl font-black text-amber-800 mt-1">
                    {loadingHistory && !historyLoaded ? (
                      <span className="inline-block w-6 h-5 bg-amber-200/60 rounded animate-pulse" />
                    ) : (
                      pendingCount
                    )}
                  </p>
                </div>
              </div>

              {/* Leader Spotlight Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center font-bold shadow-sm">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                      Designated Group Leader
                    </span>
                    <p className="text-sm font-bold text-brand-heading">
                      {currentGroup.leader?.name || 'Assigned Leader'}
                    </p>
                    <p className="text-xs text-brand-muted">
                      {currentGroup.leader?.email || 'Leader is authorized to submit group deliverables'}
                    </p>
                  </div>
                </div>
                {canManage && members.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ArrowRightLeft}
                    onClick={() => setActiveTab('members')}
                    className="text-amber-800 border-amber-300 hover:bg-amber-100 text-xs cursor-pointer shrink-0"
                  >
                    Manage Roster
                  </Button>
                )}
              </div>

              {/* Recent Activity / Next Step Teaser */}
              <div className="p-4 rounded-xl border border-brand-line bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-brand-heading flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-brand-primary" />
                    <span>Private Group Discussion</span>
                  </h5>
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Chat</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-brand-muted leading-relaxed">
                  Collaborate in real time with your team. Discuss approaches, share ideas, and coordinate assignment deliverables safely within your private workspace.
                </p>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: MEMBERS ROSTER
              ========================================================================= */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Enrolled Members ({members.length})</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  {canManage ? 'Leaders can reassign leadership' : 'One group per course rule enforced'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                {members.map((m, idx) => {
                  const u = m.user || {}
                  const memberId = m.student_id || u.id
                  const isGroupLeader = memberId === currentGroup.leader_id
                  const isCurrentUser = memberId === currentUser?.id

                  return (
                    <div
                      key={m.id || idx}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isGroupLeader
                          ? 'bg-amber-50/50 border-amber-200/90 shadow-xs'
                          : 'bg-white border-brand-line hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isGroupLeader
                              ? 'bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isGroupLeader ? <Crown className="w-4 h-4" /> : (u.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-brand-heading truncate">
                              {u.name || `Student ${idx + 1}`}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[10px] bg-brand-light text-brand-primary font-bold px-1.5 py-0.2 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-brand-muted truncate">
                            {u.email || u.student_id || 'Enrolled Student'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isGroupLeader ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300/60">
                            <Crown className="w-3 h-3 text-amber-600" />
                            Leader
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Member
                            </span>

                            {/* Leader / Instructor Transfer Leadership Action */}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => setMemberToTransfer(m)}
                                title="Transfer Leadership to this member"
                                className="px-2 py-1 rounded-md text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Make Leader</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 3: GROUP ASSIGNMENTS HISTORY
              ========================================================================= */}
          {activeTab === 'assignments' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand-primary" />
                  <span>
                    Eligible Group Assignments{' '}
                    {loadingHistory && !historyLoaded ? (
                      <span className="text-xs font-normal text-slate-400 lowercase">(loading...)</span>
                    ) : (
                      `(${assignmentHistory.length})`
                    )}
                  </span>
                </h4>
                <span className="text-[11px] text-slate-400">Class & allocation verified</span>
              </div>

              {loadingHistory && !historyLoaded ? (
                <div className="space-y-2.5" role="status" aria-label="Loading group assignments">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="p-3.5 rounded-xl border border-brand-line/80 bg-white animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-36 bg-slate-200 rounded" />
                          <div className="h-3 w-12 bg-purple-100 rounded-full" />
                        </div>
                        <div className="h-2.5 w-32 bg-slate-100 rounded" />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="h-6 w-20 bg-slate-100 rounded-full" />
                        <div className="h-7 w-20 bg-purple-100 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : historyError ? (
                <div className="p-6 rounded-xl border border-rose-200 bg-rose-50/40 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
                  <p className="text-xs font-bold text-rose-900">Failed to Load Group Assignments</p>
                  <p className="text-[11px] text-rose-700 max-w-xs mx-auto">{historyError}</p>
                  <button
                    type="button"
                    onClick={() => loadHistory(true)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-rose-200 text-rose-800 text-xs font-semibold hover:bg-rose-50 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Loading</span>
                  </button>
                </div>
              ) : assignmentHistory.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-50 border border-brand-line text-center space-y-1">
                  <p className="text-xs font-semibold text-brand-heading">No Group Assignments Found</p>
                  <p className="text-[11px] text-brand-muted max-w-sm mx-auto">
                    This course does not currently have any published assignments designated for group submission that this team is eligible for.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {assignmentHistory.map((item) => {
                    const hasSub = Boolean(item.submission)
                    const isGraded =
                      item.submission?.status === 'reviewed' ||
                      (item.submission?.marks !== null && item.submission?.marks !== undefined)

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-brand-line bg-white hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-xs font-bold text-brand-heading truncate">{item.title}</h5>
                            <span className="text-[11px] font-semibold text-brand-primary">
                              ({item.points} pts)
                            </span>
                          </div>
                          <p className="text-[11px] text-brand-muted mt-0.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-400" />
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
                            <Badge variant="success" size="sm" dot>
                              Graded: {item.submission.marks} / {item.points}
                            </Badge>
                          ) : hasSub ? (
                            <div className="text-right">
                              <Badge variant="success" size="sm" dot>
                                Submitted
                              </Badge>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                by {item.submission.leader?.name || currentGroup.leader?.name} on{' '}
                                {formatDisplayDate(item.submission.acknowledged_at)}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="warning" size="sm" dot>
                              Not Submitted
                            </Badge>
                          )}

                          {/* For Admin/Professor: Open Work in SubmissionTracking */}
                          {isTeacher ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                if (onClose) onClose()
                                navigate(
                                  `/admin/assignments/${item.id}?groupId=${currentGroup.id}&classId=${currentGroup.class_id}`,
                                  {
                                    state: {
                                      from: 'group',
                                      classId: currentGroup.class_id,
                                      groupId: currentGroup.id,
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
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-primary hover:underline bg-brand-light px-2.5 py-1 rounded cursor-pointer"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Deliverable</span>
                                </a>
                              )}
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  if (onClose) onClose()
                                  navigate(`/student/assignments/${item.id}`, {
                                    state: {
                                      from: 'group',
                                      classId: currentGroup.class_id,
                                      groupId: currentGroup.id,
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
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 4: DEDICATED PRIVATE GROUP CHAT
              ========================================================================= */}
          {activeTab === 'chat' && (
            <div className="space-y-3">
              {!hasChatAccess ? (
                <div className="p-8 rounded-xl bg-slate-50 border border-brand-line text-center space-y-2">
                  <Lock className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-bold text-brand-heading">Private Group Workspace</h4>
                  <p className="text-xs text-brand-muted max-w-sm mx-auto">
                    Only active members of <strong>{currentGroup.name}</strong> and course instructors have permission to view or participate in group discussions.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-brand-line bg-white flex flex-col h-[440px] shadow-xs">
                  {/* Chat Header */}
                  <div className="p-3 border-b border-brand-line/80 bg-slate-50/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center font-bold text-xs">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-brand-heading block leading-tight">
                          {currentGroup.name} Discussion
                        </span>
                        <span className="text-[10px] text-brand-muted font-normal">
                          {members.length} team members • Private chat
                        </span>
                      </div>
                    </div>
                    <Badge variant="purple" size="sm">
                      Live Channel
                    </Badge>
                  </div>

                  {/* Chat Message List */}
                  <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-slate-50/30">
                    {loadingChat ? (
                      <div className="h-full flex items-center justify-center text-xs text-brand-muted animate-pulse">
                        Loading discussion thread...
                      </div>
                    ) : chatError && chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-rose-800">Unable to load group discussion</p>
                        <p className="text-[11px] text-rose-600 max-w-xs">{chatError}</p>
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => loadChatMessages(currentGroup.id)}
                        >
                          Retry Loading
                        </Button>
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                        <div className="w-10 h-10 rounded-full bg-brand-light text-brand-primary flex items-center justify-center mx-auto">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-brand-heading">No messages yet</p>
                        <p className="text-[11px] text-brand-muted max-w-xs">
                          Start the conversation with your team! Coordinate task delegation, share progress, or discuss assignment milestones.
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
                              <div className="flex items-center justify-center my-2">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100/80 px-2.5 py-0.5 rounded-full border border-slate-200/50">
                                  {formatMessageDateSeparator(currentMsgDate)}
                                </div>
                              </div>
                            )}

                            <div className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                  isMe ? 'bg-brand-primary text-white' : meta.avatarBg
                                }`}
                              >
                                {meta.icon === 'Crown' ? (
                                  <Crown className="w-3.5 h-3.5" />
                                ) : meta.icon === 'Shield' ? (
                                  <Shield className="w-3.5 h-3.5" />
                                ) : (
                                  (msg.senderName || 'S').charAt(0).toUpperCase()
                                )}
                              </div>

                              <div className={`max-w-[78%] space-y-1 ${isMe ? 'items-end text-right' : 'items-start text-left'}`}>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[11px] sm:text-xs ${isMe ? 'font-bold text-brand-heading' : meta.nameClass}`}>
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
                                  className={`p-2.5 sm:p-3 rounded-xl text-xs leading-relaxed break-words text-left ${
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
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-brand-line/80 bg-white space-y-2">
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
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-brand-line focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                        required
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        icon={Send}
                        loading={sendingChat}
                        disabled={!newChatMessage.trim() || sendingChat}
                        className="shadow-purple-glow font-bold cursor-pointer shrink-0"
                      >
                        Send
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* SUB-MODAL 1: Add Members Modal */}
      <AddGroupMembersModal
        isOpen={isAddMembersOpen}
        onClose={() => setIsAddMembersOpen(false)}
        group={currentGroup}
        classId={currentGroup.class_id}
        className={courseName}
        onMembersAdded={async () => {
          setIsAddMembersOpen(false)
          setModalFeedback({ type: 'success', text: 'New members successfully added to the group!' })
          if (onGroupUpdated) onGroupUpdated()
        }}
      />

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
                Are you sure you want to transfer leadership of <strong>{currentGroup.name}</strong> to{' '}
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
              <strong className="block font-bold">Leave {currentGroup.name}?</strong>
              <p>
                You will be removed from this group. You will become eligible to create a new group or join another team in <strong>{courseName}</strong>.
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

      {/* SUB-MODAL 3.5: Edit Group Modal (Professor / Admin only) */}
      <EditGroupModal
        isOpen={isEditGroupOpen}
        onClose={() => setIsEditGroupOpen(false)}
        group={currentGroup}
        classId={currentGroup?.class_id}
        currentUser={currentUser}
        onSuccess={(updated) => {
          if (updated) setCurrentGroup(updated)
          if (onGroupUpdated) onGroupUpdated()
        }}
      />

      {/* SUB-MODAL 4: Safe Delete / Archive Group Confirmation */}
      <ConfirmDeleteModal
        isOpen={isConfirmDisbandOpen}
        onClose={() => {
          setIsConfirmDisbandOpen(false)
          setDeleteError('')
        }}
        entityLabel="Group"
        entityName={currentGroup?.name || ''}
        entityMeta={currentGroup?.status === 'archived' ? 'Archived Group' : 'Active Group'}
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
        archiveSupported={currentGroup?.status !== 'archived'}
        archiveLabel="Archive Group"
        loading={actionLoading}
        error={deleteError}
        onConfirmArchive={handleArchiveGroup}
        onConfirmDelete={handleConfirmDisbandGroup}
      />
    </>
  )
}

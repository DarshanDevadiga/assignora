import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Plus,
  UserPlus,
  Crown,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Edit2,
  Trash2,
  Archive,
  Eye
} from 'lucide-react'
import Card from '../common/Card'
import Button from '../common/Button'
import Badge from '../common/Badge'
import ActionMenu from '../common/ActionMenu'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'
import { Input } from '../common/Input'
import GroupManagementModal from '../group/GroupManagementModal'
import GroupDetailsModal from '../group/GroupDetailsModal'
import EditGroupModal from '../group/EditGroupModal'
import ProfessorCreateGroupModal from '../group/ProfessorCreateGroupModal'
import { groupsService } from '../../services/groups.service'
import { useToast } from '../../context/ToastContext'

export default function ClassGroupsTab({
  classId,
  className = 'Course',
  currentUser,
  isTeacher = false,
  onGroupChanged
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const rolePrefix = currentUser?.role === 'admin' ? '/admin' : '/student'

  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroupForDetails, setSelectedGroupForDetails] = useState(null)
  const [editingGroup, setEditingGroup] = useState(null)
  const [deleteGroupTarget, setDeleteGroupTarget] = useState(null)
  const [groupImpact, setGroupImpact] = useState(null)
  const [groupImpactLoading, setGroupImpactLoading] = useState(false)
  const [groupDeleteLoading, setGroupDeleteLoading] = useState(false)
  const [groupDeleteError, setGroupDeleteError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isProfessorCreateOpen, setIsProfessorCreateOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', text: '' })

  // Explicit 4-state membership machine: 'loading' | 'member' | 'not_member' | 'error'
  const [membershipState, setMembershipState] = useState('loading')
  const [membershipGroup, setMembershipGroup] = useState(null)
  const [membershipError, setMembershipError] = useState(null)

  const isStudent = currentUser?.role === 'student' || !isTeacher

  const loadData = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    if (isStudent && currentUser?.id) {
      setMembershipState('loading')
      setMembershipError(null)
    }

    try {
      // Concurrently query course groups and the student's authoritative membership
      const [groupsResult, memberResult] = await Promise.allSettled([
        groupsService.getCourseGroups(classId),
        isStudent && currentUser?.id
          ? groupsService.getStudentGroupInCourse(classId, currentUser.id)
          : Promise.resolve(null)
      ])

      // Handle course groups
      if (groupsResult.status === 'fulfilled') {
        setGroups(groupsResult.value || [])
      } else {
        console.error('[ClassGroupsTab] Error loading groups:', groupsResult.reason)
        setGroups([])
      }

      // Handle membership state authoritatively
      if (isStudent && currentUser?.id) {
        if (memberResult.status === 'fulfilled') {
          const activeGroup = memberResult.value
          if (activeGroup && activeGroup.id) {
            setMembershipGroup(activeGroup)
            setMembershipState('member')
          } else {
            // Also cross-verify with groupsResult in case of edge latency
            const matchedInList = (groupsResult.value || []).find((g) => {
              if (g.leader_id === currentUser.id) return true
              return (g.members || []).some(
                (m) => (m.student_id || m.user?.id) === currentUser.id
              )
            })
            if (matchedInList) {
              setMembershipGroup(matchedInList)
              setMembershipState('member')
            } else {
              setMembershipGroup(null)
              setMembershipState('not_member')
            }
          }
        } else {
          console.error('[ClassGroupsTab] Membership query error:', memberResult.reason)
          setMembershipError(memberResult.reason?.message || 'Failed to verify group membership.')
          setMembershipState('error')
        }
      } else {
        setMembershipState('not_member')
      }
    } catch (err) {
      console.error('[ClassGroupsTab] Unexpected error during loadData:', err)
      setMembershipState('error')
      setMembershipError(err.message || 'Failed to load group data.')
    } finally {
      setLoading(false)
    }
  }, [classId, isStudent, currentUser?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Backward-compatible fallback derivation
  const myGroup = useMemo(() => {
    if (membershipGroup) return membershipGroup
    if (!currentUser?.id) return null
    return groups.find((g) => {
      if (g.leader_id === currentUser.id) return true
      return (g.members || []).some((m) => (m.student_id || m.user?.id) === currentUser.id)
    })
  }, [membershipGroup, groups, currentUser?.id])

  const isUserInAnyGroup = membershipState === 'member' || Boolean(myGroup)

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim()
    if (!q) return groups
    return groups.filter((g) => {
      const matchName = (g.name || '').toLowerCase().includes(q)
      const matchLeader = (g.leader?.name || '').toLowerCase().includes(q)
      const matchMember = (g.members || []).some((m) =>
        (m.user?.name || '').toLowerCase().includes(q)
      )
      return matchName || matchLeader || matchMember
    })
  }, [groups, searchQuery])

  // Navigate to dedicated Group Details page
  const handleOpenGroupDetails = (groupId) => {
    if (!groupId) return
    navigate(`${rolePrefix}/classes/${classId}/groups/${groupId}`)
  }

  // Join action directly from card
  const handleJoinGroup = async (groupId, groupName) => {
    try {
      setActionLoading(true)
      setFeedback({ type: '', text: '' })
      await groupsService.joinCourseGroup(groupId, currentUser?.id)
      setFeedback({ type: 'success', text: `Successfully joined "${groupName}"!` })
      await loadData()
      if (onGroupChanged) onGroupChanged()
      if (selectedGroupForDetails) setSelectedGroupForDetails(null)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to join group.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleGroupUpdated = async () => {
    await loadData()
    if (onGroupChanged) onGroupChanged()
  }

  const openDeleteGroupDialog = async (grp) => {
    setDeleteGroupTarget(grp)
    setGroupDeleteError('')
    setGroupImpact(null)
    setGroupImpactLoading(true)
    try {
      const impact = await groupsService.getGroupImpactSummary(grp.id)
      setGroupImpact(impact)
    } catch (err) {
      setGroupDeleteError(err.message || 'Failed to inspect group submission history.')
    } finally {
      setGroupImpactLoading(false)
    }
  }

  const handleArchiveGroup = async (targetGroup) => {
    const grp = targetGroup || deleteGroupTarget
    if (!grp?.id) return
    try {
      setGroupDeleteLoading(true)
      setGroupDeleteError('')
      await groupsService.archiveCourseGroup(grp.id)
      setDeleteGroupTarget(null)
      toast.success(`Archived group "${grp.name}". Memberships and historical submissions remain preserved.`, 'Group Archived')
      await handleGroupUpdated()
    } catch (err) {
      const msg = err.message || 'Failed to archive group.'
      setGroupDeleteError(msg)
      toast.error(msg, 'Archive Failed')
    } finally {
      setGroupDeleteLoading(false)
    }
  }

  const handleConfirmDeleteGroup = async () => {
    if (!deleteGroupTarget?.id) return
    try {
      setGroupDeleteLoading(true)
      setGroupDeleteError('')
      const res = await groupsService.disbandCourseGroup(deleteGroupTarget.id)
      const gName = deleteGroupTarget.name
      setDeleteGroupTarget(null)
      toast.success(
        res?.message || `Deleted empty group "${gName}" successfully.`,
        res?.action === 'archived' ? 'Group Archived' : 'Group Deleted'
      )
      await handleGroupUpdated()
    } catch (err) {
      const msg = err.message || 'Unable to delete group.'
      setGroupDeleteError(msg)
      toast.error(msg, 'Action Failed')
    } finally {
      setGroupDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-br from-brand-light/90 via-purple-50/50 to-white border border-brand-line">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-brand-heading">Class Groups</h3>
            <Badge variant="primary" size="sm">
              {groups.length} {groups.length === 1 ? 'Group' : 'Groups'}
            </Badge>
          </div>
          <p className="text-xs text-brand-muted mt-1 leading-relaxed">
            Collaborative project groups for <strong>{className}</strong>. Each student may belong to exactly one group per course.
          </p>
        </div>

        {isTeacher ? (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsProfessorCreateOpen(true)}
              className="shadow-purple-glow font-bold cursor-pointer"
            >
              Create Group
            </Button>
          </div>
        ) : isStudent ? (
          <div className="flex items-center gap-2 shrink-0">
            {membershipState === 'loading' ? (
              <div className="h-10 w-32 rounded-xl bg-purple-100/70 animate-pulse border border-purple-200/50" />
            ) : membershipState === 'member' ? (
              <Button
                variant="secondary"
                size="md"
                icon={Users}
                onClick={() => handleOpenGroupDetails(myGroup?.id)}
                className="cursor-pointer"
              >
                View My Group ({myGroup?.name})
              </Button>
            ) : membershipState === 'error' ? (
              <button
                type="button"
                onClick={() => loadData()}
                className="text-xs text-rose-600 hover:text-rose-700 underline font-medium flex items-center gap-1 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            ) : (
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => setIsCreateModalOpen(true)}
                className="shadow-purple-glow font-bold cursor-pointer"
              >
                Create Group
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* Feedback Alert */}
      {feedback.text && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-700'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', text: '' })}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Student Enrollment Status Notice (Only shown when verified not in any group; never during loading) */}
      {isStudent && membershipState === 'not_member' && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">You are not part of any group in this course.</p>
              <p className="text-[11px] text-amber-800">
                To submit group assignments, you must either create a new group or join one of the available teams below.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsCreateModalOpen(true)}
            className="shrink-0 font-semibold cursor-pointer"
          >
            Create a Group
          </Button>
        </div>
      )}

      {/* Student Membership Error Notice (When DB fails, never assume not_member) */}
      {isStudent && membershipState === 'error' && (
        <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200/80 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-200/80 text-rose-800 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-950">Unable to verify team membership.</p>
              <p className="text-[11px] text-rose-800">
                {membershipError || 'A network error occurred while querying your course group status.'}
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => loadData()}
            className="shrink-0 font-semibold cursor-pointer"
          >
            Retry Verification
          </Button>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search groups by name, leader, or member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={Search}
          />
        </div>
        <span className="text-xs text-brand-muted hidden sm:inline-block">
          Showing {filteredGroups.length} of {groups.length} groups
        </span>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl skeleton-shimmer border border-brand-border/40 shadow-xs" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card padding="p-10" className="text-center space-y-3 shadow-card">
          <div className="w-12 h-12 rounded-2xl bg-brand-light text-brand-primary flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-brand-heading">
            {searchQuery ? 'No matching groups found' : 'No Groups Created Yet'}
          </h4>
          <p className="text-xs text-brand-muted max-w-md mx-auto leading-relaxed">
            {searchQuery
              ? `No groups in this course matched "${searchQuery}". Try a different search term.`
              : `There are currently no project groups registered for ${className}. Students enrolled in this course can create the first team.`}
          </p>
          {isTeacher && !searchQuery ? (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsProfessorCreateOpen(true)}
              className="mt-2 shadow-purple-glow font-bold cursor-pointer"
            >
              Create the First Group
            </Button>
          ) : isStudent && membershipState === 'not_member' && !searchQuery ? (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 shadow-purple-glow font-bold cursor-pointer"
            >
              Create the First Group
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((g) => {
            const members = g.members || []
            const isMyGroup = myGroup?.id === g.id
            const isLeader = g.leader_id === currentUser?.id
            const isArchived = g.status === 'archived'
            const canJoinThisGroup = isStudent && !isUserInAnyGroup && !isArchived

            return (
              <Card
                key={g.id}
                padding="p-5"
                className={`flex flex-col justify-between space-y-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover hover:border-brand-primary/40 ${
                  isMyGroup ? 'ring-2 ring-brand-primary/50 shadow-glow-sm bg-gradient-to-b from-purple-50/30 to-white' : ''
                } ${isArchived ? 'opacity-80 bg-slate-50/50' : ''}`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Name + Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isArchived ? 'bg-slate-200 text-slate-600' : 'bg-brand-light text-brand-primary'
                      }`}>
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-brand-heading truncate" title={g.name}>
                            {g.name}
                          </h4>
                        </div>
                        <span className="text-[11px] text-brand-muted">
                          {members.length} {members.length === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <div className="flex flex-col items-end gap-1">
                        {isArchived && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
                            Archived
                          </span>
                        )}
                        {isMyGroup && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/50">
                            Your Group
                          </span>
                        )}
                      </div>

                      {isTeacher && (
                        <ActionMenu
                          label={`Actions for group ${g.name}`}
                          items={[
                            {
                              id: 'view',
                              label: 'View Group',
                              icon: Eye,
                              onClick: () => handleOpenGroupDetails(g.id),
                            },
                            {
                              id: 'edit',
                              label: 'Edit Group',
                              icon: Edit2,
                              disabled: isArchived,
                              onClick: () => setEditingGroup(g),
                            },
                            ...(!isArchived
                              ? [
                                  {
                                    id: 'archive',
                                    label: 'Archive Group',
                                    icon: Archive,
                                    variant: 'warning',
                                    onClick: () => handleArchiveGroup(g),
                                  },
                                ]
                              : []),
                            {
                              id: 'delete',
                              label: 'Delete Group',
                              icon: Trash2,
                              variant: 'danger',
                              dividerBefore: true,
                              onClick: () => openDeleteGroupDialog(g),
                            },
                          ]}
                        />
                      )}
                    </div>
                  </div>

                  {/* Leader Info */}
                  <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Crown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-amber-900 font-semibold truncate">
                        {g.leader?.name || 'Group Leader'}
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full bg-amber-200/80 text-amber-900 shrink-0">
                      Leader
                    </span>
                  </div>

                  {/* Members Stack / List */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Team Roster
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {members.map((m, idx) => {
                        const u = m.user || {}
                        const isMLeader = (m.student_id || u.id) === g.leader_id
                        return (
                          <span
                            key={m.id || idx}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${
                              isMLeader
                                ? 'bg-amber-50 text-amber-900 border-amber-200 font-bold'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isMLeader && <Crown className="w-2.5 h-2.5 text-amber-500" />}
                            <span className="truncate max-w-[120px]">{u.name || `Student ${idx + 1}`}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-brand-line flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenGroupDetails(g.id)}
                    className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Group Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  {canJoinThisGroup ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={UserPlus}
                      loading={actionLoading}
                      onClick={() => handleJoinGroup(g.id, g.name)}
                      className="cursor-pointer shadow-purple-glow font-bold text-xs"
                    >
                      Join Group
                    </Button>
                  ) : isArchived ? (
                    <span className="text-[11px] text-slate-400 font-medium italic">
                      Archived
                    </span>
                  ) : isMyGroup ? (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Enrolled
                    </span>
                  ) : isStudent ? (
                    <span className="text-[11px] text-slate-400 italic">
                      In another team
                    </span>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Group Creation Modal */}
      <GroupManagementModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        classId={classId}
        className={className}
        currentUser={currentUser}
        currentGroup={myGroup}
        initialTab="create"
        onGroupUpdated={handleGroupUpdated}
      />

      {/* Group Details Modal */}
      <GroupDetailsModal
        isOpen={Boolean(selectedGroupForDetails)}
        onClose={() => setSelectedGroupForDetails(null)}
        group={selectedGroupForDetails}
        courseName={className}
        currentUser={currentUser}
        onJoinGroup={handleJoinGroup}
        isUserInAnyGroup={isUserInAnyGroup}
        onGroupUpdated={handleGroupUpdated}
      />

      {/* Professor Group Creation Modal */}
      <ProfessorCreateGroupModal
        isOpen={isProfessorCreateOpen}
        onClose={() => setIsProfessorCreateOpen(false)}
        classId={classId}
        className={className}
        onGroupCreated={handleGroupUpdated}
      />

      {/* Edit Group Modal (Admin / Professor Only) */}
      <EditGroupModal
        isOpen={Boolean(editingGroup)}
        onClose={() => setEditingGroup(null)}
        group={editingGroup}
        classId={classId}
        currentUser={currentUser}
        onSuccess={() => handleGroupUpdated()}
      />

      {/* Safe Delete / Archive Group Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteGroupTarget)}
        onClose={() => {
          setDeleteGroupTarget(null)
          setGroupDeleteError('')
        }}
        entityLabel="Group"
        entityName={deleteGroupTarget?.name || ''}
        entityMeta={deleteGroupTarget?.status === 'archived' ? 'Archived Group' : 'Active Group'}
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
        blockReason="This group has historical group submissions or graded records. Permanent deletion is blocked; archive the group instead to keep member and grading history intact."
        archiveSupported={deleteGroupTarget?.status !== 'archived'}
        archiveLabel="Archive Group"
        archiveHelperText="Archiving marks the group inactive while preserving all members, leadership history, group submissions, and marks."
        loading={groupDeleteLoading}
        error={groupDeleteError}
        onConfirmArchive={() => handleArchiveGroup(deleteGroupTarget)}
        onConfirmDelete={handleConfirmDeleteGroup}
      />
    </div>
  )
}

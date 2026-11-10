import React, { useState, useEffect, useMemo } from 'react'
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
  ArrowRight
} from 'lucide-react'
import Card from '../common/Card'
import Button from '../common/Button'
import Badge from '../common/Badge'
import { Input } from '../common/Input'
import GroupManagementModal from '../group/GroupManagementModal'
import GroupDetailsModal from '../group/GroupDetailsModal'
import { groupsService } from '../../services/groups.service'

export default function ClassGroupsTab({
  classId,
  className = 'Course',
  currentUser,
  isTeacher = false,
  onGroupChanged
}) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroupForDetails, setSelectedGroupForDetails] = useState(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', text: '' })

  const isStudent = currentUser?.role === 'student' || !isTeacher

  useEffect(() => {
    loadGroups()
  }, [classId])

  async function loadGroups() {
    if (!classId) return
    try {
      setLoading(true)
      const list = await groupsService.getCourseGroups(classId)
      setGroups(list)
    } catch (err) {
      console.error('[ClassGroupsTab] Error loading groups:', err)
    } finally {
      setLoading(false)
    }
  }

  // Determine which group the current user belongs to (if any)
  const myGroup = useMemo(() => {
    if (!currentUser?.id) return null
    return groups.find((g) => {
      if (g.leader_id === currentUser.id) return true
      return (g.members || []).some((m) => (m.student_id || m.user?.id) === currentUser.id)
    })
  }, [groups, currentUser?.id])

  const isUserInAnyGroup = Boolean(myGroup)

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

  // Join action directly from card
  const handleJoinGroup = async (groupId, groupName) => {
    try {
      setActionLoading(true)
      setFeedback({ type: '', text: '' })
      await groupsService.joinCourseGroup(groupId, currentUser?.id)
      setFeedback({ type: 'success', text: `Successfully joined "${groupName}"!` })
      await loadGroups()
      if (onGroupChanged) onGroupChanged()
      if (selectedGroupForDetails) setSelectedGroupForDetails(null)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to join group.' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleGroupUpdated = async () => {
    await loadGroups()
    if (onGroupChanged) onGroupChanged()
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

        {isStudent && (
          <div className="flex items-center gap-2 shrink-0">
            {!isUserInAnyGroup ? (
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => setIsCreateModalOpen(true)}
                className="shadow-purple-glow font-bold cursor-pointer"
              >
                Create Group
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                icon={Users}
                onClick={() => setSelectedGroupForDetails(myGroup)}
                className="cursor-pointer"
              >
                View My Group ({myGroup.name})
              </Button>
            )}
          </div>
        )}
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

      {/* Student Enrollment Status Notice */}
      {isStudent && !isUserInAnyGroup && (
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
            <div key={i} className="h-48 rounded-2xl bg-slate-100/80 animate-pulse border border-brand-line/60" />
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
          {isStudent && !isUserInAnyGroup && !searchQuery && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 shadow-purple-glow font-bold cursor-pointer"
            >
              Create the First Group
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((g) => {
            const members = g.members || []
            const isMyGroup = myGroup?.id === g.id
            const isLeader = g.leader_id === currentUser?.id
            const canJoinThisGroup = isStudent && !isUserInAnyGroup

            return (
              <Card
                key={g.id}
                padding="p-5"
                className={`flex flex-col justify-between space-y-4 shadow-card transition-all hover:shadow-card-hover ${
                  isMyGroup ? 'ring-2 ring-brand-primary/40 bg-gradient-to-b from-purple-50/20 to-white' : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Name + Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-brand-heading truncate" title={g.name}>
                          {g.name}
                        </h4>
                        <span className="text-[11px] text-brand-muted">
                          {members.length} {members.length === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {isMyGroup && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/50">
                          Your Group
                        </span>
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
                    onClick={() => setSelectedGroupForDetails(g)}
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
      />
    </div>
  )
}

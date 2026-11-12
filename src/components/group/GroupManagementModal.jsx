import React, { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Crown,
  LogOut,
  Trash2,
  Shield,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Layers,
  X
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import { Input } from '../common/Input'
import { groupsService } from '../../services/groups.service'
import AddGroupMembersModal from './AddGroupMembersModal'

export default function GroupManagementModal({
  isOpen,
  onClose,
  classId,
  className = 'Course',
  currentUser,
  currentGroup,
  onGroupUpdated,
  initialTab = 'myGroup' // 'myGroup', 'join', 'create'
}) {
  const [activeGroup, setActiveGroup] = useState(currentGroup)
  const [courseGroups, setCourseGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedNewLeaderId, setSelectedNewLeaderId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    setActiveGroup(currentGroup)
  }, [currentGroup])

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('')
      setSuccessMessage('')
      setSelectedNewLeaderId('')
      setNewGroupName('')
      setSearchQuery('')

      // Only fetch course groups list if opened in 'join' mode
      if (initialTab === 'join' && classId) {
        loadCourseGroups()
      }
    }
  }, [isOpen, classId, initialTab])

  async function loadCourseGroups() {
    if (!classId) return
    try {
      setLoading(true)
      const list = await groupsService.getCourseGroups(classId)
      setCourseGroups(list)
    } catch (err) {
      console.error('[GroupManagementModal] Error loading groups:', err)
    } finally {
      setLoading(false)
    }
  }

  // Refresh active group data
  async function refreshActiveGroup() {
    if (!activeGroup?.id) return
    try {
      const fresh = await groupsService.getGroupById(activeGroup.id)
      if (fresh) {
        setActiveGroup(fresh)
        if (onGroupUpdated) onGroupUpdated(fresh)
      }
    } catch (err) {
      console.error('[GroupManagementModal] Error refreshing group:', err)
    }
  }

  // Action: Create Group
  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) {
      setErrorMessage('Please enter a group name.')
      return
    }

    try {
      setActionLoading(true)
      setErrorMessage('')
      setSuccessMessage('')
      const created = await groupsService.createCourseGroup(classId, newGroupName.trim())
      setSuccessMessage(`Group "${newGroupName.trim()}" created successfully!`)
      setNewGroupName('')
      if (onGroupUpdated) onGroupUpdated(created)
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create group.')
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Join Group
  const handleJoinGroup = async (groupId, groupName) => {
    try {
      setActionLoading(true)
      setErrorMessage('')
      setSuccessMessage('')
      await groupsService.joinCourseGroup(groupId, currentUser?.id)
      setSuccessMessage(`You have joined "${groupName}"!`)
      if (onGroupUpdated) {
        const updated = await groupsService.getStudentGroupInCourse(classId, currentUser?.id)
        onGroupUpdated(updated)
      }
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to join group.')
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Leave Group
  const handleLeaveGroup = async () => {
    if (!activeGroup) return
    const confirmLeave = window.confirm(
      'Are you sure you want to leave this group? You will need to join or create another group to submit group assignments.'
    )
    if (!confirmLeave) return

    try {
      setActionLoading(true)
      setErrorMessage('')
      await groupsService.leaveCourseGroup(activeGroup.id, currentUser?.id)
      setSuccessMessage('You have left the group.')
      if (onGroupUpdated) onGroupUpdated(null)
      setTimeout(() => {
        onClose()
      }, 800)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to leave group.')
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Transfer Leadership
  const handleTransferLeadership = async () => {
    if (!activeGroup || !selectedNewLeaderId) {
      setErrorMessage('Please select a member to transfer leadership to.')
      return
    }

    try {
      setActionLoading(true)
      setErrorMessage('')
      await groupsService.transferGroupLeadership(activeGroup.id, selectedNewLeaderId)
      setSuccessMessage('Leadership transferred successfully.')
      await refreshActiveGroup()
    } catch (err) {
      setErrorMessage(err.message || 'Failed to transfer leadership.')
    } finally {
      setActionLoading(false)
    }
  }

  // Action: Disband Group
  const handleDisbandGroup = async () => {
    if (!activeGroup) return
    const confirmDisband = window.confirm(
      'Are you sure you want to disband this group? If any assignment submissions have been recorded, the group will be archived to protect academic history.'
    )
    if (!confirmDisband) return

    try {
      setActionLoading(true)
      setErrorMessage('')
      const res = await groupsService.disbandCourseGroup(activeGroup.id)
      setSuccessMessage(res.message || 'Group disbanded successfully.')
      if (onGroupUpdated) onGroupUpdated(null)
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setErrorMessage(err.message || 'Failed to disband group.')
    } finally {
      setActionLoading(false)
    }
  }

  // Is this Manage Team mode?
  const isManageTeam = Boolean(initialTab === 'myGroup' || (!['create', 'join'].includes(initialTab) && activeGroup))
  const isLeader = Boolean(activeGroup && activeGroup.leader_id === currentUser?.id)
  const isTeacher = Boolean(currentUser?.role === 'admin')
  const canManageMembers = (isLeader || isTeacher) && activeGroup?.status === 'active'
  const isArchived = Boolean(activeGroup && activeGroup.status === 'archived')
  const otherMembers = activeGroup?.members?.filter((m) => m.student_id !== currentUser?.id) || []

  // Active groups for join tab
  const filteredGroups = courseGroups.filter(
    (g) => g.status === 'active' && (g.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Dynamic modal title & subtitle
  const modalTitle = isManageTeam
    ? `Manage Team: ${activeGroup?.name || 'Group'}`
    : initialTab === 'create'
    ? 'Create New Group'
    : 'Browse & Join Groups'

  const modalSubtitle = `${className} • ${
    isManageTeam ? 'Team Management' : initialTab === 'create' ? 'New Team' : 'Available Teams'
  }`

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        subtitle={modalSubtitle}
        size="lg"
      >
        <div className="space-y-5">
          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* ========================================================
              VIEW 1: MANAGE TEAM (No tabs, dedicated group management)
             ======================================================== */}
          {isManageTeam && activeGroup && (
            <div className="space-y-5">
              {/* Group Header Card */}
              <div className="p-4 rounded-2xl bg-brand-light/40 border border-brand-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-primary text-white flex items-center justify-center shadow-purple-glow shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-brand-heading truncate">
                        {activeGroup.name}
                      </h4>
                      <Badge variant={isArchived ? 'neutral' : 'primary'} size="sm">
                        {isArchived ? 'Archived' : 'Active'}
                      </Badge>
                    </div>
                    <p className="text-xs text-brand-muted mt-0.5">
                      {className} • {activeGroup.members?.length || 1}{' '}
                      {(activeGroup.members?.length || 1) === 1 ? 'Member' : 'Members'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isLeader && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                      <span>Group Leader</span>
                    </div>
                  )}

                  {canManageMembers && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={UserPlus}
                      onClick={() => setIsAddMembersOpen(true)}
                      className="cursor-pointer font-semibold text-xs border-brand-primary/40 text-brand-primary hover:bg-brand-light"
                    >
                      Add Members
                    </Button>
                  )}
                </div>
              </div>

              {/* Members Roster */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h5 className="text-xs font-bold text-brand-heading uppercase tracking-wider">
                    Complete Member Roster ({activeGroup.members?.length || 0})
                  </h5>
                  {canManageMembers && (
                    <button
                      type="button"
                      onClick={() => setIsAddMembersOpen(true)}
                      className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Enrolled Student</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {activeGroup.members?.map((mem) => {
                    const isThisLeader = mem.student_id === activeGroup.leader_id
                    const isYou = mem.student_id === currentUser?.id
                    return (
                      <div
                        key={mem.id || mem.student_id}
                        className="p-3 rounded-xl border border-brand-line bg-white flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {(mem.user?.name || mem.user?.email || 'S')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-brand-heading truncate">
                              {mem.user?.name || mem.user?.email || 'Student'}
                              {isYou && (
                                <span className="ml-1.5 text-[11px] text-brand-primary font-medium">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-brand-muted truncate">
                              {mem.user?.student_id ? `ID: ${mem.user.student_id} • ` : ''}
                              {mem.user?.email}
                            </p>
                          </div>
                        </div>

                        {isThisLeader ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold shrink-0">
                            <Crown className="w-3 h-3 text-amber-600" /> Leader
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium shrink-0">Member</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Leader Controls: Transfer Leadership */}
              {isLeader && !isArchived && otherMembers.length > 0 && (
                <div className="p-4 rounded-xl border border-brand-line/80 bg-slate-50/70 space-y-3">
                  <h5 className="text-xs font-bold text-brand-heading flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>Transfer Group Leadership</span>
                  </h5>
                  <p className="text-[11px] text-brand-muted">
                    Designate another active group member as the leader. The new leader will assume responsibility for assignment acknowledgements.
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedNewLeaderId}
                      onChange={(e) => setSelectedNewLeaderId(e.target.value)}
                      className="flex-1 rounded-lg border border-brand-line bg-white px-3 py-2 text-xs font-medium text-brand-heading focus:border-brand-primary focus:outline-none"
                    >
                      <option value="">Select a member...</option>
                      {otherMembers.map((m) => (
                        <option key={m.student_id} value={m.student_id}>
                          {m.user?.name || m.user?.email}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={actionLoading}
                      onClick={handleTransferLeadership}
                      disabled={!selectedNewLeaderId}
                    >
                      Transfer
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions: Leave (Students) / Manage & Done */}
              <div className="flex items-center justify-between pt-3 border-t border-brand-line/60">
                {!isLeader && !isTeacher ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLeaveGroup}
                    loading={actionLoading}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    icon={LogOut}
                  >
                    Leave Group
                  </Button>
                ) : isTeacher ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisbandGroup}
                    loading={actionLoading}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    icon={Trash2}
                  >
                    Disband / Archive Group
                  </Button>
                ) : (
                  <span className="text-[11px] text-brand-muted">
                    Transfer leadership to leave this group.
                  </span>
                )}

                <Button variant="primary" size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 2: CREATE GROUP (Dedicated Create Modal)
             ======================================================== */}
          {!isManageTeam && initialTab === 'create' && (
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-brand-light/30 border border-brand-border/60 text-xs text-brand-heading">
                <p className="font-semibold mb-1">Group Creation Policy:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-brand-muted text-[11px]">
                  <li>You will automatically be designated as the <strong>Group Leader</strong>.</li>
                  <li>You are enrolled as the initial active member.</li>
                  <li>Only one group is permitted per student per course.</li>
                </ul>
              </div>

              <Input
                label="Group / Team Name"
                placeholder="e.g. Lambda Innovators, Quantum Devs"
                required
                value={newGroupName}
                onChange={(e) => {
                  setNewGroupName(e.target.value)
                  if (errorMessage) setErrorMessage('')
                }}
                icon={Users}
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={actionLoading}
                  icon={UserPlus}
                >
                  Create Group
                </Button>
              </div>
            </form>
          )}

          {/* ========================================================
              VIEW 3: BROWSE & JOIN GROUPS (Dedicated Browse Modal)
             ======================================================== */}
          {!isManageTeam && initialTab === 'join' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search groups in this class by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-brand-line bg-white placeholder:text-slate-400 focus:border-brand-primary focus:outline-none"
                />
              </div>

              {loading ? (
                <div className="py-8 text-center text-xs text-brand-muted">
                  Loading course groups...
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-brand-muted">
                    {searchQuery ? 'No groups match your search query.' : 'No groups have been created in this class yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredGroups.map((grp) => {
                    const isCurrent = activeGroup?.id === grp.id
                    const memberCount = grp.members?.length || 1

                    return (
                      <div
                        key={grp.id}
                        className="p-3.5 rounded-xl border border-brand-line bg-white flex items-center justify-between gap-3 shadow-2xs hover:border-brand-primary/50 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs sm:text-sm font-bold text-brand-heading">
                              {grp.name}
                            </h5>
                            {isCurrent && (
                              <Badge variant="primary" size="sm">
                                Current Group
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-brand-muted mt-0.5">
                            Leader: <span className="font-medium text-slate-600">{grp.leader?.name || grp.leader?.email || 'Leader'}</span> • {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </p>
                        </div>

                        {isCurrent ? (
                          <span className="text-xs font-semibold text-brand-primary flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Joined
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={actionLoading}
                            onClick={() => handleJoinGroup(grp.id, grp.name)}
                            disabled={Boolean(activeGroup)}
                          >
                            {activeGroup ? 'In another group' : 'Join Group'}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-end pt-2 border-t border-brand-line/60">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Embedded Add Members Modal for Leader / Instructor */}
      {isAddMembersOpen && activeGroup && (
        <AddGroupMembersModal
          isOpen={isAddMembersOpen}
          onClose={() => setIsAddMembersOpen(false)}
          group={activeGroup}
          classId={classId}
          className={className}
          onMembersAdded={async () => {
            await refreshActiveGroup()
          }}
        />
      )}
    </>
  )
}

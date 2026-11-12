import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Crown, RefreshCw, Shield, UserMinus, UserPlus, Users } from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import { Input, Select } from '../common/Input'
import { groupsService } from '../../services/groups.service'
import { useToast } from '../../context/ToastContext'

export default function EditGroupModal({
  isOpen,
  onClose,
  group,
  classId,
  currentUser,
  onSuccess,
}) {
  const toast = useToast()
  const [groupDetails, setGroupDetails] = useState(group || null)
  const [name, setName] = useState('')
  const [leaderId, setLeaderId] = useState('')
  const [selectedAddIds, setSelectedAddIds] = useState([])
  const [classStudents, setClassStudents] = useState([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removingStudentId, setRemovingStudentId] = useState(null)
  const [error, setError] = useState('')

  const isTeacher = currentUser?.role === 'admin'
  const isArchived = groupDetails?.status === 'archived'
  const members = useMemo(() => groupDetails?.members || [], [groupDetails?.members])

  useEffect(() => {
    if (!isOpen || !group?.id) return

    let active = true
    setError('')
    setSelectedAddIds([])
    setRemovingStudentId(null)
    setGroupDetails(group)
    setName(group.name || '')
    setLeaderId(group.leader_id || '')

    const loadContext = async () => {
      try {
        setLoadingRoster(true)
        const targetClassId = classId || group.class_id
        const [freshGroup, roster] = await Promise.all([
          groupsService.getGroupById(group.id),
          targetClassId ? groupsService.getClassStudentsGroupStatus(targetClassId) : Promise.resolve([]),
        ])
        if (!active) return
        if (freshGroup) {
          setGroupDetails(freshGroup)
          setName(freshGroup.name || '')
          setLeaderId(freshGroup.leader_id || '')
        }
        setClassStudents(roster || [])
      } catch (err) {
        if (active) {
          console.warn('[EditGroupModal] Context load warning:', err)
        }
      } finally {
        if (active) setLoadingRoster(false)
      }
    }

    loadContext()
    return () => {
      active = false
    }
  }, [isOpen, group, classId])

  const memberIds = useMemo(
    () => new Set(members.map((m) => m.student_id || m.user?.id).filter(Boolean)),
    [members]
  )

  const unassignedStudents = useMemo(
    () =>
      classStudents.filter(
        (s) => !s.isAssigned && !memberIds.has(s.id)
      ),
    [classStudents, memberIds]
  )

  const leaderOptions = useMemo(
    () =>
      members.map((m) => {
        const uid = m.student_id || m.user?.id
        const uName = m.user?.name || 'Student'
        const uEmail = m.user?.email ? ` (${m.user.email})` : ''
        return {
          value: uid,
          label: `${uName}${uEmail}`,
        }
      }),
    [members]
  )

  const toggleAddStudent = (studentId) => {
    setSelectedAddIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    )
  }

  const handleRemoveMember = async (studentId, studentName) => {
    if (!groupDetails?.id || !isTeacher || isArchived) return
    if (studentId === groupDetails.leader_id) {
      setError('Transfer group leadership before removing the current leader.')
      return
    }

    try {
      setRemovingStudentId(studentId)
      setError('')
      await groupsService.removeGroupMember(groupDetails.id, studentId)
      const targetClassId = classId || groupDetails.class_id
      const [freshGroup, roster] = await Promise.all([
        groupsService.getGroupById(groupDetails.id),
        targetClassId ? groupsService.getClassStudentsGroupStatus(targetClassId) : Promise.resolve([]),
      ])
      setGroupDetails(freshGroup)
      setClassStudents(roster || [])
      toast.success(`Removed ${studentName || 'student'} from group (still enrolled in class).`, 'Member Removed')
      if (typeof onSuccess === 'function') {
        onSuccess(freshGroup)
      }
    } catch (err) {
      const msg = err.message || 'Unable to remove group member.'
      setError(msg)
      toast.error(msg, 'Member Update Failed')
    } finally {
      setRemovingStudentId(null)
    }
  }

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    if (!groupDetails?.id) return
    if (!isTeacher) {
      setError('Only authorized professors or admins can edit group details here.')
      return
    }
    if (isArchived) {
      setError('Archived groups are read-only to preserve academic submission history.')
      return
    }

    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setError('Group name must be at least 2 characters.')
      return
    }

    if (leaderId && !memberIds.has(leaderId) && !selectedAddIds.includes(leaderId)) {
      setError('Selected group leader must belong to this group.')
      return
    }

    try {
      setSaving(true)
      setError('')

      if (selectedAddIds.length > 0) {
        await groupsService.addGroupMembers(groupDetails.id, selectedAddIds)
      }

      const updated = await groupsService.updateGroupDetails(groupDetails.id, {
        name: trimmedName,
        leaderId,
      })

      toast.success(`Updated group "${updated?.name || trimmedName}" successfully.`, 'Group Saved')
      if (typeof onSuccess === 'function') {
        onSuccess(updated)
      }
      onClose()
    } catch (err) {
      const msg = err.message || 'Failed to save group changes.'
      setError(msg)
      toast.error(msg, 'Update Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!saving && !removingStudentId) onClose()
      }}
      title="Edit Group"
      subtitle={groupDetails?.name ? `Team: ${groupDetails.name}` : 'Manage group details and leadership'}
      size="lg"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {isArchived && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-800 flex items-start gap-2.5">
            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              This group is archived to preserve historical group submissions and grades. Details are read-only.
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Group Name"
            required
            disabled={saving || isArchived}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Team Alpha"
          />

          <Select
            label="Group Leader"
            disabled={saving || isArchived || leaderOptions.length === 0}
            value={leaderId}
            onChange={(e) => setLeaderId(e.target.value)}
            options={leaderOptions}
            helperText="Leader must be an existing active member."
          />
        </div>

        {/* Current Members */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-brand-primary" />
              Current Members ({members.length})
            </p>
            <span className="text-[11px] text-brand-muted">
              1 group per student per class enforced
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto bg-white">
            {members.map((member) => {
              const uid = member.student_id || member.user?.id
              const isCurrentLeader = uid === groupDetails?.leader_id
              const memberName = member.user?.name || 'Student'
              return (
                <div
                  key={uid}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {memberName}
                      </p>
                      {isCurrentLeader && (
                        <Badge variant="purple" size="sm">
                          <Crown className="w-3 h-3 inline mr-1" />
                          Leader
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {member.user?.email || uid}
                    </p>
                  </div>

                  {!isArchived && isTeacher && !isCurrentLeader && (
                    <button
                      type="button"
                      disabled={removingStudentId === uid || saving}
                      onClick={() => handleRemoveMember(uid, memberName)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Remove from group (remains enrolled in class)"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      {removingStudentId === uid ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              )
            })}
            {members.length === 0 && (
              <p className="px-3.5 py-4 text-xs text-slate-500 text-center">
                No members assigned to this group yet.
              </p>
            )}
          </div>
        </div>

        {/* Add Unassigned Class Students */}
        {!isArchived && isTeacher && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-brand-primary" />
              Add Eligible Unassigned Students ({unassignedStudents.length})
            </p>
            {loadingRoster ? (
              <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ) : unassignedStudents.length > 0 ? (
              <div className="rounded-xl border border-slate-200 max-h-40 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                {unassignedStudents.map((student) => {
                  const checked = selectedAddIds.includes(student.id)
                  return (
                    <label
                      key={student.id}
                      className="px-3.5 py-2 flex items-center gap-3 cursor-pointer hover:bg-white transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving}
                        onChange={() => toggleAddStudent(student.id)}
                        className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {student.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{student.email}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-200">
                All enrolled class students are already assigned to an active group.
              </p>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={saving || Boolean(removingStudentId)}
          >
            {isArchived ? 'Close' : 'Cancel'}
          </Button>
          {!isArchived && (
            <Button
              type="submit"
              loading={saving}
              disabled={saving || Boolean(removingStudentId)}
              icon={error ? RefreshCw : undefined}
            >
              {error ? 'Retry Save' : 'Save Group Changes'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}

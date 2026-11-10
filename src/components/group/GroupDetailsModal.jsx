import React, { useState, useEffect } from 'react'
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
  Award
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import { groupsService } from '../../services/groups.service'
import { formatDisplayDate } from '../../utils/calculations'

export default function GroupDetailsModal({
  isOpen,
  onClose,
  group,
  courseName = 'Course',
  currentUser,
  onJoinGroup,
  isUserInAnyGroup = false
}) {
  const [assignmentHistory, setAssignmentHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (isOpen && group?.id && group?.class_id) {
      loadHistory()
    }
  }, [isOpen, group])

  async function loadHistory() {
    try {
      setLoadingHistory(true)
      const list = await groupsService.getGroupAssignmentHistory(group.class_id, group.id)
      setAssignmentHistory(list)
    } catch (err) {
      console.error('[GroupDetailsModal] Error loading assignment history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  if (!group) return null

  const members = group.members || []
  const isLeader = currentUser?.id === group.leader_id
  const isMember = members.some((m) => (m.student_id || m.user?.id) === currentUser?.id)
  const canJoin = !isUserInAnyGroup && !isMember && currentUser?.role === 'student'

  const handleJoinClick = async () => {
    if (!onJoinGroup) return
    try {
      setJoining(true)
      await onJoinGroup(group.id, group.name)
    } finally {
      setJoining(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-heading leading-tight">{group.name}</h3>
            <p className="text-xs text-brand-muted font-normal">
              Course: <span className="font-medium text-brand-heading">{courseName}</span>
            </p>
          </div>
        </div>
      }
      size="lg"
    >
      <div className="space-y-6">
        {/* Top Summary Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-light/70 via-purple-50/40 to-white border border-brand-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-primary text-white flex items-center justify-center font-black text-lg shadow-purple-glow">
              {group.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-brand-heading">{group.name}</h4>
                <Badge variant="primary" size="sm">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </Badge>
                {isMember && (
                  <Badge variant="success" size="sm" dot>
                    Your Group
                  </Badge>
                )}
              </div>
              <p className="text-xs text-brand-muted mt-0.5 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  Group Leader:{' '}
                  <strong className="text-brand-heading font-semibold">
                    {group.leader?.name || 'Assigned Leader'}
                  </strong>
                </span>
              </p>
            </div>
          </div>

          {canJoin && (
            <Button
              variant="primary"
              size="sm"
              icon={UserPlus}
              loading={joining}
              onClick={handleJoinClick}
              className="shrink-0 cursor-pointer shadow-purple-glow"
            >
              Join This Group
            </Button>
          )}
        </div>

        {/* Section 1: Team Members Roster */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-brand-primary" />
              <span>Team Members ({members.length})</span>
            </h4>
            <span className="text-[11px] text-slate-400">Creator automatically appointed as leader</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {members.map((m, idx) => {
              const u = m.user || {}
              const isGroupLeader = (m.student_id || u.id) === group.leader_id
              const isCurrentUser = (m.student_id || u.id) === currentUser?.id

              return (
                <div
                  key={m.id || idx}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                    isGroupLeader
                      ? 'bg-amber-50/40 border-amber-200/80 shadow-sm'
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-brand-heading truncate">
                          {u.name || `Student ${idx + 1}`}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.2 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-brand-muted truncate">{u.email || u.student_id || 'Enrolled Student'}</p>
                    </div>
                  </div>

                  <div className="shrink-0">
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
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 2: Group Assignment History & Acknowledgement Status */}
        <div className="space-y-3 pt-2 border-t border-brand-line">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-primary" />
              <span>Group Assignment History</span>
            </h4>
            <span className="text-[11px] text-slate-400">Course-specific submissions</span>
          </div>

          {loadingHistory ? (
            <div className="p-6 text-center text-xs text-brand-muted animate-pulse">
              Loading group assignment records...
            </div>
          ) : assignmentHistory.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 border border-brand-line text-center space-y-1">
              <p className="text-xs font-semibold text-brand-heading">No Group Assignments Found</p>
              <p className="text-[11px] text-brand-muted">
                This course does not currently have any assignments designated for group submission.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignmentHistory.map((item) => {
                const sub = item.submission
                const isAck = item.isAcknowledged
                const dateStr = sub?.acknowledged_at
                  ? `${formatDisplayDate(sub.acknowledged_at)} at ${new Date(
                      sub.acknowledged_at
                    ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : null

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-brand-line bg-white hover:border-brand-primary/40 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="text-xs sm:text-sm font-bold text-brand-heading">{item.title}</h5>
                        <p className="text-[11px] text-brand-muted flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            Due: {formatDisplayDate(item.due_date)} {item.due_time || ''}
                          </span>
                          <span>•</span>
                          <span>{item.points || 100} pts</span>
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isAck ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Acknowledged
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Not submitted by group leader
                          </span>
                        )}
                      </div>
                    </div>

                    {isAck && (
                      <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 text-xs text-emerald-900 flex items-center justify-between gap-2">
                        <p className="text-[11px] leading-relaxed">
                          <strong>Acknowledged by {sub?.leader?.name || group.leader?.name || 'Group Leader'}</strong> on{' '}
                          {dateStr}
                        </p>
                        {sub?.submission_link && (
                          <a
                            href={sub.submission_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-primary hover:underline shrink-0"
                          >
                            <span>View Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    {sub?.marks !== null && sub?.marks !== undefined && (
                      <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-brand-primary" />
                          <span>Grade: {sub.marks} / {item.points} pts</span>
                        </span>
                        {sub.feedback && (
                          <span className="text-[11px] italic text-purple-700 truncate max-w-xs">
                            "{sub.feedback}"
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

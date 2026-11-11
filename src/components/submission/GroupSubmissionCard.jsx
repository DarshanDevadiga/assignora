import React, { useState, useMemo } from 'react'
import {
  Users,
  Crown,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  FileCode,
  ExternalLink,
  Download,
  Eye,
  Award,
  Check,
  Copy,
  Cloud,
  FileSpreadsheet,
  Presentation,
  ChevronDown,
  ChevronUp,
  Globe,
  Sparkles,
  FileCheck
} from 'lucide-react'
import Card from '../common/Card'
import Button from '../common/Button'
import Badge from '../common/Badge'
import { formatDisplayDate, sanitizeUrl } from '../../utils/calculations'
import { classifyDeliverable } from '../../utils/deliverableClassifier'

/**
 * GroupSubmissionCard
 * Modern, responsive submission card used across Admin, Professor, and Student dashboards.
 */
export default function GroupSubmissionCard({
  group,
  submission,
  assignment,
  userRole = 'admin',
  isSubmitted = true,
  onViewWork,
  onGrade,
  className = '',
}) {
  const [copied, setCopied] = useState(false)
  const [showAllMembers, setShowAllMembers] = useState(false)

  const isStaff = userRole === 'admin' || userRole === 'professor'

  // Extract group fields
  const groupId = group?.id
  const groupName = group?.name || 'Group'
  const leaderName = group?.leaderName || group?.leader?.name || 'Group Leader'
  const members = group?.members || []
  const memberNames = group?.memberNames || members.map((m) => m.user?.name || m.name).filter(Boolean) || []

  // Extract submission fields
  const sub = submission || group?.sub || {}
  const submissionLink = sub?.submission_link || group?.submission_link || ''
  const commentText = sub?.comment || group?.comment || ''
  const acknowledgedAt = sub?.acknowledged_at || group?.acknowledged_at || null

  const isUuid = (val) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())

  const acknowledgedBy =
    sub?.acknowledged_by_name ||
    sub?.leader?.name ||
    group?.acknowledged_by_name ||
    group?.acknowledged_by ||
    leaderName ||
    (!isUuid(sub?.acknowledged_by) ? sub?.acknowledged_by : null) ||
    'Group Leader'

  // Grading details
  const isGraded = Boolean(sub && (sub.status === 'reviewed' || (sub.marks !== null && sub.marks !== undefined && sub.marks !== '—')))
  const marks = isGraded ? sub.marks : null
  const letterGrade = sub?.letterGrade || group?.letterGrade || '—'
  const feedback = sub?.feedback || group?.feedback || ''
  const maxPoints = assignment?.points || 100

  // Classify deliverable
  const deliverable = useMemo(() => {
    return classifyDeliverable({
      submissionLink,
      comment: commentText,
      onedriveLink: assignment?.onedrive_link,
      driveLink: assignment?.drive_link,
      assignmentId: assignment?.id,
      groupId,
      classId: assignment?.class_id,
      userRole,
    })
  }, [submissionLink, commentText, assignment, groupId, userRole])

  const handleCopyLink = async (e) => {
    e.stopPropagation()
    if (!deliverable.url) return
    try {
      await navigator.clipboard.writeText(deliverable.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (_) {}
  }

  // Display members logic (truncate if > 4)
  const displayedMembers = showAllMembers ? memberNames : memberNames.slice(0, 4)
  const hasHiddenMembers = memberNames.length > 4

  return (
    <Card
      padding="p-0"
      className={`overflow-hidden border border-brand-line/80 bg-white shadow-card hover:shadow-lg transition-all duration-200 flex flex-col justify-between ${className}`}
    >
      {/* =========================================================================
          SECTION A: CARD HEADER
      ========================================================================= */}
      <div className="p-4 sm:p-5 border-b border-brand-line/60 bg-gradient-to-r from-slate-50/90 via-white to-purple-50/30">
        <div className="flex items-start justify-between gap-3">
          {/* Group Icon & Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black shrink-0 shadow-xs ${
              isSubmitted
                ? 'bg-gradient-to-br from-brand-primary to-purple-600 text-white shadow-purple-glow/40'
                : 'bg-amber-100 text-amber-700 border border-amber-200'
            }`}>
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base sm:text-lg font-extrabold text-brand-heading truncate">
                  {groupName}
                </h4>
                <span className="text-[11px] font-semibold text-brand-muted bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                  {memberNames.length} {memberNames.length === 1 ? 'member' : 'members'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-amber-800 font-bold truncate">
                <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Leader: {leaderName}</span>
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {isSubmitted ? (
              <>
                <Badge
                  variant={isGraded ? 'purple' : deliverable.isDeliverable ? 'success' : 'warning'}
                  size="sm"
                  dot
                >
                  {isGraded
                    ? `Graded (${marks}/${maxPoints})`
                    : deliverable.isDeliverable
                    ? 'Deliverable Submitted'
                    : 'Acknowledged (No Deliverable)'}
                </Badge>
                {group?.isLate && (
                  <Badge variant="danger" size="sm">
                    Late
                  </Badge>
                )}
              </>
            ) : (
              <Badge
                variant={group?.status === 'overdue' ? 'danger' : 'warning'}
                size="sm"
                dot
              >
                {group?.status === 'overdue' ? 'Missing (Overdue)' : 'Pending Submission'}
              </Badge>
            )}
          </div>
        </div>

        {/* =========================================================================
            SECTION B: GROUP MEMBERS CHIPS
        ========================================================================= */}
        {memberNames.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-brand-line/50">
            <div className="flex items-center justify-between text-[11px] text-brand-muted font-semibold mb-1.5">
              <span>Roster Members</span>
              {hasHiddenMembers && (
                <button
                  type="button"
                  onClick={() => setShowAllMembers(!showAllMembers)}
                  className="text-brand-primary hover:text-brand-hover inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{showAllMembers ? 'Show less' : `+${memberNames.length - 4} more`}</span>
                  {showAllMembers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {displayedMembers.map((m, idx) => {
                const isLeader = m === leaderName
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                      isLeader
                        ? 'bg-amber-50 text-amber-900 border border-amber-200/80 shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                    }`}
                  >
                    {isLeader && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                    <span className="truncate max-w-[130px]">{m}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION C: ACTUAL SUBMITTED WORK / DELIVERABLES
      ========================================================================= */}
      <div className="p-4 sm:p-5 space-y-4 flex-1 bg-white">
        {isSubmitted ? (
          <>
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-brand-primary" />
                <span>Submitted Deliverable</span>
              </span>

              {/* 1. Deliverable Present (URL or File) */}
              {deliverable.isDeliverable ? (
                <div className="rounded-xl border border-brand-line/90 bg-slate-50/70 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-brand-line text-brand-primary flex items-center justify-center shrink-0 shadow-xs">
                        {deliverable.category === 'pdf' && <FileText className="w-4 h-4 text-rose-500" />}
                        {deliverable.category === 'word' && <FileText className="w-4 h-4 text-blue-600" />}
                        {deliverable.category === 'excel' && <FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                        {deliverable.category === 'powerpoint' && <Presentation className="w-4 h-4 text-amber-500" />}
                        {deliverable.category === 'onedrive' && <Cloud className="w-4 h-4 text-blue-500" />}
                        {deliverable.category === 'google_drive' && <Cloud className="w-4 h-4 text-amber-500" />}
                        {deliverable.category === 'code_repo' && <FileCode className="w-4 h-4 text-slate-800" />}
                        {(deliverable.category === 'web_app' || deliverable.category === 'external_link') && (
                          <Globe className="w-4 h-4 text-purple-600" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-brand-heading block truncate">
                          {deliverable.fileName || deliverable.label || 'Project Submission'}
                        </span>
                        <span className="text-[11px] text-brand-muted truncate block">
                          {deliverable.category === 'onedrive' ? 'Microsoft OneDrive Link' :
                           deliverable.category === 'google_drive' ? 'Google Drive Link' :
                           deliverable.category === 'code_repo' ? 'GitHub Repository' :
                           deliverable.isLocal ? 'Local Web Project' :
                           deliverable.label}
                        </span>
                      </div>
                    </div>

                    <Badge variant={deliverable.badgeColor || 'primary'} size="sm">
                      {deliverable.category === 'onedrive' ? 'OneDrive' :
                       deliverable.category === 'google_drive' ? 'Drive' :
                       deliverable.category === 'code_repo' ? 'GitHub' :
                       deliverable.category === 'pdf' ? 'PDF' :
                       deliverable.isLocal ? 'Local Dev' :
                       'Verified'}
                    </Badge>
                  </div>

                  {/* Clean Monospace Link / Location */}
                  {deliverable.url && (
                    <div className="p-2.5 rounded-lg bg-white border border-brand-line/70 text-xs flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-brand-heading truncate select-all">
                        {deliverable.url}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="p-1 text-slate-400 hover:text-brand-primary rounded shrink-0 transition-colors cursor-pointer"
                        title="Copy Deliverable Link"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  {/* Quick Inline Actions */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {onViewWork && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={Eye}
                        onClick={() => onViewWork(group, sub)}
                        className="text-xs font-bold shadow-purple-glow cursor-pointer"
                      >
                        Inspect Deliverable
                      </Button>
                    )}

                    {deliverable.url && (
                      <a
                        href={deliverable.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-brand-heading font-semibold text-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in New Tab</span>
                      </a>
                    )}

                    {deliverable.downloadUrl && (
                      <a
                        href={deliverable.downloadUrl}
                        download={deliverable.fileName || 'submitted-work'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-line hover:bg-slate-50 text-brand-heading font-semibold text-xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                /* 2. Acknowledgement Only (No Deliverable Attached) */
                <div className="rounded-xl border border-amber-200/90 bg-amber-50/60 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Assignment acknowledged, but no deliverable has been submitted.</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    The group confirmed submission status, but did not attach an external file or cloud repository link.
                  </p>
                  {deliverable.courseOneDrive && (
                    <div className="pt-2 border-t border-amber-200 flex items-center gap-2">
                      <span className="text-[11px] text-amber-900 font-medium">Course Folder:</span>
                      <a
                        href={deliverable.courseOneDrive}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-blue-700 hover:underline inline-flex items-center gap-1"
                      >
                        <span>OneDrive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submitter Notes / Accompanying Message */}
            {commentText && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">
                  Submission Notes
                </span>
                <div className="p-3 rounded-xl bg-slate-50 border border-brand-line/70 text-xs text-brand-heading whitespace-pre-wrap leading-relaxed">
                  "{commentText}"
                </div>
              </div>
            )}

            {/* =========================================================================
                SECTION D: ACKNOWLEDGEMENT DETAILS
            ========================================================================= */}
            <div className="rounded-xl bg-slate-50/80 p-3 border border-brand-line/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[11px] text-brand-muted block">Acknowledged By:</span>
                <span className="font-bold text-emerald-800 inline-flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{acknowledgedBy}</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-brand-muted block">Submitted Timestamp:</span>
                <span className="font-semibold text-brand-heading block mt-0.5">
                  {acknowledgedAt ? (
                    `${formatDisplayDate(acknowledgedAt)}, ${new Date(acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>

            {/* =========================================================================
                SECTION E: GRADING INFORMATION
            ========================================================================= */}
            {isGraded ? (
              <div className="rounded-xl bg-purple-50/80 border border-purple-200/80 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-purple-950">
                    <Award className="w-4 h-4 text-brand-primary" />
                    <span>Graded: {marks} / {maxPoints} pts</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-200 text-purple-900">
                    Grade {letterGrade}
                  </span>
                </div>
                {feedback && (
                  <p className="text-xs text-purple-900 italic border-t border-purple-200/60 pt-1.5">
                    "{feedback}"
                  </p>
                )}
              </div>
            ) : isStaff ? (
              <div className="rounded-xl bg-slate-50 border border-dashed border-brand-line p-3 flex items-center justify-between text-xs">
                <span className="text-brand-muted font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Awaiting evaluation by instructor</span>
                </span>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  Pending Grade
                </span>
              </div>
            ) : null}
          </>
        ) : (
          /* NOT SUBMITTED STATE */
          <div className="space-y-4 py-2 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h5 className="font-extrabold text-sm sm:text-base text-brand-heading">
                Pending Group Submission
              </h5>
              <p className="text-xs text-brand-muted max-w-sm mx-auto leading-relaxed">
                This group has not yet submitted their assignment. Only the group leader (<strong>{leaderName}</strong>) can acknowledge and upload the group deliverable.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-brand-line text-xs font-medium text-slate-600 inline-block text-left">
              <span className="block text-[11px] text-brand-muted">Allocation:</span>
              <span>{memberNames.length} enrolled student members awaiting submission</span>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION F: CARD ACTIONS FOOTER
      ========================================================================= */}
      <div className="p-4 sm:p-5 border-t border-brand-line/60 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {onViewWork && isSubmitted && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Eye}
              onClick={() => onViewWork(group, sub)}
              className="text-xs font-semibold"
            >
              View Work
            </Button>
          )}

          {deliverable.url && isSubmitted && (
            <a
              href={deliverable.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-line bg-white hover:bg-slate-100 text-brand-heading font-semibold text-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Link</span>
            </a>
          )}
        </div>

        {/* Staff Evaluation Action */}
        {isStaff && onGrade && (
          <Button
            type="button"
            variant={isGraded ? 'secondary' : 'primary'}
            size="sm"
            icon={Award}
            onClick={() => onGrade(group, sub)}
            className="text-xs font-bold"
          >
            {isGraded ? 'Edit Grade' : 'Grade Group'}
          </Button>
        )}
      </div>
    </Card>
  )
}

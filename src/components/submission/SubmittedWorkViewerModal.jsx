import React, { useState, useMemo } from 'react'
import {
  ExternalLink,
  Download,
  FileText,
  FileCode,
  Crown,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Award,
  Maximize2,
  Cloud,
  FileCheck
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import { formatDisplayDate } from '../../utils/calculations'
import { classifyDeliverable } from '../../utils/deliverableClassifier'

export { classifyDeliverable }

/**
 * Dedicated Submitted Work Viewer Modal
 */
export default function SubmittedWorkViewerModal({
  isOpen,
  onClose,
  data,
  onOpenGrading,
}) {
  const [copied, setCopied] = useState(false)
  const [pdfFullscreen, setPdfFullscreen] = useState(false)

  const {
    assignment = {},
    group = null,
    submission = {},
    student = null,
    isGroup = true,
  } = data || {}

  const submissionLink = submission?.submission_link || ''
  const commentText = submission?.comment || submission?.studentNote || ''
  const acknowledgedAt = submission?.acknowledged_at || submission?.submitted_at
  const isUuid = (val) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())

  const acknowledgedBy =
    submission?.acknowledged_by_name ||
    submission?.leader?.name ||
    submission?.acknowledged_by_user?.name ||
    group?.acknowledged_by ||
    group?.leaderName ||
    group?.leader?.name ||
    (!isUuid(submission?.acknowledged_by) ? submission?.acknowledged_by : null) ||
    student?.name ||
    'Group Leader'
  const isGraded = Boolean(submission?.marks !== null && submission?.marks !== undefined && submission?.marks !== '—')
  const marks = isGraded ? submission.marks : null
  const letterGrade = submission?.letterGrade || '—'
  const feedback = submission?.feedback || ''

  // Classify Deliverable - called unconditionally before any early returns
  const deliverable = useMemo(() => {
    if (!data) {
      return {
        category: 'acknowledgement_only',
        isDeliverable: false,
        url: null,
        label: 'No Data',
        message: 'No submission data provided.',
      }
    }
    return classifyDeliverable({
      submissionLink,
      comment: commentText,
      onedriveLink: assignment?.onedrive_link,
      driveLink: assignment?.drive_link,
      assignmentId: assignment?.id,
      groupId: group?.id,
      classId: assignment?.class_id,
      userRole: 'admin',
    })
  }, [data, submissionLink, commentText, assignment, group])

  if (!data) return null

  const handleCopyLink = async () => {
    if (!deliverable.url) return
    try {
      await navigator.clipboard.writeText(deliverable.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {}
  }

  const modalTitle = isGroup
    ? `Submitted Work — ${group?.name || 'Group'}`
    : `Submitted Work — ${student?.name || 'Student'}`

  const modalSubtitle = isGroup
    ? `Course: ${assignment?.classes?.name || 'Course'} • ${group?.memberNames?.length || group?.members?.length || 0} Members`
    : `Course: ${assignment?.classes?.name || 'Course'} • Student ID: ${student?.student_id || '—'}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      size={pdfFullscreen ? 'full' : 'xl'}
    >
      <div className="space-y-5">
        {/* Top Info Banner: Metadata & Grading Status */}
        <div className="rounded-2xl p-4 bg-slate-50 border border-brand-line/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">
                Assignment
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-brand-heading">
                {assignment?.title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={
                  isGraded
                    ? 'success'
                    : deliverable.isDeliverable
                    ? 'primary'
                    : 'warning'
                }
                size="md"
                dot
              >
                {isGraded
                  ? `Graded: ${marks} / ${assignment?.points || 100} (${letterGrade})`
                  : deliverable.isDeliverable
                  ? 'Deliverable Submitted'
                  : 'Acknowledged (No Deliverable)'}
              </Badge>

              {onOpenGrading && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={Award}
                  onClick={() => {
                    onClose()
                    onOpenGrading(group || student)
                  }}
                  className="font-semibold text-xs"
                >
                  {isGraded ? 'Edit Grade' : 'Grade Submission'}
                </Button>
              )}
            </div>
          </div>

          {/* Group / Student Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-brand-line/60 text-xs">
            {isGroup ? (
              <>
                <div>
                  <span className="text-brand-muted block text-[11px]">Group Leader:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                    <Crown className="w-3.5 h-3.5 text-amber-600" />
                    {group?.leaderName || group?.leader?.name || 'Leader'}
                  </span>
                </div>
                <div>
                  <span className="text-brand-muted block text-[11px]">Acknowledged By:</span>
                  <span className="font-semibold text-emerald-700">
                    {submission?.acknowledged_by_name || acknowledgedBy}
                  </span>
                </div>
                <div>
                  <span className="text-brand-muted block text-[11px]">Submission Time:</span>
                  <span className="text-brand-heading font-medium">
                    {acknowledgedAt ? `${formatDisplayDate(acknowledgedAt)} at ${new Date(acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-brand-muted block text-[11px]">Roster Count:</span>
                  <span className="text-brand-heading font-bold">
                    {group?.memberNames?.length || group?.members?.length || 0} enrolled members
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-brand-muted block text-[11px]">Student Name:</span>
                  <span className="font-bold text-brand-heading">{student?.name}</span>
                </div>
                <div>
                  <span className="text-brand-muted block text-[11px]">Student Email:</span>
                  <span className="font-medium text-brand-muted truncate block">{student?.email || '—'}</span>
                </div>
                <div>
                  <span className="text-brand-muted block text-[11px]">Submission Time:</span>
                  <span className="text-brand-heading font-medium">
                    {acknowledgedAt ? `${formatDisplayDate(acknowledgedAt)} at ${new Date(acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-brand-muted block text-[11px]">Points:</span>
                  <span className="text-brand-heading font-bold">{assignment?.points || 100} pts</span>
                </div>
              </>
            )}
          </div>

          {/* Group Roster Pills if Group */}
          {isGroup && group?.memberNames?.length > 0 && (
            <div className="pt-2 border-t border-brand-line/60">
              <span className="text-brand-muted text-[11px] block mb-1">Group Members:</span>
              <div className="flex flex-wrap gap-1">
                {group.memberNames.map((m, mIdx) => (
                  <span
                    key={mIdx}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-light text-brand-primary"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Existing Grade & Feedback Banner */}
          {isGraded && (
            <div className="pt-2 border-t border-brand-line/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-purple-50/70 p-3 rounded-xl border border-purple-200/60">
              <div>
                <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-primary" />
                  <span>Awarded Score: {marks} / {assignment?.points || 100}</span>
                </span>
                {feedback && (
                  <p className="text-xs text-purple-900 italic mt-0.5">
                    "{feedback}"
                  </p>
                )}
              </div>
              <Badge variant="purple" size="sm">
                Grade {letterGrade}
              </Badge>
            </div>
          )}
        </div>

        {/* =========================================================================
            DELIVERABLE VIEWER: ACTUAL SUBMITTED WORK
        ========================================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-brand-heading flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-brand-primary" />
              <span>Submitted Deliverable</span>
            </h4>

            {deliverable.url && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={copied ? Check : Copy}
                  onClick={handleCopyLink}
                  className="text-xs text-brand-muted hover:text-brand-heading"
                >
                  {copied ? 'Copied' : 'Copy Link'}
                </Button>

                <a
                  href={deliverable.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-white font-bold hover:bg-brand-primaryHover transition-all text-xs shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab</span>
                </a>
              </div>
            )}
          </div>

          {/* CASE 1: ACKNOWLEDGEMENT ONLY (No file/link attached) */}
          {deliverable.category === 'acknowledgement_only' && (
            <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h5 className="text-base font-extrabold text-amber-950">
                  Assignment Acknowledged, But No Deliverable Has Been Submitted
                </h5>
                <p className="text-xs text-amber-800 max-w-md mx-auto leading-relaxed">
                  The {isGroup ? 'group leader' : 'student'} (<strong>{acknowledgedBy}</strong>) acknowledged completion of this assignment on{' '}
                  {acknowledgedAt ? formatDisplayDate(acknowledgedAt) : 'record'}, but no external file, OneDrive link, or document URL was attached to the submission.
                </p>
              </div>

              {deliverable.courseOneDrive && (
                <div className="pt-3 border-t border-amber-200/80 flex items-center justify-center gap-2">
                  <span className="text-xs text-amber-900 font-medium">Instructor Course Folder:</span>
                  <a
                    href={deliverable.courseOneDrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Open Course OneDrive Folder</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* CASE 2: EMBEDDED PDF DOCUMENT */}
          {deliverable.category === 'pdf' && (
            <div className="rounded-2xl border border-brand-line/80 overflow-hidden bg-slate-900 shadow-card">
              <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between text-white text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-rose-400" />
                  <span className="font-bold truncate max-w-sm">{deliverable.fileName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPdfFullscreen(!pdfFullscreen)}
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white"
                    title={pdfFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={deliverable.url}
                    download={deliverable.fileName}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </a>
                </div>
              </div>

              {/* PDF Viewer Frame */}
              <div className="w-full h-[520px] bg-slate-100 flex items-center justify-center relative">
                <iframe
                  src={deliverable.previewUrl || deliverable.url}
                  className="w-full h-full border-0"
                  title="PDF Document Viewer"
                />
              </div>
            </div>
          )}

          {/* CASE 3: GOOGLE DRIVE / DOCS VIEWER */}
          {deliverable.category === 'google_drive' && (
            <div className="rounded-2xl border border-brand-line/80 overflow-hidden shadow-card">
              <div className="bg-amber-500/10 border-b border-brand-line/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-xs text-brand-heading">Google Drive Document</span>
                </div>
                <a
                  href={deliverable.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open in Google Drive</span>
                </a>
              </div>

              {deliverable.previewUrl ? (
                <div className="w-full h-[500px] bg-slate-50">
                  <iframe
                    src={deliverable.previewUrl}
                    className="w-full h-full border-0"
                    title="Google Drive Document Viewer"
                    allow="autoplay"
                  />
                </div>
              ) : (
                <div className="p-8 text-center space-y-3 bg-white">
                  <p className="text-xs text-brand-muted">
                    This document is hosted on Google Drive. Click below to inspect the submission.
                  </p>
                  <a
                    href={deliverable.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white font-bold text-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Work in Google Drive</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* CASE 4: MICROSOFT ONEDRIVE DELIVERABLE */}
          {deliverable.category === 'onedrive' && (
            <div className="p-6 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                      Cloud Deliverable
                    </span>
                    <h5 className="text-base font-extrabold text-blue-950">
                      Microsoft OneDrive Submission
                    </h5>
                  </div>
                </div>

                <Badge variant="blue" size="md">
                  OneDrive Verified
                </Badge>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-blue-200/70 text-xs flex items-center justify-between gap-2">
                <span className="font-mono text-brand-heading truncate select-all">{deliverable.url}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                  title="Copy URL"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <a
                  href={deliverable.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all shadow-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Work in OneDrive</span>
                </a>
              </div>
            </div>
          )}

          {/* CASE 5: MICROSOFT OFFICE DOCUMENTS (WORD, EXCEL, PPT) */}
          {(deliverable.category === 'word' || deliverable.category === 'excel' || deliverable.category === 'powerpoint') && (
            <div className="p-6 rounded-2xl bg-slate-50 border border-brand-line/80 space-y-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center font-black shadow-xs">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">
                      Office Document
                    </span>
                    <h5 className="text-base font-extrabold text-brand-heading">
                      {deliverable.fileName}
                    </h5>
                  </div>
                </div>

                <Badge variant={deliverable.badgeColor || 'primary'} size="md">
                  {deliverable.label}
                </Badge>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-brand-line text-xs flex items-center justify-between gap-2">
                <span className="font-mono text-brand-muted truncate select-all">{deliverable.url}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <a
                  href={deliverable.downloadUrl || deliverable.url}
                  download={deliverable.fileName}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-line bg-white text-brand-heading font-semibold text-xs hover:bg-slate-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Document</span>
                </a>
                <a
                  href={deliverable.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs hover:bg-brand-primaryHover transition-all shadow-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Deliverable in New Tab</span>
                </a>
              </div>
            </div>
          )}

          {/* CASE 6: GITHUB / REPOSITORY */}
          {deliverable.category === 'code_repo' && (
            <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black">
                    <FileCode className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Code Repository
                    </span>
                    <h5 className="text-base font-extrabold text-white">
                      Source Code Submission
                    </h5>
                  </div>
                </div>

                <Badge variant="purple" size="md">
                  Git Repository
                </Badge>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 truncate">
                {deliverable.url}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <a
                  href={deliverable.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs hover:bg-brand-primaryHover transition-all shadow-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Inspect GitHub Repository</span>
                </a>
              </div>
            </div>
          )}

          {/* CASE 7: WEB APP / GENERIC EXTERNAL DELIVERABLE */}
          {(deliverable.category === 'external_link' || deliverable.category === 'web_app' || (deliverable.isDeliverable && !['pdf', 'google_drive', 'onedrive', 'word', 'excel', 'powerpoint', 'code_repo'].includes(deliverable.category))) && (
            <div className="p-6 rounded-2xl bg-slate-50 border border-brand-line/80 space-y-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 text-brand-primary flex items-center justify-center font-black shadow-xs">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider block">
                      {deliverable.isLocal ? 'Local Project Link' : 'Web Project / Deliverable Link'}
                    </span>
                    <h5 className="text-base font-extrabold text-brand-heading">
                      {deliverable.label || 'Submitted Project Link'}
                    </h5>
                  </div>
                </div>

                <Badge variant={deliverable.badgeColor || 'primary'} size="md">
                  {deliverable.isLocal ? 'Development Link' : 'Verified Project Link'}
                </Badge>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-brand-line text-xs flex items-center justify-between gap-2">
                <span className="font-mono text-brand-heading truncate select-all">{deliverable.url}</span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-1.5 text-brand-primary hover:bg-brand-light rounded cursor-pointer"
                  title="Copy URL"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <a
                  href={deliverable.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs hover:bg-brand-primaryHover transition-all shadow-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Deliverable in New Tab</span>
                </a>
              </div>
            </div>
          )}

          {/* Leader Notes / Student Comments Section */}
          {commentText && (
            <div className="space-y-1.5 pt-2">
              <span className="text-xs font-bold text-brand-heading block">
                {isGroup ? 'Group Leader Submission Notes:' : 'Student Comments:'}
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line text-xs text-brand-heading leading-relaxed whitespace-pre-wrap">
                "{commentText}"
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-line/60">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Viewer
          </Button>

          {onOpenGrading && (
            <Button
              variant="primary"
              size="sm"
              icon={Award}
              onClick={() => {
                onClose()
                onOpenGrading(group || student)
              }}
              className="shadow-purple-glow font-semibold"
            >
              {isGraded ? 'Edit Grade' : 'Grade Submission'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

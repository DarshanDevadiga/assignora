import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Calendar,
  Clock,
  ExternalLink,
  Send,
  CheckCircle2,
  AlertCircle,
  Link2,
  FolderOpen,
  Sparkles,
  Lock
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { assignmentsService } from '../../services/assignments.service'
import { submissionsService } from '../../services/submissions.service'
import { formatDisplayDate, formatDeadlineBadge } from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import { Input, Textarea } from '../../components/common/Input'
import TwoStepSubmissionModal from '../../components/student/TwoStepSubmissionModal'

export default function AssignmentDetails() {
  const { id: assignmentId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [assignment, setAssignment] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)

  // Submission inputs
  const [submissionLink, setSubmissionLink] = useState('')
  const [comment, setComment] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    loadAssignmentAndSubmission()
  }, [assignmentId, user?.id])

  async function loadAssignmentAndSubmission() {
    if (!assignmentId || !user?.id) return
    try {
      setLoading(true)
      const [assignmentData, existingSub] = await Promise.all([
        assignmentsService.getAssignmentById(assignmentId),
        submissionsService.getStudentAssignmentSubmission(assignmentId, user.id),
      ])

      setAssignment(assignmentData)
      setSubmission(existingSub)
      if (existingSub) {
        setSubmissionLink(existingSub.submission_link || '')
        setComment(existingSub.comment || '')
      }
    } catch (err) {
      console.error('[AssignmentDetails] Error loading:', err)
      setErrorMessage('Failed to load assignment details.')
    } finally {
      setLoading(false)
    }
  }

  // Step 1: Open Two-Step Confirmation Modal
  const handleOpenConfirmModal = (e) => {
    e.preventDefault()
    if (!submissionLink.trim()) {
      setErrorMessage('Please provide a Google Drive, GitHub, or live deployment link.')
      return
    }
    setErrorMessage('')
    setIsModalOpen(true)
  }

  // Step 2: Final submission to Supabase
  const handleFinalSubmit = async () => {
    const result = await submissionsService.submitAssignment({
      assignmentId,
      studentId: user.id,
      submissionLink,
      comment,
    })
    setSubmission(result)
    return result
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-brand-muted">
        Loading assignment...
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="py-20 text-center space-y-3">
        <h3 className="text-lg font-bold text-brand-heading">Assignment Not Found</h3>
        <Button variant="primary" onClick={() => navigate('/student')}>
          Return to Dashboard
        </Button>
      </div>
    )
  }

  const deadlineBadge = formatDeadlineBadge(assignment.due_date, assignment.due_time)
  const isSubmitted = Boolean(submission)

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/student')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-brand-primary hover:text-brand-hover cursor-pointer mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Assignments</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
              {assignment.title}
            </h1>
            <p className="text-xs sm:text-sm text-brand-muted mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-brand-heading">{assignment.classes?.name}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Due {assignment.due_date ? `${formatDisplayDate(assignment.due_date)} at ${assignment.due_time?.substring(0, 5) || '23:59'}` : 'No deadline'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="purple" size="lg">
              {assignment.points} Points
            </Badge>
            {isSubmitted ? (
              <Badge variant="success" size="lg" dot>
                Submitted
              </Badge>
            ) : deadlineBadge ? (
              <Badge variant={deadlineBadge.variant} size="lg">
                {deadlineBadge.text}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Grid: Details on Left + Submission Card on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (7 cols): Instructions & Resources */}
        <div className="lg:col-span-7 space-y-6">
          <Card padding="p-6" className="space-y-5">
            <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-primary" />
              <span>Assignment Instructions</span>
            </h3>

            <div className="text-xs sm:text-sm text-brand-body leading-relaxed whitespace-pre-line bg-slate-50/60 p-4 rounded-xl border border-brand-line/60">
              {assignment.description || 'No detailed instructions provided.'}
            </div>

            {/* Resources Section */}
            {assignment.drive_link && (
              <div className="space-y-2 pt-2 border-t border-brand-line/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                  Attached Resources
                </h4>
                <div className="p-3.5 rounded-xl border border-brand-line bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center shrink-0">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-brand-heading truncate">
                        Reference Materials & Guidelines
                      </p>
                      <span className="text-[11px] text-brand-muted truncate block">
                        Google Drive Shared Folder
                      </span>
                    </div>
                  </div>

                  <a
                    href={assignment.drive_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline bg-brand-light px-3 py-1.5 rounded-lg shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Drive</span>
                  </a>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (5 cols): Submit Your Work Card */}
        <div className="lg:col-span-5">
          <Card padding="p-6" className="space-y-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
                <Send className="w-5 h-5 text-brand-primary" />
                <span>Submit Your Work</span>
              </h3>
              {isSubmitted && (
                <Badge variant="success" size="sm" dot>
                  Submitted
                </Badge>
              )}
            </div>

            {isSubmitted ? (
              /* Already submitted state: Duplicate submission prevented */
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Assignment Submitted</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Submitted on {formatDisplayDate(submission.submitted_at)} at {new Date(submission.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-brand-heading">Submission Link:</span>
                  <div className="p-3 rounded-xl bg-slate-50 border border-brand-line text-xs font-medium text-brand-primary flex items-center justify-between gap-2">
                    <span className="truncate">{submission.submission_link}</span>
                    <a
                      href={submission.submission_link}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-brand-heading shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {submission.comment && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-brand-heading">Student Notes:</span>
                    <p className="text-xs text-brand-muted bg-slate-50 p-3 rounded-xl border border-brand-line">
                      {submission.comment}
                    </p>
                  </div>
                )}

                <div className="pt-2 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Submission is locked and final. Duplicate submissions are disabled.</span>
                </div>
              </div>
            ) : (
              /* Submission Form */
              <form onSubmit={handleOpenConfirmModal} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {errorMessage}
                  </div>
                )}

                <Input
                  label="Submission Link (Google Drive / GitHub / Deployment)"
                  placeholder="https://drive.google.com/... or https://myproject.vercel.app"
                  required
                  icon={Link2}
                  value={submissionLink}
                  onChange={(e) => setSubmissionLink(e.target.value)}
                  helperText="Paste your completed project link or shared Drive folder."
                />

                <Textarea
                  label="Additional Comments / Notes (Optional)"
                  placeholder="Notes for your professor regarding this submission..."
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full justify-center shadow-purple-glow font-semibold mt-2"
                  icon={Send}
                >
                  Yes, I have submitted
                </Button>
              </form>
            )}
          </Card>
        </div>

      </div>

      {/* Two Step Confirmation Modal */}
      <TwoStepSubmissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        assignment={assignment}
        submissionData={{ submissionLink, comment }}
        onFinalSubmit={handleFinalSubmit}
        onSuccessDone={() => loadAssignmentAndSubmission()}
      />
    </div>
  )
}

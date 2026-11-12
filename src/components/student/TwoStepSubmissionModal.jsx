import React, { useState, useEffect } from 'react'
import { Send, CheckCircle2, X, Clock, ExternalLink } from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { formatDisplayDate } from '../../utils/calculations'
import { notificationsService } from '../../services/notifications.service'
import { submissionsService } from '../../services/submissions.service'
import { useAuth } from '../../context/AuthContext'

export default function TwoStepSubmissionModal({
  isOpen,
  onClose,
  assignment,
  submissionData,
  onFinalSubmit,
  onSuccessDone,
  onSuccess,
}) {
  const { user } = useAuth()
  const [step, setStep] = useState(1) // 1: Confirm, 2: Confirmed
  const [loading, setLoading] = useState(false)
  const [submittedTime, setSubmittedTime] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Reset step whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setErrorMessage('')
    }
  }, [isOpen])

  const handleStepOneConfirm = async () => {
    try {
      setLoading(true)
      setErrorMessage('')

      // Resilient submission handler execution:
      // Validates onFinalSubmit before invoking and supports direct fallback to prevent runtime TypeError
      let result = null
      if (typeof onFinalSubmit === 'function') {
        result = await onFinalSubmit()
      } else if (typeof onSuccess === 'function') {
        result = await onSuccess()
      } else if (assignment?.id && user?.id) {
        // Built-in resilient fallback: directly submit to database via submissionsService
        result = await submissionsService.submitAssignment({
          assignmentId: assignment.id,
          studentId: user.id,
          submissionLink: submissionData?.submissionLink || '',
          comment: submissionData?.comment || 'Submitted via Two-Step Confirmation',
        })
      } else {
        throw new Error('Submission handler is not properly configured. Please contact your instructor.')
      }

      setSubmittedTime(result?.submitted_at || new Date().toISOString())
      setStep(2)

      // Notify teacher and class members of submission in real-time
      if (assignment?.class_id) {
        notificationsService.notifyClassMembers({
          classId: assignment.class_id,
          excludeUserId: user?.id,
          title: `New Submission: ${assignment.title}`,
          message: `${user?.name || 'A student'} submitted deliverable for "${assignment.title}".`,
          type: 'submission',
          referenceId: assignment.id,
        }).catch(() => {})
      }

      // Trigger celebratory confetti dynamically on success
      try {
        const { default: confetti } = await import('canvas-confetti')
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#5B21F6', '#8B5CF6', '#16A34A', '#F59E0B'],
        })
      } catch (err) {
        // ignore confetti errors
      }
    } catch (err) {
      console.error('[TwoStepSubmission] Error:', err)
      setErrorMessage(err.message || 'Submission failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = () => {
    onClose()
    if (typeof onSuccessDone === 'function') {
      onSuccessDone()
    } else if (typeof onSuccess === 'function') {
      onSuccess()
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={step === 2 ? handleFinish : onClose}
      maxWidth="max-w-md"
    >
      {/* Header with Step indicator */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-brand-line/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-brand-primary bg-brand-light px-2.5 py-0.5 rounded-full">
            Step {step} of 2
          </span>
          <div className="flex items-center gap-1.5 ml-1">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                step >= 1 ? 'bg-brand-primary' : 'bg-slate-200'
              }`}
            />
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                step >= 2 ? 'bg-brand-primary' : 'bg-slate-200'
              }`}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={step === 2 ? handleFinish : onClose}
          className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step 1: Confirmation */}
      {step === 1 && (
        <div className="py-4 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-brand-light text-brand-primary flex items-center justify-center mx-auto shadow-purple-glow">
            <Send className="w-8 h-8 ml-0.5" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-brand-heading">
              Confirm Submission?
            </h3>
            <p className="text-xs sm:text-sm text-brand-muted mt-1 max-w-xs mx-auto">
              Are you sure you want to submit this assignment? You will have a final confirmation before it is saved.
            </p>
          </div>

          {/* Submission Preview Pill */}
          {submissionData?.submissionLink && (
            <div className="p-3 rounded-xl bg-slate-50 border border-brand-line/70 text-left text-xs space-y-1">
              <span className="text-brand-muted block font-medium">Attached Link:</span>
              <p className="font-semibold text-brand-primary truncate">
                {submissionData.submissionLink}
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left">
              {errorMessage}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              size="md"
              className="w-1/2 justify-center"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              size="md"
              loading={loading}
              className="w-1/2 justify-center shadow-purple-glow font-semibold"
              onClick={handleStepOneConfirm}
            >
              Confirm Submission
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Submission Confirmed */}
      {step === 2 && (
        <div className="py-4 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-brand-heading">
              Submission Confirmed!
            </h3>
            <p className="text-xs sm:text-sm text-brand-muted mt-1 max-w-xs mx-auto">
              Your assignment has been successfully submitted and recorded.
            </p>
          </div>

          {submittedTime && (
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-700">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Submitted on: {new Date(submittedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {formatDisplayDate(submittedTime)}
              </span>
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center shadow-purple-glow font-semibold"
              onClick={handleFinish}
            >
              View Submission
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

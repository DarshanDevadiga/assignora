import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  KeyRound,
  BookOpen,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { Input } from '../common/Input'
import { classesService } from '../../services/classes.service'
import { useAuth } from '../../context/AuthContext'

export default function JoinClassModal({ isOpen, onClose, onEnrolled }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [code, setCode] = useState('')
  const [validating, setValidating] = useState(false)
  const [classPreview, setClassPreview] = useState(null)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [redirectTimer, setRedirectTimer] = useState(null)

  const handleReset = () => {
    if (redirectTimer) clearTimeout(redirectTimer)
    setRedirectTimer(null)
    setCode('')
    setClassPreview(null)
    setError(null)
    setSuccess(false)
    setValidating(false)
    setEnrolling(false)
  }

  const handleClose = () => {
    if (redirectTimer) clearTimeout(redirectTimer)
    handleReset()
    onClose()
  }

  // Step 1: Validate code and preview class
  const handleValidateCode = async (e) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Please enter a class enrolment code.')
      return
    }

    try {
      setValidating(true)
      setError(null)
      const found = await classesService.findClassByCode(code)
      if (!found) {
        setError('Invalid class code. Please check with your teacher and try again.')
        setClassPreview(null)
        return
      }

      // Check if student is already in this class
      const isAlreadyMember = found.is_enrolled || found.class_members?.some((m) => m.student_id === user.id)
      if (isAlreadyMember) {
        setError(`You are already enrolled in ${found.name}.`)
        setClassPreview(null)
        return
      }

      setClassPreview(found)
    } catch (err) {
      console.error('[JoinClassModal] Validation error:', err)
      setError(err.message || 'Error validating class code.')
    } finally {
      setValidating(false)
    }
  }

  // Step 2: Confirm and Enroll
  const handleConfirmEnrollment = async () => {
    if (!classPreview || !user?.id) {
      setError('You must be signed in as a student to join a class.')
      return
    }

    try {
      setEnrolling(true)
      setError(null)
      const membership = await classesService.enrollStudent(
        classPreview.id,
        user.id,
        code || classPreview.class_code
      )
      if (!membership || (!membership.id && !membership.class_id)) {
        throw new Error('Enrollment could not be confirmed. Please try again.')
      }
      setSuccess(true)

      if (onEnrolled) {
        onEnrolled(classPreview)
      }

      const timer = setTimeout(() => {
        handleClose()
        navigate(`/student/classes/${classPreview.id}`)
      }, 2500)
      setRedirectTimer(timer)
    } catch (err) {
      console.error('[JoinClassModal] Enrollment error:', err)
      setError(err.message || 'Failed to complete enrolment.')
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Join a Class"
      size="md"
    >
      <div className="space-y-5">
        {/* Helper Prompt */}
        {!classPreview && !success && (
          <form onSubmit={handleValidateCode} className="space-y-4">
            <div className="rounded-xl p-4 bg-brand-secondaryBg border border-brand-border/60 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-primary text-white flex items-center justify-center shrink-0 shadow-purple-glow">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <h4 className="font-semibold text-brand-heading">
                  Have a class code?
                </h4>
                <p className="text-brand-muted mt-0.5">
                  Ask your teacher for the 6-character class code, then enter it below to join.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-heading">
                Class Enrolment Code <span className="text-brand-danger">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. CLS-E2E398 or E2E398"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                  setError(null)
                }}
                maxLength={20}
                className="w-full uppercase font-mono tracking-wider font-bold text-center text-lg py-3 px-4 rounded-xl border border-brand-line focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-line/60">
              <Button
                variant="secondary"
                type="button"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={validating}
                disabled={!code.trim() || validating}
                className="shadow-purple-glow font-semibold"
                icon={ArrowRight}
              >
                Verify Code
              </Button>
            </div>
          </form>
        )}

        {/* Class Preview Confirmation */}
        {classPreview && !success && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5 bg-gradient-to-br from-brand-primary to-brand-hover text-white shadow-purple-glow">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80 block">
                Class Found
              </span>
              <h3 className="text-lg font-bold text-white mt-1">{classPreview.name}</h3>
              <p className="text-xs text-white/80">{classPreview.subject || 'Course'}</p>

              {classPreview.description && (
                <p className="text-xs text-white/90 mt-3 pt-3 border-t border-white/20 line-clamp-2">
                  {classPreview.description}
                </p>
              )}
            </div>

            {/* Instructor Details */}
            <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-light text-brand-primary flex items-center justify-center font-bold">
                  {(classPreview.users?.name || classPreview.teacher?.name || 'P').charAt(0)}
                </div>
                <div>
                  <span className="text-[11px] text-brand-muted block">Instructor</span>
                  <strong className="text-brand-heading">
                    {classPreview.users?.name || classPreview.teacher?.name || 'Faculty Member'}
                  </strong>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-brand-muted">
                <Users className="w-4 h-4" />
                <span>{classPreview.student_count ?? classPreview.class_members?.length ?? 0} students enrolled</span>
              </div>
            </div>

            {error && (
              <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-brand-line/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClassPreview(null)}
              >
                Enter Different Code
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={enrolling}
                  onClick={handleConfirmEnrollment}
                  icon={CheckCircle2}
                  className="shadow-purple-glow font-semibold"
                >
                  Confirm & Join Class
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-brand-heading">
                Successfully Enrolled!
              </h3>
              <p className="text-xs text-brand-muted mt-1">
                You are now enrolled in <strong>{classPreview?.name}</strong>. Your dashboard and course list have been updated.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
              >
                Back to Dashboard
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={ArrowRight}
                onClick={() => {
                  handleClose()
                  navigate(`/student/classes/${classPreview.id}`)
                }}
                className="shadow-purple-glow font-semibold"
              >
                Go to Class
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

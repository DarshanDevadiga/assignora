import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  BookOpen,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  ArrowRight,
  Sparkles,
  LogIn,
  Clock,
  ShieldCheck
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { classesService } from '../../services/classes.service'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'

export default function JoinClassPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const codeParam = searchParams.get('code') || ''
  const tokenParam = searchParams.get('token') || ''
  const queryValue = codeParam || tokenParam

  const [loading, setLoading] = useState(true)
  const [classInfo, setClassInfo] = useState(null)
  const [invitationStatus, setInvitationStatus] = useState('pending') // pending, accepted, expired, invalid
  const [error, setError] = useState(null)
  const [joining, setJoining] = useState(false)
  const [manualCode, setManualCode] = useState(queryValue)

  useEffect(() => {
    if (queryValue) {
      verifyTargetClass(queryValue)
    } else {
      setLoading(false)
    }
  }, [queryValue, user?.id])

  async function verifyTargetClass(tokenOrCode) {
    try {
      setLoading(true)
      setError(null)

      const result = await classesService.verifyInviteToken(tokenOrCode)

      if (!result.valid) {
        if (result.expired) {
          setInvitationStatus('expired')
          setError('This class invitation link has expired. Please request a fresh invitation link from your teacher.')
        } else {
          setInvitationStatus('invalid')
          setError(result.error || 'Invalid or revoked invitation link.')
        }
        setClassInfo(null)
        return
      }

      const cls = result.class
      setClassInfo(cls)

      // If user is already logged in, check if already enrolled
      if (user?.id) {
        const isMember = cls.is_enrolled || cls.class_members?.some((m) => m.student_id === user.id)
        if (isMember) {
          setInvitationStatus('accepted')
        } else {
          setInvitationStatus('pending')
        }
      }
    } catch (err) {
      console.error('[JoinClassPage] Verification error:', err)
      setError(err.message || 'Failed to verify invitation.')
      setInvitationStatus('invalid')
    } finally {
      setLoading(false)
    }
  }

  const handleManualSearch = (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    verifyTargetClass(manualCode.trim())
  }

  const handleAcceptInvitation = async () => {
    if (!classInfo || !user?.id) return

    try {
      setJoining(true)
      setError(null)
      const currentCode = manualCode || queryValue || classInfo.class_code || ''
      await classesService.enrollStudent(classInfo.id, user.id, currentCode)
      setInvitationStatus('accepted')

      setTimeout(() => {
        navigate(`/student/classes/${classInfo.id}`)
      }, 1500)
    } catch (err) {
      console.error('[JoinClassPage] Accept error:', err)
      setError(err.message || 'Failed to enroll in class.')
    } finally {
      setJoining(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-brand-appBg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-appBg flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Brand Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center text-white shadow-purple-glow">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <span className="font-bold text-lg text-brand-heading tracking-tight flex items-center gap-1.5">
              Assignora
            </span>
            <span className="block text-[11px] font-medium text-brand-muted">
              Assign. Track. Achieve.
            </span>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-brand-heading hidden sm:block">
              {user.name} ({user.role})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(user.role === 'admin' ? '/admin' : '/student')}
            >
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <Link
            to={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-primary bg-brand-light px-4 py-2 rounded-xl hover:bg-brand-activeNav transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In to Accept</span>
          </Link>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-lg mx-auto w-full my-auto py-8">
        <Card padding="p-6 sm:p-8" className="shadow-modal border border-brand-line space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-light text-brand-primary mx-auto flex items-center justify-center shadow-card">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-brand-heading tracking-tight">
              Class Invitation
            </h2>
            <p className="text-xs text-brand-muted">
              Join coursework, collaborate with classmates, and submit assignments
            </p>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="animate-spin w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-brand-muted">Verifying class invitation...</p>
            </div>
          ) : classInfo ? (
            <div className="space-y-5">
              {/* Class Preview Hero Card */}
              <div className="rounded-2xl p-5 bg-gradient-to-br from-brand-primary to-brand-hover text-white shadow-purple-glow space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    {classInfo.subject || 'Course'}
                  </span>
                  <Badge variant="success" size="sm">
                    {invitationStatus === 'accepted' ? 'Already Enrolled' : 'Active Invitation'}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-xl font-black text-white">{classInfo.name}</h3>
                  {classInfo.description && (
                    <p className="text-xs text-white/85 mt-1 line-clamp-2">
                      {classInfo.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-white/20 flex items-center justify-between text-xs text-white/90">
                  <span>Enrolment Code: <strong className="font-mono">CLS-{classesService.getClassCode(classInfo)}</strong></span>
                  <span>{classInfo.class_members?.length || 0} Students</span>
                </div>
              </div>

              {/* Instructor Information */}
              <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-light text-brand-primary flex items-center justify-center font-bold">
                  {classInfo.users?.name?.charAt(0) || 'P'}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-brand-muted block">Class Instructor</span>
                  <strong className="text-xs text-brand-heading truncate block">
                    {classInfo.users?.name || 'Prof. Anitha R.'}
                  </strong>
                  <span className="text-[11px] text-brand-muted">{classInfo.users?.email}</span>
                </div>
              </div>

              {error && (
                <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              {!user ? (
                <div className="space-y-3 pt-2">
                  <Button
                    variant="primary"
                    className="w-full shadow-purple-glow font-bold py-3"
                    icon={LogIn}
                    onClick={() =>
                      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
                    }
                  >
                    Sign In to Accept Invitation
                  </Button>
                  <p className="text-center text-[11px] text-brand-muted">
                    You must be logged in to an Assignora student account to join.
                  </p>
                </div>
              ) : invitationStatus === 'accepted' ? (
                <div className="space-y-3 text-center pt-2">
                  <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>You are enrolled in this class!</span>
                  </div>
                  <Button
                    variant="primary"
                    className="w-full shadow-purple-glow font-semibold"
                    onClick={() => navigate(`/student/classes/${classInfo.id}`)}
                    icon={ArrowRight}
                  >
                    Open Class Page
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <Button
                    variant="primary"
                    className="w-full shadow-purple-glow font-bold py-3"
                    loading={joining}
                    onClick={handleAcceptInvitation}
                    icon={CheckCircle2}
                  >
                    Accept Invitation & Join Class
                  </Button>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-brand-muted">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified invitation link</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Fallback Manual Code Entry Form */
            <form onSubmit={handleManualSearch} className="space-y-4">
              {error && (
                <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-brand-heading">
                  Enter Class Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. CLS-E2E398"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="w-full uppercase font-mono tracking-wider font-bold text-center text-lg py-3 px-4 rounded-xl border border-brand-line focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
                />
              </div>

              <Button
                variant="primary"
                type="submit"
                className="w-full shadow-purple-glow font-bold"
                icon={ArrowRight}
              >
                Look up Class
              </Button>
            </form>
          )}
        </Card>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-brand-muted py-4">
        © 2026 Assignora Education SaaS. All rights reserved.
      </footer>
    </div>
  )
}

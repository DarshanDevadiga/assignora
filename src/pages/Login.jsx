import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  Calendar,
  BookOpen,
  Laptop,
  AlertCircle,
  Lock,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Button from '../components/common/Button'
import { Input } from '../components/common/Input'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  // Submit login form
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.')
      return
    }

    try {
      setLoading(true)
      setErrorMessage('')
      setInfoMessage('')
      
      const { profile } = await signIn(email.trim(), password)
      
      const targetRole = profile?.role || 'student'
      const roleDashboard = targetRole === 'admin' ? '/admin' : '/student'

      // Check query param 'code' or explicit join/invite link
      const queryParams = new URLSearchParams(location.search)
      const codeParam = queryParams.get('code')
      const redirectParam = queryParams.get('redirect') || queryParams.get('returnUrl')

      if (codeParam) {
        navigate(`/join-class?code=${encodeURIComponent(codeParam)}`, { replace: true })
        return
      }

      // Only respect redirectParam if it is an explicit public join or invitation link
      if (
        redirectParam &&
        (redirectParam.startsWith('/join') || redirectParam.startsWith('/invite'))
      ) {
        navigate(redirectParam, { replace: true })
        return
      }

      // Always navigate to the user's role-specific dashboard on fresh login
      navigate(roleDashboard, { replace: true })
    } catch (err) {
      console.error('[Login] Error signing in:', err)
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials')) {
        setErrorMessage('Invalid email or password. Please verify your credentials and try again.')
      } else if (msg.includes('Email not confirmed')) {
        setErrorMessage('Email address is not confirmed. Please check your inbox.')
      } else {
        setErrorMessage(msg || 'Failed to sign in. Please check your internet connection.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = (e) => {
    e.preventDefault()
    setInfoMessage('To reset your password, please contact your university administrator or instructor.')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FF] via-[#F5F3FF] to-[#EDE9FE] flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden">
      {/* Decorative background glow circles */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-brand-light/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-brand-border/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        
        {/* Left Hero Section */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          {/* Logo Pill */}
          <div className="inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary flex items-center justify-center text-white shadow-purple-glow">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-heading tracking-tight leading-none">
                Assignora
              </h2>
              <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
                Smart Assignment Management
              </span>
            </div>
          </div>

          {/* Punchy Headline */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-brand-heading tracking-tight leading-[1.1]">
              Assign. Track.{' '}
              <span className="text-brand-primary">Achieve.</span>
            </h1>
            <p className="text-base sm:text-lg text-brand-muted max-w-lg leading-relaxed">
              A simpler way for students and professors to manage assignments, monitor submissions, and track progress all in one place.
            </p>
          </div>

          {/* Hero Illustration / Preview Card */}
          <div className="pt-2 hidden sm:block">
            <div className="relative rounded-2xl bg-white/80 backdrop-blur-md border border-brand-line/70 p-6 shadow-xl max-w-lg">
              <div className="flex items-center justify-between pb-4 border-b border-brand-line/60">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-semibold text-brand-heading">
                    Assignments
                  </span>
                </div>
                <span className="text-xs font-medium text-brand-primary bg-brand-light px-2.5 py-1 rounded-full">
                  Real-time Sync
                </span>
              </div>

              {/* Preview items */}
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-brand-line/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-xs font-semibold text-brand-heading">
                        Web Development – Mini Project
                      </p>
                      <p className="text-[11px] text-brand-muted">
                        MCA Sem 5 • Practical Assignment
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                    Active
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-brand-line/50">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="text-xs font-semibold text-brand-heading">
                        Database Systems – ER Modeling
                      </p>
                      <p className="text-[11px] text-brand-muted">
                        Due this week • 100 Points
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">
                    Submission Open
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div className="mt-4 flex items-center justify-between text-xs text-brand-muted pt-2 border-t border-brand-line/50">
                <span className="flex items-center gap-1.5 font-medium">
                  <BookOpen className="w-4 h-4 text-brand-primary" /> Multi-Class Management
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Laptop className="w-4 h-4 text-brand-secondary" /> Instant Notifications
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Login Card */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl border border-brand-line/80 shadow-2xl p-6 sm:p-8">
            {/* Header */}
            <div className="text-center space-y-1 mb-6">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-brand-primary text-white items-center justify-center shadow-purple-glow mb-2">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-brand-heading">
                Welcome back!
              </h2>
              <p className="text-sm text-brand-muted">
                Sign in to your Assignora account
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Info Message */}
            {infoMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-brand-light border border-brand-border text-brand-primary text-xs flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{infoMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email input */}
              <Input
                label="Email address"
                type="email"
                required
                autoComplete="email"
                icon={Mail}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errorMessage) setErrorMessage('')
                }}
                placeholder="name@university.edu"
              />

              {/* Password input */}
              <div>
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  icon={Lock}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errorMessage) setErrorMessage('')
                  }}
                  placeholder="Enter your password"
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-brand-heading transition-colors p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  }
                />

                <div className="flex items-center justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-semibold text-brand-primary hover:text-brand-primary/80 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full justify-center shadow-purple-glow text-base font-semibold py-3 mt-2 cursor-pointer"
              >
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-brand-line/60 text-center space-y-2">
              <p className="text-xs sm:text-sm text-brand-muted">
                Don't have an account yet?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-brand-primary hover:text-brand-hover transition-colors"
                >
                  Create an account
                </Link>
              </p>
              <p className="text-[11px] text-slate-400">
                Course enrollments are managed directly by class codes or invitations.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

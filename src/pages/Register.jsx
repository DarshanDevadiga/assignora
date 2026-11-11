import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  User,
  Hash,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  BookOpen,
  ShieldCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Button from '../components/common/Button'
import { Input } from '../components/common/Input'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  // Form states
  const [role, setRole] = useState('student') // 'student' or 'admin' (Professor)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [studentId, setStudentId] = useState('')
  const [facultyToken, setFacultyToken] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Feedback states
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleRegister = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    // Basic validation
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.')
      return
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.')
      return
    }
    if (role === 'admin' && !facultyToken.trim()) {
      setErrorMessage('Professor registration requires a valid Faculty Invitation Token issued by academic administration.')
      return
    }

    try {
      setLoading(true)
      const res = await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        facultyInviteToken: role === 'admin' ? facultyToken.trim() : null,
        studentId: role === 'student' ? studentId.trim() : null,
      })

      if (res?.session) {
        // Logged in immediately using verified server profile role
        const confirmedRole = res?.profile?.role || 'student'
        navigate(confirmedRole === 'admin' ? '/admin' : '/student', { replace: true })
      } else {
        setSuccessMessage(
          'Registration submitted successfully! Please check your email inbox and click the confirmation link to activate your account.'
        )
      }
    } catch (err) {
      console.error('[Register] Error:', err)
      const msg = err.message || ''
      if (msg.includes('already registered')) {
        setErrorMessage('An account with this email address already exists. Please sign in instead.')
      } else if (msg.includes('Invalid Faculty Invitation Token') || msg.includes('token')) {
        setErrorMessage('Invalid or expired Faculty Invitation Token. Please check with your department administrator.')
      } else {
        setErrorMessage(msg || 'Registration failed. Please check your internet connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FF] via-[#F5F3FF] to-[#EDE9FE] flex items-center justify-center p-4 sm:p-6 lg:p-12 relative overflow-hidden">
      {/* Decorative background glow circles */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-brand-light/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-brand-border/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        <div className="bg-white rounded-3xl border border-brand-line/80 shadow-2xl p-6 sm:p-8">
          
          {/* Header */}
          <div className="text-center space-y-1 mb-6">
            <div className="inline-flex w-12 h-12 rounded-2xl bg-brand-primary text-white items-center justify-center shadow-purple-glow mb-2">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-brand-heading">
              Create an Account
            </h2>
            <p className="text-xs sm:text-sm text-brand-muted">
              Join Assignora to assign, track, and achieve your academic goals
            </p>
          </div>

          {/* Role Selection Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-brand-heading uppercase tracking-wider mb-2 text-center">
              Select Your Role
            </label>
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100/80 rounded-2xl border border-brand-line/60">
              <button
                type="button"
                onClick={() => {
                  setRole('student')
                  setErrorMessage('')
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  role === 'student'
                    ? 'bg-white text-brand-primary shadow-sm border border-brand-line/50'
                    : 'text-slate-600 hover:text-brand-heading'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole('admin')
                  setErrorMessage('')
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  role === 'admin'
                    ? 'bg-white text-brand-primary shadow-sm border border-brand-line/50'
                    : 'text-slate-600 hover:text-brand-heading'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Professor / Faculty</span>
              </button>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Full Name */}
            <Input
              label="Full Name"
              type="text"
              required
              icon={User}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errorMessage) setErrorMessage('')
              }}
              placeholder="e.g. Rahul Sharma"
            />

            {/* Email Address */}
            <Input
              label="Email Address"
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

            {/* Student ID (Only for students) */}
            {role === 'student' && (
              <Input
                label="Student Roll / Enrollment No. (Optional)"
                type="text"
                icon={Hash}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. MCA-2026-042"
              />
            )}

            {/* Faculty Invitation Token (Only for professors) */}
            {role === 'admin' && (
              <div className="space-y-1">
                <Input
                  label="Faculty Invitation Token"
                  type="text"
                  required
                  icon={KeyRound}
                  value={facultyToken}
                  onChange={(e) => {
                    setFacultyToken(e.target.value)
                    if (errorMessage) setErrorMessage('')
                  }}
                  placeholder="Enter your FAC-... invitation token"
                />
                <p className="text-[11px] text-brand-muted flex items-center gap-1.5 pt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                  <span>A valid Faculty Invitation Token issued by your department administrator is required for Professor accounts.</span>
                </p>
              </div>
            )}

            {/* Password */}
            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                icon={Lock}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errorMessage) setErrorMessage('')
                }}
                placeholder="Minimum 6 characters"
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
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full justify-center shadow-purple-glow text-base font-semibold py-3 mt-4 cursor-pointer"
            >
              <span>Create {role === 'admin' ? 'Professor' : 'Student'} Account</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Footer Link to Login */}
          <div className="mt-6 pt-5 border-t border-brand-line/60 text-center">
            <p className="text-xs sm:text-sm text-brand-muted">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-brand-primary hover:text-brand-hover transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

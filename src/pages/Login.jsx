import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  GraduationCap,
  Users,
  Shield,
  ArrowRight,
  CheckCircle2,
  Calendar,
  BookOpen,
  Laptop,
  AlertCircle,
  Lock,
  Mail,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Button from '../components/common/Button'
import { Input } from '../components/common/Input'

const DEMO_ACCOUNTS = {
  admin: [
    {
      id: 'admin1',
      name: 'Admin 1 (Administrator)',
      email: 'admin@assignora.demo',
      password: 'Admin@12345',
      role: 'admin',
    },
    {
      id: 'admin2',
      name: 'Admin 2 (Professor Admin)',
      email: 'professor@assignora.demo',
      password: 'Professor@123',
      role: 'admin',
    },
  ],
  student: [
    {
      id: 'student1',
      name: 'Student 1 — John Doe',
      email: 'student1@assignora.demo',
      password: 'Student@123',
      role: 'student',
    },
    {
      id: 'student2',
      name: 'Student 2 — Jane Smith',
      email: 'student2@assignora.demo',
      password: 'Student@123',
      role: 'student',
    },
    {
      id: 'student3',
      name: 'Student 3 — Alex Johnson',
      email: 'student3@assignora.demo',
      password: 'Student@123',
      role: 'student',
    },
    {
      id: 'student4',
      name: 'Student 4 — Sneha Rao',
      email: 'student4@assignora.demo',
      password: 'Student@123',
      role: 'student',
    },
    {
      id: 'student5',
      name: 'Student 5 — Rahul Sharma',
      email: 'student5@assignora.demo',
      password: 'Student@123',
      role: 'student',
    },
  ],
}

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [selectedRole, setSelectedRole] = useState('student')
  const [selectedAccountId, setSelectedAccountId] = useState('student1')
  const [email, setEmail] = useState('student1@assignora.demo')
  const [password, setPassword] = useState('Student@123')
  const [isCustomMode, setIsCustomMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Handle role switcher tab click
  const handleRoleChange = (role) => {
    setSelectedRole(role)
    setErrorMessage('')
    const defaultAcc = DEMO_ACCOUNTS[role][0]
    setSelectedAccountId(defaultAcc.id)
    setEmail(defaultAcc.email)
    setPassword(defaultAcc.password)
    setIsCustomMode(false)
  }

  // Handle account dropdown selection
  const handleAccountSelect = (e) => {
    const accId = e.target.value
    setSelectedAccountId(accId)
    setErrorMessage('')

    if (accId === 'custom') {
      setIsCustomMode(true)
      setEmail('')
      setPassword('')
    } else {
      setIsCustomMode(false)
      const found = DEMO_ACCOUNTS[selectedRole].find((a) => a.id === accId)
      if (found) {
        setEmail(found.email)
        setPassword(found.password)
      }
    }
  }

  // Submit login form
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMessage('Please provide both email and password.')
      return
    }

    try {
      setLoading(true)
      setErrorMessage('')
      const { profile } = await signIn(email, password)
      
      const targetRole = profile?.role || selectedRole
      const from = location.state?.from?.pathname
      if (from && ((targetRole === 'admin' && from.startsWith('/admin')) || (targetRole === 'student' && from.startsWith('/student')))) {
        navigate(from, { replace: true })
      } else {
        navigate(targetRole === 'admin' ? '/admin' : '/student', { replace: true })
      }
    } catch (err) {
      console.error('[Login] Error signing in:', err)
      setErrorMessage(
        err.message === 'Invalid login credentials'
          ? 'Invalid email or password. Please verify your credentials or select a demo account.'
          : err.message || 'Failed to sign in. Please try again.'
      )
    } finally {
      setLoading(false)
    }
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

              {/* Mock items */}
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-brand-line/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-xs font-semibold text-brand-heading">
                        Web Development – Mini Project
                      </p>
                      <p className="text-[11px] text-brand-muted">
                        Due Nov 5, 2026 • MCA Sem 5
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                    Submitted
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-brand-line/50">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="text-xs font-semibold text-brand-heading">
                        Data Structures – Problem Set
                      </p>
                      <p className="text-[11px] text-brand-muted">
                        Due Nov 8, 2026 • 100 Points
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">
                    Due in 5 days
                  </span>
                </div>
              </div>

              {/* Little 3D accent badges */}
              <div className="mt-4 flex items-center justify-between text-xs text-brand-muted pt-2 border-t border-brand-line/50">
                <span className="flex items-center gap-1.5 font-medium">
                  <BookOpen className="w-4 h-4 text-brand-primary" /> 2 Active Classes
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Laptop className="w-4 h-4 text-brand-secondary" /> Two-Step Confirmation
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
                Login to your Assignora account
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Role Switcher Tabs */}
            <div className="space-y-1.5 mb-5">
              <label className="block text-xs font-semibold text-brand-heading">
                Select your role
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleRoleChange('student')}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                    selectedRole === 'student'
                      ? 'border-brand-primary bg-brand-activeNav text-brand-primary shadow-xs ring-2 ring-brand-primary/20'
                      : 'border-brand-line bg-white text-brand-body hover:bg-slate-50'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('admin')}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                    selectedRole === 'admin'
                      ? 'border-brand-primary bg-brand-activeNav text-brand-primary shadow-xs ring-2 ring-brand-primary/20'
                      : 'border-brand-line bg-white text-brand-body hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Professor / Admin</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Account Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-brand-heading mb-1.5">
                  Select your account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={handleAccountSelect}
                  className="w-full rounded-input border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-heading font-medium focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
                >
                  {DEMO_ACCOUNTS[selectedRole].map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.email})
                    </option>
                  ))}
                  <option value="custom">✏️ Enter custom credentials...</option>
                </select>
              </div>

              {/* Email & Password inputs */}
              <div className="space-y-3 pt-1">
                <Input
                  label="Email address"
                  type="email"
                  required
                  icon={Mail}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setIsCustomMode(true)
                  }}
                  placeholder="name@assignora.demo"
                />

                <Input
                  label="Password"
                  type="password"
                  required
                  icon={Lock}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setIsCustomMode(true)
                  }}
                  placeholder="••••••••"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full justify-center shadow-purple-glow text-base font-semibold py-3 mt-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>

            {/* Quick Demo Accounts Selection Footer */}
            <div className="mt-6 pt-5 border-t border-brand-line/60">
              <span className="block text-center text-xs font-medium text-brand-muted mb-3">
                Demo Accounts
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleRoleChange('student')}
                  className="p-2.5 rounded-xl border border-brand-line/80 bg-slate-50 hover:bg-brand-activeNav hover:border-brand-border text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-brand-heading">
                    <GraduationCap className="w-3.5 h-3.5 text-brand-primary" />
                    <span>Student Accounts</span>
                  </div>
                  <span className="block text-[11px] text-brand-muted mt-0.5 truncate">
                    Student 1 – Student 5
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('admin')}
                  className="p-2.5 rounded-xl border border-brand-line/80 bg-slate-50 hover:bg-brand-activeNav hover:border-brand-border text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-brand-heading">
                    <Shield className="w-3.5 h-3.5 text-brand-primary" />
                    <span>Admin Accounts</span>
                  </div>
                  <span className="block text-[11px] text-brand-muted mt-0.5 truncate">
                    Admin 1, Admin 2
                  </span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

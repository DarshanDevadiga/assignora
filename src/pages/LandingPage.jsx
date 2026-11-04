import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Users,
  CheckSquare,
  FileText,
  Award,
  TrendingUp,
  Bell,
  ShieldCheck,
  Sparkles,
  Clock,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  Calendar,
  Layers,
  BarChart3,
  BookmarkCheck,
  Send,
  Laptop,
  Check
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LandingPage() {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activePreviewTab, setActivePreviewTab] = useState('admin')

  const dashboardPath = user
    ? user.role === 'admin'
      ? '/admin'
      : '/student'
    : '/login'

  const features = [
    {
      icon: Layers,
      title: 'Class Management',
      description:
        'Create, organize, and administer digital classrooms with subject taxonomy, enrollment codes, and rich course descriptions.',
      badge: 'Core'
    },
    {
      icon: FileText,
      title: 'Assignment Management',
      description:
        'Publish coursework with precise due dates, point weightings, resource links, and whole-class or targeted student allocation.',
      badge: 'Essential'
    },
    {
      icon: Users,
      title: 'Student Enrollment',
      description:
        'Seamless dual-channel enrollment: students join instantly via a 6-character code or instructors send direct invitations.',
      badge: 'Dual Flow'
    },
    {
      icon: CheckSquare,
      title: 'Assignment Submissions',
      description:
        'Robust two-step submission confirmation with deliverable link validation (Google Drive, GitHub, PDF) and celebratory confetti.',
      badge: 'Interactive'
    },
    {
      icon: Award,
      title: 'Grading & Feedback',
      description:
        'Dedicated teacher grading interface with score inputs, dynamic letter grade calculation (A+ to F), and qualitative feedback.',
      badge: 'Evaluations'
    },
    {
      icon: TrendingUp,
      title: 'Academic Progress Tracking',
      description:
        'Real-time student progress analytics and radial completion charts providing visual accountability for coursework.',
      badge: 'Analytics'
    },
    {
      icon: BookmarkCheck,
      title: 'Class Announcements',
      description:
        'Broadcast critical updates and syllabus notices directly to enrolled students with instant timeline updates.',
      badge: 'Broadcast'
    },
    {
      icon: Bell,
      title: 'Real-Time Notifications',
      description:
        'Instant alerts for new assignments, evaluated submissions, and announcements with active unread counters.',
      badge: 'Realtime'
    },
    {
      icon: BookOpen,
      title: 'Open Educational Resources',
      description:
        'Integrated access to high-quality Open Educational Resources (OER) including OpenStax textbooks and MIT OpenCourseWare.',
      badge: 'OER Library'
    },
    {
      icon: ShieldCheck,
      title: 'Role-Based Access Control',
      description:
        'Strict role isolation and enterprise-grade Postgres Row Level Security (RLS) guaranteeing total academic data privacy.',
      badge: 'Security'
    }
  ]

  const workflowSteps = [
    {
      step: '01',
      title: 'Create or Join a Class',
      desc: 'Administrators and teachers launch classes in seconds with 6-character codes. Students join with a single click or direct invitation.',
      role: 'Setup & Onboarding'
    },
    {
      step: '02',
      title: 'Create and Assign Work',
      desc: 'Instructors craft assignments with deadlines, points, and attachments, choosing to assign to the entire cohort or targeted students.',
      role: 'Instruction'
    },
    {
      step: '03',
      title: 'Submit Assignments',
      desc: 'Students submit deliverables with Google Drive, Docs, or GitHub links, guarded by two-step verification and duplicate submission locks.',
      role: 'Submissions'
    },
    {
      step: '04',
      title: 'Evaluate & Track Progress',
      desc: 'Instructors grade work with letter grades and personalized feedback, while students track completion metrics on their personal dashboard.',
      role: 'Evaluation'
    }
  ]

  const previewTabs = [
    { id: 'admin', label: 'Admin Dashboard', icon: BarChart3 },
    { id: 'assignment', label: 'Assignment Workflow', icon: FileText },
    { id: 'student', label: 'Student Experience', icon: Laptop },
    { id: 'grades', label: 'Grading & Analytics', icon: Award }
  ]

  return (
    <div className="min-h-screen bg-[#F8F9FF] text-brand-body font-sans selection:bg-brand-primary selection:text-white">
      {/* 1. STICKY NAVIGATION */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-brand-line/70 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Tagline */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-purple-glow group-hover:scale-105 transition-transform duration-200">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold tracking-tight text-brand-heading">
                Assignora
              </span>
              <span className="text-xs font-semibold text-brand-primary tracking-wide hidden sm:block">
                Assign. Track. Achieve.
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-brand-muted">
            <a
              href="#overview"
              className="hover:text-brand-primary transition-colors duration-150"
            >
              Overview
            </a>
            <a
              href="#roles"
              className="hover:text-brand-primary transition-colors duration-150"
            >
              Roles
            </a>
            <a
              href="#features"
              className="hover:text-brand-primary transition-colors duration-150"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-brand-primary transition-colors duration-150"
            >
              How It Works
            </a>
            <a
              href="#preview"
              className="hover:text-brand-primary transition-colors duration-150"
            >
              Preview
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/join"
              className="px-4 py-2 text-sm font-semibold text-brand-muted hover:text-brand-heading transition-colors"
            >
              Join with Code
            </Link>
            <Link
              to={dashboardPath}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-btn bg-brand-primary text-white text-sm font-semibold hover:bg-brand-hover shadow-purple-glow transition-all duration-200 hover:-translate-y-0.5"
            >
              {user ? (
                <>
                  <span>Go to Dashboard</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-brand-muted hover:text-brand-heading focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-brand-line px-4 pt-3 pb-6 space-y-3 animate-in fade-in slide-in-from-top-4 duration-200 shadow-xl">
            <a
              href="#overview"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-brand-muted hover:text-brand-primary"
            >
              Overview
            </a>
            <a
              href="#roles"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-brand-muted hover:text-brand-primary"
            >
              Roles
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-brand-muted hover:text-brand-primary"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-brand-muted hover:text-brand-primary"
            >
              How It Works
            </a>
            <a
              href="#preview"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-brand-muted hover:text-brand-primary"
            >
              Preview
            </a>
            <div className="pt-3 border-t border-brand-line flex flex-col gap-2">
              <Link
                to="/join"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 text-sm font-semibold text-brand-muted hover:text-brand-heading"
              >
                Join with Code
              </Link>
              <Link
                to={dashboardPath}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-btn bg-brand-primary text-white text-sm font-semibold shadow-purple-glow"
              >
                {user ? 'Go to Dashboard' : 'Sign In to Assignora'}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <section id="overview" className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* Soft Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-brand-light/60 via-brand-light/20 to-transparent pointer-events-none rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-light/80 border border-brand-border text-xs font-semibold text-brand-primary mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Modern Academic Workflow & Learning Management</span>
          </div>

          {/* Hero Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-brand-heading tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Smarter Learning. Better Teaching.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">
              One Platform.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg sm:text-xl text-brand-muted max-w-2xl mx-auto leading-relaxed">
            Assignora brings administrators, teachers and students together in one intelligent
            learning management platform. Manage classes, assignments, submissions and academic
            progress with ease.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={dashboardPath}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-btn bg-brand-primary text-white text-base font-semibold hover:bg-brand-hover shadow-purple-glow transition-all duration-200 hover:-translate-y-0.5"
            >
              <span>{user ? 'Access Dashboard' : 'Get Started Now'}</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-btn bg-white border border-brand-border text-brand-heading text-base font-semibold hover:bg-brand-secondaryBg hover:border-brand-primary/40 transition-all duration-200"
            >
              <span>Explore Features</span>
              <ChevronRight className="w-5 h-5 text-brand-muted" />
            </a>
          </div>

          {/* Trust stats pill */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs sm:text-sm font-semibold text-brand-muted">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-success" />
              <span>Role-Based Access Control</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-success" />
              <span>Real-Time Notifications</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-success" />
              <span>Google Classroom Inspired</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-success" />
              <span>Built-in OER Textbooks</span>
            </div>
          </div>

          {/* High-Fidelity Interactive Dashboard Preview Mockup */}
          <div className="mt-14 relative max-w-5xl mx-auto">
            <div className="rounded-2xl border border-brand-border bg-white shadow-2xl overflow-hidden p-2 sm:p-4 text-left transition-all duration-300">
              {/* Fake Browser Top Bar */}
              <div className="flex items-center justify-between pb-3 px-2 border-b border-brand-line">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-xs font-mono text-brand-muted hidden sm:inline">
                    https://assignora-cyan.vercel.app/admin
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-light text-brand-primary">
                    Live Demo Workspace
                  </span>
                </div>
              </div>

              {/* Mock Dashboard Content */}
              <div className="p-4 sm:p-6 space-y-6 bg-slate-50/60 rounded-xl mt-3">
                {/* Mock Banner */}
                <div className="bg-gradient-to-r from-brand-primary to-brand-secondary rounded-xl p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold">Welcome back, Professor!</h3>
                    <p className="text-brand-light text-xs sm:text-sm mt-1">
                      Here is the live coursework status across your 5 active classes.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold">
                      Term: Spring 2026
                    </span>
                  </div>
                </div>

                {/* Live Metric Cards Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white p-4 rounded-xl border border-brand-border/60 shadow-sm">
                    <div className="text-xs font-semibold text-brand-muted uppercase">Active Classes</div>
                    <div className="text-2xl font-bold text-brand-heading mt-1">5</div>
                    <div className="text-[11px] text-brand-success font-medium mt-1">100% active</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-brand-border/60 shadow-sm">
                    <div className="text-xs font-semibold text-brand-muted uppercase">Assignments</div>
                    <div className="text-2xl font-bold text-brand-heading mt-1">12</div>
                    <div className="text-[11px] text-brand-primary font-medium mt-1">3 due this week</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-brand-border/60 shadow-sm">
                    <div className="text-xs font-semibold text-brand-muted uppercase">Submissions</div>
                    <div className="text-2xl font-bold text-brand-heading mt-1">38</div>
                    <div className="text-[11px] text-brand-success font-medium mt-1">32 evaluated</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-brand-border/60 shadow-sm">
                    <div className="text-xs font-semibold text-brand-muted uppercase">Avg Completion</div>
                    <div className="text-2xl font-bold text-brand-primary mt-1">88%</div>
                    <div className="text-[11px] text-brand-success font-medium mt-1">+12% vs last term</div>
                  </div>
                </div>

                {/* Active Classes Sample Row */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-brand-heading uppercase tracking-wider">
                    <span>Recent Classes</span>
                    <span className="text-brand-primary normal-case font-semibold">View All 5 Classes →</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white p-4 rounded-xl border border-brand-line hover:border-brand-primary/40 transition-colors shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-primary bg-brand-light px-2 py-0.5 rounded">ECON101</span>
                        <span className="text-xs text-brand-muted">Code: <strong className="text-brand-heading font-mono">ECN101</strong></span>
                      </div>
                      <h4 className="font-bold text-sm text-brand-heading mt-2">Principles of Economics</h4>
                      <p className="text-xs text-brand-muted mt-1">Macroeconomic models & monetary policy.</p>
                      <div className="mt-3 pt-3 border-t border-brand-line/60 flex items-center justify-between text-xs">
                        <span className="text-brand-muted">4 Enrolled</span>
                        <span className="text-brand-success font-semibold">91% Submissions</span>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-brand-line hover:border-brand-primary/40 transition-colors shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-primary bg-brand-light px-2 py-0.5 rounded">CS201</span>
                        <span className="text-xs text-brand-muted">Code: <strong className="text-brand-heading font-mono">CS2010</strong></span>
                      </div>
                      <h4 className="font-bold text-sm text-brand-heading mt-2">Data Structures & Algorithms</h4>
                      <p className="text-xs text-brand-muted mt-1">Graph theory, dynamic programming & trees.</p>
                      <div className="mt-3 pt-3 border-t border-brand-line/60 flex items-center justify-between text-xs">
                        <span className="text-brand-muted">4 Enrolled</span>
                        <span className="text-brand-success font-semibold">85% Submissions</span>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-brand-line hover:border-brand-primary/40 transition-colors shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-primary bg-brand-light px-2 py-0.5 rounded">BIO110</span>
                        <span className="text-xs text-brand-muted">Code: <strong className="text-brand-heading font-mono">BIO110</strong></span>
                      </div>
                      <h4 className="font-bold text-sm text-brand-heading mt-2">Molecular Biology</h4>
                      <p className="text-xs text-brand-muted mt-1">Genetics, cellular division & CRISPR mechanisms.</p>
                      <div className="mt-3 pt-3 border-t border-brand-line/60 flex items-center justify-between text-xs">
                        <span className="text-brand-muted">4 Enrolled</span>
                        <span className="text-brand-success font-semibold">100% Submissions</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PLATFORM ROLES SECTION */}
      <section id="roles" className="py-20 bg-white border-y border-brand-line/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold tracking-widest text-brand-primary uppercase">
              Role-Based Architecture
            </h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-heading tracking-tight">
              Designed for Everyone in Education
            </p>
            <p className="mt-4 text-base sm:text-lg text-brand-muted">
              Assignora enforces strict data isolation and tailored workspaces so administrators,
              teachers and students can focus entirely on high-impact learning.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Administrator */}
            <div className="rounded-2xl p-8 border border-brand-border bg-gradient-to-b from-white to-[#F8F9FF] shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-brand-heading">Administrator</h3>
                <p className="text-sm font-medium text-brand-primary mt-1">
                  Institutional Governance & Operations
                </p>
                <p className="mt-4 text-sm text-brand-muted leading-relaxed">
                  Oversee institutional departments, monitor global class activity, manage faculty
                  assignments, verify student rosters, and generate compliance grade reports.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-brand-body font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span>Global class oversight and department controls</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span>User management & role governance</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span>Cross-class submission tracking & CSV exports</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8 pt-4 border-t border-brand-line">
                <span className="text-xs font-semibold text-brand-primary">
                  Included in Admin Workspace
                </span>
              </div>
            </div>

            {/* Teacher */}
            <div className="rounded-2xl p-8 border-2 border-brand-primary bg-white shadow-xl relative flex flex-col justify-between transform md:-translate-y-2">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-primary text-white text-[11px] font-bold tracking-wider uppercase rounded-full shadow-md">
                Course Leadership
              </div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-brand-primary text-white flex items-center justify-center mb-6 shadow-purple-glow">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-brand-heading">Teacher / Instructor</h3>
                <p className="text-sm font-medium text-brand-primary mt-1">
                  Coursework Authoring & Assessment
                </p>
                <p className="mt-4 text-sm text-brand-muted leading-relaxed">
                  Create digital classes, author coursework with deadline rules, selectively assign
                  projects to specific students, evaluate submissions with letter grades, and broadcast
                  stream announcements.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-brand-body font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span>Flexible whole-cohort or targeted assignment assignment</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span>Grading modal with dynamic letter grades & feedback</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span>Class announcements & real-time student notifications</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8 pt-4 border-t border-brand-line">
                <span className="text-xs font-semibold text-brand-primary">
                  Full Course Lifecycle Control
                </span>
              </div>
            </div>

            {/* Student */}
            <div className="rounded-2xl p-8 border border-brand-border bg-gradient-to-b from-white to-[#F8F9FF] shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center mb-6">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-brand-heading">Student</h3>
                <p className="text-sm font-medium text-brand-primary mt-1">
                  Learning, Deliverables & Mastery
                </p>
                <p className="mt-4 text-sm text-brand-muted leading-relaxed">
                  Join classrooms with 6-character codes, track upcoming deadlines on a personal
                  dashboard, submit coursework with Google Drive links, celebrate completion with
                  confetti, and review grades.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-brand-body font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span>Visual completion charts & upcoming deadline cards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span>Two-step submission modal with link verification</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span>Instant access to curated Open Educational Resources (OER)</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8 pt-4 border-t border-brand-line">
                <span className="text-xs font-semibold text-brand-primary">
                  Personalized Student Dashboard
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. KEY FEATURES (10 CARDS) */}
      <section id="features" className="py-20 bg-[#F8F9FF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold tracking-widest text-brand-primary uppercase">
              Comprehensive Platform Capabilities
            </h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-heading tracking-tight">
              Everything You Need for Modern Education
            </p>
            <p className="mt-4 text-base sm:text-lg text-brand-muted">
              Built from the ground up to solve coursework fragmentation, grading overhead, and
              submission tracking in one unified interface.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon
              return (
                <div
                  key={idx}
                  className="rounded-2xl p-6 bg-white border border-brand-border/70 shadow-sm hover:shadow-card-hover hover:border-brand-primary/40 transition-all duration-200 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors duration-200">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-slate-100 text-brand-muted">
                        {feat.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-brand-heading group-hover:text-brand-primary transition-colors">
                      {feat.title}
                    </h3>
                    <p className="mt-2 text-sm text-brand-muted leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 5. HOW ASSIGNORA WORKS (4 CONNECTED STEPS) */}
      <section id="how-it-works" className="py-20 bg-white border-t border-brand-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold tracking-widest text-brand-primary uppercase">
              Seamless Workflow
            </h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-heading tracking-tight">
              How Assignora Works
            </p>
            <p className="mt-4 text-base sm:text-lg text-brand-muted">
              From course setup to feedback distribution, experience a friction-free academic cycle.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {workflowSteps.map((step, idx) => (
              <div
                key={idx}
                className="relative rounded-2xl p-6 bg-[#F8F9FF] border border-brand-border flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl font-black text-brand-primary/30">
                      {step.step}
                    </span>
                    <span className="text-[11px] font-semibold text-brand-primary bg-brand-light px-2 py-0.5 rounded-full">
                      {step.role}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-brand-heading">{step.title}</h3>
                  <p className="mt-3 text-sm text-brand-muted leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. PRODUCT PREVIEW (INTERACTIVE TABS) */}
      <section id="preview" className="py-20 bg-[#F8F9FF] border-t border-brand-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold tracking-widest text-brand-primary uppercase">
              Interface Showcase
            </h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-heading tracking-tight">
              Engineered for Intuitive Usability
            </p>
            <p className="mt-4 text-base sm:text-lg text-brand-muted">
              Inspect how Assignora transforms everyday academic routines into delightful digital
              experiences.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {previewTabs.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activePreviewTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActivePreviewTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-primary text-white shadow-purple-glow'
                      : 'bg-white text-brand-muted hover:text-brand-heading border border-brand-line'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab Content Display */}
          <div className="mt-8 max-w-4xl mx-auto bg-white rounded-2xl border border-brand-border p-6 shadow-xl">
            {activePreviewTab === 'admin' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-brand-line">
                  <div className="font-bold text-base text-brand-heading">
                    Admin / Teacher Overview Panel
                  </div>
                  <span className="text-xs text-brand-success font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Realtime Sync Active
                  </span>
                </div>
                <p className="text-sm text-brand-muted">
                  Gain instant clarity on active classes, scheduled deadlines, pending submissions,
                  and student grade distributions across your entire department.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line">
                    <span className="text-xs text-brand-muted">Total Enrolled Students</span>
                    <p className="text-xl font-bold text-brand-heading mt-1">20 Students</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line">
                    <span className="text-xs text-brand-muted">Assignments Due</span>
                    <p className="text-xl font-bold text-brand-primary mt-1">4 Active</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line">
                    <span className="text-xs text-brand-muted">Submissions to Grade</span>
                    <p className="text-xl font-bold text-amber-600 mt-1">6 Pending</p>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'assignment' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-brand-line">
                  <div className="font-bold text-base text-brand-heading">
                    Flexible Coursework Allocation
                  </div>
                  <span className="text-xs text-brand-primary font-semibold bg-brand-light px-2.5 py-1 rounded-full">
                    Targeted Assignment Support
                  </span>
                </div>
                <p className="text-sm text-brand-muted">
                  Instructors can publish assignments to the entire class or select individual
                  students for tailored remedial or honors coursework. Attach drive links and set
                  granular due dates.
                </p>
                <div className="p-4 rounded-xl bg-brand-light/30 border border-brand-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-brand-heading">Assignment Allocation Mode</span>
                    <span className="font-semibold text-brand-primary">Selective (2 / 4 Students)</span>
                  </div>
                  <div className="w-full bg-white h-2 rounded-full overflow-hidden border border-brand-border/60">
                    <div className="bg-brand-primary h-full w-1/2" />
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'student' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-brand-line">
                  <div className="font-bold text-base text-brand-heading">
                    Student Dashboard & Submission Flow
                  </div>
                  <span className="text-xs text-brand-success font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Confetti Celebrations Enabled
                  </span>
                </div>
                <p className="text-sm text-brand-muted">
                  Students experience clean deadline countdowns, two-step submission verification to
                  prevent accidental uploads, and celebratory animations upon successful coursework
                  hand-in.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line">
                    <span className="text-xs text-brand-muted">Step 1: Link Attachment</span>
                    <p className="text-sm font-semibold text-brand-heading mt-1">
                      Validate Google Drive / GitHub URL
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line">
                    <span className="text-xs text-brand-muted">Step 2: Confirmation Guard</span>
                    <p className="text-sm font-semibold text-brand-heading mt-1">
                      Prevent accidental submissions
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'grades' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-brand-line">
                  <div className="font-bold text-base text-brand-heading">
                    Gradebook & Performance Analytics
                  </div>
                  <span className="text-xs text-brand-primary font-semibold bg-brand-light px-2.5 py-1 rounded-full">
                    Letter Grades A+ to F
                  </span>
                </div>
                <p className="text-sm text-brand-muted">
                  Teachers enter marks out of 100 or custom points, and Assignora automatically
                  calculates standardized letter grades alongside detailed instructor feedback
                  notes.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-xs text-emerald-700 font-bold">90–100%</span>
                    <p className="text-lg font-black text-emerald-800">A+ / A</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                    <span className="text-xs text-blue-700 font-bold">80–89%</span>
                    <p className="text-lg font-black text-blue-800">B+ / B</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-xs text-amber-700 font-bold">70–79%</span>
                    <p className="text-lg font-black text-amber-800">C+ / C</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                    <span className="text-xs text-red-700 font-bold">&lt; 60%</span>
                    <p className="text-lg font-black text-red-800">F</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 7. WHY ASSIGNORA */}
      <section className="py-20 bg-white border-t border-brand-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold tracking-widest text-brand-primary uppercase">
              The Assignora Advantage
            </h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-heading tracking-tight">
              Why Choose Assignora?
            </p>
            <p className="mt-4 text-base sm:text-lg text-brand-muted">
              Built with modern web standards to provide a dependable, fast, and secure educational
              hub.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[#F8F9FF] border border-brand-border">
              <h3 className="text-lg font-bold text-brand-heading">Centralized Academic Hub</h3>
              <p className="mt-2 text-sm text-brand-muted leading-relaxed">
                Eliminate scattered WhatsApp groups and missing emails. All class syllabi,
                assignments, announcements, and deliverables live in one organized repository.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#F8F9FF] border border-brand-border">
              <h3 className="text-lg font-bold text-brand-heading">Zero Accidental Overwrites</h3>
              <p className="mt-2 text-sm text-brand-muted leading-relaxed">
                Database-level unique constraints on submissions guarantee no duplicated or lost
                work. Students have complete confidence their work is recorded.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#F8F9FF] border border-brand-border">
              <h3 className="text-lg font-bold text-brand-heading">Open Education First</h3>
              <p className="mt-2 text-sm text-brand-muted leading-relaxed">
                Empower every learner with zero textbook cost barriers by bundling peer-reviewed
                OpenStax and MIT OpenCourseWare links into coursework streams.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FINAL CALL TO ACTION */}
      <section className="py-20 bg-gradient-to-tr from-brand-primary via-[#4C1D95] to-brand-primary text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Bring Your Learning Experience Together.
          </h2>
          <p className="mt-5 text-base sm:text-lg text-brand-light max-w-2xl mx-auto leading-relaxed">
            Join teachers and students using Assignora to simplify coursework, track academic
            progress, and elevate classroom collaboration.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={dashboardPath}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-btn bg-white text-brand-primary text-base font-bold hover:bg-brand-light shadow-xl transition-all duration-200 hover:-translate-y-0.5"
            >
              <span>{user ? 'Enter Your Dashboard' : 'Sign In to Assignora'}</span>
              <ArrowRight className="w-5 h-5 text-brand-primary" />
            </Link>
            <Link
              to="/join"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-btn bg-white/10 hover:bg-white/20 border border-white/20 text-white text-base font-semibold backdrop-blur-md transition-all duration-200"
            >
              <span>Have a Class Code?</span>
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-16 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
            {/* Col 1: Logo & Tagline */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center text-white shadow-purple-glow">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-white">Assignora</span>
              </div>
              <p className="text-sm text-slate-400 max-w-sm">
                Assign. Track. Achieve. The intelligent learning management platform designed for
                modern academic excellence.
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
                <span>Built with React 18</span>
                <span>•</span>
                <span>Vite 6</span>
                <span>•</span>
                <span>Tailwind CSS</span>
                <span>•</span>
                <span>Supabase</span>
              </div>
            </div>

            {/* Col 2: Navigation */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
                Platform
              </h4>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <a href="#overview" className="hover:text-white transition-colors">
                    Overview
                  </a>
                </li>
                <li>
                  <a href="#roles" className="hover:text-white transition-colors">
                    Roles & Workspaces
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Key Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#preview" className="hover:text-white transition-colors">
                    Interface Preview
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Access */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
                Access
              </h4>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/join" className="hover:text-white transition-colors">
                    Join with Class Code
                  </Link>
                </li>
                <li>
                  <Link to={dashboardPath} className="hover:text-white transition-colors">
                    {user ? 'My Dashboard' : 'Demo Credentials'}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              © {new Date().getFullYear()} Assignora. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span>Production Deployment on Vercel</span>
              <span>•</span>
              <span>PostgreSQL Row Level Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  PieChart,
  Calendar,
  ArrowRight,
  ExternalLink,
  Laptop,
  GraduationCap,
  Eye,
  Send,
  AlertCircle,
  Sparkles,
  BookOpen
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { submissionsService } from '../../services/submissions.service'
import { calculateCompletionRate, isOverdue, formatDisplayDate, formatDeadlineBadge } from '../../utils/calculations'
import Card from '../../components/common/Card'
import StatCard from '../../components/common/StatCard'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'

export default function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [classes, setClasses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudentData()
  }, [user?.id])

  async function loadStudentData() {
    if (!user?.id) return
    try {
      setLoading(true)

      // 1. Fetch student's class memberships
      const { data: memberRows } = await supabase
        .from('class_members')
        .select(`
          class_id,
          classes (id, name, subject, admin_id)
        `)
        .eq('student_id', user.id)

      const studentClasses = memberRows?.map((m) => m.classes).filter(Boolean) || []
      setClasses(studentClasses)
      const classIds = studentClasses.map((c) => c.id)

      // 2. Fetch assignments assigned to all in student's classes
      let allAssigned = []
      if (classIds.length > 0) {
        const { data: classAssignments } = await supabase
          .from('assignments')
          .select(`
            *,
            classes (id, name, subject)
          `)
          .in('class_id', classIds)
          .eq('assign_to_all', true)
          .eq('status', 'published')

        allAssigned = classAssignments || []
      }

      // Also fetch assignments where student is selectively assigned
      const { data: specificAssignments } = await supabase
        .from('assignment_students')
        .select(`
          assignment_id,
          assignments (
            *,
            classes (id, name, subject)
          )
        `)
        .eq('student_id', user.id)

      const selectiveList = specificAssignments?.map((s) => s.assignments).filter(Boolean) || []
      
      // Combine and deduplicate
      const combined = [...allAssigned]
      selectiveList.forEach((a) => {
        if (!combined.some((item) => item.id === a.id)) {
          combined.push(a)
        }
      })
      setAssignments(combined)

      // 3. Fetch student's submissions
      const studentSubs = await submissionsService.getStudentSubmissions(user.id)
      setSubmissions(studentSubs)
    } catch (err) {
      console.error('[StudentDashboard] Error loading student dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create submission status map: assignmentId -> submission object
  const submissionMap = useMemo(() => {
    const map = {}
    submissions.forEach((sub) => {
      map[sub.assignment_id] = sub
    })
    return map
  }, [submissions])

  // Statistics
  const totalCount = assignments.length
  const submittedCount = submissions.length
  const pendingCount = Math.max(0, totalCount - submittedCount)
  const completionRate = calculateCompletionRate(submittedCount, totalCount)

  // Upcoming deadlines (pending assignments sorted by due date)
  const upcomingDeadlines = useMemo(() => {
    return assignments
      .filter((a) => !submissionMap[a.id] && a.due_date)
      .sort((a, b) => new Date(`${a.due_date}T${a.due_time || '23:59:00'}`) - new Date(`${b.due_date}T${b.due_time || '23:59:00'}`))
      .slice(0, 3)
  }, [assignments, submissionMap])

  const studentDisplayName = user?.name || 'Student'

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner matching reference mockup */}
      <div className="relative overflow-hidden rounded-2xl purple-gradient-card p-6 border border-brand-border/70 shadow-card">
        <div className="relative z-10 flex flex-col justify-between max-w-xl">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-heading tracking-tight flex items-center gap-2">
              Welcome back, {studentDisplayName}! <span className="inline-block animate-pulse">👋</span>
            </h1>
            <p className="text-sm text-brand-muted leading-relaxed">
              Stay on top of your assignments, submit project deliverables, and track your completion progress in real-time.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-4 text-xs font-semibold text-brand-primary">
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-brand-border/80 shadow-xs">
              <BookOpen className="w-3.5 h-3.5" />
              {classes.length} Enrolled Courses
            </span>
            <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-brand-border/80 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {submittedCount} Completed
            </span>
          </div>
        </div>

        {/* 3D Illustration Graphic on right */}
        <div className="absolute -right-4 -bottom-6 opacity-25 lg:opacity-40 pointer-events-none">
          <GraduationCap className="w-48 h-48 text-brand-primary" />
        </div>
      </div>

      {/* 4 Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          value={totalCount}
          label="Total Assignments"
          color="purple"
        />
        <StatCard
          icon={CheckCircle2}
          value={submittedCount}
          label="Submitted"
          color="green"
        />
        <StatCard
          icon={Clock}
          value={pendingCount}
          label="Pending"
          color="amber"
        />
        <StatCard
          icon={PieChart}
          value={`${completionRate}%`}
          label="Completion Rate"
          color="blue"
        />
      </div>

      {/* Main Grid: My Assignments (8 cols) + Progress & Deadlines (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): My Assignments */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-brand-heading">
              My Assignments
            </h2>
            <button
              type="button"
              onClick={() => navigate('/student/assignments')}
              className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {assignments.map((assignment) => {
              const sub = submissionMap[assignment.id]
              const isSubmitted = Boolean(sub)
              const deadlineBadge = formatDeadlineBadge(assignment.due_date, assignment.due_time)

              return (
                <Card
                  key={assignment.id}
                  padding="p-4 sm:p-5"
                  className="hover:border-brand-border transition-all shadow-card flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isSubmitted
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-brand-light text-brand-primary'
                      }`}
                    >
                      {isSubmitted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <ClipboardList className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-brand-heading truncate">
                          {assignment.title}
                        </h4>
                        <span className="text-xs text-brand-muted">
                          • {assignment.classes?.name}
                        </span>
                      </div>

                      <p className="text-xs text-brand-muted mt-1">
                        {isSubmitted ? (
                          <span className="text-emerald-700 font-medium">
                            Submitted: {formatDisplayDate(sub.submitted_at)}
                          </span>
                        ) : (
                          <span>
                            Due: {assignment.due_date ? `${formatDisplayDate(assignment.due_date)} at ${assignment.due_time?.substring(0, 5) || '23:59'}` : 'No deadline'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Badges */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isSubmitted ? (
                      <Badge variant="success" size="sm" dot>
                        Submitted
                      </Badge>
                    ) : deadlineBadge ? (
                      <Badge variant={deadlineBadge.variant} size="sm">
                        {deadlineBadge.text}
                      </Badge>
                    ) : null}

                    {isSubmitted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Eye}
                        onClick={() => navigate(`/student/assignments/${assignment.id}`)}
                      >
                        View
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Send}
                        className="shadow-purple-glow font-semibold"
                        onClick={() => navigate(`/student/assignments/${assignment.id}`)}
                      >
                        Submit
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}

            {assignments.length === 0 && (
              <Card className="text-center py-12 space-y-3">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-xs text-brand-muted">
                  No assignments currently assigned to your enrolled classes.
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Progress Donut & Upcoming */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Assignment Progress Widget */}
          <Card padding="p-5" className="space-y-4 shadow-card">
            <h3 className="text-sm font-bold text-brand-heading flex items-center gap-2">
              <PieChart className="w-4 h-4 text-brand-primary" />
              <span>Assignment Progress</span>
            </h3>

            {/* Donut Chart representation */}
            <div className="flex items-center justify-center py-2">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background track */}
                  <path
                    className="text-slate-100"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Progress stroke */}
                  <path
                    className="text-brand-primary transition-all duration-1000 ease-out"
                    strokeDasharray={`${completionRate}, 100`}
                    strokeWidth="4"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-black text-brand-heading leading-none block">
                    {completionRate}%
                  </span>
                  <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">
                    Completed
                  </span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 pt-2 border-t border-brand-line/60 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-medium text-brand-body">Submitted</span>
                </div>
                <span className="font-bold text-brand-heading">{submittedCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-primary" />
                  <span className="font-medium text-brand-body">Pending</span>
                </div>
                <span className="font-bold text-brand-heading">{pendingCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="font-medium text-brand-body">Total Assigned</span>
                </div>
                <span className="font-bold text-brand-heading">{totalCount}</span>
              </div>
            </div>
          </Card>

          {/* Upcoming Deadlines Widget */}
          <Card padding="p-5" className="space-y-4 shadow-card">
            <h3 className="text-sm font-bold text-brand-heading flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-primary" />
              <span>Upcoming Deadlines</span>
            </h3>

            <div className="space-y-3">
              {upcomingDeadlines.map((item) => {
                const badge = formatDeadlineBadge(item.due_date, item.due_time)
                return (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/student/assignments/${item.id}`)}
                    className="p-3 rounded-xl bg-slate-50 border-l-4 border-l-amber-500 border-y border-r border-brand-line/60 hover:bg-slate-100 transition-all cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs font-bold text-brand-heading truncate">
                        {item.title}
                      </h5>
                      {badge && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          {badge.text}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-brand-muted flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Due {item.due_date}, {item.due_time?.substring(0, 5) || '23:59'}
                    </p>
                  </div>
                )
              })}

              {upcomingDeadlines.length === 0 && (
                <p className="text-xs text-brand-muted text-center py-4">
                  No pending deadlines upcoming! You're all caught up.
                </p>
              )}
            </div>
          </Card>

        </div>

      </div>
    </div>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Search,
  ExternalLink,
  Eye,
  Filter,
  Check,
  AlertCircle,
  FileText,
  Share2,
  MoreVertical,
  ChevronDown
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { assignmentsService } from '../../services/assignments.service'
import { classesService } from '../../services/classes.service'
import { calculateCompletionRate, isOverdue, formatDisplayDate, exportToCSV } from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import ProgressBar from '../../components/common/ProgressBar'
import Modal from '../../components/common/Modal'

export default function SubmissionTracking() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [assignments, setAssignments] = useState([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [currentAssignment, setCurrentAssignment] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all, submitted, pending, not_submitted
  const [sortOrder, setSortOrder] = useState('nameAsc')

  // Submission detail modal
  const [inspectedStudent, setInspectedStudent] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Points grading map (persisted in local component state for demo grading)
  const [gradesMap, setGradesMap] = useState({})

  useEffect(() => {
    loadAssignments()
  }, [user?.id])

  async function loadAssignments() {
    if (!user?.id) return
    try {
      setLoading(true)
      const list = await assignmentsService.getAdminAssignments(user.id)
      setAssignments(list)

      const paramId = searchParams.get('id')
      if (paramId && list.some((a) => a.id === paramId)) {
        setSelectedAssignmentId(paramId)
      } else if (list.length > 0) {
        setSelectedAssignmentId(list[0].id)
      }
    } catch (err) {
      console.error('[SubmissionTracking] Error loading assignments:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load detailed assignment data whenever selectedAssignmentId changes
  useEffect(() => {
    if (!selectedAssignmentId) return
    loadAssignmentDetails(selectedAssignmentId)
  }, [selectedAssignmentId])

  async function loadAssignmentDetails(id) {
    try {
      const details = await assignmentsService.getAssignmentById(id)
      setCurrentAssignment(details)
    } catch (err) {
      console.error('[SubmissionTracking] Error loading assignment details:', err)
    }
  }

  // Derive all assigned students and their submission records
  const studentRows = useMemo(() => {
    if (!currentAssignment) return []

    // Eligible students:
    // If assign_to_all is true, all students in class_members
    // If assign_to_all is false, students in assignment_students
    let eligible = []
    if (currentAssignment.assign_to_all) {
      eligible =
        currentAssignment.classes?.class_members?.map((m) => m.users).filter(Boolean) || []
    } else {
      eligible =
        currentAssignment.assignment_students?.map((s) => s.users).filter(Boolean) || []
    }

    const pastDeadline = isOverdue(currentAssignment.due_date, currentAssignment.due_time)
    const submissionsList = currentAssignment.submissions || []

    return eligible.map((student, idx) => {
      const sub = submissionsList.find((s) => s.student_id === student.id)
      let status = 'pending'
      if (sub) {
        status = 'submitted'
      } else if (pastDeadline) {
        status = 'not_submitted'
      }

      return {
        id: student.id,
        name: student.name || `Student ${idx + 1}`,
        email: student.email,
        student_id: student.student_id || `MCA2600${idx + 1}`,
        submission: sub || null,
        status, // 'submitted' | 'pending' | 'not_submitted'
        submitted_at: sub?.submitted_at || null,
        submission_link: sub?.submission_link || null,
        comment: sub?.comment || '',
        points: gradesMap[student.id] || (sub ? currentAssignment.points : '—'),
      }
    })
  }, [currentAssignment, gradesMap])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return studentRows
      .filter((row) => {
        if (statusFilter !== 'all' && row.status !== statusFilter) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          return (
            row.name.toLowerCase().includes(q) ||
            row.email.toLowerCase().includes(q) ||
            row.student_id.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        if (sortOrder === 'nameAsc') return a.name.localeCompare(b.name)
        if (sortOrder === 'nameDesc') return b.name.localeCompare(a.name)
        if (sortOrder === 'submittedFirst') {
          return (b.submission ? 1 : 0) - (a.submission ? 1 : 0)
        }
        return 0
      })
  }, [studentRows, statusFilter, searchQuery, sortOrder])

  // Aggregate counters
  const totalEligible = studentRows.length
  const submittedCount = studentRows.filter((r) => r.status === 'submitted').length
  const pendingCount = studentRows.filter((r) => r.status === 'pending').length
  const notSubmittedCount = studentRows.filter((r) => r.status === 'not_submitted').length
  const completionRate = calculateCompletionRate(submittedCount, totalEligible)

  // Export CSV handler
  const handleExportCSV = () => {
    if (!currentAssignment || studentRows.length === 0) return

    const exportData = studentRows.map((r, i) => ({
      index: i + 1,
      name: r.name,
      email: r.email,
      student_id: r.student_id,
      status: r.status.toUpperCase(),
      submitted_on: r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'N/A',
      submission_link: r.submission_link || 'N/A',
      notes: r.comment || 'N/A',
      points: r.points,
    }))

    const headers = [
      { key: 'index', label: '#' },
      { key: 'name', label: 'Student Name' },
      { key: 'email', label: 'Email' },
      { key: 'student_id', label: 'Student ID' },
      { key: 'status', label: 'Submission Status' },
      { key: 'submitted_on', label: 'Submitted On' },
      { key: 'submission_link', label: 'Submission Link' },
      { key: 'points', label: 'Score' },
      { key: 'notes', label: 'Student Notes' },
    ]

    exportToCSV(`Submissions_${currentAssignment.title.replace(/\s+/g, '_')}`, exportData, headers)
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/admin/assignments')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-brand-primary hover:text-brand-hover cursor-pointer mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Assignments</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
              Assignment Submissions
            </h1>
            <p className="text-xs sm:text-sm text-brand-muted mt-1">
              Track and manage student submissions, evaluate deliverables, and export performance reports.
            </p>
          </div>

          {/* Assignment Switcher Dropdown */}
          {assignments.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-brand-heading shrink-0">Switch Assignment:</label>
              <select
                value={selectedAssignmentId}
                onChange={(e) => {
                  setSelectedAssignmentId(e.target.value)
                  setSearchParams({ id: e.target.value })
                }}
                className="rounded-input border border-brand-line bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-brand-heading focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer min-w-[200px]"
              >
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.classes?.name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {currentAssignment && (
        <>
          {/* Assignment Header Summary Banner */}
          <Card padding="p-5 sm:p-6" className="shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-line/60 pb-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-brand-light text-brand-primary flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-brand-heading truncate">
                    {currentAssignment.title}
                  </h2>
                  <p className="text-xs text-brand-muted mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-brand-heading">
                      {currentAssignment.classes?.name}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Due: {currentAssignment.due_date ? `${formatDisplayDate(currentAssignment.due_date)} at ${currentAssignment.due_time?.substring(0, 5) || '23:59'}` : 'No deadline'}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-brand-primary">
                      {currentAssignment.points} Points
                    </span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={handleExportCSV}
                >
                  Export (CSV)
                </Button>
                {currentAssignment.drive_link && (
                  <a
                    href={currentAssignment.drive_link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary bg-brand-light hover:bg-brand-border/60 px-3 py-2 rounded-btn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Reference Drive</span>
                  </a>
                )}
              </div>
            </div>

            {/* 4 Stat Counters + Completion Progress Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 text-brand-primary flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-brand-heading leading-none">
                    {totalEligible}
                  </div>
                  <div className="text-xs font-medium text-brand-muted mt-1">
                    Total Students
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-brand-heading leading-none">
                    {submittedCount}
                  </div>
                  <div className="text-xs font-medium text-brand-muted mt-1">
                    Submitted
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-brand-heading leading-none">
                    {pendingCount}
                  </div>
                  <div className="text-xs font-medium text-brand-muted mt-1">
                    Pending
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-brand-line/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-brand-heading leading-none">
                    {notSubmittedCount}
                  </div>
                  <div className="text-xs font-medium text-brand-muted mt-1">
                    Not Submitted
                  </div>
                </div>
              </div>

              {/* Completion Rate Pill */}
              <div className="col-span-2 lg:col-span-1 p-3.5 rounded-xl bg-brand-light/40 border border-brand-border/80 flex flex-col justify-center">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-brand-heading">Completion Rate</span>
                  <span className="text-brand-primary">{completionRate}%</span>
                </div>
                <ProgressBar
                  value={submittedCount}
                  max={totalEligible || 1}
                  size="sm"
                  color="purple"
                />
              </div>
            </div>
          </Card>

          {/* Status Tabs matching reference */}
          <div className="flex items-center gap-2 border-b border-brand-line/80 pb-2 text-xs sm:text-sm font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-brand-primary text-white shadow-xs'
                  : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
              }`}
            >
              All Submissions ({totalEligible})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('submitted')}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                statusFilter === 'submitted'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
              }`}
            >
              Submitted ({submittedCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
              }`}
            >
              Pending ({pendingCount})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('not_submitted')}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                statusFilter === 'not_submitted'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-brand-muted hover:text-brand-heading hover:bg-slate-100'
              }`}
            >
              Not Submitted ({notSubmittedCount})
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students by name, email, ID..."
                className="w-full rounded-full border border-brand-line bg-white pl-9 pr-4 py-1.5 text-xs sm:text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-brand-muted font-medium">Sort:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="rounded-lg border border-brand-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-heading focus:border-brand-primary focus:outline-none cursor-pointer"
              >
                <option value="nameAsc">Name (A – Z)</option>
                <option value="nameDesc">Name (Z – A)</option>
                <option value="submittedFirst">Submitted First</option>
              </select>
            </div>
          </div>

          {/* Submissions Table matching reference screenshots */}
          <Card padding="p-0" className="overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/80 border-b border-brand-line/60 text-brand-muted uppercase text-[11px] font-bold">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Student ID / Roll No</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Submission Deliverable</th>
                    <th className="py-3 px-4">Submitted On</th>
                    <th className="py-3 px-4">Points</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-line/50">
                  {filteredRows.map((row, idx) => {
                    const initials = row.name
                      ? row.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .substring(0, 2)
                      : 'ST'

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Student Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-light text-brand-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-brand-heading truncate">
                                {row.name}
                              </p>
                              <p className="text-[11px] text-brand-muted truncate">
                                {row.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Student ID */}
                        <td className="py-3.5 px-4 font-medium text-brand-heading">
                          {row.student_id}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {row.status === 'submitted' ? (
                            <Badge variant="success" size="sm" dot>
                              Submitted
                            </Badge>
                          ) : row.status === 'pending' ? (
                            <Badge variant="warning" size="sm" dot>
                              Pending
                            </Badge>
                          ) : (
                            <Badge variant="danger" size="sm" dot>
                              Not Submitted
                            </Badge>
                          )}
                        </td>

                        {/* Submission Link */}
                        <td className="py-3.5 px-4">
                          {row.submission_link ? (
                            <a
                              href={row.submission_link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline bg-brand-light px-2.5 py-1 rounded-lg truncate max-w-[200px]"
                            >
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">View Submission</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </td>

                        {/* Submitted On */}
                        <td className="py-3.5 px-4 text-brand-muted text-xs whitespace-nowrap">
                          {row.submitted_at ? (
                            <span>{formatDisplayDate(row.submitted_at)}, {new Date(row.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          ) : (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </td>

                        {/* Points Grade input */}
                        <td className="py-3.5 px-4">
                          {row.status === 'submitted' ? (
                            <input
                              type="text"
                              value={gradesMap[row.id] ?? currentAssignment.points}
                              onChange={(e) =>
                                setGradesMap({ ...gradesMap, [row.id]: e.target.value })
                              }
                              className="w-16 rounded border border-brand-line px-2 py-1 text-xs font-bold text-brand-heading focus:border-brand-primary focus:outline-none text-center"
                            />
                          ) : (
                            <span className="text-slate-400 font-medium text-center block w-16">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectedStudent(row)
                              setIsDetailModalOpen(true)
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-heading hover:bg-slate-100 transition-colors cursor-pointer"
                            title="View student details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-brand-muted">
                        No students found matching current filter or search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="px-6 py-3.5 border-t border-brand-line/60 bg-slate-50/50 flex items-center justify-between text-xs text-brand-muted font-medium">
              <span>Showing 1–{filteredRows.length} of {totalEligible} students</span>
              <div className="flex items-center gap-1">
                <span className="w-7 h-7 rounded-lg bg-brand-primary text-white font-bold flex items-center justify-center">
                  1
                </span>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Inspect Student Submission Modal */}
      {inspectedStudent && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Student: ${inspectedStudent.name}`}
          subtitle={`Roll No: ${inspectedStudent.student_id} • ${inspectedStudent.email}`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-brand-line">
              <span className="text-xs font-semibold text-brand-heading">Submission Status</span>
              {inspectedStudent.status === 'submitted' ? (
                <Badge variant="success" size="sm" dot>Submitted</Badge>
              ) : (
                <Badge variant="warning" size="sm" dot>Pending</Badge>
              )}
            </div>

            {inspectedStudent.submission_link && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-brand-heading">Submitted Deliverable Link:</span>
                <div className="p-3 rounded-xl bg-slate-50 border border-brand-line text-xs font-medium text-brand-primary flex items-center justify-between gap-2">
                  <span className="truncate">{inspectedStudent.submission_link}</span>
                  <a
                    href={inspectedStudent.submission_link}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 hover:text-brand-heading text-slate-500"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {inspectedStudent.comment && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-brand-heading">Student Notes:</span>
                <p className="text-xs text-brand-body bg-slate-50 p-3 rounded-xl border border-brand-line">
                  {inspectedStudent.comment}
                </p>
              </div>
            )}

            {inspectedStudent.submitted_at && (
              <p className="text-xs text-brand-muted">
                Submitted on: {formatDisplayDate(inspectedStudent.submitted_at)} at {new Date(inspectedStudent.submitted_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

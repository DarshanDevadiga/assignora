import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  Eye,
  ArrowRight
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { assignmentsService } from '../../services/assignments.service'
import { classesService } from '../../services/classes.service'
import { calculateCompletionRate, isOverdue, formatDisplayDate, formatDeadlineBadge } from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import ProgressBar from '../../components/common/ProgressBar'

export default function AssignmentsList() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [assignments, setAssignments] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  // Delete dialog state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingAssignment, setDeletingAssignment] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadAssignments()
  }, [user?.id])

  async function loadAssignments() {
    if (!user?.id) return
    try {
      setLoading(true)
      const [allAssignments, adminClasses] = await Promise.all([
        assignmentsService.getAdminAssignments(user.id),
        classesService.getAdminClasses(user.id),
      ])
      setAssignments(allAssignments)
      setClasses(adminClasses)
    } catch (err) {
      console.error('[AssignmentsList] Error loading assignments:', err)
    } finally {
      setLoading(false)
    }
  }

  // Delete Assignment
  const handleDeleteConfirm = async () => {
    if (!deletingAssignment) return
    try {
      setDeleting(true)
      await assignmentsService.deleteAssignment(deletingAssignment.id)
      setIsDeleteModalOpen(false)
      setDeletingAssignment(null)
      await loadAssignments()
    } catch (err) {
      console.error('[AssignmentsList] Error deleting assignment:', err)
    } finally {
      setDeleting(false)
    }
  }

  // Filtered and sorted assignments
  const filteredAssignments = useMemo(() => {
    return assignments
      .filter((a) => {
        // Class filter
        if (selectedClassFilter !== 'all' && a.class_id !== selectedClassFilter) {
          return false
        }
        // Status filter
        if (selectedStatusFilter === 'published' && a.status !== 'published') return false
        if (selectedStatusFilter === 'draft' && a.status !== 'draft') return false
        if (selectedStatusFilter === 'overdue' && !isOverdue(a.due_date, a.due_time)) return false

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchTitle = a.title?.toLowerCase().includes(q)
          const matchClass = a.classes?.name?.toLowerCase().includes(q)
          const matchDesc = a.description?.toLowerCase().includes(q)
          if (!matchTitle && !matchClass && !matchDesc) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at) - new Date(a.created_at)
        }
        if (sortBy === 'earliestDue') {
          return new Date(`${a.due_date || '9999'}T${a.due_time || '23:59:00'}`) -
            new Date(`${b.due_date || '9999'}T${b.due_time || '23:59:00'}`)
        }
        return 0
      })
  }, [assignments, selectedClassFilter, selectedStatusFilter, searchQuery, sortBy])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
            Assignments
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Create, allocate, and monitor coursework across all your classes.
          </p>
        </div>

        <Button
          variant="primary"
          icon={Plus}
          onClick={() => navigate('/admin/assignments/create')}
          className="self-start sm:self-auto shadow-purple-glow font-semibold"
        >
          Create Assignment
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <Card padding="p-4" className="shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Bar */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assignments by title, topic..."
              className="w-full rounded-input border border-brand-line bg-slate-50 pl-10 pr-4 py-2 text-xs sm:text-sm placeholder:text-slate-400 focus:bg-white focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          {/* Class Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="w-full rounded-input border border-brand-line bg-white px-3 py-2 text-xs sm:text-sm font-medium text-brand-heading focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
            >
              <option value="all">All Classes ({classes.length})</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full rounded-input border border-brand-line bg-white px-3 py-2 text-xs sm:text-sm font-medium text-brand-heading focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-input border border-brand-line bg-white px-3 py-2 text-xs sm:text-sm font-medium text-brand-heading focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="earliestDue">Due Date (Earliest)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Assignment List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-brand-line animate-pulse" />
          ))}
        </div>
      ) : filteredAssignments.length > 0 ? (
        <div className="space-y-4">
          {filteredAssignments.map((assignment) => {
            const classMembersCount = assignment.classes?.class_members?.length || 0
            const eligibleStudentsCount = assignment.assign_to_all
              ? classMembersCount
              : assignment.assignment_students?.length || 0
            const submissionsCount = assignment.submissions?.length || 0
            const completionRate = calculateCompletionRate(submissionsCount, eligibleStudentsCount)
            const deadlineBadge = formatDeadlineBadge(assignment.due_date, assignment.due_time)

            return (
              <Card
                key={assignment.id}
                padding="p-5 sm:p-6"
                className="hover:border-brand-border transition-all shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Left Info Column */}
                <div className="space-y-3 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge variant="purple" size="sm">
                      {assignment.classes?.name || 'Class'}
                    </Badge>

                    {assignment.status === 'draft' ? (
                      <Badge variant="warning" size="sm">Draft</Badge>
                    ) : deadlineBadge ? (
                      <Badge variant={deadlineBadge.variant} size="sm">
                        {deadlineBadge.text}
                      </Badge>
                    ) : null}

                    <span className="text-xs font-semibold text-brand-muted">
                      {assignment.points} Points
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-brand-heading hover:text-brand-primary transition-colors">
                      {assignment.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-brand-muted mt-1 line-clamp-2">
                      {assignment.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-brand-muted pt-1 flex-wrap">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Due: {assignment.due_date ? `${formatDisplayDate(assignment.due_date)} at ${assignment.due_time?.substring(0, 5) || '23:59'}` : 'No deadline'}
                    </span>

                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {assignment.assign_to_all
                        ? `All Students (${eligibleStudentsCount})`
                        : `Selected Students (${eligibleStudentsCount})`}
                    </span>

                    {assignment.drive_link && (
                      <a
                        href={assignment.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand-primary hover:underline font-semibold"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Drive Link
                      </a>
                    )}
                  </div>
                </div>

                {/* Right Progress & Actions Column */}
                <div className="flex flex-col sm:flex-row sm:items-center md:flex-col lg:flex-row items-stretch gap-4 shrink-0 md:w-72 lg:w-80 border-t md:border-t-0 pt-4 md:pt-0 border-brand-line">
                  {/* Completion Rate */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-brand-muted">Submissions</span>
                      <span className="text-brand-primary">{submissionsCount} / {eligibleStudentsCount} ({completionRate}%)</span>
                    </div>
                    <ProgressBar
                      value={submissionsCount}
                      max={eligibleStudentsCount || 1}
                      size="sm"
                      color={completionRate === 100 ? 'green' : 'purple'}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/admin/submissions')}
                    >
                      Track
                    </Button>

                    <button
                      type="button"
                      onClick={() => navigate(`/admin/assignments/${assignment.id}/edit`)}
                      className="p-2 rounded-lg text-slate-400 hover:text-brand-heading hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Edit Assignment"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeletingAssignment(assignment)
                        setIsDeleteModalOpen(true)
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-brand-danger hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Assignment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-light text-brand-primary flex items-center justify-center mx-auto">
            <ClipboardList className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-brand-heading">No assignments found</h3>
            <p className="text-sm text-brand-muted max-w-sm mx-auto mt-1">
              Create an assignment to assign coursework, set due dates, and track student submissions.
            </p>
          </div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => navigate('/admin/assignments/create')}
          >
            Create Assignment
          </Button>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Assignment?"
        subtitle={`Permanently delete "${deletingAssignment?.title}"`}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDeleteConfirm}>
              Yes, Delete Assignment
            </Button>
          </>
        }
      >
        <p className="text-sm text-brand-body leading-relaxed">
          Deleting this assignment will also permanently remove all student allocations and student submission records. Are you sure you wish to continue?
        </p>
      </Modal>
    </div>
  )
}

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  BookOpen,
  Users,
  Edit2,
  Trash2,
  Code2,
  Database,
  Network,
  Cpu,
  Folder,
  Layers,
  ArrowRight,
  Sparkles,
  UserPlus,
  KeyRound
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { classesService } from '../../services/classes.service'
import { getCached } from '../../utils/dataCache'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import ActionMenu from '../../components/common/ActionMenu'
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal'
import EditClassModal from '../../components/class/EditClassModal'
import { Input, Textarea } from '../../components/common/Input'
import NotificationBadge from '../../components/common/NotificationBadge'
import { useNotifications } from '../../context/NotificationContext'
import { useToast } from '../../context/ToastContext'

const InviteStudentModal = lazy(() => import('../../components/class/InviteStudentModal'))
const JoinClassModal = lazy(() => import('../../components/class/JoinClassModal'))

const THEMES = [
  {
    bg: 'bg-gradient-to-r from-purple-600 to-indigo-600',
    icon: Code2,
    accent: 'text-purple-600',
  },
  {
    bg: 'bg-gradient-to-r from-blue-600 to-cyan-600',
    icon: Database,
    accent: 'text-blue-600',
  },
  {
    bg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
    icon: Network,
    accent: 'text-emerald-600',
  },
  {
    bg: 'bg-gradient-to-r from-violet-600 to-purple-800',
    icon: Cpu,
    accent: 'text-violet-600',
  },
]

export default function ClassesManagement() {
  const { user } = useAuth()
  const toast = useToast()
  const { classUnreadCounts = {} } = useNotifications()
  const navigate = useNavigate()

  const cacheKey = user?.id ? `${user.role === 'admin' ? 'adminClasses' : 'studentClasses'}:${user.id}` : null
  const initialClasses = cacheKey ? getCached(cacheKey, { allowStale: true }) : null

  const [classes, setClasses] = useState(() => initialClasses || [])
  const [loading, setLoading] = useState(() => !initialClasses)

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSubject, setCreateSubject] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit Modal State
  const [editingClass, setEditingClass] = useState(null)

  // Safe Delete Confirmation State
  const [deletingClass, setDeletingClass] = useState(null)
  const [classImpact, setClassImpact] = useState(null)
  const [impactLoading, setImpactLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Invite Modal State
  const [inviteModalClass, setInviteModalClass] = useState(null)

  // Student Join Class Modal
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)

  const isTeacher = user?.role === 'admin'

  const loadClasses = useCallback(async ({ force = false, silent = false } = {}) => {
    if (!user?.id) return
    try {
      if (!silent) setLoading(true)
      const data = user.role === 'admin'
        ? await classesService.getAdminClasses(user.id, force)
        : await classesService.getStudentClasses(user.id, force)
      setClasses(data)
    } catch (err) {
      console.error('[ClassesManagement] Error loading classes:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.role])

  useEffect(() => {
    if (!user?.id) return
    const key = `${user.role === 'admin' ? 'adminClasses' : 'studentClasses'}:${user.id}`
    const fresh = getCached(key)
    if (fresh) {
      setClasses(fresh)
      setLoading(false)
      return
    }
    const stale = getCached(key, { allowStale: true })
    if (stale) {
      setClasses(stale)
      setLoading(false)
      loadClasses({ force: false, silent: true })
    } else {
      loadClasses()
    }
  }, [user?.id, user?.role, loadClasses])

  // Create Class
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!createName.trim()) return

    try {
      setCreating(true)
      const created = await classesService.createClass({
        name: createName,
        subject: createSubject,
        description: createDesc,
        admin_id: user.id,
      })
      setIsCreateOpen(false)
      setCreateName('')
      setCreateSubject('')
      setCreateDesc('')
      toast.success(`Created class "${created?.name || createName}".`, 'Class Created')
      await loadClasses({ force: true })
    } catch (err) {
      console.error('[ClassesManagement] Error creating class:', err)
      toast.error(err.message || 'Failed to create class.')
    } finally {
      setCreating(false)
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (cls) => {
    setEditingClass(cls)
  }

  // Open Safe Delete Dialog with Live Impact Inspection
  const handleOpenDelete = async (cls) => {
    setDeletingClass(cls)
    setDeleteError('')
    setClassImpact(null)
    setImpactLoading(true)
    try {
      const impact = await classesService.getClassImpactSummary(cls.id)
      setClassImpact(impact)
    } catch (err) {
      setDeleteError(err.message || 'Failed to inspect associated class records.')
    } finally {
      setImpactLoading(false)
    }
  }

  // Delete Class (strictly empty only)
  const handleDeleteConfirm = async () => {
    if (!deletingClass?.id) return

    try {
      setDeleting(true)
      setDeleteError('')
      await classesService.deleteClass(deletingClass.id)
      const removedName = deletingClass.name
      setDeletingClass(null)
      toast.success(`Deleted empty class "${removedName}".`, 'Class Deleted')
      await loadClasses({ force: true })
    } catch (err) {
      console.error('[ClassesManagement] Error deleting class:', err)
      const msg = err.message || 'Unable to delete class.'
      setDeleteError(msg)
      toast.error(msg, 'Delete Blocked')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
            My Classes
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Manage your courses, view enrolled students, and assign coursework.
          </p>
        </div>

        {isTeacher ? (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setIsCreateOpen(true)}
            className="self-start sm:self-auto shadow-purple-glow font-semibold"
          >
            Create Class
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={KeyRound}
            onClick={() => setIsJoinModalOpen(true)}
            className="self-start sm:self-auto shadow-purple-glow font-semibold"
          >
            Join Class
          </Button>
        )}
      </div>

      {/* Classes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-white border border-brand-line animate-pulse p-4"
            />
          ))}
        </div>
      ) : classes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls, idx) => {
            const theme = THEMES[idx % THEMES.length]
            const ThemeIcon = theme.icon
            const studentCount = cls.class_members?.length || 0
            const assignmentCount = cls.assignments?.length || 0

            return (
              <div
                key={cls.id}
                onClick={() => navigate(`/${isTeacher ? 'admin' : 'student'}/classes/${cls.id}`)}
                className="group relative bg-white rounded-2xl border border-brand-line/80 shadow-card hover:shadow-card-hover hover:border-brand-border transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                {/* Colored Top Header Banner */}
                <div className={`p-5 text-white ${theme.bg} relative rounded-t-2xl`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                        <ThemeIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg sm:text-xl text-white truncate group-hover:underline">
                            {cls.name}
                          </h3>
                          {classUnreadCounts[cls.id] > 0 && (
                            <NotificationBadge
                              count={classUnreadCounts[cls.id]}
                              className="shadow-md"
                            />
                          )}
                        </div>
                        <p className="text-xs text-white/80 font-medium truncate mt-0.5">
                          {cls.subject || 'Course'}
                        </p>
                      </div>
                    </div>

                    {/* 3-dots Actions Menu */}
                    <ActionMenu
                      label={`Actions for ${cls.name}`}
                      buttonClassName="p-1.5 rounded-lg text-white/85 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                      iconSize="w-5 h-5"
                      items={[
                        {
                          id: 'open',
                          label: 'View Class',
                          icon: BookOpen,
                          onClick: () =>
                            navigate(`/${isTeacher ? 'admin' : 'student'}/classes/${cls.id}`),
                        },
                        ...(isTeacher && cls.admin_id === user?.id
                          ? [
                              {
                                id: 'invite',
                                label: 'Invite Students',
                                icon: UserPlus,
                                onClick: () => setInviteModalClass(cls),
                              },
                              {
                                id: 'people',
                                label: 'Class People',
                                icon: Users,
                                onClick: () => navigate(`/admin/classes/${cls.id}?tab=people`),
                              },
                              {
                                id: 'edit',
                                label: 'Edit Class',
                                icon: Edit2,
                                onClick: () => handleOpenEdit(cls),
                              },
                              {
                                id: 'delete',
                                label: 'Delete Class',
                                icon: Trash2,
                                variant: 'danger',
                                dividerBefore: true,
                                onClick: () => handleOpenDelete(cls),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>

                  <p className="mt-3 text-xs text-white/70 line-clamp-2 min-h-[32px]">
                    {cls.description || 'No description provided.'}
                  </p>
                </div>

                {/* Body Meta Row */}
                <div className="p-4 bg-slate-50/50 flex items-center justify-between border-t border-brand-line/60 rounded-b-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-light text-brand-primary text-xs font-bold flex items-center justify-center">
                      {user?.name?.charAt(0) || 'P'}
                    </div>
                    <span className="text-xs font-semibold text-brand-heading truncate max-w-[120px]">
                      {user?.name || 'Prof. Anitha'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-brand-muted">
                    <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border border-brand-line">
                      <Users className="w-3.5 h-3.5 text-brand-primary" />
                      <span>{studentCount} students</span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card className="text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-light text-brand-primary flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-brand-heading">
              {isTeacher ? 'No classes created yet' : 'No classes enrolled yet'}
            </h3>
            <p className="text-sm text-brand-muted max-w-sm mx-auto mt-1">
              {isTeacher
                ? 'Click the button below to create your first class and start assigning coursework.'
                : 'Join a class using the enrolment code or invitation link provided by your teacher.'}
            </p>
          </div>
          {isTeacher ? (
            <Button variant="primary" icon={Plus} onClick={() => setIsCreateOpen(true)} className="shadow-purple-glow font-semibold">
              Create Class
            </Button>
          ) : (
            <Button variant="primary" icon={KeyRound} onClick={() => setIsJoinModalOpen(true)} className="shadow-purple-glow font-semibold">
              Join Class
            </Button>
          )}
        </Card>
      )}

      {/* Modal: Create Class */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Class"
        subtitle="Set up course name, subject code, and syllabus description."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={creating} onClick={handleCreateSubmit}>
              Create Class
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Class Name"
            placeholder="e.g. MCA – Semester 5"
            required
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />

          <Input
            label="Subject / Code"
            placeholder="e.g. Computer Applications"
            value={createSubject}
            onChange={(e) => setCreateSubject(e.target.value)}
          />

          <Textarea
            label="Description"
            placeholder="Course overview and syllabus notes..."
            rows={3}
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
          />
        </form>
      </Modal>

      {/* Modal: Edit Class */}
      <EditClassModal
        isOpen={Boolean(editingClass)}
        onClose={() => setEditingClass(null)}
        classData={editingClass}
        onSuccess={() => loadClasses({ force: true })}
      />

      {/* Modal: Safe Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingClass)}
        onClose={() => {
          setDeletingClass(null)
          setDeleteError('')
        }}
        entityLabel="Class"
        entityName={deletingClass?.name || ''}
        entityMeta={deletingClass?.class_code ? `Code: ${deletingClass.class_code}` : ''}
        impactLoading={impactLoading}
        stats={
          classImpact
            ? [
                { label: 'Students', value: classImpact.studentsCount, highlight: classImpact.studentsCount > 0 },
                { label: 'Assignments', value: classImpact.assignmentsCount, highlight: classImpact.assignmentsCount > 0 },
                { label: 'Groups', value: classImpact.groupsCount, highlight: classImpact.groupsCount > 0 },
                { label: 'Submissions', value: classImpact.totalSubmissionsCount, highlight: classImpact.totalSubmissionsCount > 0 },
                { label: 'Graded Records', value: classImpact.totalGradedCount, highlight: classImpact.totalGradedCount > 0 },
              ]
            : []
        }
        canPermanentDelete={Boolean(classImpact?.canPermanentDelete)}
        blockReason="This class contains enrolled students, assignments, groups, or recorded submissions/grades. Permanent deletion is disabled so Round 1 and Round 2 historical records remain intact."
        requireTypedDelete
        loading={deleting}
        error={deleteError}
        onConfirmDelete={handleDeleteConfirm}
      />

      {/* Modal: Invite Students */}
      {Boolean(inviteModalClass) && (
        <Suspense fallback={null}>
          <InviteStudentModal
            isOpen={Boolean(inviteModalClass)}
            onClose={() => setInviteModalClass(null)}
            currentClass={inviteModalClass}
          />
        </Suspense>
      )}

      {/* Modal: Student Join Class */}
      {isJoinModalOpen && (
        <Suspense fallback={null}>
          <JoinClassModal
            isOpen={isJoinModalOpen}
            onClose={() => setIsJoinModalOpen(false)}
            onEnrolled={() => loadClasses({ force: true })}
          />
        </Suspense>
      )}
    </div>
  )
}

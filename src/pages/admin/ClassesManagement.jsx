import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  BookOpen,
  Users,
  MoreVertical,
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
import { supabase } from '../../lib/supabase'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { Input, Textarea } from '../../components/common/Input'
import InviteStudentModal from '../../components/class/InviteStudentModal'
import JoinClassModal from '../../components/class/JoinClassModal'
import NotificationBadge from '../../components/common/NotificationBadge'
import { useNotifications } from '../../context/NotificationContext'

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
  const { classUnreadCounts = {} } = useNotifications()
  const navigate = useNavigate()

  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createSubject, setCreateSubject] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingClass, setEditingClass] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [updating, setUpdating] = useState(false)

  // Delete Confirmation State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingClassId, setDeletingClassId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Active dropdown menu per card
  const [activeMenuId, setActiveMenuId] = useState(null)

  useEffect(() => {
    if (!activeMenuId) return undefined
    const handleOutsideClick = () => setActiveMenuId(null)
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [activeMenuId])

  // Invite Modal State
  const [inviteModalClass, setInviteModalClass] = useState(null)

  // Student Join Class Modal
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)

  const isTeacher = user?.role === 'admin'

  useEffect(() => {
    loadClasses()
  }, [user?.id, user?.role])

  async function loadClasses() {
    if (!user?.id) return
    try {
      setLoading(true)
      if (user.role === 'admin') {
        const data = await classesService.getAdminClasses(user.id)
        setClasses(data)
      } else {
        const { data: memberRows } = await supabase
          .from('class_members')
          .select(`
            class_id,
            classes (
              *,
              class_members (id, student_id),
              assignments (id, title, status, due_date, due_time, points)
            )
          `)
          .eq('student_id', user.id)

        const studentClasses = memberRows?.map((m) => m.classes).filter(Boolean) || []
        setClasses(studentClasses)
      }
    } catch (err) {
      console.error('[ClassesManagement] Error loading classes:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create Class
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!createName.trim()) return

    try {
      setCreating(true)
      await classesService.createClass({
        name: createName,
        subject: createSubject,
        description: createDesc,
        admin_id: user.id,
      })
      setIsCreateOpen(false)
      setCreateName('')
      setCreateSubject('')
      setCreateDesc('')
      await loadClasses()
    } catch (err) {
      console.error('[ClassesManagement] Error creating class:', err)
    } finally {
      setCreating(false)
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (cls, e) => {
    e.stopPropagation()
    setActiveMenuId(null)
    setEditingClass(cls)
    setEditName(cls.name)
    setEditSubject(cls.subject || '')
    setEditDesc(cls.description || '')
    setIsEditOpen(true)
  }

  // Update Class
  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!editName.trim() || !editingClass) return

    try {
      setUpdating(true)
      await classesService.updateClass(editingClass.id, {
        name: editName,
        subject: editSubject,
        description: editDesc,
      })
      setIsEditOpen(false)
      setEditingClass(null)
      await loadClasses()
    } catch (err) {
      console.error('[ClassesManagement] Error updating class:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Open Delete Dialog
  const handleOpenDelete = (clsId, e) => {
    e.stopPropagation()
    setActiveMenuId(null)
    setDeletingClassId(clsId)
    setIsDeleteOpen(true)
  }

  // Delete Class
  const handleDeleteConfirm = async () => {
    if (!deletingClassId) return

    try {
      setDeleting(true)
      await classesService.deleteClass(deletingClassId)
      setIsDeleteOpen(false)
      setDeletingClassId(null)
      await loadClasses()
    } catch (err) {
      console.error('[ClassesManagement] Error deleting class:', err)
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
                className={`group relative bg-white rounded-2xl border border-brand-line/80 shadow-card hover:shadow-card-hover hover:border-brand-border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  activeMenuId === cls.id ? 'z-dropdown' : ''
                }`}
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

                    {/* 3-dots Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveMenuId(activeMenuId === cls.id ? null : cls.id)
                        }}
                        className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {activeMenuId === cls.id && (
                        <div
                          className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-modal border border-brand-line py-1 z-dropdown text-left"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/${isTeacher ? 'admin' : 'student'}/classes/${cls.id}`)
                            }}
                            className="w-full px-3.5 py-2 text-xs font-medium text-brand-body hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-brand-primary" />
                            <span>Open Class</span>
                          </button>

                          {isTeacher && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setInviteModalClass(cls)
                                  setActiveMenuId(null)
                                }}
                                className="w-full px-3.5 py-2 text-xs font-medium text-brand-body hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-brand-primary" />
                                <span>Invite Students</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/admin/classes/${cls.id}?tab=people`)
                                }}
                                className="w-full px-3.5 py-2 text-xs font-medium text-brand-body hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <span>Class People</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleOpenEdit(cls, e)}
                                className="w-full px-3.5 py-2 text-xs font-medium text-brand-body hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>Edit Class</span>
                              </button>

                              <div className="border-t border-brand-line my-1" />

                              <button
                                type="button"
                                onClick={(e) => handleOpenDelete(cls.id, e)}
                                className="w-full px-3.5 py-2 text-xs font-medium text-brand-danger hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Class</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
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
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Class"
        subtitle="Update course information."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={updating} onClick={handleUpdateSubmit}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          <Input
            label="Class Name"
            required
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />

          <Input
            label="Subject / Code"
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
          />

          <Textarea
            label="Description"
            rows={3}
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
          />
        </form>
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Class?"
        subtitle="This action cannot be undone. All class assignments, memberships, and submissions will also be deleted."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDeleteConfirm}>
              Yes, Delete Class
            </Button>
          </>
        }
      >
        <p className="text-sm text-brand-body leading-relaxed">
          Are you sure you want to permanently delete this class? Students will no longer have access to its materials and assignments.
        </p>
      </Modal>

      {/* Modal: Invite Students */}
      <InviteStudentModal
        isOpen={Boolean(inviteModalClass)}
        onClose={() => setInviteModalClass(null)}
        currentClass={inviteModalClass}
      />

      {/* Modal: Student Join Class */}
      <JoinClassModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onEnrolled={() => loadClasses()}
      />
    </div>
  )
}

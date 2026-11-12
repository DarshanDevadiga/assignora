import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Trash2,
  Search,
  BookOpen,
  Mail,
  GraduationCap,
  Check,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { classesService } from '../../services/classes.service'
import { usersService } from '../../services/users.service'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { formatDisplayDate } from '../../utils/calculations'

export default function StudentsManagement() {
  const { user } = useAuth()

  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [allStudents, setAllStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Enroll Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false)
  const [selectedStudentsToEnroll, setSelectedStudentsToEnroll] = useState([])
  const [enrolling, setEnrolling] = useState(false)

  // Remove Modal State
  const [removingMember, setRemovingMember] = useState(null)
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  const loadData = useCallback(async (force = false) => {
    if (!user?.id) return
    try {
      setLoading(true)
      const [fetchedClasses, studentsList] = await Promise.all([
        classesService.getAdminClasses(user.id, force),
        usersService.getStudents(force),
      ])

      setClasses(fetchedClasses)
      setAllStudents(studentsList)
      if (fetchedClasses.length > 0) {
        setSelectedClassId((prev) => prev && fetchedClasses.some((c) => c.id === prev) ? prev : fetchedClasses[0].id)
      }
    } catch (err) {
      console.error('[StudentsManagement] Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const currentClass = useMemo(() => classes.find((c) => c.id === selectedClassId), [classes, selectedClassId])
  const enrolledMembers = useMemo(() => currentClass?.class_members || [], [currentClass])

  // Filter enrolled members (memoized)
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return enrolledMembers
    const q = searchQuery.toLowerCase()
    return enrolledMembers.filter((m) => (
      m.users?.name?.toLowerCase().includes(q) ||
      m.users?.email?.toLowerCase().includes(q) ||
      m.users?.student_id?.toLowerCase().includes(q)
    ))
  }, [enrolledMembers, searchQuery])

  // Available students to enroll (memoized)
  const availableToEnroll = useMemo(() => {
    const enrolledStudentIds = new Set(enrolledMembers.map((m) => m.student_id))
    return allStudents.filter((s) => !enrolledStudentIds.has(s.id))
  }, [allStudents, enrolledMembers])

  // Handle Enroll Submit (parallelized)
  const handleEnrollSubmit = async () => {
    if (selectedStudentsToEnroll.length === 0 || !selectedClassId) return

    try {
      setEnrolling(true)
      await Promise.all(selectedStudentsToEnroll.map((sId) => classesService.addMember(selectedClassId, sId)))
      setIsEnrollModalOpen(false)
      setSelectedStudentsToEnroll([])
      await loadData(true)
    } catch (err) {
      console.error('[StudentsManagement] Error enrolling students:', err)
    } finally {
      setEnrolling(false)
    }
  }

  // Handle Remove Submit
  const handleRemoveConfirm = async () => {
    if (!removingMember) return

    try {
      setRemoving(true)
      await classesService.removeMember(removingMember.id)
      setIsRemoveModalOpen(false)
      setRemovingMember(null)
      await loadData(true)
    } catch (err) {
      console.error('[StudentsManagement] Error removing member:', err)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
            Students & Roster
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Enroll students into your classes and manage their membership.
          </p>
        </div>

        <Button
          variant="primary"
          icon={UserPlus}
          disabled={!currentClass || availableToEnroll.length === 0}
          onClick={() => {
            setSelectedStudentsToEnroll([])
            setIsEnrollModalOpen(true)
          }}
          className="self-start sm:self-auto shadow-purple-glow font-semibold"
        >
          Enroll Students
        </Button>
      </div>

      {/* Class Selector Bar & Search */}
      <Card padding="p-4" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Class Selection */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-brand-heading shrink-0">Class:</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-input border border-brand-line bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-brand-heading focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer min-w-[220px]"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.class_members?.length || 0} students)
              </option>
            ))}
          </select>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students..."
            className="w-full rounded-full border border-brand-line bg-slate-50 pl-9 pr-4 py-1.5 text-xs sm:text-sm placeholder:text-slate-400 focus:bg-white focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
      </Card>

      {/* Students Table */}
      <Card padding="p-0" className="overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-brand-line/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-primary" />
            <h3 className="font-bold text-sm text-brand-heading">
              Enrolled Roster ({enrolledMembers.length})
            </h3>
          </div>
          <span className="text-xs text-brand-muted">
            {currentClass?.name}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/70 border-b border-brand-line/60 text-brand-muted uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Student ID / Roll No</th>
                <th className="py-3 px-4">Enrolled Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line/50">
              {filteredMembers.map((member, index) => {
                const initials = member.users?.name
                  ? member.users.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .substring(0, 2)
                  : 'ST'

                return (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-400">
                      {index + 1}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-light text-brand-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-brand-heading">
                            {member.users?.name || 'Student'}
                          </p>
                          <p className="text-[11px] text-brand-muted">
                            {member.users?.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-brand-heading">
                      {member.users?.student_id || `MCA2600${index + 1}`}
                    </td>

                    <td className="py-3.5 px-4 text-brand-muted text-xs">
                      {formatDisplayDate(member.joined_at)}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant="success" size="sm" dot>
                        Active
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setRemovingMember(member)
                          setIsRemoveModalOpen(true)
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-danger hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove from class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-brand-muted">
                    No students currently enrolled in this class. Click "Enroll Students" to add demo accounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Enroll Students */}
      <Modal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        title="Enroll Students"
        subtitle={`Select students to add to ${currentClass?.name || 'this class'}`}
        footer={
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-muted">
              <strong className="text-brand-heading">{selectedStudentsToEnroll.length}</strong> selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEnrollModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={enrolling}
                disabled={selectedStudentsToEnroll.length === 0}
                onClick={handleEnrollSubmit}
              >
                Enroll Selected
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          {availableToEnroll.length > 0 ? (
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {availableToEnroll.map((student) => {
                const isChecked = selectedStudentsToEnroll.includes(student.id)
                return (
                  <label
                    key={student.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'border-brand-primary bg-brand-activeNav/60 ring-1 ring-brand-primary/30'
                        : 'border-brand-line bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedStudentsToEnroll(
                              selectedStudentsToEnroll.filter((id) => id !== student.id)
                            )
                          } else {
                            setSelectedStudentsToEnroll([...selectedStudentsToEnroll, student.id])
                          }
                        }}
                        className="w-4 h-4 rounded text-brand-primary border-brand-line focus:ring-brand-primary/30 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-brand-heading">
                          {student.name}
                        </p>
                        <p className="text-[11px] text-brand-muted">{student.email}</p>
                      </div>
                    </div>

                    <Badge variant="purple" size="sm">Available</Badge>
                  </label>
                )
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-brand-muted">
              All registered student accounts are already enrolled in this class!
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Remove Member Confirmation */}
      <Modal
        isOpen={isRemoveModalOpen}
        onClose={() => setIsRemoveModalOpen(false)}
        title="Remove Student from Class?"
        subtitle={`Remove ${removingMember?.users?.name || 'this student'} from ${currentClass?.name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsRemoveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={removing} onClick={handleRemoveConfirm}>
              Yes, Remove Student
            </Button>
          </>
        }
      >
        <p className="text-sm text-brand-body leading-relaxed">
          The student will be unenrolled from this class and will no longer have access to its assignments and stream posts.
        </p>
      </Modal>
    </div>
  )
}

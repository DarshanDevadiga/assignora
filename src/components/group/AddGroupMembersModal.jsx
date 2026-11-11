import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Shield,
  Layers
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import { groupsService } from '../../services/groups.service'

export default function AddGroupMembersModal({
  isOpen,
  onClose,
  group,
  classId,
  className = 'Course',
  onMembersAdded
}) {
  const [students, setStudents] = useState([])
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isOpen && classId && group?.id) {
      loadStudents()
      setSelectedStudentIds([])
      setSearchQuery('')
      setErrorMessage('')
    }
  }, [isOpen, classId, group?.id])

  async function loadStudents() {
    try {
      setLoading(true)
      const list = await groupsService.getClassStudentsGroupStatus(classId)
      setStudents(list)
    } catch (err) {
      console.error('[AddGroupMembersModal] Error loading students:', err)
      setErrorMessage('Failed to load class student directory.')
    } finally {
      setLoading(false)
    }
  }

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim()
    if (!q) return students
    return students.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.student_id || '').toLowerCase().includes(q)
    )
  }, [students, searchQuery])

  // Count available
  const availableStudents = useMemo(() => students.filter((s) => !s.isAssigned), [students])

  const handleToggleStudent = (studentId, isAssigned) => {
    if (isAssigned) return
    setErrorMessage('')
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    )
  }

  const handleSelectAllAvailable = () => {
    setSelectedStudentIds(availableStudents.map((s) => s.id))
  }

  const handleClearSelection = () => {
    setSelectedStudentIds([])
  }

  const handleAddMembers = async (e) => {
    e.preventDefault()
    if (selectedStudentIds.length === 0) {
      setErrorMessage('Please select at least one student to add.')
      return
    }

    try {
      setSubmitting(true)
      setErrorMessage('')

      await groupsService.addGroupMembers(group.id, selectedStudentIds)

      if (onMembersAdded) onMembersAdded()
      onClose()
    } catch (err) {
      console.error('[AddGroupMembersModal] Error adding members:', err)
      setErrorMessage(err.message || 'Failed to add members.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!group) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center font-bold">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-heading leading-tight">
              Add Members to {group.name}
            </h3>
            <p className="text-xs text-brand-muted font-normal">
              Course: <span className="font-semibold text-brand-heading">{className}</span>
            </p>
          </div>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleAddMembers} className="space-y-4">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-3 rounded-xl bg-brand-light/60 border border-brand-border/60 text-xs text-brand-heading flex items-center justify-between">
          <span>Current Team Size: <strong>{(group.members || []).length} members</strong></span>
          <span className="text-brand-primary font-semibold">
            {selectedStudentIds.length} new {selectedStudentIds.length === 1 ? 'member' : 'members'} selected
          </span>
        </div>

        {/* Directory Controls */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            Available Classmates ({availableStudents.length})
          </span>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSelectAllAvailable}
              className="font-semibold text-brand-primary hover:underline cursor-pointer"
            >
              Select All
            </button>
            {selectedStudentIds.length > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search classmates by name, email, ID..."
            className="w-full rounded-xl border border-brand-line bg-white pl-9 pr-4 py-2 text-xs focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 shadow-xs"
          />
        </div>

        {/* Student Checklist */}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-brand-line divide-y divide-brand-line/60 bg-white">
          {loading ? (
            <div className="p-8 text-center text-xs text-brand-muted animate-pulse">
              Loading enrolled students...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-brand-muted">
              No students found matching your search.
            </div>
          ) : (
            filteredStudents.map((student) => {
              const isSelected = selectedStudentIds.includes(student.id)
              const isAssigned = student.isAssigned
              const isAlreadyInThisGroup = (group.members || []).some(
                (m) => (m.student_id || m.user?.id) === student.id
              )

              return (
                <div
                  key={student.id}
                  onClick={() => handleToggleStudent(student.id, isAssigned)}
                  className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                    isAssigned
                      ? 'bg-slate-50/70 text-slate-400 cursor-not-allowed opacity-75'
                      : isSelected
                      ? 'bg-purple-50/70 hover:bg-purple-50 cursor-pointer'
                      : 'hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isAssigned}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-brand-primary border-slate-300 focus:ring-brand-primary cursor-pointer disabled:cursor-not-allowed"
                    />

                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs shrink-0 text-slate-700">
                      {student.avatar ? (
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <span>{(student.name || 'S').charAt(0).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <span className="font-bold text-brand-heading truncate block">
                        {student.name}
                      </span>
                      <span className="text-[11px] text-brand-muted truncate block">
                        {student.email || student.student_id}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {isAlreadyInThisGroup ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-brand-primary">
                        Already in this group
                      </span>
                    ) : isAssigned ? (
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                        In {student.groupName || 'another group'}
                      </span>
                    ) : isSelected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> Selected
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Available
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-brand-line">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={selectedStudentIds.length === 0}
            icon={UserPlus}
            className="shadow-purple-glow font-bold"
          >
            Add Selected to Group
          </Button>
        </div>
      </form>
    </Modal>
  )
}

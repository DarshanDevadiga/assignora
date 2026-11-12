import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Crown,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import { Input } from '../common/Input'
import { groupsService } from '../../services/groups.service'

export default function ProfessorCreateGroupModal({
  isOpen,
  onClose,
  classId,
  className = 'Course',
  onGroupCreated
}) {
  const [groupName, setGroupName] = useState('')
  const [students, setStudents] = useState([])
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [selectedLeaderId, setSelectedLeaderId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isOpen && classId) {
      loadStudents()
      setGroupName('')
      setSelectedStudentIds([])
      setSelectedLeaderId('')
      setSearchQuery('')
      setErrorMessage('')
    }
  }, [isOpen, classId])

  async function loadStudents() {
    try {
      setLoading(true)
      const list = await groupsService.getClassStudentsGroupStatus(classId)
      setStudents(list)
    } catch (err) {
      console.error('[ProfessorCreateGroupModal] Error loading students:', err)
      setErrorMessage('Failed to load course student directory.')
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

  // Count available vs assigned
  const availableCount = useMemo(() => students.filter((s) => !s.isAssigned).length, [students])

  // Toggle single student selection
  const handleToggleStudent = (studentId, isAssigned) => {
    if (isAssigned) return // Cannot select students already in a group
    setErrorMessage('')

    setSelectedStudentIds((prev) => {
      let updated
      if (prev.includes(studentId)) {
        updated = prev.filter((id) => id !== studentId)
        // If leader was unselected, reset leader
        if (selectedLeaderId === studentId) {
          setSelectedLeaderId(updated[0] || '')
        }
      } else {
        updated = [...prev, studentId]
        // Auto-select first selected student as default leader if none chosen
        if (!selectedLeaderId) {
          setSelectedLeaderId(studentId)
        }
      }
      return updated
    })
  }

  // Select all available students
  const handleSelectAllAvailable = () => {
    const availableIds = students.filter((s) => !s.isAssigned).map((s) => s.id)
    setSelectedStudentIds(availableIds)
    if (!selectedLeaderId && availableIds.length > 0) {
      setSelectedLeaderId(availableIds[0])
    }
  }

  const handleClearSelection = () => {
    setSelectedStudentIds([])
    setSelectedLeaderId('')
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    const cleanName = (groupName || '').trim()

    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      setErrorMessage('Group name must be between 2 and 80 characters.')
      return
    }

    if (selectedStudentIds.length === 0) {
      setErrorMessage('Please select at least one student to join this group.')
      return
    }

    if (!selectedLeaderId || !selectedStudentIds.includes(selectedLeaderId)) {
      setErrorMessage('Please select a group leader from the selected members.')
      return
    }

    try {
      setSubmitting(true)
      setErrorMessage('')

      await groupsService.professorCreateGroup(
        classId,
        cleanName,
        selectedStudentIds,
        selectedLeaderId
      )

      if (onGroupCreated) onGroupCreated()
      onClose()
    } catch (err) {
      console.error('[ProfessorCreateGroupModal] Error creating group:', err)
      setErrorMessage(err.message || 'Failed to create group. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-heading leading-tight">
              Create Class Group
            </h3>
            <p className="text-xs text-brand-muted font-normal">
              Course: <span className="font-semibold text-brand-heading">{className}</span>
            </p>
          </div>
        </div>
      }
      size="lg"
    >
      <form onSubmit={handleCreateGroup} className="space-y-5">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Group Name Input */}
        <div>
          <Input
            label="Group Name"
            placeholder="e.g. Distributed Systems Team Alpha"
            required
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            helperText="Give this project team a recognizable name."
          />
        </div>

        {/* Member Directory & Selection */}
        <div className="space-y-3 pt-1 border-t border-brand-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-heading flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-primary" />
                <span>Select Group Members ({selectedStudentIds.length} selected)</span>
              </h4>
              <p className="text-[11px] text-brand-muted">
                {availableCount} available students in this class • Students already in a group cannot be selected
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAllAvailable}
                className="text-xs font-semibold text-brand-primary hover:underline cursor-pointer"
              >
                Select All Available
              </button>
              {selectedStudentIds.length > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search enrolled students by name, email, ID..."
              className="w-full rounded-xl border border-brand-line bg-white pl-9 pr-4 py-2 text-xs focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 shadow-xs"
            />
          </div>

          {/* Student List Box */}
          <div className="max-h-60 overflow-y-auto rounded-xl border border-brand-line divide-y divide-brand-line/60 bg-white">
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
                        onChange={() => {}} // handled by parent div
                        className="w-4 h-4 rounded text-brand-primary border-slate-300 focus:ring-brand-primary cursor-pointer disabled:cursor-not-allowed"
                      />

                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs shrink-0 text-slate-700">
                        {student.avatar ? (
                          <img
                            src={student.avatar}
                            alt={student.name}
                            loading="lazy"
                            decoding="async"
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
                      {isAssigned ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                          Already in {student.groupName || 'a group'}
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
        </div>

        {/* Leader Selection */}
        {selectedStudentIds.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
            <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-600" />
              <span>Designate Group Leader (Required)</span>
            </label>
            <p className="text-[11px] text-amber-800">
              Only the group leader is authorized to acknowledge and submit group assignments.
            </p>

            <select
              value={selectedLeaderId}
              onChange={(e) => setSelectedLeaderId(e.target.value)}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-brand-heading focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
            >
              {selectedStudentIds.map((sid) => {
                const s = students.find((st) => st.id === sid)
                return (
                  <option key={sid} value={sid}>
                    {s ? `${s.name} (${s.email || 'Student'})` : sid}
                  </option>
                )
              })}
            </select>
          </div>
        )}

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
            icon={Plus}
            className="shadow-purple-glow font-bold"
          >
            Create Group & Assign Roster
          </Button>
        </div>
      </form>
    </Modal>
  )
}

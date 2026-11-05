import React, { useState, useEffect, useMemo } from 'react'
import { Users, Search, Check, X } from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'

export default function StudentSelectionModal({
  isOpen,
  onClose,
  className = '',
  students = [],
  selectedStudentIds = [],
  onApply,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(selectedStudentIds)

  // Sync state whenever modal opens or initial selection changes
  React.useEffect(() => {
    setSelectedIds(selectedStudentIds)
  }, [isOpen, selectedStudentIds])

  // Filter students by name or email or student_id
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = searchQuery.toLowerCase()
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.student_id?.toLowerCase().includes(q)
    )
  }, [students, searchQuery])

  const allSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.includes(s.id))

  const handleToggleAll = () => {
    if (allSelected) {
      // Unselect filtered students
      const filteredIds = new Set(filteredStudents.map((s) => s.id))
      setSelectedIds(selectedIds.filter((id) => !filteredIds.has(id)))
    } else {
      // Select all filtered students
      const newIds = new Set([...selectedIds, ...filteredStudents.map((s) => s.id)])
      setSelectedIds(Array.from(newIds))
    }
  }

  const handleToggleStudent = (studentId) => {
    if (selectedIds.includes(studentId)) {
      setSelectedIds(selectedIds.filter((id) => id !== studentId))
    } else {
      setSelectedIds([...selectedIds, studentId])
    }
  }

  const handleApply = () => {
    onApply(selectedIds)
    onClose()
  }

  // Get color for initials avatar
  const getAvatarColor = (index) => {
    const colors = [
      'bg-purple-100 text-purple-700',
      'bg-indigo-100 text-indigo-700',
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700',
      'bg-sky-100 text-sky-700',
    ]
    return colors[index % colors.length]
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-primary flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-brand-heading">Select Students</h3>
            <p className="text-xs text-brand-muted">{className || 'Class Roster'}</p>
          </div>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between">
          <span className="text-xs font-semibold text-brand-muted">
            <strong className="text-brand-heading">{selectedIds.length}</strong> students selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students by name, email or ID..."
            className="w-full rounded-input border border-brand-line bg-slate-50/70 hover:bg-white pl-9 pr-4 py-2 text-xs sm:text-sm text-brand-heading placeholder:text-slate-400 focus:bg-white focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>

        {/* Select All Checkbox row */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-brand-line/60">
          <label className="flex items-center gap-2.5 text-xs font-semibold text-brand-heading cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleToggleAll}
              className="w-4 h-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30 cursor-pointer"
            />
            <span>Select All ({students.length})</span>
          </label>
          <span className="text-[11px] text-brand-muted">
            {filteredStudents.length} matching
          </span>
        </div>

        {/* Students Checkbox List */}
        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-brand-line/40">
          {filteredStudents.map((student, idx) => {
            const isSelected = selectedIds.includes(student.id)
            const initials = student.name
              ? student.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .substring(0, 2)
              : 'ST'

            return (
              <label
                key={student.id}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                  isSelected ? 'bg-brand-activeNav/60' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleStudent(student.id)}
                    className="w-4 h-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary/30 cursor-pointer shrink-0"
                  />
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColor(
                      idx
                    )}`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-brand-heading truncate">
                      {student.name}
                    </p>
                    <p className="text-[11px] text-brand-muted truncate">
                      {student.student_id ? `${student.student_id} • ` : ''}
                      {student.email}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-4 h-4 text-brand-primary shrink-0 ml-2" />
                )}
              </label>
            )
          })}

          {filteredStudents.length === 0 && (
            <p className="text-xs text-brand-muted text-center py-6">
              No students found matching "{searchQuery}"
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

import React from 'react'
import {
  User,
  Mail,
  GraduationCap,
  Calendar,
  CheckCircle2,
  BookOpen,
  Award,
  IdCard
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Badge from '../common/Badge'
import { formatDisplayDate } from '../../utils/calculations'

export default function StudentProfileModal({ isOpen, onClose, member }) {
  if (!member) return null

  const student = member.users || {}
  const joinedDate = member.joined_at ? formatDisplayDate(member.joined_at) : 'Active'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Profile"
      size="md"
    >
      <div className="space-y-6">
        {/* Profile Card Header */}
        <div className="relative rounded-2xl p-6 bg-gradient-to-br from-brand-secondaryBg to-brand-light border border-brand-border/60 text-center">
          <div className="w-20 h-20 rounded-full bg-white text-brand-primary mx-auto flex items-center justify-center font-bold text-2xl shadow-card ring-4 ring-brand-primary/20 overflow-hidden">
            {student.avatar ? (
              <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <span>{student.name?.charAt(0) || 'S'}</span>
            )}
          </div>

          <h3 className="text-lg font-bold text-brand-heading mt-3">
            {student.name || 'Student Name'}
          </h3>
          <p className="text-xs text-brand-muted mt-0.5">{student.email}</p>

          <div className="flex items-center justify-center gap-2 mt-3">
            <Badge variant="success" size="sm" dot>
              Active Student
            </Badge>
            <span className="text-[11px] font-semibold text-brand-primary bg-white px-2.5 py-0.5 rounded-full border border-brand-border/50 shadow-xs">
              MCA Scholar
            </span>
          </div>
        </div>

        {/* Detailed Information Grid */}
        <div className="space-y-3">
          <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-brand-muted flex items-center gap-2 font-medium shrink-0">
              <Mail className="w-4 h-4 text-slate-400" />
              Email Address
            </span>
            <span className="font-semibold text-brand-heading break-all">{student.email}</span>
          </div>

          <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-brand-muted flex items-center gap-2 font-medium shrink-0">
              <GraduationCap className="w-4 h-4 text-slate-400" />
              Student Registration ID
            </span>
            <span className="font-mono font-semibold text-brand-primary">
              {student.student_id || 'STU-2026-MCA'}
            </span>
          </div>

          <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-brand-muted flex items-center gap-2 font-medium shrink-0">
              <Calendar className="w-4 h-4 text-slate-400" />
              Class Enrolment Date
            </span>
            <span className="font-semibold text-brand-heading">{joinedDate}</span>
          </div>

          <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-brand-muted flex items-center gap-2 font-medium shrink-0">
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              Status
            </span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Enrolled & Verified
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-brand-line/60">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

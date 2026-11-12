import React, { useEffect, useState } from 'react'
import { KeyRound, RefreshCw, AlertCircle } from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { Input, Textarea } from '../common/Input'
import { classesService } from '../../services/classes.service'
import { useToast } from '../../context/ToastContext'

function generateEnrollmentCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return out
}

export default function EditClassModal({
  isOpen,
  onClose,
  classData,
  onSuccess,
}) {
  const toast = useToast()
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    description: '',
    class_code: '',
    semester: '',
    academic_year: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const supportsTermFields = Boolean(
    classData &&
      ('semester' in classData || 'academic_year' in classData)
  )

  useEffect(() => {
    if (!isOpen || !classData) return
    setFormData({
      name: classData.name || '',
      subject: classData.subject || '',
      description: classData.description || '',
      class_code: classData.class_code || '',
      semester: classData.semester || '',
      academic_year: classData.academic_year || '',
    })
    setError('')
    setSaving(false)
  }, [isOpen, classData])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!classData?.id) return

    const trimmedName = formData.name.trim()
    const trimmedSubject = formData.subject.trim()
    const normalizedCode = formData.class_code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')

    if (trimmedName.length < 2) {
      setError('Class name must be at least 2 characters.')
      return
    }
    if (!trimmedSubject) {
      setError('Course code / subject is required.')
      return
    }
    if (normalizedCode.length < 4 || normalizedCode.length > 16) {
      setError('Enrollment code must be 4 to 16 alphanumeric characters.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const payload = {
        name: trimmedName,
        subject: trimmedSubject,
        description: formData.description.trim(),
        class_code: normalizedCode,
      }

      if (supportsTermFields) {
        payload.semester = formData.semester.trim()
        payload.academic_year = formData.academic_year.trim()
      }

      const updated = await classesService.updateClass(classData.id, payload)
      toast.success(`Updated "${updated?.name || trimmedName}" successfully.`, 'Class Saved')
      if (typeof onSuccess === 'function') {
        onSuccess(updated)
      }
      onClose()
    } catch (err) {
      const msg = err.message || 'Failed to update class details.'
      setError(msg)
      toast.error(msg, 'Update Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Class Details"
      subtitle={classData?.name || 'Update course information and enrollment code'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <Input
          label="Class Name"
          required
          disabled={saving}
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Data Structures & Algorithms"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Input
            label="Course Code / Subject"
            required
            disabled={saving}
            value={formData.subject}
            onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
            placeholder="e.g., CS301"
          />

          <Input
            label="Enrollment Code"
            required
            disabled={saving}
            icon={KeyRound}
            value={formData.class_code}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                class_code: e.target.value.toUpperCase(),
              }))
            }
            placeholder="e.g., CS301A"
            rightElement={
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, class_code: generateEnrollmentCode() }))
                }
                title="Generate new enrollment code"
                className="text-[11px] font-bold text-brand-primary hover:text-brand-secondary px-1.5 py-0.5 rounded-md hover:bg-brand-light transition-colors"
              >
                New
              </button>
            }
          />
        </div>

        {supportsTermFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Semester"
              disabled={saving}
              value={formData.semester}
              onChange={(e) => setFormData((prev) => ({ ...prev, semester: e.target.value }))}
              placeholder="e.g., Fall 2026"
            />
            <Input
              label="Academic Year"
              disabled={saving}
              value={formData.academic_year}
              onChange={(e) => setFormData((prev) => ({ ...prev, academic_year: e.target.value }))}
              placeholder="e.g., 2026-2027"
            />
          </div>
        )}

        <Textarea
          label="Course Description"
          rows={3}
          disabled={saving}
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Brief overview, syllabus notes, or expectations..."
        />

        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={saving}
            icon={error ? RefreshCw : undefined}
          >
            {error ? 'Retry Save' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

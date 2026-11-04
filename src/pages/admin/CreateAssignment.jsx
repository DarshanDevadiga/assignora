import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Users,
  Calendar,
  Clock,
  Link2,
  Trash2,
  ExternalLink,
  Plus,
  Send,
  Save,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  Upload,
  CheckCircle2,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { classesService } from '../../services/classes.service'
import { assignmentsService } from '../../services/assignments.service'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import { Input, Textarea } from '../../components/common/Input'
import StudentSelectionModal from '../../components/admin/StudentSelectionModal'

export default function CreateAssignment() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id: editAssignmentId } = useParams()

  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignToAll, setAssignToAll] = useState(true)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('23:59')
  const [points, setPoints] = useState('100')
  const [driveLink, setDriveLink] = useState('')
  const [driveLinkTitle, setDriveLinkTitle] = useState('Reference Materials – Google Drive')
  const [requireSubmission, setRequireSubmission] = useState(true)
  const [twoStepSubmission, setTwoStepSubmission] = useState(true)

  // Link addition dialog state
  const [showAddLink, setShowAddLink] = useState(false)
  const [tempLink, setTempLink] = useState('')

  // Student selection modal state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false)

  // Loading & error states
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    loadClassesAndAssignment()
  }, [user?.id, editAssignmentId])

  async function loadClassesAndAssignment() {
    if (!user?.id) return
    try {
      setInitialLoading(true)
      const adminClasses = await classesService.getAdminClasses(user.id)
      setClasses(adminClasses)

      if (adminClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(adminClasses[0].id)
      }

      // If in edit mode, fetch existing assignment details
      if (editAssignmentId) {
        const existing = await assignmentsService.getAssignmentById(editAssignmentId)
        if (existing) {
          setTitle(existing.title)
          setDescription(existing.description || '')
          setSelectedClassId(existing.class_id)
          setDueDate(existing.due_date || '')
          setDueTime(existing.due_time ? existing.due_time.substring(0, 5) : '23:59')
          setPoints(String(existing.points || 100))
          setDriveLink(existing.drive_link || '')
          setAssignToAll(existing.assign_to_all)
          if (!existing.assign_to_all && existing.assignment_students) {
            setSelectedStudentIds(existing.assignment_students.map((s) => s.student_id))
          }
        }
      } else {
        // Set default due date to 7 days from now
        const defaultDue = new Date()
        defaultDue.setDate(defaultDue.getDate() + 7)
        setDueDate(defaultDue.toISOString().split('T')[0])
      }
    } catch (err) {
      console.error('[CreateAssignment] Error loading data:', err)
      setErrorMessage('Failed to load classes.')
    } finally {
      setInitialLoading(false)
    }
  }

  const currentClass = classes.find((c) => c.id === selectedClassId)
  const classStudents = currentClass?.class_members?.map((m) => m.users).filter(Boolean) || []

  // Formatting helpers for description
  const appendFormat = (tag) => {
    setDescription((prev) => `${prev}\n- `)
  }

  // Handle Add Link
  const handleSaveDriveLink = () => {
    if (tempLink.trim()) {
      setDriveLink(tempLink.trim())
      setTempLink('')
      setShowAddLink(false)
    }
  }

  // Submit Assignment
  const handleSaveAssignment = async (status = 'published') => {
    if (!title.trim()) {
      setErrorMessage('Please enter an assignment title.')
      return
    }
    if (!selectedClassId) {
      setErrorMessage('Please select a class.')
      return
    }
    if (!assignToAll && selectedStudentIds.length === 0) {
      setErrorMessage('Please select at least one student or choose "All Students".')
      return
    }

    try {
      setLoading(true)
      setErrorMessage('')

      const payload = {
        title,
        description,
        class_id: selectedClassId,
        admin_id: user.id,
        due_date: dueDate || null,
        due_time: dueTime ? `${dueTime}:00` : '23:59:00',
        points: Number(points) || 100,
        drive_link: driveLink || null,
        assign_to_all: assignToAll,
        status,
      }

      if (editAssignmentId) {
        await assignmentsService.updateAssignment(
          editAssignmentId,
          payload,
          assignToAll ? [] : selectedStudentIds
        )
      } else {
        await assignmentsService.createAssignment(
          payload,
          assignToAll ? [] : selectedStudentIds
        )
      }

      navigate('/admin/assignments')
    } catch (err) {
      console.error('[CreateAssignment] Error saving assignment:', err)
      setErrorMessage(err.message || 'Failed to save assignment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="py-16 text-center text-sm text-brand-muted">
        Loading assignment workspace...
      </div>
    )
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

        <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
          {editAssignmentId ? 'Edit Assignment' : 'Create Assignment'}
        </h1>
        <p className="text-sm text-brand-muted mt-0.5">
          {editAssignmentId
            ? 'Update the assignment details, resources, and deadlines.'
            : 'Create and publish a new assignment for your class.'}
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Two Column Layout matching reference screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Title, Description, Resources */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Assignment Details Card */}
          <Card padding="p-6" className="space-y-5">
            <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-primary" />
              <span>Assignment Details</span>
            </h3>

            {/* Title */}
            <div>
              <Input
                label="Title"
                placeholder="e.g. Web Development – Mini Project"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description with formatting toolbar */}
            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1.5">
                Description <span className="text-brand-danger">*</span>
              </label>

              {/* Toolbar */}
              <div className="border border-brand-line rounded-t-input bg-slate-50 px-3 py-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-brand-muted px-2 py-1 bg-white border border-brand-line rounded">
                  Paragraph
                </span>
                <div className="w-[1px] h-4 bg-brand-line mx-1" />
                <button
                  type="button"
                  title="Bold"
                  onClick={() => appendFormat('bold')}
                  className="p-1.5 text-slate-500 hover:text-brand-heading hover:bg-white rounded transition-colors"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Italic"
                  onClick={() => appendFormat('italic')}
                  className="p-1.5 text-slate-500 hover:text-brand-heading hover:bg-white rounded transition-colors"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Underline"
                  onClick={() => appendFormat('underline')}
                  className="p-1.5 text-slate-500 hover:text-brand-heading hover:bg-white rounded transition-colors"
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-brand-line mx-1" />
                <button
                  type="button"
                  title="Bullet list"
                  onClick={() => appendFormat('list')}
                  className="p-1.5 text-slate-500 hover:text-brand-heading hover:bg-white rounded transition-colors"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Numbered list"
                  onClick={() => appendFormat('ordered')}
                  className="p-1.5 text-slate-500 hover:text-brand-heading hover:bg-white rounded transition-colors"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Build a responsive web application using React. Include authentication, CRUD operations, and a clean UI. Submit the project link and a brief report."
                className="block w-full rounded-b-input border-x border-b border-brand-line bg-white px-3.5 py-3 text-sm text-brand-heading placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
          </Card>

          {/* Add Resources (Optional) Card */}
          <Card padding="p-6" className="space-y-4">
            <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
              <Link2 className="w-5 h-5 text-brand-primary" />
              <span>Add Resources (Optional)</span>
            </h3>

            {/* Existing / added Drive Link */}
            {driveLink ? (
              <div className="p-3.5 rounded-xl border border-brand-line bg-slate-50/70 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-white border border-brand-line flex items-center justify-center shrink-0 shadow-xs">
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg"
                      alt="Google Drive"
                      className="w-5 h-5"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-brand-heading truncate">
                      {driveLinkTitle}
                    </p>
                    <a
                      href={driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-brand-primary hover:underline truncate block"
                    >
                      {driveLink}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setDriveLink('')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-danger hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* Static PDF sample resource from reference */}
            <div className="p-3.5 rounded-xl border border-brand-line bg-slate-50/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 font-bold text-xs">
                  PDF
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-brand-heading truncate">
                    Project_Guidelines.pdf
                  </p>
                  <p className="text-[11px] text-brand-muted">2.4 MB</p>
                </div>
              </div>
              <Badge variant="neutral" size="sm">Attachment</Badge>
            </div>

            {/* Add Link Input dialog */}
            {showAddLink ? (
              <div className="p-3.5 rounded-xl border border-brand-primary bg-brand-light/30 space-y-3">
                <Input
                  label="Google Drive or External URL"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={tempLink}
                  onChange={(e) => setTempLink(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddLink(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveDriveLink}
                  >
                    Save Link
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Link2}
                  onClick={() => setShowAddLink(true)}
                >
                  Add Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Upload}
                  onClick={() => alert('PDF attachment added from workspace guidelines.')}
                >
                  Upload File
                </Button>
              </div>
            )}
          </Card>

        </div>

        {/* Right Column (4 cols): Class, Allocations, Settings, Actions */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Class & Students Card */}
          <Card padding="p-6" className="space-y-5">
            <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-primary" />
              <span>Class & Students</span>
            </h3>

            {/* Select Class */}
            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1.5">
                Select Class <span className="text-brand-danger">*</span>
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value)
                  setSelectedStudentIds([])
                }}
                className="w-full rounded-input border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-heading font-medium focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.class_members?.length || 0} students)
                  </option>
                ))}
              </select>
            </div>

            {/* Assign to: All or Select Students */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-brand-heading">
                Assign to <span className="text-brand-danger">*</span>
              </label>

              <div className="space-y-2.5">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-brand-line hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="assignTo"
                    checked={assignToAll}
                    onChange={() => setAssignToAll(true)}
                    className="w-4 h-4 text-brand-primary border-brand-line focus:ring-brand-primary/30"
                  />
                  <div className="text-xs sm:text-sm font-semibold text-brand-heading">
                    All Students ({classStudents.length})
                  </div>
                </label>

                <div
                  onClick={() => {
                    setAssignToAll(false)
                    setIsStudentModalOpen(true)
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    !assignToAll
                      ? 'border-brand-primary bg-brand-activeNav/60 ring-1 ring-brand-primary/20'
                      : 'border-brand-line hover:bg-slate-50'
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="assignTo"
                      checked={!assignToAll}
                      onChange={() => {
                        setAssignToAll(false)
                        setIsStudentModalOpen(true)
                      }}
                      className="w-4 h-4 text-brand-primary border-brand-line focus:ring-brand-primary/30"
                    />
                    <span className="text-xs sm:text-sm font-semibold text-brand-heading">
                      Select Students ({selectedStudentIds.length})
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAssignToAll(false)
                      setIsStudentModalOpen(true)
                    }}
                    className="text-xs font-semibold text-brand-primary hover:underline"
                  >
                    Customize
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Assignment Settings Card */}
          <Card padding="p-6" className="space-y-5">
            <h3 className="text-base font-bold text-brand-heading flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-primary" />
              <span>Assignment Settings</span>
            </h3>

            {/* Due Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Due Date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />

              <Input
                label="Due Time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>

            {/* Points */}
            <div>
              <Input
                label="Points"
                type="number"
                min="0"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2 border-t border-brand-line/60">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-brand-heading">Require Submission</p>
                  <p className="text-[11px] text-brand-muted">Students must submit their work</p>
                </div>
                <input
                  type="checkbox"
                  checked={requireSubmission}
                  onChange={(e) => setRequireSubmission(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-primary border-brand-line cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-brand-heading">Two-Step Confirmation</p>
                  <p className="text-[11px] text-brand-muted">Confirm before final submission</p>
                </div>
                <input
                  type="checkbox"
                  checked={twoStepSubmission}
                  onChange={(e) => setTwoStepSubmission(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-primary border-brand-line cursor-pointer"
                />
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              loading={loading}
              icon={Save}
              className="w-1/2 justify-center"
              onClick={() => handleSaveAssignment('draft')}
            >
              Save Draft
            </Button>

            <Button
              variant="primary"
              size="lg"
              loading={loading}
              icon={Send}
              className="w-1/2 justify-center shadow-purple-glow font-semibold"
              onClick={() => handleSaveAssignment('published')}
            >
              {editAssignmentId ? 'Update' : 'Publish'}
            </Button>
          </div>

        </div>

      </div>

      {/* Student Selection Modal */}
      <StudentSelectionModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        className={currentClass?.name}
        students={classStudents}
        selectedStudentIds={selectedStudentIds}
        onApply={(ids) => setSelectedStudentIds(ids)}
      />
    </div>
  )
}

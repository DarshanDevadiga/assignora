import React, { useState, useEffect } from 'react'
import {
  MessageSquare,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Send,
  Sparkles,
  Users
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { announcementsService } from '../../services/announcements.service'
import { classesService } from '../../services/classes.service'
import { formatTimeAgo, formatDisplayDate } from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { Input, Textarea } from '../../components/common/Input'

export default function AnnouncementsManagement() {
  const { user } = useAuth()

  const [announcements, setAnnouncements] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedClassFilter, setSelectedClassFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [targetClassId, setTargetClassId] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)

  // Delete State
  const [deletingId, setDeletingId] = useState(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [user?.id])

  async function loadData() {
    if (!user?.id) return
    try {
      setLoading(true)
      const [allAnnouncements, adminClasses] = await Promise.all([
        announcementsService.getAnnouncements(),
        classesService.getAdminClasses(user.id),
      ])
      setAnnouncements(allAnnouncements)
      setClasses(adminClasses)
      if (adminClasses.length > 0 && !targetClassId) {
        setTargetClassId(adminClasses[0].id)
      }
    } catch (err) {
      console.error('[AnnouncementsManagement] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredAnnouncements = announcements.filter((a) => {
    if (selectedClassFilter === 'all') return true
    return a.class_id === selectedClassFilter
  })

  // Handle Post
  const handlePostSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim() || !targetClassId) return

    try {
      setPosting(true)
      await announcementsService.createAnnouncement({
        title: title || 'Class Announcement',
        message,
        class_id: targetClassId,
        admin_id: user.id,
      })
      setIsCreateOpen(false)
      setTitle('')
      setMessage('')
      await loadData()
    } catch (err) {
      console.error('[AnnouncementsManagement] Error creating:', err)
    } finally {
      setPosting(false)
    }
  }

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingId) return
    try {
      setDeleting(true)
      await announcementsService.deleteAnnouncement(deletingId)
      setIsDeleteOpen(false)
      setDeletingId(null)
      await loadData()
    } catch (err) {
      console.error('[AnnouncementsManagement] Error deleting:', err)
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
            Announcements & Stream Posts
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Publish class updates, deadlines reminders, and academic notices.
          </p>
        </div>

        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setIsCreateOpen(true)}
          className="self-start sm:self-auto shadow-purple-glow font-semibold"
        >
          Post Announcement
        </Button>
      </div>

      {/* Filter Bar */}
      <Card padding="p-4" className="flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-brand-heading shrink-0">Filter by Class:</label>
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="rounded-input border border-brand-line bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold text-brand-heading focus:border-brand-primary focus:outline-none cursor-pointer min-w-[200px]"
          >
            <option value="all">All Classes ({announcements.length} posts)</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Announcements List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-brand-line animate-pulse" />
          ))}
        </div>
      ) : filteredAnnouncements.length > 0 ? (
        <div className="space-y-4">
          {filteredAnnouncements.map((ann) => (
            <Card key={ann.id} padding="p-5 sm:p-6" className="shadow-card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-light text-brand-primary font-bold text-xs flex items-center justify-center">
                    {ann.users?.name?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-brand-heading">
                      {ann.title || 'Announcement'}
                    </h4>
                    <p className="text-xs text-brand-muted">
                      {ann.users?.name || 'Prof. Anitha'} • {formatTimeAgo(ann.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="purple" size="sm">
                    {ann.classes?.name || 'Class'}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingId(ann.id)
                      setIsDeleteOpen(true)
                    }}
                    className="p-1.5 text-slate-400 hover:text-brand-danger hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-brand-body leading-relaxed whitespace-pre-line bg-slate-50/60 p-4 rounded-xl border border-brand-line/60">
                {ann.message}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-16 space-y-3">
          <MessageSquare className="w-14 h-14 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-brand-heading">No announcements posted</h3>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            Click "Post Announcement" to broadcast news or syllabus updates to your students.
          </p>
          <Button variant="primary" icon={Plus} onClick={() => setIsCreateOpen(true)}>
            Post Announcement
          </Button>
        </Card>
      )}

      {/* Modal: Post Announcement */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Post Announcement"
        subtitle="Share important updates, deadlines, or materials with your students."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={posting} icon={Send} onClick={handlePostSubmit}>
              Publish Announcement
            </Button>
          </>
        }
      >
        <form onSubmit={handlePostSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-brand-heading mb-1.5">
              Target Class <span className="text-brand-danger">*</span>
            </label>
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full rounded-input border border-brand-line bg-white px-3 py-2 text-sm text-brand-heading font-medium focus:border-brand-primary focus:outline-none cursor-pointer"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Announcement Title"
            placeholder="e.g. Midterm Guidelines & Resources"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Textarea
            label="Announcement Message"
            placeholder="Type your announcement to share with the class..."
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </form>
      </Modal>

      {/* Modal: Delete Announcement Confirmation */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Announcement?"
        subtitle="This action cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDeleteConfirm}>
              Yes, Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-brand-body leading-relaxed">
          Are you sure you want to delete this announcement from the stream? Students will no longer see it.
        </p>
      </Modal>
    </div>
  )
}

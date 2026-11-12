import React, { useState, useEffect } from 'react'
import {
  User,
  Mail,
  GraduationCap,
  Calendar,
  Shield,
  Edit2,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Award,
  Sparkles,
  Camera
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usersService } from '../../services/users.service'
import { classesService } from '../../services/classes.service'
import { formatDisplayDate } from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { Input } from '../../components/common/Input'

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
]

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth()

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editName, setEditName] = useState(user?.name || '')
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '')
  const [editStudentId, setEditStudentId] = useState(user?.student_id || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) {
      setEditName(user.name || '')
      setEditAvatar(user.avatar || '')
      setEditStudentId(user.student_id || '')
    }
  }, [user])

  const handleOpenEdit = () => {
    setEditName(user?.name || '')
    setEditAvatar(user?.avatar || '')
    setEditStudentId(user?.student_id || '')
    setError(null)
    setIsEditOpen(true)
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!editName.trim() || !user?.id) {
      setError('Full Name is required.')
      return
    }

    try {
      setSaving(true)
      setError(null)

      // Persist in Supabase public.users
      await usersService.updateProfile(user.id, {
        name: editName.trim(),
        avatar: editAvatar.trim(),
        student_id: editStudentId.trim(),
      })

      // Immediately refresh profile state across AuthContext
      if (refreshProfile) {
        await refreshProfile()
      }

      setSuccess(true)
      setIsEditOpen(false)
      setTimeout(() => setSuccess(false), 3500)
    } catch (err) {
      console.error('[ProfilePage] Error saving profile:', err)
      setError(err.message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const isTeacher = user?.role === 'admin'
  const displayName = user?.name || (isTeacher ? 'Prof. Anitha R.' : 'Student')
  const displayRole = isTeacher ? 'Administrator & Lead Professor' : 'Student Scholar'

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Success Notification Alert */}
      {success && (
        <div className="rounded-2xl p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between shadow-card">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <strong className="block font-bold">Profile Updated Successfully!</strong>
              <span>Your changes are now reflected across your sidebar, classes, and dashboard.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="text-emerald-600 hover:text-emerald-800 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Profile Banner Card */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-700 via-indigo-700 to-brand-primary p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar with Ring */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-white text-brand-primary flex items-center justify-center font-bold text-3xl shadow-modal ring-4 ring-white/30 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={displayName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <span>{displayName.charAt(0)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleOpenEdit}
                title="Change Avatar"
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-brand-primary text-white ring-2 ring-white hover:bg-brand-hover shadow-card cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="success" size="sm" dot>
                  Active Account
                </Badge>
                <span className="text-[11px] font-semibold text-white/80 bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full">
                  {isTeacher ? 'Faculty Level 1' : 'MCA Master Cohort'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {displayName}
              </h1>

              <p className="text-xs sm:text-sm text-white/85 font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-white/70" />
                <span>{user?.email}</span>
              </p>
            </div>
          </div>

          <Button
            variant="white"
            icon={Edit2}
            onClick={handleOpenEdit}
            className="font-bold text-brand-primary shadow-lg self-start sm:self-center"
          >
            Edit Profile
          </Button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details */}
        <Card padding="p-6" className="space-y-4 shadow-card">
          <h3 className="text-sm font-bold text-brand-heading border-b border-brand-line/60 pb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-primary" />
            <span>Personal Information</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-brand-line/40">
              <span className="text-brand-muted">Full Name</span>
              <strong className="text-brand-heading">{displayName}</strong>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-brand-line/40">
              <span className="text-brand-muted">Email Address</span>
              <strong className="text-brand-heading">{user?.email}</strong>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-brand-line/40">
              <span className="text-brand-muted">
                {isTeacher ? 'Faculty Employee ID' : 'Student Registration ID'}
              </span>
              <strong className="font-mono text-brand-primary">
                {user?.student_id || (isTeacher ? 'FAC-MCA-001' : 'STU-2026-MCA')}
              </strong>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-brand-muted">Account Role</span>
              <span className="font-bold text-brand-heading flex items-center gap-1.5">
                {isTeacher ? <Shield className="w-3.5 h-3.5 text-brand-primary" /> : <GraduationCap className="w-3.5 h-3.5 text-brand-primary" />}
                {displayRole}
              </span>
            </div>
          </div>
        </Card>

        {/* Academic Profile Details */}
        <Card padding="p-6" className="space-y-4 shadow-card">
          <h3 className="text-sm font-bold text-brand-heading border-b border-brand-line/60 pb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-brand-primary" />
            <span>Academic Standing</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-brand-line/40">
              <span className="text-brand-muted">Institution</span>
              <strong className="text-brand-heading">Department of Computer Applications</strong>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-brand-line/40">
              <span className="text-brand-muted">Program</span>
              <strong className="text-brand-heading">MCA (Master of Computer Applications)</strong>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-brand-line/40">
              <span className="text-brand-muted">Term / Semester</span>
              <strong className="text-brand-heading">Semester 5 (Final Year)</strong>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-brand-muted">Status</span>
              <Badge variant="success" size="sm" dot>
                Active & Good Standing
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          EDIT PROFILE MODAL
      ========================================================================= */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Profile Information"
        size="md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {error && (
            <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Full Name"
            placeholder="e.g. Rahul Sharma"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label={isTeacher ? 'Faculty / Employee ID' : 'Student Registration ID'}
            placeholder="e.g. STU-2026-MCA"
            value={editStudentId}
            onChange={(e) => setEditStudentId(e.target.value)}
          />

          <div className="space-y-2">
            <Input
              label="Avatar Image URL"
              placeholder="https://images.unsplash.com/..."
              value={editAvatar}
              onChange={(e) => setEditAvatar(e.target.value)}
            />

            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-brand-muted">
                Or select an avatar style:
              </span>
              <div className="flex items-center gap-2.5">
                {AVATAR_PRESETS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setEditAvatar(url)}
                    className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                      editAvatar === url ? 'border-brand-primary ring-2 ring-brand-primary/40 scale-105' : 'border-slate-200 hover:border-brand-border'
                    }`}
                  >
                    <img src={url} alt={`Preset ${i}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-line/60">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setIsEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={saving}
              icon={Save}
              className="shadow-purple-glow font-semibold"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

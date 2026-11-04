import React, { useState, useEffect } from 'react'
import {
  User,
  Mail,
  Shield,
  Bell,
  Lock,
  Palette,
  CheckCircle2,
  AlertCircle,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  Globe,
  Sun,
  Moon
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usersService } from '../../services/users.service'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import { Input } from '../../components/common/Input'

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
]

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth()

  // Profile Settings Form
  const [name, setName] = useState(user?.name || '')
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [studentId, setStudentId] = useState(user?.student_id || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState(null)

  // Security Form (Password Change)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState(null)

  // Notification Preferences (stored in localStorage)
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('assignora_notifications')
      return saved
        ? JSON.parse(saved)
        : {
            assignments: true,
            submissions: true,
            announcements: true,
            invitations: true,
          }
    } catch {
      return { assignments: true, submissions: true, announcements: true, invitations: true }
    }
  })

  // Appearance / Theme
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('assignora_theme') || 'light'
  })

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setAvatar(user.avatar || '')
      setStudentId(user.student_id || '')
    }
  }, [user])

  // Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!name.trim() || !user?.id) return

    try {
      setSavingProfile(true)
      setProfileError(null)
      setProfileSuccess(false)

      await usersService.updateProfile(user.id, {
        name: name.trim(),
        avatar: avatar.trim(),
        student_id: studentId.trim(),
      })

      if (refreshProfile) {
        await refreshProfile()
      }

      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      console.error('[SettingsPage] Error updating profile:', err)
      setProfileError(err.message || 'Failed to update profile settings.')
    } finally {
      setSavingProfile(false)
    }
  }

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    try {
      setUpdatingPassword(true)
      setPasswordError(null)
      setPasswordSuccess(false)

      await usersService.updatePassword(newPassword)

      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err) {
      console.error('[SettingsPage] Error changing password:', err)
      setPasswordError(err.message || 'Failed to change password.')
    } finally {
      setUpdatingPassword(false)
    }
  }

  // Toggle Notifications
  const handleToggleNotification = (key) => {
    const updated = { ...notifications, [key]: !notifications[key] }
    setNotifications(updated)
    localStorage.setItem('assignora_notifications', JSON.stringify(updated))
  }

  // Toggle Theme
  const handleToggleTheme = (mode) => {
    setThemeMode(mode)
    localStorage.setItem('assignora_theme', mode)
  }

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-brand-heading tracking-tight">
          Platform Settings
        </h1>
        <p className="text-xs text-brand-muted mt-1">
          Manage your account credentials, profile information, notifications, and security preferences
        </p>
      </div>

      {/* =========================================================================
          1. ACCOUNT SETTINGS
      ========================================================================= */}
      <Card padding="p-6" className="space-y-5 shadow-card">
        <div className="flex items-center gap-3 border-b border-brand-line/60 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-heading">Account Overview</h3>
            <p className="text-[11px] text-brand-muted">
              Primary identification and account status on Assignora
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line">
            <span className="text-brand-muted block text-[11px]">Primary Email</span>
            <strong className="text-brand-heading text-sm mt-0.5 block truncate">
              {user?.email}
            </strong>
          </div>

          <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line">
            <span className="text-brand-muted block text-[11px]">Account Role</span>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="primary" size="sm">
                {user?.role === 'admin' ? 'Administrator / Professor' : 'Student Scholar'}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line">
            <span className="text-brand-muted block text-[11px]">Account Status</span>
            <span className="mt-1 font-bold text-emerald-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Active & Verified
            </span>
          </div>

          <div className="rounded-xl p-3.5 bg-slate-50 border border-brand-line">
            <span className="text-brand-muted block text-[11px]">Account ID</span>
            <span className="font-mono text-xs text-slate-500 mt-1 block truncate">
              {user?.id}
            </span>
          </div>
        </div>
      </Card>

      {/* =========================================================================
          2. PROFILE SETTINGS
      ========================================================================= */}
      <Card padding="p-6" className="space-y-5 shadow-card">
        <div className="flex items-center gap-3 border-b border-brand-line/60 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-heading">Profile Settings</h3>
            <p className="text-[11px] text-brand-muted">
              Update how your name and avatar appear across classes and submissions
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {profileSuccess && (
            <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Profile information successfully saved and synced across Assignora!</span>
            </div>
          )}

          {profileError && (
            <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label={user?.role === 'admin' ? 'Faculty / Employee ID' : 'Student Registration ID'}
              placeholder="e.g. STU-2026-MCA"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Input
              label="Profile Picture URL"
              placeholder="https://example.com/avatar.jpg"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
            />

            {/* Quick avatar selector presets */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-brand-muted">
                Or pick a preset avatar:
              </span>
              <div className="flex items-center gap-2.5">
                {AVATAR_PRESETS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatar(url)}
                    className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                      avatar === url ? 'border-brand-primary ring-2 ring-brand-primary/30 scale-105' : 'border-slate-200 hover:border-brand-border'
                    }`}
                  >
                    <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={savingProfile}
              icon={Save}
              className="shadow-purple-glow font-semibold"
            >
              Save Profile Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* =========================================================================
          3. NOTIFICATION SETTINGS
      ========================================================================= */}
      <Card padding="p-6" className="space-y-5 shadow-card">
        <div className="flex items-center gap-3 border-b border-brand-line/60 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center font-bold">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-heading">Notification Settings</h3>
            <p className="text-[11px] text-brand-muted">
              Choose which academic alerts you want to receive
            </p>
          </div>
        </div>

        <div className="divide-y divide-brand-line/60 space-y-1">
          <div className="py-3 flex items-center justify-between">
            <div>
              <strong className="text-xs font-bold text-brand-heading block">
                Assignment Notifications
              </strong>
              <p className="text-[11px] text-brand-muted">
                Alerts when new coursework is assigned or due dates approach
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifications.assignments}
              onChange={() => handleToggleNotification('assignments')}
              className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary cursor-pointer"
            />
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <strong className="text-xs font-bold text-brand-heading block">
                Submission & Grading Alerts
              </strong>
              <p className="text-[11px] text-brand-muted">
                Notifications when student work is submitted or reviewed by instructor
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifications.submissions}
              onChange={() => handleToggleNotification('submissions')}
              className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary cursor-pointer"
            />
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <strong className="text-xs font-bold text-brand-heading block">
                Class Announcements
              </strong>
              <p className="text-[11px] text-brand-muted">
                Broadcast updates and urgent notices from faculty members
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifications.announcements}
              onChange={() => handleToggleNotification('announcements')}
              className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary cursor-pointer"
            />
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <strong className="text-xs font-bold text-brand-heading block">
                Invitation & Enrolment Alerts
              </strong>
              <p className="text-[11px] text-brand-muted">
                Alerts when new students join classes or accept invitations
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifications.invitations}
              onChange={() => handleToggleNotification('invitations')}
              className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* =========================================================================
          4. SECURITY SETTINGS (Change Password)
      ========================================================================= */}
      <Card padding="p-6" className="space-y-5 shadow-card">
        <div className="flex items-center gap-3 border-b border-brand-line/60 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-heading">Security & Password</h3>
            <p className="text-[11px] text-brand-muted">
              Update your account password with instant Supabase Auth security validation
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          {passwordSuccess && (
            <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Password successfully updated!</span>
            </div>
          )}

          {passwordError && (
            <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-heading">
              New Password <span className="text-brand-danger">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-xs rounded-xl border border-brand-line px-3.5 py-2.5 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-heading">
              Confirm New Password <span className="text-brand-danger">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-type new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full text-xs rounded-xl border border-brand-line px-3.5 py-2.5 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
              required
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            type="submit"
            loading={updatingPassword}
            icon={KeyRound}
            className="shadow-purple-glow font-semibold"
          >
            Update Password
          </Button>
        </form>
      </Card>

      {/* =========================================================================
          5. APPEARANCE & THEME
      ========================================================================= */}
      <Card padding="p-6" className="space-y-5 shadow-card">
        <div className="flex items-center gap-3 border-b border-brand-line/60 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-light text-brand-primary flex items-center justify-center font-bold">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-heading">Appearance</h3>
            <p className="text-[11px] text-brand-muted">
              Customize the look and visual palette of Assignora
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => handleToggleTheme('light')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-2 ${
              themeMode === 'light'
                ? 'border-brand-primary bg-brand-activeNav/40 shadow-card'
                : 'border-brand-line hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-brand-heading flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                Assignora Light (Default)
              </span>
              {themeMode === 'light' && <CheckCircle2 className="w-4 h-4 text-brand-primary" />}
            </div>
            <p className="text-[11px] text-brand-muted">
              Purple gradient theme with crisp white cards and optimal readability.
            </p>
          </div>

          <div
            onClick={() => handleToggleTheme('dark')}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-2 ${
              themeMode === 'dark'
                ? 'border-brand-primary bg-slate-900 text-white shadow-card'
                : 'border-brand-line hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-brand-heading flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-400" />
                Deep Violet Night
              </span>
              {themeMode === 'dark' && <CheckCircle2 className="w-4 h-4 text-brand-primary" />}
            </div>
            <p className="text-[11px] text-brand-muted">
              High contrast nighttime view designed to reduce eye strain during late grading.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

import React, { useState } from 'react'
import {
  Copy,
  Check,
  Link as LinkIcon,
  Mail,
  Clock,
  ShieldCheck,
  Share2,
  Sparkles
} from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { classesService } from '../../services/classes.service'
import { getAppUrl } from '../../utils/appUrl'

export default function InviteStudentModal({ isOpen, onClose, currentClass }) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  if (!currentClass) return null

  const classCode = classesService.getClassCode(currentClass)
  const formattedCode = `CLS-${classCode}`
  const inviteToken = classesService.generateInviteToken(currentClass.id)
  const inviteUrl = `${getAppUrl()}/join-class?code=${classCode}`

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(formattedCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2500)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Invitation to join ${currentClass.name} on Assignora`)
    const body = encodeURIComponent(
      `Hello,\n\nYou have been invited to join the class "${currentClass.name}" (${currentClass.subject || 'Course'}) on Assignora.\n\nUse Class Code: ${formattedCode}\nOr join directly with this link:\n${inviteUrl}\n\nBest regards,\nAssignora Academic Team`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Students to Class"
      size="md"
    >
      <div className="space-y-6">
        {/* Class Banner Summary */}
        <div className="rounded-xl p-4 bg-gradient-to-r from-brand-primary to-brand-hover text-white shadow-purple-glow">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80 block">
                Target Class
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">{currentClass.name}</h3>
              <p className="text-xs text-white/80">{currentClass.subject || 'Course'}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* Method 1: Class Enrolment Code */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-brand-heading uppercase tracking-wider flex items-center gap-1.5">
            <span>Method 1: Class Enrolment Code</span>
          </label>
          <p className="text-xs text-brand-muted">
            Share this 6-character code with your students. They can enter it from their dashboard.
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-50 border-2 border-dashed border-brand-border rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="font-mono text-xl font-black text-brand-primary tracking-widest">
                {formattedCode}
              </span>
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Active Code
              </span>
            </div>
            <Button
              variant={copiedCode ? 'success' : 'primary'}
              onClick={handleCopyCode}
              icon={copiedCode ? Check : Copy}
              className="h-12 px-4 shadow-purple-glow"
            >
              {copiedCode ? 'Copied!' : 'Copy Code'}
            </Button>
          </div>
        </div>

        {/* Method 2: Direct Invitation Link */}
        <div className="space-y-2.5 pt-2 border-t border-brand-line/60">
          <label className="text-xs font-semibold text-brand-heading uppercase tracking-wider flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-brand-primary" />
            <span>Method 2: Direct Invitation Link</span>
          </label>
          <p className="text-xs text-brand-muted">
            Students who click this link can accept the invitation and instantly join this class.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 bg-slate-50 border border-brand-line text-xs rounded-xl px-3.5 py-3 text-brand-body font-mono truncate focus:outline-none"
            />
            <Button
              variant={copiedLink ? 'success' : 'outline'}
              onClick={handleCopyLink}
              icon={copiedLink ? Check : Copy}
              className="h-11 px-3.5 shrink-0"
            >
              {copiedLink ? 'Copied' : 'Copy Link'}
            </Button>
          </div>
        </div>

        {/* Share Action & Status Footer */}
        <div className="pt-2 border-t border-brand-line/60 space-y-3">
          <div className="flex items-center justify-between text-xs text-brand-muted">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-4 h-4 text-brand-primary" />
              <span>Status: <strong className="text-brand-heading">Active</strong> • Valid for 7 days</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Secure Token</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              icon={Mail}
              onClick={handleShareEmail}
            >
              Email Invitation
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

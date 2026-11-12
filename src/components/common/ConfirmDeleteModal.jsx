import React, { useEffect, useState } from 'react'
import { AlertTriangle, Archive, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import Badge from './Badge'

/**
 * Safe Confirmation Dialog for Delete / Archive operations across Classes, Groups, and Assignments.
 * - Shows impact counts while loading/loaded
 * - Blocks permanent deletion when historical submissions, grades, or non-empty dependencies exist
 * - Offers Archive alternative when supported
 * - Stays open during submission with spinner, shows exact error + Retry on failure
 */
export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  entityLabel = 'Item',
  entityName = '',
  entityMeta = '',
  stats = [],
  warningText = '',
  impactLoading = false,
  canPermanentDelete = true,
  blockReason = '',
  archiveSupported = false,
  archiveLabel = 'Archive Instead',
  archiveHelperText = '',
  requireTypedDelete = false,
  loading = false,
  error = '',
  onConfirmDelete,
  onConfirmArchive,
}) {
  const [typedConfirm, setTypedConfirm] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setTypedConfirm('')
    }
  }, [isOpen])

  const needsConfirmText = canPermanentDelete && requireTypedDelete
  const isDeleteReady = !needsConfirmText || typedConfirm.trim().toUpperCase() === 'DELETE'
  const showArchiveCTA = archiveSupported && typeof onConfirmArchive === 'function'

  const handleClose = () => {
    if (loading) return
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={canPermanentDelete ? `Delete ${entityLabel}` : `Preserve ${entityLabel} History`}
      subtitle={entityName ? `${entityLabel}: ${entityName}` : undefined}
      size="md"
    >
      <div className="space-y-4">
        {/* Summary Card */}
        <div
          className={`rounded-xl border p-4 flex items-start gap-3 ${
            canPermanentDelete
              ? 'bg-red-50/75 border-red-200'
              : 'bg-amber-50/85 border-amber-200'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              canPermanentDelete
                ? 'bg-red-100 text-red-600'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {canPermanentDelete ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900 break-words">
                {entityName || `Selected ${entityLabel}`}
              </p>
              {entityMeta && (
                <Badge variant="neutral" size="sm">
                  {entityMeta}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-700 mt-1 leading-relaxed">
              {canPermanentDelete
                ? warningText ||
                  `This permanently removes this ${entityLabel.toLowerCase()}. Please verify the associated impact counts below.`
                : blockReason ||
                  `This ${entityLabel.toLowerCase()} has active academic or submission records and cannot be permanently deleted to protect Round 1/Round 2 history.`}
            </p>
          </div>
        </div>

        {/* Impact Breakdown */}
        {(impactLoading || stats.length > 0) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Associated Records Impact
            </p>
            {impactLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-lg bg-white border border-slate-200 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-lg border px-3 py-2 bg-white ${
                      stat.highlight ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200'
                    }`}
                  >
                    <p className="text-[11px] font-semibold text-slate-500 truncate">
                      {stat.label}
                    </p>
                    <p
                      className={`text-base font-bold mt-0.5 ${
                        stat.highlight ? 'text-amber-700' : 'text-slate-900'
                      }`}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Archive guidance when supported */}
        {showArchiveCTA && (
          <div className="rounded-xl border border-brand-line bg-brand-light/40 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
            <Archive className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-brand-heading">
                Recommended: Archive to preserve historical work
              </p>
              <p className="leading-relaxed">
                {archiveHelperText ||
                  `Archiving hides this ${entityLabel.toLowerCase()} from active workflows while keeping all submissions, marks, feedback, and timestamps intact.`}
              </p>
            </div>
          </div>
        )}

        {/* Optional typed DELETE safeguard */}
        {!impactLoading && needsConfirmText && (
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-delete-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm permanent removal
            </label>
            <input
              id="confirm-delete-input"
              type="text"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              disabled={loading}
              placeholder="DELETE"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
            />
          </div>
        )}

        {/* Error Alert with Retry */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 flex items-start justify-between gap-3">
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>

          {showArchiveCTA && (
            <Button
              type="button"
              variant={canPermanentDelete ? 'outline' : 'primary'}
              onClick={onConfirmArchive}
              loading={loading}
              disabled={impactLoading || loading}
              icon={Archive}
            >
              {archiveLabel}
            </Button>
          )}

          {canPermanentDelete && typeof onConfirmDelete === 'function' && (
            <Button
              type="button"
              variant="danger"
              onClick={onConfirmDelete}
              loading={loading}
              disabled={impactLoading || loading || !isDeleteReady}
              icon={error ? RefreshCw : Trash2}
            >
              {error ? `Retry Delete ${entityLabel}` : `Delete ${entityLabel}`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

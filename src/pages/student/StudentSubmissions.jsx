import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckSquare,
  Clock,
  ExternalLink,
  Eye,
  Calendar,
  ClipboardList,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { submissionsService } from '../../services/submissions.service'
import { formatDisplayDate, sanitizeUrl } from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'

export default function StudentSubmissions() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubmissions()
  }, [user?.id])

  async function loadSubmissions() {
    if (!user?.id) return
    try {
      setLoading(true)
      const data = await submissionsService.getStudentSubmissions(user.id)
      setSubmissions(data)
    } catch (err) {
      console.error('[StudentSubmissions] Error loading submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
          My Submissions
        </h1>
        <p className="text-sm text-brand-muted mt-1">
          Review all your submitted coursework, submission links, and confirmation timestamps.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-brand-line animate-pulse" />
          ))}
        </div>
      ) : submissions.length > 0 ? (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <Card
              key={sub.id}
              padding="p-5 sm:p-6"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge variant="purple" size="sm">
                    {sub.assignments?.classes?.name || 'Class'}
                  </Badge>
                  <Badge variant="success" size="sm" dot>
                    Submitted
                  </Badge>
                  <span className="text-xs font-semibold text-brand-muted">
                    {sub.assignments?.points || 100} Points
                  </span>
                </div>

                <h3 className="text-base font-bold text-brand-heading">
                  {sub.assignments?.title || 'Assignment'}
                </h3>

                <p className="text-xs text-brand-muted flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Submitted on {formatDisplayDate(sub.submitted_at)} at {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </p>

                {sub.submission_link && (
                  <div className="pt-1">
                    <a
                      href={sanitizeUrl(sub.submission_link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline bg-brand-light px-2.5 py-1 rounded-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{sub.submission_link}</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Eye}
                  onClick={() =>
                    navigate(`/student/assignments/${sub.assignment_id}`, {
                      state: { from: 'assignments', classId: sub.assignment?.class_id },
                    })
                  }
                >
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-16 space-y-3">
          <CheckSquare className="w-14 h-14 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-brand-heading">No submissions yet</h3>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            Once you submit your assignments via the two-step confirmation process, your records will appear here.
          </p>
          <Button variant="primary" onClick={() => navigate('/student')}>
            Go to Assignments
          </Button>
        </Card>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { MessageSquare, Bell, Calendar, Clock, BookOpen, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatTimeAgo, formatDisplayDate } from '../../utils/calculations'
import Card from '../../components/common/Card'
import Badge from '../../components/common/Badge'

export default function StudentAnnouncements() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudentAnnouncements()
  }, [user?.id])

  async function loadStudentAnnouncements() {
    if (!user?.id) return
    try {
      setLoading(true)
      // 1. Get enrolled class IDs
      const { data: memberRows } = await supabase
        .from('class_members')
        .select('class_id')
        .eq('student_id', user.id)

      const classIds = memberRows?.map((m) => m.class_id) || []

      // 2. Fetch announcements for these classes
      let items = []
      if (classIds.length > 0) {
        const { data } = await supabase
          .from('announcements')
          .select(`
            *,
            classes (id, name, subject),
            users:admin_id (id, name, email, avatar)
          `)
          .in('class_id', classIds)
          .eq('is_published', true)
          .order('created_at', { ascending: false })

        items = (data || []).filter((a) => !a.title?.startsWith('[Discussion]'))
      }
      setAnnouncements(items)
    } catch (err) {
      console.error('[StudentAnnouncements] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
          Class Announcements
        </h1>
        <p className="text-sm text-brand-muted mt-1">
          Stay informed about course updates, syllabus changes, and notices from your professors.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-brand-line animate-pulse" />
          ))}
        </div>
      ) : announcements.length > 0 ? (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <Card key={ann.id} padding="p-5 sm:p-6" className="shadow-card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-light text-brand-primary font-bold text-xs flex items-center justify-center">
                    {ann.users?.name?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-brand-heading">
                      {ann.title || 'Course Announcement'}
                    </h4>
                    <p className="text-xs text-brand-muted">
                      {ann.users?.name || 'Professor'} • {formatTimeAgo(ann.created_at)}
                    </p>
                  </div>
                </div>

                <Badge variant="purple" size="sm">
                  {ann.classes?.name || 'Course'}
                </Badge>
              </div>

              <div className="text-xs sm:text-sm text-brand-body leading-relaxed whitespace-pre-line bg-slate-50/70 p-4 rounded-xl border border-brand-line/60">
                {ann.message}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-16 space-y-3">
          <MessageSquare className="w-14 h-14 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-brand-heading">No announcements yet</h3>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            Your professors have not published any announcements to your enrolled classes yet.
          </p>
        </Card>
      )}
    </div>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
import {
  BarChart2,
  Download,
  BookOpen,
  Users,
  Search,
  Sparkles,
  ChevronDown
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { classesService } from '../../services/classes.service'
import { assignmentsService } from '../../services/assignments.service'
import { calculateCompletionRate, exportToCSV } from '../../utils/calculations'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'

export default function GradesGradebook() {
  const { user } = useAuth()

  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadClassData()
  }, [user?.id])

  async function loadClassData() {
    if (!user?.id) return
    try {
      setLoading(true)
      const [fetchedClasses, allAssignments] = await Promise.all([
        classesService.getAdminClasses(user.id),
        assignmentsService.getAdminAssignments(user.id),
      ])

      setClasses(fetchedClasses)
      setAssignments(allAssignments)
      if (fetchedClasses.length > 0) {
        setSelectedClassId(fetchedClasses[0].id)
      }
    } catch (err) {
      console.error('[GradesGradebook] Error loading gradebook:', err)
    } finally {
      setLoading(false)
    }
  }

  const currentClass = useMemo(() => classes.find((c) => c.id === selectedClassId), [classes, selectedClassId])
  const classAssignments = useMemo(() => assignments.filter((a) => a.class_id === selectedClassId), [assignments, selectedClassId])
  const enrolledStudents = useMemo(() => currentClass?.class_members?.map((m) => m.users).filter(Boolean) || [], [currentClass])

  // Calculate scores and letters per student using O(1) submission lookup Maps
  const studentGrades = useMemo(() => {
    const submissionMapsByAssignment = new Map(
      classAssignments.map((a) => [
        a.id,
        new Map((a.submissions || []).filter((s) => s?.student_id).map((s) => [s.student_id, s])),
      ])
    )

    return enrolledStudents.map((student, idx) => {
      let totalEarned = 0
      let totalPossible = 0
      const scores = {}

      classAssignments.forEach((assignment) => {
        const sub = submissionMapsByAssignment.get(assignment.id)?.get(student.id)
        const pts = Number(assignment.points) || 100
        totalPossible += pts
        if (sub) {
          scores[assignment.id] = pts
          totalEarned += pts
        } else {
          scores[assignment.id] = 0
        }
      })

      const percent = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0
      let letter = 'A+'
      if (percent < 50) letter = 'F'
      else if (percent < 60) letter = 'C'
      else if (percent < 70) letter = 'B'
      else if (percent < 80) letter = 'B+'
      else if (percent < 90) letter = 'A-'
      else letter = 'A'

      return {
        id: student.id,
        name: student.name || `Student ${idx + 1}`,
        email: student.email,
        student_id: student.student_id || `MCA2600${idx + 1}`,
        scores,
        totalEarned,
        totalPossible,
        percent,
        letter,
      }
    })
  }, [enrolledStudents, classAssignments])

  // Filter students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return studentGrades
    const q = searchQuery.toLowerCase()
    return studentGrades.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.student_id.toLowerCase().includes(q)
    )
  }, [studentGrades, searchQuery])

  // Class completion rate (memoized)
  const classAvgCompletion = useMemo(() => {
    let totalSubmissions = 0
    let totalAllocated = 0
    classAssignments.forEach((a) => {
      totalSubmissions += a.submissions?.length || 0
      totalAllocated += enrolledStudents.length
    })
    return calculateCompletionRate(totalSubmissions, totalAllocated)
  }, [classAssignments, enrolledStudents.length])

  // Export Grades handler
  const handleExportGrades = () => {
    if (!currentClass || studentGrades.length === 0) return

    const exportRows = studentGrades.map((s, i) => {
      const row = {
        index: i + 1,
        name: s.name,
        student_id: s.student_id,
        email: s.email,
      }
      classAssignments.forEach((a) => {
        row[a.id] = `${s.scores[a.id] || 0} / ${a.points}`
      })
      row.overall = `${s.totalEarned} / ${s.totalPossible} (${s.percent}%)`
      row.grade = s.letter
      return row
    })

    const headers = [
      { key: 'index', label: '#' },
      { key: 'name', label: 'Student Name' },
      { key: 'student_id', label: 'Student ID' },
      { key: 'email', label: 'Email' },
      ...classAssignments.map((a) => ({ key: a.id, label: `${a.title} (${a.points})` })),
      { key: 'overall', label: 'Overall Score' },
      { key: 'grade', label: 'Grade' },
    ]

    exportToCSV(`Grades_${currentClass.name.replace(/\s+/g, '_')}`, exportRows, headers)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-heading tracking-tight">
            Class Gradebook & Performance
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Evaluate overall assignment submissions, grade distributions, and export grade records.
          </p>
        </div>

        <Button
          variant="primary"
          icon={Download}
          onClick={handleExportGrades}
          className="self-start sm:self-auto shadow-purple-glow font-semibold"
        >
          Export Grades (CSV)
        </Button>
      </div>

      {/* Class Selector & Class Performance Banner */}
      {currentClass && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Class Hero Banner */}
          <div className="lg:col-span-8 purple-gradient-banner rounded-2xl p-6 text-white shadow-card flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="bg-white/20 hover:bg-white/30 text-white font-bold text-xl sm:text-2xl rounded-lg px-2 py-1 border border-white/20 focus:outline-none cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id} className="text-brand-heading">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-white/80 text-sm font-medium">
                {currentClass.subject || 'Coursework'} • {classAssignments.length} Assignments Published
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4 text-xs font-semibold">
              <span className="bg-white/15 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {enrolledStudents.length} Students
              </span>
            </div>
          </div>

          {/* Performance Rate Pill */}
          <Card padding="p-6" className="lg:col-span-4 flex flex-col justify-center space-y-2 shadow-card">
            <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">
              Class Performance
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-brand-primary">
                {classAvgCompletion}%
              </span>
              <span className="text-xs font-semibold text-brand-muted">
                Avg. Completion
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-brand-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${classAvgCompletion}%` }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Gradebook Table matching reference mockup */}
      <Card padding="p-0" className="overflow-hidden shadow-card">
        {/* Table Header controls */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-brand-line/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-brand-primary" />
            <h3 className="font-bold text-sm text-brand-heading">
              Student Grade Registry ({filteredStudents.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student..."
              className="w-full rounded-full border border-brand-line bg-slate-50 pl-9 pr-4 py-1.5 text-xs sm:text-sm focus:bg-white focus:border-brand-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-brand-line/60 text-brand-muted uppercase text-[11px] font-bold">
              <tr>
                <th className="py-3.5 px-4">#</th>
                <th className="py-3.5 px-4">Student Name</th>
                <th className="py-3.5 px-4">Student ID</th>
                {classAssignments.map((a) => (
                  <th key={a.id} className="py-3.5 px-4 text-center">
                    <span className="truncate block max-w-[140px] mx-auto">{a.title} ({a.points})</span>
                  </th>
                ))}
                <th className="py-3.5 px-4 text-center font-extrabold text-brand-heading">Overall</th>
                <th className="py-3.5 px-4 text-center">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line/50">
              {filteredStudents.map((student, idx) => {
                const initials = student.name
                  ? student.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .substring(0, 2)
                  : 'ST'

                return (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-slate-400 font-semibold">{idx + 1}</td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-light text-brand-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-brand-heading">{student.name}</p>
                          <p className="text-[11px] text-brand-muted">{student.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-brand-heading">
                      {student.student_id}
                    </td>

                    {/* Columns per assignment */}
                    {classAssignments.map((a) => {
                      const score = student.scores[a.id]
                      return (
                        <td key={a.id} className="py-3.5 px-4 text-center font-medium">
                          {score > 0 ? (
                            <span className="text-emerald-700 font-semibold">{score} / {a.points}</span>
                          ) : (
                            <span className="text-slate-400">0 / {a.points}</span>
                          )}
                        </td>
                      )
                    })}

                    {/* Overall Score */}
                    <td className="py-3.5 px-4 text-center font-bold text-brand-heading">
                      {student.totalEarned} / {student.totalPossible}
                    </td>

                    {/* Letter Grade Badge */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {student.letter}
                      </span>
                    </td>
                  </tr>
                )
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5 + classAssignments.length} className="py-12 text-center text-xs text-brand-muted">
                    No students currently enrolled in this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

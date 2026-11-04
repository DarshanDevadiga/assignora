/**
 * Assignora – Seed Submissions Script
 * 
 * Inserts realistic submissions adhering to Supabase Row-Level Security:
 * 1. Signs in as each student to insert their respective submissions.
 * 2. Signs in as admin to apply grades and feedback.
 * 3. Creates grade notifications for students.
 */

import fs from 'node:fs'
import path from 'node:path'

// Load local .env into process.env if running directly via Node.js
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const k = trimmed.substring(0, idx).trim()
      const v = trimmed.substring(idx + 1).trim()
      if (!process.env[k]) process.env[k] = v
    }
  }
}

import { supabase } from '../src/lib/supabase.js'

const ADMIN_CREDENTIALS = {
  email: 'admin@assignora.demo',
  password: 'Admin@12345',
}

const STUDENTS = [
  {
    id: '823bfee8-f844-44fd-a7ee-786ac161930e',
    name: 'Rahul Sharma',
    email: 'student1@assignora.demo',
    password: 'Student@123',
    student_id: 'MCA26001',
  },
  {
    id: 'fb5103de-e56d-43db-80eb-6c74942f9c14',
    name: 'Ananya Verma',
    email: 'student2@assignora.demo',
    password: 'Student@123',
    student_id: 'MBA26002',
  },
  {
    id: '1a2ce826-bd8f-4afc-93da-c97e5a14164f',
    name: 'Rohan Gupta',
    email: 'student3@assignora.demo',
    password: 'Student@123',
    student_id: 'MBA26003',
  },
  {
    id: 'ef4c13dc-04df-4f91-a2aa-5d420cde2ebb',
    name: 'Sneha Reddy',
    email: 'student4@assignora.demo',
    password: 'Student@123',
    student_id: 'MBA26004',
  },
]

// Data definitions mapping assignments to submissions
const CLASS_SUBMISSIONS = [
  {
    className: 'Principles of Management',
    assignments: [
      {
        title: 'Management Principles Case Study',
        submissions: [
          {
            student: STUDENTS[0], // Rahul - Graded
            status: 'reviewed',
            submitted_at: '2026-11-02T14:30:00Z',
            link: 'https://drive.google.com/file/d/1_Rahul_Mgmt_CaseStudy.pdf/view',
            text: 'Detailed analytical case study on Tata Group managerial structure and leadership principles.',
            grade: 92,
            feedback: 'Excellent analysis with clear practical examples and sound strategic framework.',
          },
          {
            student: STUDENTS[1], // Ananya - Awaiting review
            status: 'submitted',
            submitted_at: '2026-11-03T10:15:00Z',
            link: 'https://drive.google.com/file/d/2_Ananya_Mgmt_Principles.pdf/view',
            text: 'Report submitted analysing managerial planning and agile organizational matrices.',
            grade: null,
            feedback: '',
          },
        ],
      },
      {
        title: 'Leadership Styles Analysis',
        submissions: [
          {
            student: STUDENTS[1], // Ananya - Graded
            status: 'reviewed',
            submitted_at: '2026-11-01T16:00:00Z',
            link: 'https://drive.google.com/file/d/3_Ananya_Leadership_Analysis.pdf/view',
            text: 'Comparative review of autocratic vs transformational leaders in Fortune 500 tech.',
            grade: 46,
            feedback: 'Insightful comparison and thoughtful real-world case citations.',
          },
        ],
      },
      {
        title: 'Organisational Structure Report',
        submissions: [
          {
            student: STUDENTS[0], // Rahul - On-time & Graded
            status: 'reviewed',
            submitted_at: '2026-10-24T18:20:00Z',
            link: 'https://drive.google.com/file/d/4_Rahul_OrgStructure_Report.pdf/view',
            text: 'Evaluation of Matrix and Functional structures in global multi-national corporations.',
            grade: 88,
            feedback: 'Well-organised submission. Sound theoretical grounding with solid diagrammatic models.',
          },
          {
            student: STUDENTS[2], // Rohan - Late & Graded
            status: 'reviewed',
            submitted_at: '2026-10-27T11:45:00Z',
            link: 'https://drive.google.com/file/d/5_Rohan_Matrix_Structure.pdf/view',
            text: 'Late submission due to medical leave. Contains functional hierarchy assessment.',
            grade: 75,
            feedback: 'Good effort. Solid structure analysis, though penalty applied for late submission.',
          },
        ],
      },
    ],
  },
  {
    className: 'Financial Management',
    assignments: [
      {
        title: 'Financial Statement Analysis',
        submissions: [
          {
            student: STUDENTS[1], // Ananya - Graded
            status: 'reviewed',
            submitted_at: '2026-11-01T09:30:00Z',
            link: 'https://drive.google.com/file/d/6_Ananya_FinAnalysis_DuPont.pdf/view',
            text: 'Financial ratio analysis of Reliance Industries for fiscal years 2024-2026.',
            grade: 95,
            feedback: 'Masterful analysis with deep insights on DuPont breakdown and capital efficiency.',
          },
          {
            student: STUDENTS[3], // Sneha - Awaiting review
            status: 'submitted',
            submitted_at: '2026-11-03T18:10:00Z',
            link: 'https://drive.google.com/file/d/7_Sneha_FinStatements.pdf/view',
            text: 'Solvency and profitability ratios calculated from BSE listed manufacturing data.',
            grade: null,
            feedback: '',
          },
        ],
      },
      {
        title: 'Capital Budgeting Case Study',
        submissions: [
          {
            student: STUDENTS[2], // Rohan - Awaiting review
            status: 'submitted',
            submitted_at: '2026-11-02T13:40:00Z',
            link: 'https://drive.google.com/file/d/8_Rohan_NPV_Model.pdf/view',
            text: 'Investment appraisal spreadsheet model comparing Project Alpha vs Project Beta.',
            grade: null,
            feedback: '',
          },
        ],
      },
      {
        title: 'Working Capital Management Report',
        submissions: [
          {
            student: STUDENTS[3], // Sneha - On-time & Graded
            status: 'reviewed',
            submitted_at: '2026-10-27T16:15:00Z',
            link: 'https://drive.google.com/file/d/9_Sneha_WorkingCapital.pdf/view',
            text: 'Optimizing cash conversion cycles and receivables management in FMCG distribution.',
            grade: 86,
            feedback: 'Thorough coverage of operating cycles. Good recommendations on credit terms.',
          },
          {
            student: STUDENTS[1], // Ananya - Late & Graded
            status: 'reviewed',
            submitted_at: '2026-10-30T09:20:00Z',
            link: 'https://drive.google.com/file/d/10_Ananya_CashCycle_Report.pdf/view',
            text: 'Inventory turnover optimization report with sensitivity analysis.',
            grade: 80,
            feedback: 'High quality modeling. Deduction made for late submission past the Oct 28 deadline.',
          },
        ],
      },
    ],
  },
  {
    className: 'Marketing Management',
    assignments: [
      {
        title: 'Consumer Behaviour Analysis',
        submissions: [
          {
            student: STUDENTS[0], // Rahul - Graded
            status: 'reviewed',
            submitted_at: '2026-11-01T11:00:00Z',
            link: 'https://drive.google.com/file/d/11_Rahul_ConsumerBehavior.pdf/view',
            text: 'Consumer adoption of EV vehicles in tier-1 urban markets.',
            grade: 89,
            feedback: 'Compelling consumer survey synthesis with solid behavioral psychology application.',
          },
          {
            student: STUDENTS[2], // Rohan - Awaiting review
            status: 'submitted',
            submitted_at: '2026-11-03T17:30:00Z',
            link: 'https://drive.google.com/file/d/12_Rohan_Consumer_Research.pdf/view',
            text: 'Decision-making journey and cognitive dissonance in smartphone purchases.',
            grade: null,
            feedback: '',
          },
        ],
      },
      {
        title: 'Digital Marketing Strategy',
        submissions: [
          {
            student: STUDENTS[3], // Sneha - Graded
            status: 'reviewed',
            submitted_at: '2026-11-02T12:00:00Z',
            link: 'https://drive.google.com/file/d/13_Sneha_DigitalStrategy.pdf/view',
            text: 'Comprehensive D2C brand acquisition funnel and ROAS projections.',
            grade: 48,
            feedback: 'Exceptional digital acquisition strategy with realistic unit economics.',
          },
        ],
      },
      {
        title: 'Brand Positioning Case Study',
        submissions: [
          {
            student: STUDENTS[2], // Rohan - On-time & Graded
            status: 'reviewed',
            submitted_at: '2026-10-29T14:10:00Z',
            link: 'https://drive.google.com/file/d/14_Rohan_Brand_Positioning.pdf/view',
            text: 'Perceptual positioning map comparing Indian quick-commerce delivery apps.',
            grade: 84,
            feedback: 'Well-structured perceptual map. Deep insights into consumer value drivers.',
          },
          {
            student: STUDENTS[0], // Rahul - Late & Graded
            status: 'reviewed',
            submitted_at: '2026-11-01T10:15:00Z',
            link: 'https://drive.google.com/file/d/15_Rahul_Brand_Strategy.pdf/view',
            text: 'Differentiation strategies in luxury apparel brand management.',
            grade: 76,
            feedback: 'Good work on differentiation attributes. Points deducted for late turn in.',
          },
        ],
      },
    ],
  },
  {
    className: 'Business Analytics',
    assignments: [
      {
        title: 'Business Sales Data Analysis',
        submissions: [
          {
            student: STUDENTS[1], // Ananya - Graded
            status: 'reviewed',
            submitted_at: '2026-11-01T14:00:00Z',
            link: 'https://drive.google.com/file/d/16_Ananya_Sales_EDA.pdf/view',
            text: 'Multivariate exploratory data analysis with seasonal decomposition and ARIMA forecasting.',
            grade: 98,
            feedback: 'Brilliant statistical rigor, impeccable chart design, and actionable business insights.',
          },
          {
            student: STUDENTS[0], // Rahul - Awaiting review
            status: 'submitted',
            submitted_at: '2026-11-03T11:30:00Z',
            link: 'https://drive.google.com/file/d/17_Rahul_Retail_Analytics.pdf/view',
            text: 'Cohort analysis and customer lifetime value prediction using Python Pandas.',
            grade: null,
            feedback: '',
          },
        ],
      },
      {
        title: 'Dashboard Design and Interpretation',
        submissions: [
          {
            student: STUDENTS[3], // Sneha - Graded
            status: 'reviewed',
            submitted_at: '2026-11-02T15:45:00Z',
            link: 'https://drive.google.com/file/d/18_Sneha_Executive_Dashboard.pdf/view',
            text: 'Interactive Tableau and Google Sheets sales performance dashboard with drilldowns.',
            grade: 47,
            feedback: 'Visually polished layout with effective visual hierarchy and clear executive takeaways.',
          },
        ],
      },
      {
        title: 'Statistical Analysis Report',
        submissions: [
          {
            student: STUDENTS[0], // Rahul - On-time & Graded
            status: 'reviewed',
            submitted_at: '2026-10-26T16:20:00Z',
            link: 'https://drive.google.com/file/d/19_Rahul_Hypothesis_Testing.pdf/view',
            text: 'Two-sample t-tests and two-way ANOVA examining regional conversion rates.',
            grade: 91,
            feedback: 'Sound methodology. Correct interpretation of p-values and confidence intervals.',
          },
          {
            student: STUDENTS[1], // Ananya - Late & Graded
            status: 'reviewed',
            submitted_at: '2026-10-29T10:00:00Z',
            link: 'https://drive.google.com/file/d/20_Ananya_ANOVA_Report.pdf/view',
            text: 'Regression diagnostics and collinearity assessment on pricing elasticity.',
            grade: 82,
            feedback: 'Excellent econometric model. Modest penalty incurred for submission past Oct 27.',
          },
        ],
      },
    ],
  },
  {
    className: 'Information Technology for Business',
    assignments: [
      {
        title: 'Database Design and ER Diagram',
        submissions: [
          {
            student: STUDENTS[0], // Rahul - Graded
            status: 'reviewed',
            submitted_at: '2026-11-01T16:00:00Z',
            link: 'https://drive.google.com/file/d/21_Rahul_ERD_Schema.pdf/view',
            text: 'Normalized E-Commerce database schema with crowd-foot ERD and PostgreSQL DDL.',
            grade: 97,
            feedback: 'Flawless 3NF normalization with optimal indexing strategies and foreign key constraints.',
          },
          {
            student: STUDENTS[1], // Ananya - Graded
            status: 'reviewed',
            submitted_at: '2026-11-02T11:00:00Z',
            link: 'https://drive.google.com/file/d/22_Ananya_Relational_Model.pdf/view',
            text: 'Hospital management system relational model with stored procedures.',
            grade: 93,
            feedback: 'Solid entity relationships. Good job defining cascading referential integrity.',
          },
          {
            student: STUDENTS[2], // Rohan - Awaiting review
            status: 'submitted',
            submitted_at: '2026-11-03T18:00:00Z',
            link: 'https://drive.google.com/file/d/23_Rohan_Database_DDL.pdf/view',
            text: 'Inventory management database architecture with query execution plans.',
            grade: null,
            feedback: '',
          },
        ],
      },
      {
        title: 'Cloud Computing in Business',
        submissions: [
          {
            student: STUDENTS[3], // Sneha - Graded
            status: 'reviewed',
            submitted_at: '2026-11-02T13:30:00Z',
            link: 'https://drive.google.com/file/d/24_Sneha_Cloud_Migration.pdf/view',
            text: 'AWS vs Azure total cost of ownership study for financial services workload.',
            grade: 48,
            feedback: 'Exceptional architectural diagrams and well-justified multi-region disaster recovery.',
          },
        ],
      },
      {
        title: 'Cybersecurity Risk Assessment',
        submissions: [
          {
            student: STUDENTS[1], // Ananya - On-time & Graded
            status: 'reviewed',
            submitted_at: '2026-10-28T14:40:00Z',
            link: 'https://drive.google.com/file/d/25_Ananya_CyberRisk_NIST.pdf/view',
            text: 'Threat modeling and STRIDE analysis on enterprise healthcare web portal.',
            grade: 94,
            feedback: 'Thorough threat mitigation matrix with strong alignment to NIST SP 800-30.',
          },
          {
            student: STUDENTS[2], // Rohan - Late & Graded
            status: 'reviewed',
            submitted_at: '2026-10-31T12:00:00Z',
            link: 'https://drive.google.com/file/d/26_Rohan_Vulnerability_Audit.pdf/view',
            text: 'Penetration testing report and zero-trust architecture transition plan.',
            grade: 81,
            feedback: 'Good technical vulnerability depth. Late submission penalty applied.',
          },
          {
            student: STUDENTS[0], // Rahul - On-time & Graded
            status: 'reviewed',
            submitted_at: '2026-10-27T17:15:00Z',
            link: 'https://drive.google.com/file/d/27_Rahul_SecAudit_NIST.pdf/view',
            text: 'NIST cybersecurity posture analysis and incident response runbook.',
            grade: 92,
            feedback: 'Well-structured incident response workflows and proactive mitigation controls.',
          },
        ],
      },
    ],
  },
]

async function seedSubmissions() {
  console.log('🚀 Starting Submissions Seeding across 5 classes...\n')

  // Sign in as admin first to fetch assignments mapping
  const { error: initialAdminAuthErr } = await supabase.auth.signInWithPassword(ADMIN_CREDENTIALS)
  if (initialAdminAuthErr) {
    console.error('Failed to sign in as admin for initial lookup:', initialAdminAuthErr)
    return
  }

  // Fetch assignments mapping
  const { data: assignments, error: aErr } = await supabase
    .from('assignments')
    .select('id, title, class_id, points, classes (id, name)')

  if (aErr) {
    console.error('Failed to fetch assignments:', aErr)
    return
  }

  const assignmentLookup = new Map()
  for (const a of assignments) {
    const key = `${a.classes?.name || ''}::${a.title}`
    assignmentLookup.set(key, a)
  }

  // Flatten all submissions into student buckets
  const studentSubmissionsMap = new Map()
  for (const student of STUDENTS) {
    studentSubmissionsMap.set(student.id, [])
  }

  const allGradedTasks = []

  for (const classData of CLASS_SUBMISSIONS) {
    for (const aData of classData.assignments) {
      const assignment = assignmentLookup.get(`${classData.className}::${aData.title}`)
      if (!assignment) {
        console.warn(`⚠️ Assignment not found: ${classData.className} -> "${aData.title}"`)
        continue
      }

      for (const sub of aData.submissions) {
        const studentTasks = studentSubmissionsMap.get(sub.student.id)
        if (studentTasks) {
          studentTasks.push({
            assignmentId: assignment.id,
            assignmentTitle: aData.title,
            className: classData.className,
            points: assignment.points,
            sub,
          })
        }
        if (sub.status === 'reviewed' && sub.grade !== null) {
          allGradedTasks.push({
            assignmentId: assignment.id,
            assignmentTitle: aData.title,
            studentId: sub.student.id,
            studentName: sub.student.name,
            points: assignment.points,
            grade: sub.grade,
            feedback: sub.feedback,
            submittedAt: sub.submitted_at,
          })
        }
      }
    }
  }

  // STEP 1: Insert submissions as each student
  let totalInserted = 0
  for (const student of STUDENTS) {
    const tasks = studentSubmissionsMap.get(student.id) || []
    if (tasks.length === 0) continue

    console.log(`\n🔑 Signing in as ${student.name} (${student.email})...`)
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: student.email,
      password: student.password,
    })

    if (authErr) {
      console.error(`❌ Authentication failed for ${student.email}:`, authErr)
      continue
    }

    for (const task of tasks) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('submissions')
        .select('id')
        .eq('assignment_id', task.assignmentId)
        .eq('student_id', student.id)
        .maybeSingle()

      if (existing) {
        console.log(`  ℹ️ Submission already exists for "${task.assignmentTitle}"`)
        continue
      }

      const initialComment = JSON.stringify({
        text: task.sub.text,
        grade: null,
        feedback: '',
      })

      const { data: inserted, error: insErr } = await supabase
        .from('submissions')
        .insert({
          assignment_id: task.assignmentId,
          student_id: student.id,
          submission_link: task.sub.link,
          comment: initialComment,
          status: 'submitted',
          submitted_at: task.sub.submitted_at,
          updated_at: task.sub.submitted_at,
        })
        .select()
        .single()

      if (insErr) {
        console.error(`  ❌ Failed to insert submission for "${task.assignmentTitle}":`, insErr.message)
      } else {
        totalInserted++
        console.log(`  ✅ Submitted: "${task.assignmentTitle}" (${task.className})`)
      }
    }
  }

  // STEP 2: Sign in as Admin to grade and provide feedback
  console.log(`\n🔑 Signing in as Admin to apply grades and feedback...`)
  const { error: adminAuthErr } = await supabase.auth.signInWithPassword(ADMIN_CREDENTIALS)
  if (adminAuthErr) {
    console.error('❌ Admin authentication failed:', adminAuthErr)
    return
  }

  let totalGraded = 0
  let notificationsAdded = 0

  for (const graded of allGradedTasks) {
    const { data: existingSub } = await supabase
      .from('submissions')
      .select('id, comment')
      .eq('assignment_id', graded.assignmentId)
      .eq('student_id', graded.studentId)
      .maybeSingle()

    if (!existingSub) {
      console.warn(`  ⚠️ Cannot grade: Submission not found for ${graded.studentName} on "${graded.assignmentTitle}"`)
      continue
    }

    let existingText = ''
    try {
      const parsed = JSON.parse(existingSub.comment)
      existingText = parsed.text || ''
    } catch {
      existingText = existingSub.comment || ''
    }

    const updatedComment = JSON.stringify({
      text: existingText,
      grade: graded.grade,
      feedback: graded.feedback,
    })

    const { error: gradeErr } = await supabase
      .from('submissions')
      .update({
        status: 'reviewed',
        comment: updatedComment,
        updated_at: graded.submittedAt,
      })
      .eq('id', existingSub.id)

    if (gradeErr) {
      console.error(`  ❌ Failed to grade submission for ${graded.studentName}:`, gradeErr.message)
    } else {
      totalGraded++
      console.log(`  🏆 Graded: ${graded.studentName} on "${graded.assignmentTitle}" -> ${graded.grade}/${graded.points} pts`)

      // Check if notification already exists
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', graded.studentId)
        .eq('reference_id', graded.assignmentId)
        .eq('type', 'submission')
        .maybeSingle()

      if (!existingNotif) {
        const { error: nErr } = await supabase.from('notifications').insert({
          user_id: graded.studentId,
          title: `Assignment Graded: ${graded.assignmentTitle}`,
          message: `Your score: ${graded.grade}/${graded.points} pts. Feedback: "${graded.feedback}"`,
          type: 'submission',
          reference_id: graded.assignmentId,
          is_read: false,
          created_at: graded.submittedAt,
        })
        if (!nErr) notificationsAdded++
      }
    }
  }

  console.log(`\n========================================`)
  console.log(`🎉 SUBMISSION SEEDING SUMMARY`)
  console.log(`========================================`)
  console.log(`Total Submissions Inserted : ${totalInserted}`)
  console.log(`Total Submissions Graded   : ${totalGraded}`)
  console.log(`Grade Notifications Added : ${notificationsAdded}`)
  console.log(`========================================\n`)
}

seedSubmissions().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

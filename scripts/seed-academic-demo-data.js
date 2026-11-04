/**
 * Assignora – Comprehensive Academic Sample Data Seeder
 * Populates 5 complete realistic classes with assignments, student enrolments,
 * submissions, grades, announcements, discussion messages, and notifications.
 *
 * Idempotent: Can be executed multiple times safely without duplicate records.
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

const ADMIN_ID = '4eb63857-af15-4b31-be12-58ab7c426953'

const STUDENTS = [
  {
    id: '823bfee8-f844-44fd-a7ee-786ac161930e',
    name: 'Rahul Sharma',
    email: 'student1@assignora.demo',
    student_id: 'MCA26001',
  },
  {
    id: 'fb5103de-e56d-43db-80eb-6c74942f9c14',
    name: 'Ananya Verma',
    email: 'student2@assignora.demo',
    student_id: 'MBA26002',
  },
  {
    id: '1a2ce826-bd8f-4afc-93da-c97e5a14164f',
    name: 'Rohan Gupta',
    email: 'student3@assignora.demo',
    student_id: 'MBA26003',
  },
  {
    id: 'ef4c13dc-04df-4f91-a2aa-5d420cde2ebb',
    name: 'Sneha Reddy',
    email: 'student4@assignora.demo',
    student_id: 'MBA26004',
  },
]

const CLASSES_CONFIG = [
  {
    name: 'Principles of Management',
    subject: 'Management Studies',
    description:
      'Understanding management principles, planning, leadership, organisational structures and business decision-making.',
    created_at: '2026-10-01T09:00:00Z',
    students: [STUDENTS[0], STUDENTS[1], STUDENTS[2]], // Rahul, Ananya, Rohan
    assignments: [
      {
        title: 'Management Principles Case Study',
        points: 100,
        due_date: '2026-11-10',
        due_time: '23:59:00',
        description:
          'Analyse the management practices of a recognised organisation. Explain planning, organising, leadership and controlling.',
        drive_link: 'https://drive.google.com/drive/folders/1_Mgmt_Principles_CaseStudy',
        submissions: [
          {
            student: STUDENTS[0], // Rahul - Submitted & Graded
            status: 'reviewed',
            submitted_at: '2026-11-02T14:30:00Z',
            link: 'https://drive.google.com/file/d/1_Rahul_Mgmt_CaseStudy.pdf/view',
            text: 'Detailed analytical case study on Tata Group managerial structure and leadership principles.',
            grade: 92,
            feedback: 'Excellent analysis with clear practical examples and sound strategic framework.',
          },
          {
            student: STUDENTS[1], // Ananya - Submitted, Awaiting grading
            status: 'submitted',
            submitted_at: '2026-11-03T10:15:00Z',
            link: 'https://drive.google.com/file/d/2_Ananya_Mgmt_Principles.pdf/view',
            text: 'Report submitted analysing managerial planning and agile organizational matrices.',
            grade: null,
            feedback: '',
          },
          // Rohan - Pending (no submission)
        ],
      },
      {
        title: 'Leadership Styles Analysis',
        points: 50,
        due_date: '2026-11-15',
        due_time: '23:59:00',
        description:
          'Compare autocratic, democratic and transformational leadership styles with practical examples.',
        drive_link: 'https://drive.google.com/drive/folders/2_Leadership_Styles_Reference',
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
          // Rahul and Rohan - Pending
        ],
      },
      {
        title: 'Organisational Structure Report',
        points: 100,
        due_date: '2026-10-25',
        due_time: '23:59:00', // Past deadline
        description:
          'Prepare a report comparing functional, divisional and matrix organisational structures.',
        drive_link: 'https://drive.google.com/drive/folders/3_Org_Structures_Guide',
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
            student: STUDENTS[2], // Rohan - Late submission & Graded
            status: 'reviewed',
            submitted_at: '2026-10-27T11:45:00Z', // 2 days late
            link: 'https://drive.google.com/file/d/5_Rohan_Matrix_Structure.pdf/view',
            text: 'Late submission due to medical leave. Contains functional hierarchy assessment.',
            grade: 75,
            feedback: 'Good effort. Solid structure analysis, though penalty applied for late submission.',
          },
          // Ananya - Pending (Overdue)
        ],
      },
    ],
    announcements: [
      {
        title: 'Welcome to Principles of Management',
        message:
          'Welcome students to the Principles of Management course. Please inspect the course syllabus, reference textbooks on OpenStax, and discussion guidelines under the Resources tab before our next lecture.',
        created_at: '2026-10-01T10:00:00Z',
      },
      {
        title: 'Management Principles Case Study Available',
        message:
          'The Management Principles Case Study has been published under the Assignments tab. Ensure you cover planning, organizing, leading, and controlling frameworks.',
        created_at: '2026-10-15T11:00:00Z',
      },
      {
        title: 'Reminder: Leadership Styles Submissions',
        message:
          'Gentle reminder that the Leadership Styles Analysis assignment is due shortly. Please check the submission criteria and rubrics before turning in your PDF deliverable.',
        created_at: '2026-11-01T09:30:00Z',
      },
    ],
    discussions: [
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'Welcome everyone! Please review the course materials on OpenStax and complete the first case study before the deadline.',
        created_at: '2026-10-02T10:15:00Z',
      },
      {
        sender: 'Rahul Sharma',
        role: 'student',
        text: 'Professor, should we submit the case study as an executive PDF or will a presentation deck be acceptable?',
        created_at: '2026-10-03T11:20:00Z',
      },
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'Please submit your comprehensive analysis as a single PDF document. Include your roll number and full citations on the title page.',
        created_at: '2026-10-03T12:00:00Z',
      },
      {
        sender: 'Ananya Verma',
        role: 'student',
        text: 'Thank you Professor, I have reviewed the OpenStax chapter guidelines and prepared the organizational diagram.',
        created_at: '2026-10-04T14:30:00Z',
      },
    ],
  },
  {
    name: 'Financial Management',
    subject: 'Finance & Accounting',
    description:
      'Financial planning, capital budgeting, working capital management, financial analysis and investment decisions.',
    created_at: '2026-10-02T09:00:00Z',
    students: [STUDENTS[1], STUDENTS[2], STUDENTS[3]], // Ananya, Rohan, Sneha
    assignments: [
      {
        title: 'Financial Statement Analysis',
        points: 100,
        due_date: '2026-11-12',
        due_time: '23:59:00',
        description:
          'Perform ratio analysis, liquidity review, and solvency assessment using corporate annual reports.',
        drive_link: 'https://drive.google.com/drive/folders/4_Fin_Statement_Ratios',
        submissions: [
          {
            student: STUDENTS[1], // Ananya - Graded
            status: 'reviewed',
            submitted_at: '2026-11-01T15:20:00Z',
            link: 'https://drive.google.com/file/d/6_Ananya_Ratio_Analysis.pdf/view',
            text: 'Financial ratio analysis of Reliance Industries for fiscal years 2024-2026.',
            grade: 95,
            feedback: 'Masterful analysis with deep insights on DuPont breakdown and capital efficiency.',
          },
          {
            student: STUDENTS[3], // Sneha - Submitted, awaiting grading
            status: 'submitted',
            submitted_at: '2026-11-03T18:10:00Z',
            link: 'https://drive.google.com/file/d/7_Sneha_FinStatements.pdf/view',
            text: 'Solvency and profitability ratios calculated from BSE listed manufacturing data.',
            grade: null,
            feedback: '',
          },
          // Rohan - Pending
        ],
      },
      {
        title: 'Capital Budgeting Case Study',
        points: 50,
        due_date: '2026-11-18',
        due_time: '23:59:00',
        description:
          'Evaluate capital investment alternatives using NPV, IRR, Payback Period, and Profitability Index.',
        drive_link: 'https://drive.google.com/drive/folders/5_Capital_Budgeting_Ref',
        submissions: [
          {
            student: STUDENTS[2], // Rohan - Submitted
            status: 'submitted',
            submitted_at: '2026-11-02T13:40:00Z',
            link: 'https://drive.google.com/file/d/8_Rohan_NPV_Model.pdf/view',
            text: 'Investment appraisal spreadsheet model comparing Project Alpha vs Project Beta.',
            grade: null,
            feedback: '',
          },
          // Ananya and Sneha - Pending
        ],
      },
      {
        title: 'Working Capital Management Report',
        points: 100,
        due_date: '2026-10-28',
        due_time: '23:59:00', // Past deadline
        description:
          'Assess cash conversion cycle, inventory turnover, and receivables management strategies.',
        drive_link: 'https://drive.google.com/drive/folders/6_Working_Capital_Model',
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
            student: STUDENTS[1], // Ananya - Late submission & Graded
            status: 'reviewed',
            submitted_at: '2026-10-30T09:20:00Z', // 2 days late
            link: 'https://drive.google.com/file/d/10_Ananya_CashCycle_Report.pdf/view',
            text: 'Inventory turnover optimization report with sensitivity analysis.',
            grade: 80,
            feedback: 'High quality modeling. Deduction made for late submission past the Oct 28 deadline.',
          },
          // Rohan - Pending (Overdue)
        ],
      },
    ],
    announcements: [
      {
        title: 'Financial Statement Analysis assignment available',
        message:
          'The Financial Statement Analysis assignment is now uploaded. Please download the corporate annual reports and apply the ratio models demonstrated in class.',
        created_at: '2026-10-10T11:00:00Z',
      },
      {
        title: 'Review capital budgeting reference material',
        message:
          'Please review the capital budgeting MIT OpenCourseWare reference readings on discounted cash flows before attempting the Capital Budgeting case study.',
        created_at: '2026-10-18T14:30:00Z',
      },
      {
        title: 'Check your assignment feedback and marks',
        message:
          'Grades and personalized instructor feedback for the Working Capital Management report have been released. Open the assignment details to inspect your evaluation.',
        created_at: '2026-11-02T16:00:00Z',
      },
    ],
    discussions: [
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'Welcome to Financial Management! Make sure to review the DuPont model formulas before working on the ratio assignment.',
        created_at: '2026-10-03T10:00:00Z',
      },
      {
        sender: 'Rohan Gupta',
        role: 'student',
        text: 'Maam, regarding the Capital Budgeting case, should we assume a 10% or 12% discount rate for the NPV calculation?',
        created_at: '2026-10-05T14:20:00Z',
      },
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'Use 10% as your base Weighted Average Cost of Capital (WACC), and provide a sensitivity table for 12% and 8%.',
        created_at: '2026-10-05T15:00:00Z',
      },
      {
        sender: 'Sneha Reddy',
        role: 'student',
        text: 'Understood, thank you! The sensitivity table format is very clear in the reference Google Sheets model.',
        created_at: '2026-10-06T09:40:00Z',
      },
    ],
  },
  {
    name: 'Marketing Management',
    subject: 'Marketing',
    description:
      'Marketing strategies, consumer behaviour, market segmentation, digital marketing and brand management.',
    created_at: '2026-10-03T09:00:00Z',
    students: [STUDENTS[0], STUDENTS[2], STUDENTS[3]], // Rahul, Rohan, Sneha
    assignments: [
      {
        title: 'Consumer Behaviour Analysis',
        points: 100,
        due_date: '2026-11-14',
        due_time: '23:59:00',
        description:
          'Analyse psychological and socio-cultural factors influencing consumer purchasing decisions.',
        drive_link: 'https://drive.google.com/drive/folders/7_Consumer_Behavior_Cases',
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
            student: STUDENTS[2], // Rohan - Submitted
            status: 'submitted',
            submitted_at: '2026-11-03T17:30:00Z',
            link: 'https://drive.google.com/file/d/12_Rohan_Consumer_Research.pdf/view',
            text: 'Decision-making journey and cognitive dissonance in smartphone purchases.',
            grade: null,
            feedback: '',
          },
          // Sneha - Pending
        ],
      },
      {
        title: 'Digital Marketing Strategy',
        points: 50,
        due_date: '2026-11-20',
        due_time: '23:59:00',
        description:
          'Develop an omni-channel digital marketing plan covering SEO, SEM, content strategy, and social media.',
        drive_link: 'https://drive.google.com/drive/folders/8_Digital_Marketing_Blueprint',
        submissions: [
          {
            student: STUDENTS[3], // Sneha - Submitted & Graded
            status: 'reviewed',
            submitted_at: '2026-11-02T12:00:00Z',
            link: 'https://drive.google.com/file/d/13_Sneha_DigitalStrategy.pdf/view',
            text: 'Comprehensive D2C brand acquisition funnel and ROAS projections.',
            grade: 48,
            feedback: 'Exceptional digital acquisition strategy with realistic unit economics.',
          },
          // Rahul and Rohan - Pending
        ],
      },
      {
        title: 'Brand Positioning Case Study',
        points: 100,
        due_date: '2026-10-30',
        due_time: '23:59:00', // Past deadline
        description:
          'Construct perceptual positioning maps and analyse brand differentiation strategies.',
        drive_link: 'https://drive.google.com/drive/folders/9_Brand_Positioning_Maps',
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
            student: STUDENTS[0], // Rahul - Late submission & Graded
            status: 'reviewed',
            submitted_at: '2026-11-01T10:15:00Z', // 2 days late
            link: 'https://drive.google.com/file/d/15_Rahul_Brand_Strategy.pdf/view',
            text: 'Differentiation strategies in luxury apparel brand management.',
            grade: 76,
            feedback: 'Good work on differentiation attributes. Points deducted for late turn in.',
          },
          // Sneha - Pending (Overdue)
        ],
      },
    ],
    announcements: [
      {
        title: 'Welcome to Marketing Management',
        message:
          'Welcome to Marketing Management. Review the Open Textbook Library marketing resources and syllabus in the Resources section.',
        created_at: '2026-10-03T10:00:00Z',
      },
      {
        title: 'Digital Marketing Strategy assignment is available',
        message:
          'The Digital Marketing Strategy assignment has been published. Make sure to define target segments and ROI metrics clearly.',
        created_at: '2026-10-16T12:00:00Z',
      },
      {
        title: 'Please upload your brand positioning report',
        message:
          'Reminder to all students who have not yet submitted: the Brand Positioning report deadline has closed. Late submissions will be evaluated with minor penalties.',
        created_at: '2026-10-31T09:00:00Z',
      },
    ],
    discussions: [
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'Welcome marketing scholars! Be sure to examine how psychological biases affect modern consumer shopping journeys.',
        created_at: '2026-10-04T11:00:00Z',
      },
      {
        sender: 'Sneha Reddy',
        role: 'student',
        text: 'Professor, for the digital campaign budget, are we focusing purely on organic channels or paid performance ads as well?',
        created_at: '2026-10-06T15:10:00Z',
      },
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'Include a balanced split: 60% paid search and social performance, 40% content marketing and SEO.',
        created_at: '2026-10-06T16:00:00Z',
      },
    ],
  },
  {
    name: 'Business Analytics',
    subject: 'Data & Analytics',
    description:
      'Data analysis, business intelligence, statistical methods, dashboards and data-driven decision-making.',
    created_at: '2026-10-04T09:00:00Z',
    students: [STUDENTS[0], STUDENTS[1], STUDENTS[3]], // Rahul, Ananya, Sneha
    assignments: [
      {
        title: 'Business Sales Data Analysis',
        points: 100,
        due_date: '2026-11-16',
        due_time: '23:59:00',
        description:
          'Perform exploratory data analysis and trend forecasting on retail transactional data.',
        drive_link: 'https://drive.google.com/drive/folders/10_Sales_Analytics_Dataset',
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
            student: STUDENTS[0], // Rahul - Submitted
            status: 'submitted',
            submitted_at: '2026-11-03T11:30:00Z',
            link: 'https://drive.google.com/file/d/17_Rahul_Retail_Analytics.pdf/view',
            text: 'Cohort analysis and customer lifetime value prediction using Python Pandas.',
            grade: null,
            feedback: '',
          },
          // Sneha - Pending
        ],
      },
      {
        title: 'Dashboard Design and Interpretation',
        points: 50,
        due_date: '2026-11-22',
        due_time: '23:59:00',
        description:
          'Design executive KPI dashboards with interactive filters, drill-downs, and visual storytelling.',
        drive_link: 'https://drive.google.com/drive/folders/11_Dashboard_KPI_Templates',
        submissions: [
          {
            student: STUDENTS[3], // Sneha - Submitted & Graded
            status: 'reviewed',
            submitted_at: '2026-11-02T15:45:00Z',
            link: 'https://drive.google.com/file/d/18_Sneha_Executive_Dashboard.pdf/view',
            text: 'Interactive Tableau and Google Sheets sales performance dashboard with drilldowns.',
            grade: 47,
            feedback: 'Visually polished layout with effective visual hierarchy and clear executive takeaways.',
          },
          // Rahul and Ananya - Pending
        ],
      },
      {
        title: 'Statistical Analysis Report',
        points: 100,
        due_date: '2026-10-27',
        due_time: '23:59:00', // Past deadline
        description:
          'Apply hypothesis testing, ANOVA, and multivariate regression models to business metrics.',
        drive_link: 'https://drive.google.com/drive/folders/12_Stats_Hypothesis_Cases',
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
            submitted_at: '2026-10-29T10:00:00Z', // 2 days late
            link: 'https://drive.google.com/file/d/20_Ananya_ANOVA_Report.pdf/view',
            text: 'Regression diagnostics and collinearity assessment on pricing elasticity.',
            grade: 82,
            feedback: 'Excellent econometric model. Modest penalty incurred for submission past Oct 27.',
          },
          // Sneha - Pending (Overdue)
        ],
      },
    ],
    announcements: [
      {
        title: 'Business Sales Data Analysis assignment is now available',
        message:
          'The transactional sales dataset is uploaded to the Resources tab. Download the CSV files and begin exploratory data cleaning.',
        created_at: '2026-10-12T10:00:00Z',
      },
      {
        title: 'Dashboard Design resources have been uploaded',
        message:
          'Please inspect the MIT OCW analytics lecture slides and Google Sheets template before finalizing your KPI dashboard layout.',
        created_at: '2026-10-20T14:00:00Z',
      },
      {
        title: 'Please review your statistical analysis feedback',
        message:
          'Evaluations for the Statistical Analysis Report have been posted. Verify your scores, p-value justifications, and instructor remarks.',
        created_at: '2026-10-30T11:00:00Z',
      },
    ],
    discussions: [
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'Welcome to Business Analytics! Data is only as useful as the decisions it drives. Let us focus on actionable insights.',
        created_at: '2026-10-05T09:30:00Z',
      },
      {
        sender: 'Rahul Sharma',
        role: 'student',
        text: 'Professor, are we required to clean null values with mean imputation or forward fill for the sales dataset?',
        created_at: '2026-10-07T14:15:00Z',
      },
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'For missing transactional timestamps, drop incomplete rows. For numerical quantities, use median imputation due to skewness.',
        created_at: '2026-10-07T15:00:00Z',
      },
      {
        sender: 'Ananya Verma',
        role: 'student',
        text: 'Thank you Professor! That resolved our variance inflation factor concern as well.',
        created_at: '2026-10-08T11:20:00Z',
      },
    ],
  },
  {
    name: 'Information Technology for Business',
    subject: 'Information Technology',
    description:
      'Business information systems, database management, cloud computing, cybersecurity and digital transformation.',
    created_at: '2026-10-05T09:00:00Z',
    students: [STUDENTS[0], STUDENTS[1], STUDENTS[2], STUDENTS[3]], // All 4 students
    assignments: [
      {
        title: 'Database Design and ER Diagram',
        points: 100,
        due_date: '2026-11-17',
        due_time: '23:59:00',
        description:
          'Develop conceptual and logical entity-relationship schemas, normalization up to 3NF, and SQL DDL.',
        drive_link: 'https://drive.google.com/drive/folders/13_ERD_Database_Design',
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
            student: STUDENTS[2], // Rohan - Submitted
            status: 'submitted',
            submitted_at: '2026-11-03T18:00:00Z',
            link: 'https://drive.google.com/file/d/23_Rohan_Database_DDL.pdf/view',
            text: 'Inventory management database architecture with query execution plans.',
            grade: null,
            feedback: '',
          },
          // Sneha - Pending
        ],
      },
      {
        title: 'Cloud Computing in Business',
        points: 50,
        due_date: '2026-11-23',
        due_time: '23:59:00',
        description:
          'Evaluate IaaS, PaaS, and SaaS migration architectures, cost models, and SLAs for enterprise.',
        drive_link: 'https://drive.google.com/drive/folders/14_Cloud_Migration_Cases',
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
          // Rahul, Ananya, Rohan - Pending
        ],
      },
      {
        title: 'Cybersecurity Risk Assessment',
        points: 100,
        due_date: '2026-10-29',
        due_time: '23:59:00', // Past deadline
        description:
          'Conduct threat modelling, vulnerability assessment, and risk mitigation planning using NIST framework.',
        drive_link: 'https://drive.google.com/drive/folders/15_Cybersecurity_Risk_Assess',
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
            submitted_at: '2026-10-31T12:00:00Z', // 2 days late
            link: 'https://drive.google.com/file/d/26_Rohan_Vulnerability_Audit.pdf/view',
            text: 'Penetration testing report and zero-trust architecture transition plan.',
            grade: 81,
            feedback: 'Good technical vulnerability depth. Late submission penalty applied.',
          },
          {
            student: STUDENTS[0], // Rahul - On-time & Graded
            status: 'reviewed',
            submitted_at: '2026-10-28T17:15:00Z',
            link: 'https://drive.google.com/file/d/27_Rahul_Security_Controls.pdf/view',
            text: 'Zero trust security framework and identity management audit.',
            grade: 90,
            feedback: 'Well-structured defense-in-depth model with realistic mitigation timelines.',
          },
          // Sneha - Pending (Overdue)
        ],
      },
    ],
    announcements: [
      {
        title: 'Welcome to Information Technology for Business',
        message:
          'Welcome to IT for Business. Please inspect the open textbook on Information Systems, MIT OCW cloud engineering resources, and lab syllabus under the Resources tab.',
        created_at: '2026-10-05T10:00:00Z',
      },
      {
        title: 'Database Design assignment instructions are available',
        message:
          'Database Design and ERD project requirements are now live. Make sure schemas satisfy 3NF normalization rules.',
        created_at: '2026-10-18T11:00:00Z',
      },
      {
        title: 'Review the cybersecurity resources before submission',
        message:
          'All students enrolled in IT for Business: Please review the NIST SP 800-30 risk matrix in Google Sheets before your next submission.',
        created_at: '2026-10-25T15:00:00Z',
      },
    ],
    discussions: [
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'Welcome to IT for Business! We will cover database normalization, enterprise cloud infrastructure, and zero-trust security.',
        created_at: '2026-10-06T10:00:00Z',
      },
      {
        sender: 'Rohan Gupta',
        role: 'student',
        text: 'Professor, will our SQL DDL need to include stored procedures or just tables and indexes for the Database assignment?',
        created_at: '2026-10-08T16:20:00Z',
      },
      {
        sender: 'Prof. Anitha R.',
        role: 'admin',
        text: 'Primary emphasis is on normalized DDL with primary and foreign key constraints. Stored procedures can earn bonus marks.',
        created_at: '2026-10-08T17:00:00Z',
      },
      {
        sender: 'Rahul Sharma',
        role: 'student',
        text: 'Understood, thank you Professor! I have added indexing benchmarks as well.',
        created_at: '2026-10-09T11:45:00Z',
      },
    ],
  },
]

export async function seedAcademicDemoData() {
  console.log('=== STARTING ACADEMIC DEMO DATA SEEDING ===')

  // Authenticate as Admin
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@assignora.demo',
    password: 'Admin@12345',
  })
  if (authErr) throw authErr
  console.log('Authenticated as Admin:', auth.user.id)

  const summary = {
    classesCreated: 0,
    classesExisting: 0,
    enrolmentsAdded: 0,
    assignmentsAdded: 0,
    submissionsAdded: 0,
    announcementsAdded: 0,
    discussionsAdded: 0,
    notificationsAdded: 0,
  }

  for (const cConfig of CLASSES_CONFIG) {
    console.log(`\nProcessing Class: "${cConfig.name}"...`)

    // 1. Get or Create Class
    let classId = null
    const { data: existingClass } = await supabase
      .from('classes')
      .select('id, name')
      .eq('name', cConfig.name)
      .maybeSingle()

    if (existingClass) {
      classId = existingClass.id
      console.log(`  -> Class already exists (ID: ${classId})`)
      summary.classesExisting++
    } else {
      const { data: newClass, error: cErr } = await supabase
        .from('classes')
        .insert({
          name: cConfig.name,
          subject: cConfig.subject,
          description: cConfig.description,
          admin_id: ADMIN_ID,
          created_at: cConfig.created_at,
        })
        .select()
        .single()

      if (cErr) {
        console.error(`Error creating class "${cConfig.name}":`, cErr)
        continue
      }
      classId = newClass.id
      console.log(`  -> Created new Class (ID: ${classId})`)
      summary.classesCreated++
    }

    // 2. Enrol Designated Students
    for (const student of cConfig.students) {
      const { data: existingMember } = await supabase
        .from('class_members')
        .select('id')
        .eq('class_id', classId)
        .eq('student_id', student.id)
        .maybeSingle()

      if (!existingMember) {
        const { error: mErr } = await supabase.from('class_members').insert({
          class_id: classId,
          student_id: student.id,
          joined_at: cConfig.created_at,
        })
        if (!mErr) {
          summary.enrolmentsAdded++
          console.log(`     Enrolled ${student.name} (${student.email})`)
        }
      }
    }

    // 3. Create Assignments
    for (const aConfig of cConfig.assignments) {
      let assignmentId = null
      const { data: existingAssignment } = await supabase
        .from('assignments')
        .select('id, title')
        .eq('class_id', classId)
        .eq('title', aConfig.title)
        .maybeSingle()

      if (existingAssignment) {
        assignmentId = existingAssignment.id
      } else {
        const { data: newAssignment, error: aErr } = await supabase
          .from('assignments')
          .insert({
            title: aConfig.title,
            description: aConfig.description,
            class_id: classId,
            admin_id: ADMIN_ID,
            due_date: aConfig.due_date,
            due_time: aConfig.due_time,
            drive_link: aConfig.drive_link,
            points: aConfig.points,
            assign_to_all: true,
            status: 'published',
            created_at: cConfig.created_at,
            updated_at: cConfig.created_at,
          })
          .select()
          .single()

        if (aErr) {
          console.error(`Error creating assignment "${aConfig.title}":`, aErr)
          continue
        }
        assignmentId = newAssignment.id
        summary.assignmentsAdded++
        console.log(`     Created Assignment: "${aConfig.title}" (${aConfig.points} pts, Due: ${aConfig.due_date})`)
      }

      // 4. Create Submissions
      for (const sub of aConfig.submissions) {
        const { data: existingSub } = await supabase
          .from('submissions')
          .select('id')
          .eq('assignment_id', assignmentId)
          .eq('student_id', sub.student.id)
          .maybeSingle()

        const commentPayload = JSON.stringify({
          text: sub.text,
          grade: sub.grade,
          feedback: sub.feedback,
        })

        if (!existingSub) {
          const { error: sErr } = await supabase.from('submissions').insert({
            assignment_id: assignmentId,
            student_id: sub.student.id,
            submission_link: sub.link,
            comment: commentPayload,
            status: sub.status,
            submitted_at: sub.submitted_at,
            updated_at: sub.status === 'reviewed' ? sub.submitted_at : sub.submitted_at,
          })
          if (!sErr) {
            summary.submissionsAdded++
            console.log(
              `        Submission: ${sub.student.name} -> ${sub.status.toUpperCase()} ${
                sub.grade !== null ? `(${sub.grade}/${aConfig.points})` : '(Awaiting review)'
              }`
            )

            // Add notification for student if graded
            if (sub.status === 'reviewed' && sub.grade !== null) {
              await supabase.from('notifications').insert({
                user_id: sub.student.id,
                title: `Assignment Graded: ${aConfig.title}`,
                message: `Your score: ${sub.grade}/${aConfig.points} pts. Feedback: "${sub.feedback}"`,
                type: 'submission',
                reference_id: assignmentId,
                is_read: false,
                created_at: sub.submitted_at,
              })
              summary.notificationsAdded++
            }
          }
        }
      }
    }

    // 5. Formal Announcements
    for (const ann of cConfig.announcements) {
      const { data: existingAnn } = await supabase
        .from('announcements')
        .select('id')
        .eq('class_id', classId)
        .eq('title', ann.title)
        .maybeSingle()

      if (!existingAnn) {
        const { error: annErr } = await supabase.from('announcements').insert({
          title: ann.title,
          message: ann.message,
          class_id: classId,
          admin_id: ADMIN_ID,
          is_published: true,
          created_at: ann.created_at,
          updated_at: ann.created_at,
        })
        if (!annErr) {
          summary.announcementsAdded++
          console.log(`     Announcement: "${ann.title}"`)

          // Notify enrolled students
          for (const s of cConfig.students) {
            await supabase.from('notifications').insert({
              user_id: s.id,
              title: `New Announcement in ${cConfig.name}`,
              message: ann.title,
              type: 'announcement',
              reference_id: classId,
              is_read: false,
              created_at: ann.created_at,
            })
            summary.notificationsAdded++
          }
        }
      }
    }

    // 6. Discussion Messages
    for (const msg of cConfig.discussions) {
      const discussionTitle = `[Discussion] ${msg.sender}`
      const { data: existingDisc } = await supabase
        .from('announcements')
        .select('id')
        .eq('class_id', classId)
        .eq('title', discussionTitle)
        .eq('created_at', msg.created_at)
        .maybeSingle()

      if (!existingDisc) {
        const senderObj = STUDENTS.find((s) => s.name === msg.sender)
        const senderId = msg.role === 'admin' ? ADMIN_ID : senderObj?.id || STUDENTS[0].id

        const payload = JSON.stringify({
          sender_id: senderId,
          sender_name: msg.sender,
          sender_role: msg.role,
          sender_avatar: '',
          text: msg.text,
        })

        const { error: dErr } = await supabase.from('announcements').insert({
          title: discussionTitle,
          message: payload,
          class_id: classId,
          admin_id: ADMIN_ID,
          is_published: true,
          created_at: msg.created_at,
          updated_at: msg.created_at,
        })
        if (!dErr) {
          summary.discussionsAdded++
        }
      }
    }
  }

  console.log('\n=== SEEDING SUMMARY ===')
  console.log(`Classes Created:       ${summary.classesCreated}`)
  console.log(`Classes Pre-existing:  ${summary.classesExisting}`)
  console.log(`Enrolments Added:      ${summary.enrolmentsAdded}`)
  console.log(`Assignments Added:     ${summary.assignmentsAdded}`)
  console.log(`Submissions Added:     ${summary.submissionsAdded}`)
  console.log(`Announcements Added:   ${summary.announcementsAdded}`)
  console.log(`Discussions Added:     ${summary.discussionsAdded}`)
  console.log(`Notifications Added:   ${summary.notificationsAdded}`)
  console.log('====================================\n')

  return summary
}

// Run immediately if called directly
seedAcademicDemoData().then(() => {
  console.log('Seeder script execution complete.')
  process.exit(0)
}).catch((err) => {
  console.error('Fatal seeder error:', err)
  process.exit(1)
})

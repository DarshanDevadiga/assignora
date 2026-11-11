import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { classifyDeliverable } from '../src/utils/deliverableClassifier.js'

test('CRITICAL FIX — Real Submitted Work Viewer & Classification Engine', async (t) => {
  await t.test('1.1 classifyDeliverable returns acknowledgement_only for empty links, and web_app for submitted URLs', () => {
    // Test empty link
    const resEmpty = classifyDeliverable({
      submissionLink: '',
      comment: 'Acknowledged without file',
      onedriveLink: 'https://1drv.ms/f/s!course-folder',
    })
    assert.equal(resEmpty.category, 'acknowledgement_only')
    assert.equal(resEmpty.isDeliverable, false)
    assert.equal(resEmpty.message, 'Assignment acknowledged, but no deliverable has been submitted.')
    assert.equal(resEmpty.courseOneDrive, 'https://1drv.ms/f/s!course-folder')

    // Test submitted web project / app link (such as localhost or preview)
    const resWebApp = classifyDeliverable({
      submissionLink: 'http://localhost:5173/student/assignments/be665af0-7b57-41b2-a69b-df445996357c',
      comment: 'eved',
      onedriveLink: 'https://1drv.ms/f/s!course-folder',
    })
    assert.equal(resWebApp.category, 'web_app')
    assert.equal(resWebApp.isDeliverable, true)
    assert.equal(resWebApp.url, 'http://localhost:5173/student/assignments/be665af0-7b57-41b2-a69b-df445996357c')
    assert.equal(resWebApp.isLocal, true)
  })

  await t.test('1.2 classifyDeliverable correctly identifies PDF documents and enables preview', () => {
    const resPdf = classifyDeliverable({
      submissionLink: 'https://storage.example.com/student-submissions/report.pdf',
    })
    assert.equal(resPdf.category, 'pdf')
    assert.equal(resPdf.isDeliverable, true)
    assert.equal(resPdf.canPreview, true)
    assert.equal(resPdf.fileName, 'report.pdf')
    assert.equal(resPdf.url, 'https://storage.example.com/student-submissions/report.pdf')

    // Data URL PDF
    const resDataPdf = classifyDeliverable({
      submissionLink: 'data:application/pdf;base64,JVBERi0xLjQK...',
    })
    assert.equal(resDataPdf.category, 'pdf')
    assert.equal(resDataPdf.isDeliverable, true)
    assert.equal(resDataPdf.canPreview, true)
    assert.equal(resDataPdf.fileName, 'submitted-document.pdf')
  })

  await t.test('1.3 classifyDeliverable correctly identifies Office files (DOCX, XLSX, PPTX)', () => {
    const resWord = classifyDeliverable({
      submissionLink: 'https://storage.example.com/project_spec.docx',
    })
    assert.equal(resWord.category, 'word')
    assert.equal(resWord.isDeliverable, true)
    assert.equal(resWord.canPreview, false)
    assert.equal(resWord.fileName, 'project_spec.docx')

    const resExcel = classifyDeliverable({
      submissionLink: 'https://storage.example.com/financial_model.xlsx',
    })
    assert.equal(resExcel.category, 'excel')
    assert.equal(resExcel.isDeliverable, true)

    const resPpt = classifyDeliverable({
      submissionLink: 'https://storage.example.com/final_pitch.pptx',
    })
    assert.equal(resPpt.category, 'powerpoint')
    assert.equal(resPpt.isDeliverable, true)
  })

  await t.test('1.4 classifyDeliverable identifies OneDrive, Google Drive, and GitHub links', () => {
    const resOneDrive = classifyDeliverable({
      submissionLink: 'https://1drv.ms/u/official-leader-deliverable',
    })
    assert.equal(resOneDrive.category, 'onedrive')
    assert.equal(resOneDrive.isDeliverable, true)

    const resGDrive = classifyDeliverable({
      submissionLink: 'https://drive.google.com/file/d/1tkRzCeVdPgzRYEcFHRlsMvBBidRxci4g/view',
    })
    assert.equal(resGDrive.category, 'google_drive')
    assert.equal(resGDrive.isDeliverable, true)
    assert.equal(resGDrive.canPreview, true)
    assert.equal(
      resGDrive.previewUrl,
      'https://drive.google.com/file/d/1tkRzCeVdPgzRYEcFHRlsMvBBidRxci4g/preview'
    )

    const resGit = classifyDeliverable({
      submissionLink: 'https://github.com/assignora/honors-project',
    })
    assert.equal(resGit.category, 'code_repo')
    assert.equal(resGit.isDeliverable, true)
  })
})

test('CRITICAL FIX — Admin / Professor SubmissionTracking View Work Integration', async (t) => {
  const submissionTrackingSource = fs.readFileSync(
    path.resolve('src/pages/admin/SubmissionTracking.jsx'),
    'utf8'
  )

  await t.test('2.1 View Work button calls handleOpenSubmittedWork (separate from grading)', () => {
    assert.match(
      submissionTrackingSource,
      /handleOpenSubmittedWork\(row,\s*true\)/,
      'Group table View Work button must invoke handleOpenSubmittedWork for group'
    )
    assert.match(
      submissionTrackingSource,
      /handleOpenSubmittedWork\(row,\s*false\)/,
      'Individual table View Work button must invoke handleOpenSubmittedWork for student'
    )
  })

  await t.test('2.2 Grade Group / Edit Grade button calls openGroupGradingModal', () => {
    assert.match(
      submissionTrackingSource,
      /onGrade=\{\(\) => openGroupGradingModal\(row\)\}/,
      'Group submission card must be wired to openGroupGradingModal'
    )
    const cardSource = fs.readFileSync(
      path.resolve('src/components/submission/GroupSubmissionCard.jsx'),
      'utf8'
    )
    assert.match(
      cardSource,
      /\{isGraded \? 'Edit Grade' : 'Grade Group'\}/,
      'Card component must render Edit Grade or Grade Group button'
    )
  })

  await t.test('2.3 SubmittedWorkViewerModal is imported and mounted', () => {
    assert.match(
      submissionTrackingSource,
      /import SubmittedWorkViewerModal from '\.\.\/\.\.\/components\/submission\/SubmittedWorkViewerModal'/,
      'Must import SubmittedWorkViewerModal'
    )
    assert.match(
      submissionTrackingSource,
      /<SubmittedWorkViewerModal[\s\S]*?isOpen=\{isSubmittedWorkModalOpen\}/,
      'Must mount SubmittedWorkViewerModal with isSubmittedWorkModalOpen state'
    )
  })

  await t.test('2.4 Switching assignments resets both viewer and grading modal states', () => {
    assert.match(
      submissionTrackingSource,
      /setIsGroupDetailModalOpen\(false\)[\s\S]*?setIsSubmittedWorkModalOpen\(false\)[\s\S]*?setSubmittedWorkData\(null\)/,
      'handleSwitchAssignment must close both grading and submitted work modals'
    )
  })
})

test('CRITICAL FIX — Student Submission Pipeline File Upload & Preview Support', async (t) => {
  const assignmentDetailsSource = fs.readFileSync(
    path.resolve('src/pages/student/AssignmentDetails.jsx'),
    'utf8'
  )

  await t.test('3.1 Supports both link and file submission modes with FileReader', () => {
    assert.match(
      assignmentDetailsSource,
      /const \[submissionMode, setSubmissionMode\] = useState\('link'\)/,
      'Must have submissionMode state'
    )
    assert.match(
      assignmentDetailsSource,
      /reader\.readAsDataURL\(file\)/,
      'Must use FileReader.readAsDataURL for document file uploads'
    )
  })

  await t.test('3.2 Validates file or link presence before opening confirmation modal', () => {
    assert.match(
      assignmentDetailsSource,
      /handleOpenLeaderConfirmModal[\s\S]*?!submissionLink\.trim\(\)[\s\S]*?Please upload a deliverable file or provide a project submission link/,
      'Leader submission must validate deliverable presence'
    )
  })

  await t.test('3.3 Displays View Deliverable button and mounts SubmittedWorkViewerModal for students', () => {
    assert.match(
      assignmentDetailsSource,
      /View Deliverable/,
      'Student page must display View Deliverable button when submission exists'
    )
    assert.match(
      assignmentDetailsSource,
      /<SubmittedWorkViewerModal[\s\S]*?isOpen=\{isViewerOpen\}/,
      'Student page must mount SubmittedWorkViewerModal for previewing work'
    )
  })
})

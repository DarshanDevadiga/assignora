/**
 * verify-group-submission-cards.js
 * Comprehensive automated verification for Group Assignment Submission Cards UI
 * across Student, Professor, and Admin views.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('GroupSubmissionCard Component Architecture & Structure', async (t) => {
  const cardCode = readProjectFile('src/components/submission/GroupSubmissionCard.jsx');

  await t.test('exports GroupSubmissionCard as default function', () => {
    assert.match(cardCode, /export\s+default\s+function\s+GroupSubmissionCard/);
  });

  await t.test('contains Section A: Card Header with group icon, name, leader and member count', () => {
    assert.match(cardCode, /groupName/);
    assert.match(cardCode, /leaderName/);
    assert.match(cardCode, /memberNames\.length/);
    assert.match(cardCode, /Crown/); // Leader icon
    assert.match(cardCode, /Users/); // Members icon
  });

  await t.test('contains Section B: Collapsible Group Members display', () => {
    assert.match(cardCode, /showAllMembers/);
    assert.match(cardCode, /displayedMembers/);
    assert.match(cardCode, /isLeader/);
    assert.match(cardCode, /ChevronDown/);
    assert.match(cardCode, /ChevronUp/);
  });

  await t.test('contains Section C: Submitted Deliverable / Work viewer', () => {
    assert.match(cardCode, /classifyDeliverable/);
    assert.match(cardCode, /deliverable/);
    assert.match(cardCode, /Open In New Tab|Open Link/i);
    assert.match(cardCode, /Inspect Deliverable|View Work/i);
    assert.match(cardCode, /whitespace-pre-wrap/); // Preserves line breaks in submission comments
  });

  await t.test('contains Section D: Acknowledgement details with verified student name and timestamp', () => {
    assert.match(cardCode, /Acknowledged By:/i);
    assert.match(cardCode, /acknowledgedBy/);
    assert.match(cardCode, /formatDisplayDate/);
    assert.match(cardCode, /CheckCircle2/);
  });

  await t.test('contains Section E: Grading information section', () => {
    assert.match(cardCode, /Graded:/);
    assert.match(cardCode, /Grade\s+\{letterGrade\}/);
    assert.match(cardCode, /feedback/);
    assert.match(cardCode, /Awaiting evaluation by instructor|Pending Grade/i);
  });

  await t.test('contains Section F: Action footer and role awareness', () => {
    assert.match(cardCode, /userRole/);
    assert.match(cardCode, /isStaff/);
    assert.match(cardCode, /onGrade/);
    assert.match(cardCode, /onViewWork/);
    assert.match(cardCode, /Edit Grade/);
    assert.match(cardCode, /Grade Group/);
  });

  await t.test('handles unsubmitted groups gracefully with not-submitted badge and empty state', () => {
    assert.match(cardCode, /isSubmitted/);
    assert.match(cardCode, /Pending Group Submission/i);
    assert.match(cardCode, /Missing \(Overdue\)|Pending Submission/i);
  });
});

test('SubmissionTracking.jsx: Replaced Group Tables with Submission Cards', async (t) => {
  const trackingCode = readProjectFile('src/pages/admin/SubmissionTracking.jsx');

  await t.test('imports GroupSubmissionCard', () => {
    assert.match(trackingCode, /import\s+GroupSubmissionCard\s+from\s+['"]\.\.\/\.\.\/components\/submission\/GroupSubmissionCard['"]/);
  });

  await t.test('renders Submitted Groups as a responsive 2-column card grid', () => {
    assert.match(trackingCode, /filteredGroupRows\.submitted\.map/);
    assert.match(trackingCode, /<GroupSubmissionCard[\s\S]*?key=\{row\.id\}[\s\S]*?group=\{row\}[\s\S]*?userRole=\{user\?\.role/);
    assert.match(trackingCode, /grid grid-cols-1 lg:grid-cols-2 gap-5/);
  });

  await t.test('renders Not Submitted Groups as a responsive card grid', () => {
    assert.match(trackingCode, /filteredGroupRows\.notSubmitted\.map/);
    assert.match(trackingCode, /<GroupSubmissionCard[\s\S]*?isSubmitted=\{false\}/);
  });

  await t.test('group section uses cards exclusively without table layout', () => {
    // Look at group assignment section in SubmissionTracking.jsx
    const groupSectionStart = trackingCode.indexOf('GROUP ASSIGNMENT DUAL LIST: SUBMITTED GROUPS & NOT SUBMITTED GROUPS');
    const individualSectionStart = trackingCode.indexOf('INDIVIDUAL ASSIGNMENT: STUDENT SUBMISSION TABLE & FILTERS');
    assert.ok(groupSectionStart > 0, 'Group tracking section comment exists');
    assert.ok(individualSectionStart > groupSectionStart, 'Individual tracking section follows group section');

    const groupSectionCode = trackingCode.substring(groupSectionStart, individualSectionStart);
    assert.doesNotMatch(groupSectionCode, /<table/i, 'Group tracking section does not contain <table> tags');
    assert.doesNotMatch(groupSectionCode, /<thead/i, 'Group tracking section does not contain <thead> tags');
    assert.doesNotMatch(groupSectionCode, /<tbody/i, 'Group tracking section does not contain <tbody> tags');
  });
});

test('AssignmentDetails.jsx: Student View uses GroupSubmissionCard', async (t) => {
  const studentCode = readProjectFile('src/pages/student/AssignmentDetails.jsx');

  await t.test('imports GroupSubmissionCard', () => {
    assert.match(studentCode, /import\s+GroupSubmissionCard\s+from\s+['"]\.\.\/\.\.\/components\/submission\/GroupSubmissionCard['"]/);
  });

  await t.test('renders GroupSubmissionCard for acknowledged group assignment with student role', () => {
    assert.match(studentCode, /<GroupSubmissionCard[\s\S]*?userRole="student"/);
    assert.match(studentCode, /group=\{\s*\{[\s\S]*?\.\.\.studentGroup/);
  });
});

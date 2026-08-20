// Spec §15.4 — the advisor's PDF report, generated client-side (no new
// backend runtime dependency) from GET /api/advisor/report.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdvisorReportRowDTO, AdvisorResponsibilityDetailDTO, VpAdvisorSummaryDTO, ColliderProjectDTO, AffectedStudentRowDTO } from '../api/client';
import { DemandForecast, CourseRiskProfile, BottleneckCourse } from '@advisor/shared';
import { departmentsCell } from '../portal/lib/departmentsCell';
import { drawHeaderLogo, drawSeal, drawWatermark, getPdfBrandKit } from './pdfBrandKit';

// AEGIS rebrand — every PDF below is a white-page document, so the black-
// lined "icon-light" export (meant for light backgrounds) is the right
// variant regardless of the app's own light/dark toggle; a PDF page has no
// theme. Logo fetch/cache, the header mark, the page watermark, and the
// signature-area seal all now live in pdfBrandKit.ts — a single shared
// object every PDF generator in this file (and any future one) pulls from,
// instead of each generator re-implementing its own copy.

// A warm amber, distinct from the report's own dark header color and from
// jsPDF's default white/striped body rows — used both for the highlighted
// rows below and the responsibility letter's accent, so the two documents
// read as visually related.
const RESPONSIBILITY_HIGHLIGHT_RGB: [number, number, number] = [250, 224, 168];

/** Every generated PDF gets a small verification seal near the bottom of
 *  its last page — "this came out of AEGIS" independent of whatever
 *  signature block (if any) the document itself has. Called once, after
 *  everything else on the document is drawn, so it always lands on
 *  whichever page ends up being the actual last one. */
function drawVerificationFooter(doc: jsPDF, brand: Parameters<typeof drawSeal>[1]): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  drawSeal(doc, brand, pageWidth - 22, pageHeight - 20, 10);
}

/** The amber-highlight legend, once, in a fixed footer position — NOT
 *  anymore via autoTable's `didDrawPage` at the table's own trailing
 *  cursor position. That approach had two real bugs, both reported
 *  against live output: (1) `didDrawPage` fires on every page a table
 *  spans, so a multi-page table got the legend redrawn on each page, at a
 *  Y position that was wherever THAT page's rows happened to stop — often
 *  hard against the bottom margin; (2) in the VP report specifically, the
 *  legend's own trailing Y and the *next* table's "Advisor Responsibility
 *  Detail" heading were computed independently from roughly the same
 *  point (the first table's end), so a legend long enough to wrap a
 *  second line (enumerating every flagged student by name had no upper
 *  bound) visibly overlapped that heading and the table under it.
 *  Fixing both: call this once, after every table on the page is fully
 *  drawn, at a fixed bottom-margin position (clear of the verification
 *  seal's own footer slot) — and the text itself no longer enumerates
 *  names (the highlighted rows already show exactly who, right there in
 *  the table), so its height is now bounded to one line regardless of how
 *  many rows are flagged. */
function drawHighlightLegend(doc: jsPDF, text: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 38;
  doc.setFillColor(...RESPONSIBILITY_HIGHLIGHT_RGB);
  doc.rect(14, y - 3.5, 4, 4, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(60);
  doc.text(text, 20, y, { maxWidth: pageWidth - 55 }); // stops well clear of the seal
}

export async function downloadAdvisorReportPdf(rows: AdvisorReportRowDTO[]): Promise<void> {
  const doc = new jsPDF();
  const brand = await getPdfBrandKit();
  const textLeft = drawHeaderLogo(doc, brand);
  doc.setFontSize(16);
  doc.text('Academic Advisor — Student Roster Report', textLeft, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, textLeft, 25);

  // Real bug found by audit: matching by name risks two different
  // students who happen to share a name (generated fillers are drawn from
  // a shared first/last name pool — a real, non-contrived collision risk
  // across a 25-student roster) getting the wrong one's row highlighted.
  // studentId is the actual unique key.
  const flaggedStudentIds = new Set(rows.filter(r => r.hasBelowOrEqualAdvisorProposal).map(r => r.studentId));

  autoTable(doc, {
    startY: 32,
    head: [['Student', 'CGPA', 'Warning', 'Pending', 'Advisor-approved', 'Registered']],
    body: rows.map(r => [
      r.name,
      r.cgpa.toFixed(2),
      `${r.probationCount}/6`,
      String(r.pendingCount),
      String(r.advisorApprovedCount),
      String(r.registeredCount),
    ]),
    headStyles: { fillColor: [35, 32, 23] },
    styles: { fontSize: 9 },
    // Advisor-responsibility epic — a row's whole background turns amber
    // wherever that student has a live advisor-proposed course whose
    // expected grade was no better than the system's own recommendation.
    // What the color means is explained once, in the page footer (see
    // drawHighlightLegend) — not here per-page against the table's own
    // trailing cursor, which is what used to cause it to overlap other
    // content on a multi-page report.
    didParseCell: data => {
      if (data.section === 'body' && flaggedStudentIds.has(rows[data.row.index]?.studentId)) {
        data.cell.styles.fillColor = RESPONSIBILITY_HIGHLIGHT_RGB;
      }
    },
    // `willDrawPage`, not `didDrawPage` — the watermark needs to paint
    // BEFORE that page's rows so the table content ends up on top of it,
    // not the other way around (jsPDF has no z-index; whatever's drawn
    // last simply covers whatever came before).
    willDrawPage: () => drawWatermark(doc, brand),
  });

  if (flaggedStudentIds.size > 0) {
    drawHighlightLegend(doc, "Highlighted rows: the advisor is responsible for this student's grade in a proposed course.");
  }
  drawVerificationFooter(doc, brand);
  doc.save(`advisor-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Vice President epic — the VP's own aggregate PDF, one row per advisor
 *  (not per student — see downloadAdvisorReportPdf above for that). Same
 *  highlight+legend pattern as the advisor's own roster report, just one
 *  level up: an advisor's row is highlighted whenever ANY student on
 *  their roster has a live advisor-proposed course the advisor "took
 *  responsibility" for (§17.3) — the flag is computed server-side from
 *  the exact same per-student data the advisor's own report highlights,
 *  so the two PDFs can never disagree about who's flagged.
 *
 *  `responsibilityDetails` (optional — omit/empty for the old behavior) is
 *  the full per-(student, course) breakdown behind those flags
 *  (GET /api/vp/responsibility-details): when there's at least one, a
 *  second table is appended right after the advisor table naming exactly
 *  who, which course, and which advisor, instead of leaving the VP to
 *  infer it from the flag count alone. */
export async function downloadVpAdvisorsReportPdf(
  rows: VpAdvisorSummaryDTO[],
  responsibilityDetails: AdvisorResponsibilityDetailDTO[] = []
): Promise<void> {
  const doc = new jsPDF();
  const brand = await getPdfBrandKit();
  const textLeft = drawHeaderLogo(doc, brand);
  doc.setFontSize(16);
  doc.text('Vice President — Advisor Oversight Report', textLeft, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, textLeft, 25);

  // Real ids, not names, for the same reason as downloadAdvisorReportPdf
  // above — advisor names are a small curated list so a collision here is
  // far less likely in practice, but there's no reason to rely on that
  // when advisor.id is right there and just as easy to match on.
  const flaggedAdvisorIds = new Set(rows.filter(r => r.flaggedStudentNames.length > 0).map(r => r.advisor.id));

  autoTable(doc, {
    startY: 32,
    head: [['Advisor', 'Department', 'Students', 'Average CGPA', 'Responsibility flags']],
    body: rows.map(r => [
      r.advisor.name,
      `${r.advisor.facultyId}/${r.advisor.departmentId}`,
      String(r.studentCount),
      r.averageCgpa.toFixed(2),
      r.flaggedStudentNames.length > 0 ? String(r.flaggedStudentNames.length) : '—',
    ]),
    headStyles: { fillColor: [35, 32, 23] },
    styles: { fontSize: 9 },
    didParseCell: data => {
      if (data.section === 'body' && flaggedAdvisorIds.has(rows[data.row.index]?.advisor.id)) {
        data.cell.styles.fillColor = RESPONSIBILITY_HIGHLIGHT_RGB;
      }
    },
    willDrawPage: () => drawWatermark(doc, brand),
  });

  if (responsibilityDetails.length > 0) {
    const afterFirstTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text('Advisor Responsibility Detail', 14, afterFirstTable);
    autoTable(doc, {
      startY: afterFirstTable + 4,
      head: [['Student Name', 'Student ID', 'Student\'s Advisor', 'Subject Name', 'Subject Code']],
      body: responsibilityDetails.map(d => [d.studentName, d.studentId, d.advisorName, d.courseName, d.courseCode]),
      headStyles: { fillColor: [35, 32, 23] },
      styles: { fontSize: 9 },
      willDrawPage: () => drawWatermark(doc, brand),
    });
  }

  if (flaggedAdvisorIds.size > 0) {
    drawHighlightLegend(
      doc,
      responsibilityDetails.length > 0
        ? 'Highlighted rows: this advisor took responsibility for at least one student\'s grade in a proposed course — see the detail table above for exactly which students and courses.'
        : "Highlighted rows: this advisor took responsibility for at least one student's grade in a proposed course."
    );
  }
  drawVerificationFooter(doc, brand);
  doc.save(`vp-advisor-oversight-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface ResponsibilityLetterInput {
  studentName: string;
  advisorName: string;
  oldCourseCode: string;
  newCourseCode: string;
  /** 'no change' when the proposed course's expected grade exactly ties
   *  the system's own recommendation; 'decrease' when it's strictly worse. */
  gradeEffect: 'no change' | 'decrease';
}

/** Advisor-responsibility epic — a signed letter to the student, generated
 *  once they register a course an advisor proposed with a same-or-worse
 *  expected grade than the system's own recommendation (the exact case
 *  the confirmation modal in AdvisorProposalsTab.tsx gates on). Available
 *  to download from both the advisor's and the student's own proposal
 *  views — same content either way, since it's addressed to the student
 *  but is really the advisor's own signed acknowledgement. */
export async function downloadResponsibilityLetterPdf(input: ResponsibilityLetterInput): Promise<void> {
  const doc = new jsPDF();

  const brand = await getPdfBrandKit();
  drawWatermark(doc, brand);
  const textLeft = drawHeaderLogo(doc, brand, { x: 14, y: 12, w: 20, h: 22 });
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text('Academic Advising — Course Recommendation Letter', textLeft, 20);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Issued ${new Date().toLocaleString()}`, textLeft, 27);

  doc.setDrawColor(200);
  doc.line(14, 38, 196, 38);

  doc.setFontSize(11);
  doc.setTextColor(20);
  let y = 52;
  const lineHeight = 7;
  const write = (text: string, opts?: { bold?: boolean; gap?: number }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, 172);
    doc.text(lines, 14, y);
    y += lines.length * lineHeight + (opts?.gap ?? 4);
  };

  write(`My dear student ${input.studentName},`);
  write(`I am your advisor, Prof. ${input.advisorName}.`);
  write(
    `I am recommending you take ${input.newCourseCode} instead of ${input.oldCourseCode}, ` +
    `although its expected effect on your CGPA is ${input.gradeEffect === 'no change' ? 'no change' : 'a decrease'} ` +
    `compared to the system's own recommendation. I take full responsibility for this recommendation, and I will be ` +
    `responsible for the retake process should you receive a grade in ${input.newCourseCode} that requires you to retake it.`
  );
  write('Advisor Signature:', { bold: true, gap: 2 });
  doc.setFont('helvetica', 'italic');
  doc.text(input.advisorName, 14, y);
  drawSeal(doc, brand, 170, y - 4, 11);

  doc.save(`responsibility-letter-${input.studentName.replace(/\s+/g, '-').toLowerCase()}-${input.newCourseCode}.pdf`);
}

export interface UnofficialTranscriptRow {
  semesterOrdinal: number;
  courseCode: string;
  courseName: string;
  credits: number;
  letter: string;
}
export interface UnofficialTranscriptInput {
  studentName: string;
  studentId: string;
  facultyId: string;
  departmentId: string;
  cgpa: number;
  advisorName: string;
  rows: UnofficialTranscriptRow[];
}

/** Student-facing "Download Unofficial Transcript" — same visual template
 *  (header logo, watermark, seal) as the advisor/VP PDFs above, but this
 *  one carries the same three-signature footer a real registrar's
 *  unofficial-transcript printout would: Manager of Student Affairs,
 *  the student's own Academic Advisor, and the Vice President, each with
 *  a blank line — genuinely blank, since signing it would make it an
 *  OFFICIAL document, which this explicitly is not. The advisor's real
 *  name is still printed under their line (we know it — it's just not a
 *  substitute for their actual signature); the other two roles print only
 *  the role label. The verification seal sits under the Vice President's
 *  line specifically, per how this was asked for. */
export async function downloadUnofficialTranscriptPdf(input: UnofficialTranscriptInput): Promise<void> {
  const doc = new jsPDF();
  const brand = await getPdfBrandKit();
  const textLeft = drawHeaderLogo(doc, brand);

  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text('Unofficial Academic Transcript', textLeft, 18);
  doc.setFontSize(10);
  doc.setTextColor(190, 60, 40);
  doc.setFont('helvetica', 'bold');
  doc.text('NOT VALID WITHOUT SIGNATURE — FOR STUDENT USE ONLY', textLeft, 24);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, textLeft, 29);

  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(`Student: ${input.studentName}  (ID: ${input.studentId})`, 14, 42);
  doc.text(`Program: ${input.facultyId}/${input.departmentId}`, 14, 48);
  doc.text(`Cumulative GPA: ${input.cgpa.toFixed(2)} / 4.00`, 14, 54);

  autoTable(doc, {
    startY: 60,
    head: [['Sem.', 'Course Code', 'Course Name', 'Credits', 'Grade']],
    body: input.rows.map(r => [String(r.semesterOrdinal), r.courseCode, r.courseName, String(r.credits), r.letter]),
    headStyles: { fillColor: [35, 32, 23] },
    styles: { fontSize: 9 },
    willDrawPage: () => drawWatermark(doc, brand),
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const pageHeight = doc.internal.pageSize.getHeight();
  // The signature footer always sits near the bottom of the LAST page,
  // not right after the table — a transcript with only a few courses
  // shouldn't have its signature block floating awkwardly high up.
  const footerY = Math.max(afterTable + 30, pageHeight - 50);

  doc.setDrawColor(120);
  doc.setLineWidth(0.3);
  const cols = [
    { x1: 14, x2: 74, label: 'Manager of Student Affairs', name: null as string | null },
    { x1: 80, x2: 130, label: 'Academic Advisor', name: input.advisorName },
    { x1: 136, x2: 196, label: 'Vice President', name: null as string | null },
  ];
  for (const col of cols) {
    doc.line(col.x1, footerY, col.x2, footerY);
    doc.setFontSize(8.5);
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    doc.text(col.label, (col.x1 + col.x2) / 2, footerY + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(col.name ?? '(signature)', (col.x1 + col.x2) / 2, footerY + 10, { align: 'center' });
  }
  // The seal sits under the Vice President's own signature line, per how
  // this was asked for — a document-level "system verified" mark right
  // where the highest-authority signature would otherwise go.
  drawSeal(doc, brand, (cols[2].x1 + cols[2].x2) / 2, footerY + 22, 10);

  doc.save(`unofficial-transcript-${input.studentName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

const STAGE_LABEL: Record<string, string> = { idea: 'Idea', forming_team: 'Forming team', active: 'Active', matched_externally: 'Matched externally', archived: 'Archived' };
const TYPE_LABEL: Record<string, string> = { academic_research: 'Academic research', commercial_spinoff: 'Commercial spin-off', graduation_project: 'Graduation project' };

/** AI Features Blueprint — the VP's Innovation Topography PDF export:
 *  every active-or-idea project, who's on it (advisor + every member,
 *  real advisee or cross-faculty collaborator, named), and every funding
 *  allocation with its source spelled out explicitly (university money
 *  vs. an external grant/award, never left ambiguous) — the three things
 *  asked for. Three separate autoTables (summary / team roster / funding
 *  detail) rather than one freeform per-project block: autoTable already
 *  handles pagination and repeated headers correctly across page breaks,
 *  which hand-tracked freeform text cursors do not (see this file's own
 *  header-comment history — didDrawPage/Y-cursor collisions were a real,
 *  previously-shipped bug in the VP advisor report before it was fixed to
 *  use exactly this kind of table-first approach). */
export async function downloadInnovationTopographyPdf(input: { projects: (ColliderProjectDTO & { advisorName: string })[] }): Promise<void> {
  const { projects } = input;
  const doc = new jsPDF();
  const brand = await getPdfBrandKit();
  const textLeft = drawHeaderLogo(doc, brand);
  doc.setFontSize(16);
  doc.text('Innovation Topography — Project Collider Report', textLeft, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, textLeft, 25);

  const totalFundedFor = (p: ColliderProjectDTO) => p.fundingAllocations.reduce((s, f) => s + f.amount, 0);

  autoTable(doc, {
    startY: 32,
    head: [['Project', 'Type', 'Stage', 'Advisor', 'Skills', 'Members', 'Total funded (EGP)']],
    body: projects.map(p => [
      p.title,
      TYPE_LABEL[p.type] ?? p.type,
      STAGE_LABEL[p.stage] ?? p.stage,
      p.advisorName,
      p.skills.join(', '),
      String(p.members.length),
      totalFundedFor(p).toLocaleString(),
    ]),
    headStyles: { fillColor: [35, 32, 23] },
    styles: { fontSize: 8.5 },
    willDrawPage: () => drawWatermark(doc, brand),
  });

  const afterSummary = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text('Project Teams', 14, afterSummary);
  autoTable(doc, {
    startY: afterSummary + 4,
    head: [['Project', 'Member', 'Role', 'Faculty / Department']],
    body: projects.flatMap(p =>
      p.members.map(m => [p.title, m.name, m.isCollaborator ? 'Cross-faculty collaborator' : 'Student (this advisor\'s roster)', `${m.facultyId}/${m.departmentId}`])
    ),
    headStyles: { fillColor: [35, 32, 23] },
    styles: { fontSize: 8.5 },
    willDrawPage: () => drawWatermark(doc, brand),
  });

  const projectsWithFunding = projects.filter(p => p.fundingAllocations.length > 0);
  if (projectsWithFunding.length > 0) {
    const afterTeams = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text('Funding Allocations', 14, afterTeams);
    autoTable(doc, {
      startY: afterTeams + 4,
      head: [['Project', 'Amount (EGP)', 'Source', 'Grant / Award Name', 'Note', 'Date']],
      body: projectsWithFunding.flatMap(p =>
        p.fundingAllocations.map(f => [
          p.title,
          f.amount.toLocaleString(),
          f.source === 'external_grant' ? 'External grant/award' : 'University funding',
          f.grantName ?? '—',
          f.note || '—',
          new Date(f.allocatedAt).toLocaleDateString(),
        ])
      ),
      headStyles: { fillColor: [35, 32, 23] },
      styles: { fontSize: 8.5 },
      // External-grant rows get the same highlight tone the rest of this
      // file already uses for "worth a second look" rows — the university-
      // vs-external distinction is the one thing this report exists to
      // make impossible to miss, not just a column value scanned past.
      didParseCell: data => {
        if (data.section === 'body') {
          const row = projectsWithFunding.flatMap(p => p.fundingAllocations.map(f => ({ p, f })))[data.row.index];
          if (row?.f.source === 'external_grant') data.cell.styles.fillColor = RESPONSIBILITY_HIGHLIGHT_RGB;
        }
      },
      willDrawPage: () => drawWatermark(doc, brand),
    });
    drawHighlightLegend(doc, 'Highlighted rows: funding sourced from an external grant/award, not the university\'s own funds.');
  }

  drawVerificationFooter(doc, brand);
  doc.save(`innovation-topography-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ---------------------------------------------------------------------
// Curriculum Analytics epic — "make the new features data downloadable
// via PDF." Same client-side jsPDF+autoTable+pdfBrandKit pattern as every
// report above, no new dependency. Each function takes the courses/rows
// the CALLING page is already showing (post-filter, post-sort) — the
// export always matches exactly what's on screen when the VP or advisor
// clicks the button, department/category filter included, not a second,
// separately-fetched "everything" dump.
// ---------------------------------------------------------------------

const TREND_LABEL = (slope: number) => (slope > 0.5 ? 'Rising' : slope < -0.5 ? 'Declining' : 'Steady');

export async function downloadDemandForecastPdf(input: { title: string; courses: DemandForecast[] }): Promise<void> {
  const { title, courses } = input;
  const doc = new jsPDF();
  const brand = await getPdfBrandKit();
  const textLeft = drawHeaderLogo(doc, brand);
  doc.setFontSize(16);
  doc.text(title, textLeft, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, textLeft, 25);

  autoTable(doc, {
    startY: 32,
    head: [['Course', 'Department(s)', 'Forecasted next term', 'Confidence', 'Sections (est.)', 'Instructor load (est.)', 'Trend']],
    body: courses.map(c => [
      `${c.courseCode} — ${c.courseName}`,
      departmentsCell(c.departments),
      String(c.nextTermEnrolled),
      `± ${c.confidenceBand}`,
      String(c.forecastedSections),
      String(c.forecastedInstructorLoad),
      TREND_LABEL(c.trendSlope),
    ]),
    headStyles: { fillColor: [35, 32, 23] },
    styles: { fontSize: 8 },
    willDrawPage: () => drawWatermark(doc, brand),
  });

  doc.setFontSize(8);
  doc.setTextColor(130);
  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.text('Sections and instructor load are derived estimates (forecasted enrollment ÷ typical class size) — not real section-scheduling or instructor-assignment data.', 14, afterTable, { maxWidth: 182 });

  drawVerificationFooter(doc, brand);
  doc.save(`demand-forecast-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Mirrors VpCurriculumHealthMonitor.tsx/AdvisorCurriculumHealthMonitor.tsx's
// own healthBadge() cutoffs (75/55) — those are themselves already inline
// magic numbers matching predictionWeights.json's atRiskThreshold=55,
// same duplication those components already carry, not a new one.
const HEALTH_ROW_RGB: [number, number, number] = [252, 214, 210]; // at-risk red, distinct from the amber "responsibility" highlight elsewhere in this file

export async function downloadCurriculumHealthPdf(input: { title: string; courses: CourseRiskProfile[] }): Promise<void> {
  const { title, courses } = input;
  const doc = new jsPDF();
  const brand = await getPdfBrandKit();
  const textLeft = drawHeaderLogo(doc, brand);
  doc.setFontSize(16);
  doc.text(title, textLeft, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, textLeft, 25);

  autoTable(doc, {
    startY: 32,
    head: [['Course', 'Department(s)', 'Health', 'Failure rate', 'Gates', 'Demand pressure', 'Expected delay']],
    body: courses.map(c => [
      `${c.courseCode} — ${c.courseName}`,
      departmentsCell(c.departments),
      `${c.healthScore}/100`,
      `${c.failureRate}%`,
      c.downstreamImpact.toFixed(1),
      `${(c.demandPressure * 100).toFixed(0)}%`,
      c.cascadingDelaySemesters > 0 ? `${c.cascadingDelaySemesters.toFixed(1)} sem` : '—',
    ]),
    headStyles: { fillColor: [35, 32, 23] },
    styles: { fontSize: 8 },
    didParseCell: data => {
      if (data.section === 'body' && courses[data.row.index]?.healthScore < 55) {
        data.cell.styles.fillColor = HEALTH_ROW_RGB;
      }
    },
    willDrawPage: () => drawWatermark(doc, brand),
  });

  if (courses.some(c => c.healthScore < 55)) {
    drawHighlightLegend(doc, 'Highlighted rows: below the at-risk health threshold (55/100).');
  }
  drawVerificationFooter(doc, brand);
  doc.save(`curriculum-health-${new Date().toISOString().slice(0, 10)}.pdf`);
}

const BOTTLENECK_REASON_LABEL: Record<string, string> = {
  failed_needs_retake: 'Already failed — needs a retake',
  prereq_not_yet_cleared: 'Still a real gate ahead in their plan',
};

export async function downloadBottleneckAnalyzerPdf(input: {
  title: string;
  bottlenecks: BottleneckCourse[];
  /** Advisor-only — omit/empty on the VP's export, which has no per-
   *  student roster tracing (same scope split as the live pages). */
  affectedAdvisees?: AffectedStudentRowDTO[];
}): Promise<void> {
  const { title, bottlenecks, affectedAdvisees = [] } = input;
  const doc = new jsPDF();
  const brand = await getPdfBrandKit();
  const textLeft = drawHeaderLogo(doc, brand);
  doc.setFontSize(16);
  doc.text(title, textLeft, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, textLeft, 25);

  let startY = 32;
  if (affectedAdvisees.length > 0) {
    autoTable(doc, {
      startY,
      head: [['Student', 'Bottleneck course', 'Why']],
      body: affectedAdvisees.map(a => [a.studentName, a.bottleneckCourseCode, BOTTLENECK_REASON_LABEL[a.reason] ?? a.reason]),
      headStyles: { fillColor: [35, 32, 23] },
      styles: { fontSize: 8.5 },
      willDrawPage: () => drawWatermark(doc, brand),
    });
    startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text('Institution-wide Bottleneck Ranking', 14, startY);
    startY += 4;
  }

  autoTable(doc, {
    startY,
    head: [['Course', 'Department(s)', 'Expected delay', 'Failure rate', 'Directly blocks']],
    body: bottlenecks.map(b => [
      `${b.courseCode} — ${b.courseName}`,
      departmentsCell(b.departments),
      `${b.cascadingDelaySemesters.toFixed(1)} sem`,
      `${b.failureRate}%`,
      b.directlyBlocks.length > 0 ? b.directlyBlocks.join(', ') : '—',
    ]),
    headStyles: { fillColor: [35, 32, 23] },
    styles: { fontSize: 8 },
    willDrawPage: () => drawWatermark(doc, brand),
  });

  drawVerificationFooter(doc, brand);
  doc.save(`bottleneck-analyzer-${new Date().toISOString().slice(0, 10)}.pdf`);
}

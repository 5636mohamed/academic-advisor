// Spec §15.4 — the advisor's PDF report, generated client-side (no new
// backend runtime dependency) from GET /api/advisor/report.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdvisorReportRowDTO, AdvisorResponsibilityDetailDTO, VpAdvisorSummaryDTO } from '../api/client';
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

export async function downloadAdvisorReportPdf(rows: AdvisorReportRowDTO[]): Promise<void> {
  const doc = new jsPDF();
  const brand = await getPdfBrandKit();
  const textLeft = drawHeaderLogo(doc, brand);
  doc.setFontSize(16);
  doc.text('Academic Advisor — Student Roster Report', textLeft, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, textLeft, 25);

  const flaggedNames = rows.filter(r => r.hasBelowOrEqualAdvisorProposal).map(r => r.name);

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
    // expected grade was no better than the system's own recommendation;
    // the legend right below the table (added via didDrawPage, since
    // that's the reliable place to know the table's actual final Y even
    // if it spans multiple pages) explains what the color means.
    didParseCell: data => {
      if (data.section === 'body' && flaggedNames.includes(String(rows[data.row.index]?.name))) {
        data.cell.styles.fillColor = RESPONSIBILITY_HIGHLIGHT_RGB;
      }
    },
    // `willDrawPage`, not `didDrawPage` — the watermark needs to paint
    // BEFORE that page's rows so the table content ends up on top of it,
    // not the other way around (jsPDF has no z-index; whatever's drawn
    // last simply covers whatever came before).
    willDrawPage: () => drawWatermark(doc, brand),
    didDrawPage: data => {
      if (flaggedNames.length === 0) return;
      const finalY = (data.cursor?.y ?? 32) + 10;
      doc.setFillColor(...RESPONSIBILITY_HIGHLIGHT_RGB);
      doc.rect(14, finalY - 4, 4, 4, 'F');
      doc.setFontSize(9);
      doc.setTextColor(60);
      doc.text(
        `Highlighted rows: the advisor is responsible for this student's grade in a proposed course — ${flaggedNames.join(', ')}.`,
        20, finalY,
        { maxWidth: 175 }
      );
    },
  });

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

  const flaggedAdvisors = rows.filter(r => r.flaggedStudentNames.length > 0);

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
      if (data.section === 'body' && flaggedAdvisors.some(a => a.advisor.name === String(rows[data.row.index]?.advisor.name))) {
        data.cell.styles.fillColor = RESPONSIBILITY_HIGHLIGHT_RGB;
      }
    },
    willDrawPage: () => drawWatermark(doc, brand),
    didDrawPage: data => {
      if (flaggedAdvisors.length === 0) return;
      const y = (data.cursor?.y ?? 32) + 10;
      doc.setFillColor(...RESPONSIBILITY_HIGHLIGHT_RGB);
      doc.rect(14, y - 4, 4, 4, 'F');
      doc.setFontSize(9);
      doc.setTextColor(60);
      doc.text(
        'Highlighted rows: this advisor took responsibility for at least one student\'s grade in a proposed course (a course whose expected grade was not better than the system\'s own recommendation) — see the detail table below for exactly which students and courses.',
        20, y,
        { maxWidth: 175 }
      );
    },
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

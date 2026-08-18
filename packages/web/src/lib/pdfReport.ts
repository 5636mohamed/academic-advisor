// Spec §15.4 — the advisor's PDF report, generated client-side (no new
// backend runtime dependency) from GET /api/advisor/report.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdvisorReportRowDTO } from '../api/client';
import aegisIconLightPdf from '../assets/aegis-icon-light-pdf.png';

// AEGIS rebrand — both PDFs below are white-page documents, so the black-
// lined "icon-light" export (meant for light backgrounds) is the right
// variant here regardless of the app's own light/dark toggle; a PDF page
// has no theme. A dedicated, smaller-resolution copy is used here (rather
// than the same asset the topbar/login use) since jsPDF embeds a PNG's
// full source resolution regardless of its on-page display size — the
// full-size topbar asset would otherwise bloat every generated PDF by
// several hundred KB for no visible benefit at this tiny render size.
// Fetched once and cached as a data: URL, since jsPDF's addImage needs
// actual image data, not a bundled asset path.
let cachedLogoDataUrl: string | null | undefined;
async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const res = await fetch(aegisIconLightPdf);
    const blob = await res.blob();
    cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    // A missing/failed logo fetch should never block the PDF itself.
    cachedLogoDataUrl = null;
  }
  return cachedLogoDataUrl;
}

// A warm amber, distinct from the report's own dark header color and from
// jsPDF's default white/striped body rows — used both for the highlighted
// rows below and the responsibility letter's accent, so the two documents
// read as visually related.
const RESPONSIBILITY_HIGHLIGHT_RGB: [number, number, number] = [250, 224, 168];

export async function downloadAdvisorReportPdf(rows: AdvisorReportRowDTO[]): Promise<void> {
  const doc = new jsPDF();
  const logoDataUrl = await getLogoDataUrl();
  const textLeft = logoDataUrl ? 32 : 14;
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', 14, 10, 14, 15); } catch { /* non-fatal */ }
  }
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

  doc.save(`advisor-report-${new Date().toISOString().slice(0, 10)}.pdf`);
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

  const logoDataUrl = await getLogoDataUrl();
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'PNG', 14, 12, 20, 22); } catch { /* a missing/invalid logo shouldn't block the letter itself */ }
  }
  const textLeft = logoDataUrl ? 40 : 14;
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

  doc.save(`responsibility-letter-${input.studentName.replace(/\s+/g, '-').toLowerCase()}-${input.newCourseCode}.pdf`);
}

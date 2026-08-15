// Spec §15.4 — the advisor's PDF report, generated client-side (no new
// backend runtime dependency) from GET /api/advisor/report.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdvisorReportRowDTO } from '../api/client';

export function downloadAdvisorReportPdf(rows: AdvisorReportRowDTO[]): void {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Academic Advisor — Student Roster Report', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 25);

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
  });

  doc.save(`advisor-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

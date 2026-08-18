// Every PDF this system generates (advisor/VP reports, responsibility
// letters, transcripts, ...) shares the same small set of AEGIS brand
// assets/treatments — a header logo mark, a page watermark, and a
// verification "seal" stamp near a signature block. Rather than each PDF
// generator re-implementing its own "fetch the logo, cache it as a data:
// URL" plumbing (which is exactly what happened before this module
// existed — see pdfReport.ts's git history), this is ONE object, fetched
// once and reused everywhere, plus a few small draw helpers built around
// it. The next PDF this system needs (or the next version of it) should
// import `getPdfBrandKit`/`drawHeaderLogo`/`drawWatermark`/`drawSeal` from
// here rather than growing a second copy of any of this.
import jsPDF, { GState } from 'jspdf';
import aegisIconLightPdf from '../assets/aegis-icon-light-pdf.png';

export interface PdfBrandKit {
  /** null if the logo genuinely failed to load — every helper below treats
   *  that as "skip the graphic, never let a missing asset block the PDF
   *  itself" (the same non-fatal philosophy this file's callers already
   *  followed for the plain header logo). */
  logoDataUrl: string | null;
}

let cached: PdfBrandKit | null = null;

/** Fetched once per page load and cached — a dedicated, small-resolution
 *  PDF-only export (rather than the same asset the topbar/login use)
 *  since jsPDF embeds a PNG's full source resolution regardless of its
 *  on-page display size. */
export async function getPdfBrandKit(): Promise<PdfBrandKit> {
  if (cached) return cached;
  let logoDataUrl: string | null = null;
  try {
    const res = await fetch(aegisIconLightPdf);
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    logoDataUrl = null;
  }
  cached = { logoDataUrl };
  return cached;
}

/** The plain header logo mark every PDF already opens with (top-left,
 *  next to the title). Returns the x-position the caller's own header
 *  text should start at — pushed right to leave room for the logo, or the
 *  plain margin if it didn't load. */
export function drawHeaderLogo(doc: jsPDF, brand: PdfBrandKit, opts?: { x?: number; y?: number; w?: number; h?: number; marginX?: number }): number {
  const marginX = opts?.marginX ?? 14;
  const x = opts?.x ?? marginX;
  const y = opts?.y ?? 10;
  const w = opts?.w ?? 14;
  const h = opts?.h ?? 15;
  if (brand.logoDataUrl) {
    try {
      doc.addImage(brand.logoDataUrl, 'PNG', x, y, w, h);
      return x + w + 4;
    } catch { /* a missing/invalid logo should never block the document itself */ }
  }
  return marginX;
}

/** A large, faint, diagonal watermark centered on the current page —
 *  every generated PDF gets this, marking it as exported by the system
 *  without interfering with legibility of the real content drawn under or
 *  over it. Safe to call on every page of a multi-page document (e.g.
 *  from autoTable's `didDrawPage`). */
export function drawWatermark(doc: jsPDF, brand: PdfBrandKit, label = 'AEGIS'): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cx = pageWidth / 2;
  const cy = pageHeight / 2;

  doc.saveGraphicsState();
  try {
    // jsPDF's GState is how opacity is set for anything drawn afterward —
    // there's no per-call opacity argument on addImage/text.
    doc.setGState(new GState({ opacity: 0.06 }));
    if (brand.logoDataUrl) {
      const size = 80;
      try { doc.addImage(brand.logoDataUrl, 'PNG', cx - size / 2, cy - size / 2 - 20, size, size, undefined, undefined, 30); } catch { /* non-fatal */ }
    }
    doc.setFontSize(52);
    doc.setTextColor(90);
    doc.setFont('helvetica', 'bold');
    doc.text(label, cx, cy + 46, { align: 'center', angle: 30 });
  } finally {
    doc.restoreGraphicsState();
  }
}

/** A circular verification "seal" built from the logo — dropped next to a
 *  signature block so the document visually marks itself as system-
 *  issued. Deliberately labeled "system verified", not any claim of a
 *  real notarized/legal seal. `cx`/`cy` are the seal's center in the
 *  page's own coordinate units (same units as the rest of the document). */
export function drawSeal(doc: jsPDF, brand: PdfBrandKit, cx: number, cy: number, radius = 12): void {
  doc.saveGraphicsState();
  try {
    doc.setGState(new GState({ opacity: 0.9 }));
    doc.setDrawColor(178, 34, 34);
    doc.setLineWidth(0.5);
    doc.circle(cx, cy, radius, 'S');
    doc.circle(cx, cy, radius - 1.6, 'S');
    if (brand.logoDataUrl) {
      const size = radius * 1.15;
      try { doc.addImage(brand.logoDataUrl, 'PNG', cx - size / 2, cy - size / 2, size, size); } catch { /* non-fatal */ }
    }
  } finally {
    doc.restoreGraphicsState();
  }
  doc.setFontSize(5.5);
  doc.setTextColor(150, 40, 35);
  doc.setFont('helvetica', 'bold');
  doc.text('AEGIS · SYSTEM VERIFIED', cx, cy + radius + 4, { align: 'center' });
}

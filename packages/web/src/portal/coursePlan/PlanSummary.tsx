// The 4-stat summary strip at the top of course-plan.pdf: total planned
// credits, this semester's projected GPA, the resulting projected
// cumulative GPA, and the advised maximum credit limit. The first three are
// computed client-side from real PlanCourseDTO numbers (credit-weighted
// average of `expectedPoints`, then folded into the student's current CGPA
// the same way a real semester close would) — flagged as an estimate in the
// caption since it's a projection, not a stored value.
import { RosterCourse } from '../lib/planBundle';
import { CatalogEntry } from '../lib/useCatalogMap';

export function computePlanProjection(plan: RosterCourse[], catalog: Map<string, CatalogEntry>, currentCgpa: number, completedCredits: number | null) {
  const credited = plan.map(c => ({ c, credits: catalog.get(c.courseCode)?.credits ?? 0 }));
  const totalCredits = credited.reduce((s, r) => s + r.credits, 0);
  const qualityPoints = credited.reduce((s, r) => s + r.credits * r.c.expectedPoints, 0);
  const semesterGpa = totalCredits > 0 ? qualityPoints / totalCredits : 0;
  const priorCredits = completedCredits ?? 0;
  const postGpa =
    priorCredits + totalCredits > 0 ? (currentCgpa * priorCredits + qualityPoints) / (priorCredits + totalCredits) : semesterGpa;
  return { totalCredits, semesterGpa, postGpa };
}

export function PlanSummary({
  totalCredits,
  semesterGpa,
  postGpa,
  currentCgpa,
  cap,
  capReason,
}: {
  totalCredits: number;
  semesterGpa: number;
  postGpa: number;
  currentCgpa: number;
  cap: number;
  capReason: string;
}) {
  const exits = currentCgpa < 2.0 && postGpa >= 2.0;
  return (
    <div className="su-stat-grid" style={{ marginBottom: 18 }}>
      <div className="su-stat-card">
        <div className="su-stat-label">Total planned credits</div>
        <div className="su-stat-value" style={{ color: 'var(--su-info)' }}>{totalCredits} <span className="unit">Credits</span></div>
      </div>
      <div className="su-stat-card">
        <div className="su-stat-label">Projected GPA this semester</div>
        <div className="su-stat-value" style={{ color: 'var(--su-good)' }}>{semesterGpa.toFixed(2)}</div>
      </div>
      <div className="su-stat-card">
        <div className="su-stat-label">Projected post-GPA</div>
        <div className="su-stat-value">{postGpa.toFixed(2)}</div>
        <div className={`su-stat-sub${exits ? '' : ''}`} style={{ color: exits ? 'var(--su-good)' : undefined }}>
          {exits ? 'Exits probation' : currentCgpa < 2.0 ? 'Probation continues' : 'Estimate — actual results may vary'}
        </div>
      </div>
      <div className="su-stat-card">
        <div className="su-stat-label">Advised maximum limit</div>
        <div className="su-stat-value accent">{cap} <span className="unit">Credit limit</span></div>
        <div className="su-stat-sub">{capReason}</div>
      </div>
    </div>
  );
}

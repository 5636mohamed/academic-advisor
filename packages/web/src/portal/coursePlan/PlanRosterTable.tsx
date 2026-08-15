// The "Semester Recommended Course Roster" table from course-plan.pdf —
// shared by all three Course Plan modes (Fastest Graduation / Target CGPA
// Focus / Probation Repair), since they all return the same PlanCourseDTO
// shape. `passRate` (already computed server-side, §5's scoring formula) is
// reused verbatim as the "confidence score" bar — not a new number, just the
// existing prediction surfaced the way the mockup shows it.
import { letterClass } from '../lib/studentUiHelpers';
import { RosterCourse } from '../lib/planBundle';
import { CatalogEntry } from '../lib/useCatalogMap';
import { Empty } from '../ui/Primitives';

export function PlanRosterTable({ plan, catalog, categoryTagFor }: { plan: RosterCourse[]; catalog: Map<string, CatalogEntry>; categoryTagFor: (c: RosterCourse) => { label: string; tone: string } }) {
  if (plan.length === 0) return <Empty>No eligible courses were found for this planning run.</Empty>;
  return (
    <div className="su-table-wrap">
      <table className="su-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Code</th>
            <th>Course name</th>
            <th>Credits</th>
            <th>Category tag</th>
            <th>Expected grade</th>
            <th>Best case</th>
            <th>Confidence score</th>
          </tr>
        </thead>
        <tbody>
          {plan.map((c, i) => {
            const meta = catalog.get(c.courseCode);
            const tag = categoryTagFor(c);
            // `passRate` is already 0-100 (see api/client.ts's PlanCourseDTO
            // and PlanMember) — no second *100 here, that was the bug behind
            // "confidence 8500%".
            const confidence = Math.round(c.passRate);
            return (
              <tr key={c.courseCode} className={c.mandatory ? 'mandatory' : ''}>
                <td className="su-muted">{i + 1}</td>
                <td><b>{c.courseCode}</b></td>
                <td>{meta?.name ?? '—'}</td>
                <td>{meta?.credits ?? '—'}</td>
                <td><span className={`su-badge ${tag.tone}`}>{tag.label}</span></td>
                <td className={letterClass(c.expectedLetter)} style={{ fontSize: 15 }}>{c.expectedLetter}</td>
                <td className={letterClass(c.bestCaseLetter)} style={{ fontSize: 15 }}>{c.bestCaseLetter || '—'}</td>
                <td className="su-confidence">
                  <div className="su-confidence-track"><div className="su-confidence-fill" style={{ width: `${confidence}%` }} /></div>
                  <div className="su-confidence-label">{confidence}% confidence</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function defaultCategoryTag(c: RosterCourse, catalog: Map<string, CatalogEntry>, humanize: (cat: string) => string): { label: string; tone: string } {
  if (c.mandatory) return { label: 'Mandatory Retake', tone: 'danger' };
  if (c.isRetake) return { label: 'Retake Option', tone: 'neutral' };
  const meta = catalog.get(c.courseCode);
  return { label: meta ? humanize(meta.category) : 'Core Requirement', tone: 'info' };
}

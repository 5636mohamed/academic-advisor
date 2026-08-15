// Spec §10 component list — a single row in the plan-results table, styled
// distinctly for mandatory (F-retake, required) vs optimizer-chosen slips
// (§5.2 / §10 step 4). Shows §15.2's best-case grade alongside the
// realistic expected one. `hidePct` implements §15.1's student-portal rule
// (letters only, never a raw percentage) — the advisor view passes it as
// false (the default) and keeps showing percentages exactly as before.
import { PlanCourseDTO } from '../api/client';

const letterClass = (letter: string) => `letter-${letter.replace('+', 'p')}`;

export function CourseSlip({ course, hidePct = false }: { course: PlanCourseDTO; hidePct?: boolean }) {
  return (
    <tr className={course.mandatory ? 'mandatory-row' : ''}>
      <td>
        <b>{course.courseCode}</b>
        {course.isRetake && <span className="badge neutral" style={{ marginLeft: 6 }}>retake</span>}
        {course.mandatory && (
          <div className="muted">Mandatory retake — required to graduate (F on record)</div>
        )}
      </td>
      <td className={letterClass(course.expectedLetter)}>
        {course.expectedLetter}
        {!hidePct && ` (${course.expectedPct.toFixed(1)}%)`}
      </td>
      <td className={letterClass(course.bestCaseLetter)}>
        {course.bestCaseLetter}
        {!hidePct && ` (${course.bestCasePct.toFixed(1)}%)`}
      </td>
      <td>{course.deltaPts !== null ? (course.deltaPts > 0 ? `+${course.deltaPts.toFixed(2)}` : course.deltaPts.toFixed(2)) : '—'}</td>
      <td>{course.chainUnlockValue.toFixed(2)}</td>
      <td>{course.mandatory ? '—' : course.score.toFixed(1)}</td>
    </tr>
  );
}

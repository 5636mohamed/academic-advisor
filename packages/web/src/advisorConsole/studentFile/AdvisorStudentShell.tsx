// Per-student drill-down shell — reached from Dashboard/All Students. Not
// its own mockup screen (the mockups only show the Overview tab's content),
// but every other existing advisor feature per student (course plan modes,
// curriculum, probation history, proposal review) needs a home, so this is
// a lightweight sub-nav + outlet in the same su-* chrome, one level under
// the main topbar — same pattern PortalLayout uses for the top level.
// Product-owner decision: the Best-Fit Department Quiz is a student-only
// feature — removed from the advisor's per-student tabs entirely (it still
// lives on the student's own portal, unchanged).
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, StudentSummary } from '../../api/client';
import { Loading } from '../../portal/ui/Primitives';
import { RISK_TONE, riskLevelFor } from '../lib/riskLevel';

export function AdvisorStudentShell() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<StudentSummary | null>(null);

  useEffect(() => {
    if (id) api.getStudent(id).then(setStudent);
  }, [id]);

  if (!id) return null;
  if (!student) return <Loading label="Loading student…" />;

  const risk = riskLevelFor(student.cgpa, student.probationCounter.count);
  const tabs = [
    { to: `/students/${id}`, label: 'Overview', end: true },
    { to: `/students/${id}/course-plan`, label: 'Course Plan' },
    { to: `/students/${id}/curriculum`, label: 'Curriculum' },
    { to: `/students/${id}/probation-history`, label: 'Probation History' },
  ];

  return (
    <div>
      <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div className="su-eyebrow">
            {student.facultyId}/{student.departmentId} · Level {student.level}
            {student.status === 'dismissed' && <span className="su-badge danger" style={{ marginLeft: 8 }}>dismissed</span>}
          </div>
          <div className="su-title" style={{ fontSize: 24 }}>{student.name}</div>
        </div>
        <div className="su-flex su-gap-14 su-items-center">
          <div style={{ textAlign: 'right' }}>
            <div className="su-stat-label">CGPA</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: student.cgpa < 2.0 ? 'var(--su-danger)' : undefined }}>{student.cgpa.toFixed(2)}</div>
          </div>
          <span className={`su-badge ${RISK_TONE[risk]}`}>{risk} risk</span>
        </div>
      </div>

      {student.status === 'dismissed' && (
        <div className="su-note danger su-mt-16" style={{ marginTop: 0, marginBottom: 16 }}>
          This student has been dismissed (warning counter reached 6/6). Advising, transfers, and registration are
          locked at the API layer — contact the registrar for the appeal process.
        </div>
      )}

      <div className="su-subtabs">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `su-subtab${isActive ? ' active' : ''}`}>
            {t.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={{ student, reload: () => api.getStudent(id).then(setStudent) }} />
    </div>
  );
}

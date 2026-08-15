// Spec §10 step 8 — advisor/registrar console: same data as the student
// views, plus a roster overview and each student's transfer/probation audit
// trail. NOT yet implemented (flagged, not silently skipped): recommendation
// override and a `PlanningRun` viewer — this demo layer doesn't persist
// PlanningRun rows (spec §9.3's table exists in schema.prisma but nothing
// writes to it outside the real Postgres path, which isn't wired up here).
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, StudentSummary, TransferRecordDTO, AdvisorReportRowDTO } from '../../api/client';
import { ProbationCounterPill } from '../../components/ProbationCounterPill';
import { downloadAdvisorReportPdf } from '../../lib/pdfReport';

export function AdvisorConsole() {
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferRecordDTO[] | null>(null);
  const [report, setReport] = useState<AdvisorReportRowDTO[] | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.listStudents().then(setStudents);
    api.advisorReport().then(setReport);
  }, []);

  const reportById = new Map((report ?? []).map(r => [r.studentId, r]));

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const rows = await api.advisorReport(); // refresh right before export
      downloadAdvisorReportPdf(rows);
    } finally {
      setDownloading(false);
    }
  };

  const toggle = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    const detail = await api.getStudent(id);
    setTransfers(detail.transferRecords);
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Advisor Console</h2>
          <button disabled={downloading} onClick={downloadReport}>
            {downloading ? 'Building PDF…' : 'Generate Report (PDF)'}
          </button>
        </div>
        <p className="sub">
          Roster-wide view: status, CGPA, warning counter, §15.3 proposal status (pending / advisor-approved /
          registered), and each student's transfer history. The report button (§15.4) exports this as a PDF.
        </p>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
              <th>CGPA</th>
              <th>Warning</th>
              <th>Pending</th>
              <th>Approved</th>
              <th>Registered</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students?.map(s => (
              <Fragment key={s.id}>
                <tr>
                  <td>
                    <Link to={`/students/${s.id}`}>{s.name}</Link>
                  </td>
                  <td>
                    <span className={`badge ${s.status === 'dismissed' ? 'danger' : 'ok'}`}>{s.status}</span>
                  </td>
                  <td>{s.cgpa.toFixed(2)}</td>
                  <td>
                    <ProbationCounterPill count={s.probationCounter.count} />
                  </td>
                  <td>{reportById.get(s.id)?.pendingCount ?? '—'}</td>
                  <td>{reportById.get(s.id)?.advisorApprovedCount ?? '—'}</td>
                  <td>{reportById.get(s.id)?.registeredCount ?? '—'}</td>
                  <td>
                    <button className="secondary" onClick={() => toggle(s.id)}>
                      {expanded === s.id ? 'Hide' : 'Transfers'}
                    </button>
                  </td>
                </tr>
                {expanded === s.id && (
                  <tr>
                    <td colSpan={8}>
                      {transfers && transfers.length === 0 && <span className="muted">No transfers on record.</span>}
                      {transfers?.map((t, i) => (
                        <div key={i} className="muted">
                          {t.type === 'internal_department'
                            ? `Internal: ${t.fromDepartmentId} → ${t.toDepartmentId} (counter ${t.counterAction})`
                            : `Faculty: ${t.fromFacultyId} → ${t.toFacultyId}/${t.toDepartmentId} (counter ${t.counterAction})`}
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>Not yet implemented here</h2>
        <p className="muted">
          Recommendation override now exists per-student (§15.3 — open a student's "Proposals" tab). A `PlanningRun`
          audit viewer is still not implemented: it needs the real Postgres-backed `PlanningRun` table (§9.3) — this
          demo's in-memory store doesn't persist planning runs. See <code>PROGRESS.md</code>.
        </p>
      </div>
    </div>
  );
}

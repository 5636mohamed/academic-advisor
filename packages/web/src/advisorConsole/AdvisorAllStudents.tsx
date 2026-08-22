// "All Students" tab — All students.pdf. Quick filters + full roster +
// "students overview" counts, all real aggregates over api.listStudents().
// Also folds in AdvisorConsole.tsx's old roster-report PDF export (§15.4)
// and per-row transfer-history expand, so neither of those existing
// features gets lost in the redesign — just relocated to where a roster
// screen naturally lives now.
import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, StudentSummary, TransferRecordDTO, AdvisorReportRowDTO } from '../api/client';
import { downloadAdvisorReportPdf } from '../lib/pdfReport';
import { Loading, SearchBox } from '../portal/ui/Primitives';
import { RISK_TONE, riskLevelFor } from './lib/riskLevel';
import { useAuth } from '../auth/AuthContext';

type QuickFilter = 'probation' | 'atRisk' | 'lowCgpa' | 'highCgpa' | 'pending' | null;

export function AdvisorAllStudents() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { auth } = useAuth();
  // This component is only ever rendered inside RequireAdvisor's tree, so
  // auth is always the advisor arm here — narrowed defensively rather than
  // asserted, in case that ever changes.
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [report, setReport] = useState<AdvisorReportRowDTO[] | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<QuickFilter>((params.get('filter') as QuickFilter) ?? null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferRecordDTO[] | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.listStudents(advisorId).then(setStudents);
    api.advisorReport(advisorId).then(setReport);
  }, [advisorId]);

  const reportById = useMemo(() => new Map((report ?? []).map(r => [r.studentId, r])), [report]);

  if (!students) return <Loading label="Loading the student roster…" />;

  const onProbation = students.filter(s => s.probationCounter.count > 0);
  const atRisk = students.filter(s => s.cgpa < 2.5 && s.probationCounter.count === 0);
  const lowCgpa = students.filter(s => s.cgpa < 2.0);
  const highCgpa = students.filter(s => s.cgpa >= 3.0);
  const goodStanding = students.filter(s => s.probationCounter.count === 0 && s.cgpa >= 2.5);

  const filtered = students.filter(s => {
    if (filter === 'probation' && s.probationCounter.count === 0) return false;
    if (filter === 'atRisk' && !(s.cgpa < 2.5 && s.probationCounter.count === 0)) return false;
    if (filter === 'lowCgpa' && s.cgpa >= 2.0) return false;
    if (filter === 'highCgpa' && s.cgpa < 3.0) return false;
    if (filter === 'pending' && !(reportById.get(s.id)?.pendingCount ?? 0 > 0)) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.probationCounter.count - a.probationCounter.count || a.cgpa - b.cgpa);

  const toggle = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const detail = await api.getStudent(id);
    setTransfers(detail.transferRecords);
  };

  const downloadReport = async () => {
    setDownloading(true);
    try {
      await downloadAdvisorReportPdf(await api.advisorReport(advisorId));
    } finally {
      setDownloading(false);
    }
  };

  const FILTERS: Array<{ key: QuickFilter; label: string; count: number }> = [
    { key: 'probation', label: 'Students on probation', count: onProbation.length },
    { key: 'atRisk', label: 'At risk students', count: atRisk.length },
    { key: 'lowCgpa', label: 'Low CGPA (<2.00)', count: lowCgpa.length },
    { key: 'highCgpa', label: 'High CGPA (≥3.00)', count: highCgpa.length },
  ];

  return (
    <div>
      <div className="su-two-col">
        <div>
          <div className="su-card">
            <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="su-title" style={{ fontSize: 18 }}>Find student</div>
              <button className="su-btn su-btn-secondary su-btn-sm" disabled={downloading} onClick={downloadReport}>
                {downloading ? 'Building PDF…' : 'Generate Report (PDF)'}
              </button>
            </div>
            <div className="su-mt-16"><SearchBox value={query} onChange={setQuery} placeholder="Search by name / Id" /></div>
          </div>

          <div className="su-card su-mt-16">
            <div className="su-table-wrap">
              <table className="su-table">
                <thead>
                  <tr><th>Student</th><th>ID</th><th>CGPA</th><th>Risk level</th><th>Probation status</th><th></th></tr>
                </thead>
                <tbody>
                  {sorted.map(s => {
                    const risk = riskLevelFor(s.cgpa, s.probationCounter.count);
                    const r = reportById.get(s.id);
                    return (
                      <Fragment key={s.id}>
                        <tr>
                          <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}><b>{s.name}</b></td>
                          <td className="su-muted">{s.id}</td>
                          <td style={{ fontWeight: 700, color: s.cgpa < 2.0 ? 'var(--su-danger-text)' : s.cgpa >= 3.0 ? 'var(--su-good-text)' : undefined }}>{s.cgpa.toFixed(2)}</td>
                          <td><span className={`su-badge ${RISK_TONE[risk]}`}>{risk}</span></td>
                          <td>
                            <div className="su-flex su-items-center su-gap-8">
                              <span className="su-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{s.probationCounter.count} / 6 semesters</span>
                              <div className="su-confidence-track" style={{ width: 60 }}>
                                <div className="su-confidence-fill" style={{ width: `${(s.probationCounter.count / 6) * 100}%`, background: s.probationCounter.count >= 3 ? 'var(--su-danger)' : 'var(--su-warn)' }} />
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="su-flex su-gap-8">
                              {r && r.pendingCount > 0 && <span className="su-badge warn">{r.pendingCount} pending</span>}
                              <button className="su-btn su-btn-ghost su-btn-sm" onClick={() => toggle(s.id)}>{expanded === s.id ? 'Hide' : 'Transfers'}</button>
                            </div>
                          </td>
                        </tr>
                        {expanded === s.id && (
                          <tr>
                            <td colSpan={6} style={{ background: 'var(--su-bg-soft)' }}>
                              {transfers && transfers.length === 0 && <span className="su-muted">No transfers on record.</span>}
                              {transfers?.map((t, i) => (
                                <div key={i} className="su-muted" style={{ padding: '4px 0' }}>
                                  {t.type === 'internal_department'
                                    ? `Internal: ${t.fromDepartmentId} → ${t.toDepartmentId} (counter ${t.counterAction})`
                                    : `Faculty: ${t.fromFacultyId} → ${t.toFacultyId}/${t.toDepartmentId} (counter ${t.counterAction})`}
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {sorted.length === 0 && <div className="su-empty">No students match the current search/filter.</div>}
            </div>
          </div>
        </div>

        <div>
          <div className="su-card">
            <div className="su-title" style={{ fontSize: 16 }}>Quick filters</div>
            <div className="su-mt-16" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`su-btn ${filter === f.key ? 'su-btn-outline' : 'su-btn-secondary'} su-btn-block`}
                  style={{ justifyContent: 'space-between' }}
                  onClick={() => setFilter(filter === f.key ? null : f.key)}
                >
                  {f.label} <span className="su-badge neutral">{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="su-card su-mt-16">
            <div className="su-title" style={{ fontSize: 16 }}>Students overview</div>
            <div className="su-mt-16" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <OverviewRow label="Total students" value={students.length} />
              <OverviewRow label="On probation" value={`${onProbation.length} (${((onProbation.length / students.length) * 100).toFixed(1)}%)`} tone="danger" />
              <OverviewRow label="At risk" value={`${atRisk.length} (${((atRisk.length / students.length) * 100).toFixed(1)}%)`} tone="warn" />
              <OverviewRow label="Good standing" value={`${goodStanding.length} (${((goodStanding.length / students.length) * 100).toFixed(1)}%)`} tone="good" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewRow({ label, value, tone }: { label: string; value: ReactNode; tone?: 'danger' | 'warn' | 'good' }) {
  return (
    <div className="su-flex su-justify-between su-items-center">
      <span className="su-muted" style={{ fontSize: 13 }}>{label}</span>
      {/* Contrast audit: needs the darkened "-text" variant, same as
          CgpaBarChart's su-bar-value — plain --su-danger/warn/good all
          fail WCAG AA as readable text (warn worst of all, 1.48:1 here). */}
      <span style={{ fontWeight: 800, color: tone ? `var(--su-${tone}-text)` : undefined }}>{value}</span>
    </div>
  );
}

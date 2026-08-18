// "Dashboard" tab — dashboard-advisor.pdf. Every number here is a real
// aggregate over api.listStudents()/api.advisorReport() — no separate
// "alerts" data source exists in this app, so alerts are derived from the
// same signals every other screen already uses (pending proposals,
// dismissed/6-warning students) rather than inventing categories (like the
// mockup's "course plan conflict detected") this app has no way to detect.
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, AdvisorReportRowDTO, StudentSummary } from '../api/client';
import { IconArrowRight, IconCheck, IconPaperPlane } from '../portal/ui/Icons';
import { Loading, SearchBox, Section, StatCard } from '../portal/ui/Primitives';
import { RISK_TONE, riskLevelFor } from './lib/riskLevel';
import { useAuth } from '../auth/AuthContext';

export function AdvisorDashboard() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const advisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [report, setReport] = useState<AdvisorReportRowDTO[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.listStudents(advisorId).then(setStudents);
    api.advisorReport(advisorId).then(setReport);
  }, [advisorId]);

  const reportById = useMemo(() => new Map((report ?? []).map(r => [r.studentId, r])), [report]);

  if (!students) return <Loading label="Loading the advisor dashboard…" />;

  const avgCgpa = students.length > 0 ? students.reduce((s, st) => s + st.cgpa, 0) / students.length : 0;
  const onProbation = students.filter(s => s.probationCounter.count > 0);
  const dismissed = students.filter(s => s.status === 'dismissed');
  const pendingTotal = report ? report.reduce((s, r) => s + r.pendingCount, 0) : 0;
  const studentsWithPending = report ? report.filter(r => r.pendingCount > 0).length : 0;
  const alertCount = studentsWithPending + dismissed.length;

  const mostNeedAdvising = [...students]
    .sort((a, b) => b.probationCounter.count - a.probationCounter.count || a.cgpa - b.cgpa)
    .filter(s => s.probationCounter.count > 0 || s.cgpa < 2.3)
    .slice(0, 5);

  const searchResults = query.trim()
    ? students.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.id.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div>
      <Section title="Find student" right={<button className="su-btn su-btn-outline su-btn-sm" onClick={() => navigate('/students')}>Advanced search</button>}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search by name / Id" />
        {query.trim() && (
          <div className="su-mt-16" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searchResults.length === 0 && <div className="su-muted">No students match “{query}”.</div>}
            {searchResults.slice(0, 6).map(s => (
              <button key={s.id} className="su-quick-item" onClick={() => navigate(`/students/${s.id}`)}>
                <span className="su-quick-dot" style={{ background: 'var(--su-accent)' }} />
                <span className="body">
                  <span className="head">{s.name}</span>
                  <span className="desc">ID: {s.id} · CGPA {s.cgpa.toFixed(2)}</span>
                </span>
                <IconArrowRight className="chev" width={16} height={16} />
              </button>
            ))}
          </div>
        )}
      </Section>

      <div className="su-stat-grid su-stagger su-mt-16">
        <StatCard label="AVG CGPA (all students)" value={avgCgpa.toFixed(2)} unit="/ 4.00" accent sub="Target: 3.00 AVG CGPA" />
        <StatCard label="Total students" value={students.length} sub="Across the advised roster" />
        <StatCard
          label="Students on probation"
          value={`${onProbation.length} / ${students.length}`}
          sub={students.length > 0 ? `${((onProbation.length / students.length) * 100).toFixed(1)}% of total students` : undefined}
          subTone={onProbation.length > 0 ? 'warn' : 'muted'}
        />
        <StatCard label="Alert / action required" value={alertCount} sub={alertCount > 0 ? 'Needs your attention' : 'All clear'} subTone={alertCount > 0 ? 'warn' : 'muted'} />
      </div>

      <div className="su-two-col su-mt-16">
        <Section
          eyebrow="Ranked by probation status and CGPA"
          title="Students need advising the most"
          right={<button className="su-btn su-btn-outline su-btn-sm" onClick={() => navigate('/students?filter=probation')}>View all</button>}
        >
          {mostNeedAdvising.length === 0 ? (
            <div className="su-muted">No students currently flagged — everyone is in good standing.</div>
          ) : (
            <div className="su-table-wrap">
              <table className="su-table">
                <thead>
                  <tr><th>Student</th><th>ID</th><th>CGPA</th><th>Risk level</th><th>Probation status</th></tr>
                </thead>
                <tbody>
                  {mostNeedAdvising.map(s => {
                    const risk = riskLevelFor(s.cgpa, s.probationCounter.count);
                    return (
                      <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
                        <td><b>{s.name}</b></td>
                        <td className="su-muted">{s.id}</td>
                        <td style={{ color: s.cgpa < 2.0 ? 'var(--su-danger)' : undefined, fontWeight: 700 }}>{s.cgpa.toFixed(2)}</td>
                        <td><span className={`su-badge ${RISK_TONE[risk]}`}>{risk}</span></td>
                        <td>
                          <div className="su-flex su-items-center su-gap-8">
                            <span className="su-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{s.probationCounter.count} / 6 semesters</span>
                            <div className="su-confidence-track" style={{ width: 70 }}>
                              <div className="su-confidence-fill" style={{ width: `${(s.probationCounter.count / 6) * 100}%`, background: s.probationCounter.count >= 3 ? 'var(--su-danger)' : 'var(--su-warn)' }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Alerts and notifications">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {studentsWithPending > 0 && (
              <AlertRow icon={<IconPaperPlane width={15} height={15} />} text={`${studentsWithPending} student${studentsWithPending > 1 ? 's have' : ' has'} course plan approvals pending (${pendingTotal} proposal${pendingTotal > 1 ? 's' : ''})`} onClick={() => navigate('/students?filter=pending')} />
            )}
            {dismissed.length > 0 && (
              <AlertRow icon={<IconCheck width={15} height={15} />} text={`${dismissed.length} student${dismissed.length > 1 ? 's have' : ' has'} reached 6 semesters on probation`} onClick={() => navigate('/students?filter=probation')} />
            )}
            {alertCount === 0 && <div className="su-muted">No alerts right now.</div>}
          </div>
          <button className="su-btn su-btn-secondary su-btn-block su-mt-16" onClick={() => navigate('/students')}>View all students</button>
        </Section>
      </div>
    </div>
  );
}

function AlertRow({ icon, text, onClick }: { icon: ReactNode; text: string; onClick: () => void }) {
  return (
    <button className="su-quick-item" onClick={onClick}>
      <span className="su-quick-dot" style={{ background: 'var(--su-danger)' }} />
      <span className="body"><span className="head" style={{ fontWeight: 600 }}>{text}</span></span>
      {icon}
    </button>
  );
}

// Ranked, auto-generated candidate list for one venture project —
// Accept/Decline, view CV inline. Restyled from the old
// FacultyProjectCandidates.tsx; capacity is still enforced server-side.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, VentureCandidateDTO } from '../../api/client';
import { ScoreRow } from '../../portal/ui/Primitives';

export function AdvisorProjectCandidates() {
  const { professorId, projectId } = useParams<{ professorId: string; projectId: string }>();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<VentureCandidateDTO[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingCv, setViewingCv] = useState<{ studentName: string; fileName: string; dataUrl: string } | null>(null);

  const load = () => { if (professorId && projectId) api.ventureCandidates(professorId, projectId).then(setCandidates); };
  useEffect(load, [professorId, projectId]);

  if (!professorId || !projectId) return null;

  const act = async (matchId: string, status: 'accepted' | 'declined') => {
    setBusyId(matchId);
    setError(null);
    try { await api.setVentureMatchStatus(matchId, status); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  };

  return (
    <div>
      <button className="su-btn su-btn-ghost su-btn-sm" onClick={() => navigate(`/venture-board/${professorId}`)} style={{ marginBottom: 12 }}>← Back to projects</button>

      <div className="su-card">
        <div className="su-title" style={{ fontSize: 16 }}>Ranked Candidates</div>
        <div className="su-subtitle">Every opted-in Level 3+ student who answered the Venture Gate, scored against this project — not just the ones who've already applied.</div>
        {error && <div className="su-note danger su-mt-16">{error}</div>}
      </div>

      <div className="su-card su-mt-16">
        {candidates === null ? (
          <div className="su-loading"><div className="su-spinner" /></div>
        ) : candidates.length === 0 ? (
          <div className="su-empty">No opted-in candidates yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {candidates.map(c => (
              <div key={c.studentId} style={{ borderBottom: '1px solid var(--su-border)', paddingBottom: 16 }}>
                <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <b>{c.studentName}</b>
                    <span className="su-badge neutral" style={{ marginLeft: 8 }}>{c.status}</span>
                  </div>
                  <div className="su-flex su-gap-10 su-items-center">
                    {c.cvDataUrl ? (
                      <button className="su-btn su-btn-sm su-btn-secondary" onClick={() => setViewingCv({ studentName: c.studentName, fileName: c.cvFileName ?? 'CV', dataUrl: c.cvDataUrl! })}>View CV</button>
                    ) : (
                      <span className="su-muted" style={{ fontSize: 12 }}>no CV</span>
                    )}
                    {c.matchId && (c.status === 'applied' || c.status === 'suggested') && (
                      <>
                        <button className="su-btn su-btn-sm" disabled={busyId === c.matchId} onClick={() => act(c.matchId!, 'accepted')}>Accept</button>
                        <button className="su-btn su-btn-sm su-btn-ghost" disabled={busyId === c.matchId} onClick={() => act(c.matchId!, 'declined')}>Decline</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="su-mt-16">
                  <ScoreRow name="Course competency" pct={c.courseCompetencyScore} />
                  <ScoreRow name="Skill alignment" pct={c.skillAlignmentScore} />
                  <ScoreRow name="Trajectory" pct={c.academicTrajectoryScore} />
                  <div style={{ marginTop: 6 }}><span className="su-badge solid">Total {Math.round(c.total * 100)}%</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingCv && (
        <div className="su-modal-overlay" role="dialog" aria-label={`${viewingCv.studentName}'s CV`} onMouseDown={e => e.target === e.currentTarget && setViewingCv(null)}>
          <div className="su-modal su-pop" style={{ maxWidth: 900, width: '90vw' }}>
            <div className="su-card" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 10 }}>
                <div className="su-title" style={{ fontSize: 15 }}>{viewingCv.studentName}'s CV — {viewingCv.fileName}</div>
                <button className="su-btn su-btn-sm su-btn-secondary" onClick={() => setViewingCv(null)}>Close</button>
              </div>
              <iframe title={`${viewingCv.studentName}'s CV`} src={viewingCv.dataUrl} style={{ flex: 1, width: '100%', border: '1px solid var(--su-border)', borderRadius: 8 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

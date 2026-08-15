// Spec §16.6 — ranked, auto-generated candidate list for one project, with
// Accept/Decline on any applied/suggested match. Capacity is enforced
// server-side (§16.8) — an accept beyond capacity comes back as an error,
// shown here rather than silently allowed.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, VentureCandidateDTO } from '../api/client';

export function FacultyProjectCandidates() {
  const { id, projectId } = useParams<{ id: string; projectId: string }>();
  const [candidates, setCandidates] = useState<VentureCandidateDTO[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingCv, setViewingCv] = useState<{ studentName: string; fileName: string; dataUrl: string } | null>(null);

  const load = () => {
    if (id && projectId) api.ventureCandidates(id, projectId).then(setCandidates);
  };

  useEffect(load, [id, projectId]);

  if (!id || !projectId) return null;

  const act = async (matchId: string, status: 'accepted' | 'declined') => {
    setBusyId(matchId);
    setError(null);
    try {
      await api.setVentureMatchStatus(matchId, status);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Ranked Candidates</h2>
        <p className="sub">Every opted-in Level 3+ student who answered the Venture Gate, scored against this project — not just the ones who've already applied.</p>
        {error && <div className="note" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{error}</div>}
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Course competency</th>
              <th>Skill alignment</th>
              <th>Trajectory</th>
              <th>Total</th>
              <th>Status</th>
              <th>CV</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {candidates?.map(c => (
              <tr key={c.studentId}>
                <td>{c.studentName}</td>
                <td>{Math.round(c.courseCompetencyScore * 100)}%</td>
                <td>{Math.round(c.skillAlignmentScore * 100)}%</td>
                <td>{Math.round(c.academicTrajectoryScore * 100)}%</td>
                <td><b>{Math.round(c.total * 100)}%</b></td>
                <td><span className="badge neutral">{c.status}</span></td>
                <td>
                  {c.cvDataUrl ? (
                    <button
                      className="secondary"
                      onClick={() => setViewingCv({ studentName: c.studentName, fileName: c.cvFileName ?? 'CV', dataUrl: c.cvDataUrl! })}
                    >
                      View CV
                    </button>
                  ) : (
                    <span className="muted">none</span>
                  )}
                </td>
                <td>
                  {c.matchId && (c.status === 'applied' || c.status === 'suggested') && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button disabled={busyId === c.matchId} onClick={() => act(c.matchId!, 'accepted')}>Accept</button>
                      <button className="secondary" disabled={busyId === c.matchId} onClick={() => act(c.matchId!, 'declined')}>Decline</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {candidates && candidates.length === 0 && <div className="empty-state">No opted-in candidates yet.</div>}
      </div>

      {viewingCv && (
        <div
          role="dialog"
          aria-label={`${viewingCv.studentName}'s CV`}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24,
          }}
          onClick={() => setViewingCv(null)}
        >
          <div className="card" style={{ width: '100%', maxWidth: 900, height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>{viewingCv.studentName}'s CV — {viewingCv.fileName}</h2>
              <button className="secondary" onClick={() => setViewingCv(null)}>Close</button>
            </div>
            {/* Rendered inline via the browser's built-in PDF viewer — no download, stays on the site. */}
            <iframe title={`${viewingCv.studentName}'s CV`} src={viewingCv.dataUrl} style={{ flex: 1, width: '100%', border: '1px solid var(--rule)', borderRadius: 4 }} />
          </div>
        </div>
      )}
    </div>
  );
}

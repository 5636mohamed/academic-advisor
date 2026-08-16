// "Venture board" tab — rebuilt to match venture-board-advisor.pdf: the
// advisor owns every venture directly (post/edit/archive, review
// candidates) rather than browsing a directory of separate professors —
// no other-professor attribution is shown anywhere on this screen. A
// three-pane live dashboard: My venture (left) → Pending approvals (middle,
// filterable by venture) → selected candidate's full profile (right,
// Accept/Reject). "View all ventures" expands full project management
// (create/edit/archive) below.
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, AdvisorVentureProjectRowDTO, StudentDetail, VentureCandidateDTO, VentureProjectType, VentureQuizQuestionDTO } from '../../api/client';
import { Loading, ScoreRow, SearchBox } from '../../portal/ui/Primitives';
import { IconLayers, IconPeople, IconPlus } from '../../portal/ui/Icons';

const ADVISOR_PROFESSOR_ID = 'advisor-owned';

/** Mirrors server.ts's isPendingCandidate (§16.2: a qualifying match only
 *  gets a real, actionable row once the student visits their own Venture
 *  Board — this also surfaces a high-scoring match nobody's touched yet,
 *  same 0.80 threshold weights.ventureFit.matchThreshold uses server-side). */
function isPendingCandidate(c: VentureCandidateDTO): boolean {
  return c.status === 'applied' || c.status === 'suggested' || (c.status === 'unscored' && c.total >= 0.8);
}

interface SelectedCandidate {
  candidate: VentureCandidateDTO;
  row: AdvisorVentureProjectRowDTO;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function AdvisorVentureBoard() {
  const [rows, setRows] = useState<AdvisorVentureProjectRowDTO[] | null>(null);
  const [ventureQuiz, setVentureQuiz] = useState<VentureQuizQuestionDTO[] | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedCandidate | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.advisorVentureProjects().then(setRows).catch(e => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => {
    load();
    api.ventureQuiz().then(setVentureQuiz);
  }, []);

  if (!rows) return <Loading label="Loading your ventures…" />;

  const activeRows = rows.filter(r => r.project.isActive);
  const pendingRows = (filterProjectId ? activeRows.filter(r => r.project.id === filterProjectId) : activeRows);
  const pendingList = pendingRows.flatMap(row =>
    row.candidates.filter(isPendingCandidate).map(c => ({ candidate: c, row }))
  );
  const totalPending = activeRows.reduce((s, r) => s + r.pendingCount, 0);

  const act = async (matchId: string, status: 'accepted' | 'declined') => {
    try {
      await api.setVentureMatchStatus(matchId, status);
      setSelected(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="su-eyebrow">Innovation &amp; Venture Catalyst</div>
          <div className="su-title" style={{ fontSize: 24 }}>Venture Board</div>
        </div>
      </div>
      {error && <div className="su-note danger su-mt-16" style={{ marginTop: 0, marginBottom: 16 }}>{error}</div>}

      <div className="su-venture-3col">
        {/* --- Left: My venture --- */}
        <div>
          <CreateVentureCard onCreated={load} />
          <div className="su-card su-mt-16">
            <div className="su-title" style={{ fontSize: 15 }}>My venture</div>
            <div className="su-subtitle" style={{ marginTop: 2, marginBottom: 12 }}>Manage and track my ventures</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className={`su-quick-item${filterProjectId === null ? ' selected' : ''}`}
                style={{ borderColor: filterProjectId === null ? 'var(--su-accent)' : undefined }}
                onClick={() => setFilterProjectId(null)}
              >
                <span className="su-quick-dot" style={{ background: 'var(--su-accent)' }} />
                <span className="body"><span className="head">All ventures</span><span className="desc">{activeRows.length} active</span></span>
              </button>
              {activeRows.map(r => (
                <button
                  key={r.project.id}
                  className="su-quick-item"
                  style={{ borderColor: filterProjectId === r.project.id ? 'var(--su-accent)' : undefined }}
                  onClick={() => setFilterProjectId(r.project.id)}
                >
                  <span className="su-quick-dot" style={{ background: r.project.type === 'commercial_spinoff' ? 'var(--su-warn)' : 'var(--su-info)' }} />
                  <span className="body">
                    <span className="head">{r.project.title}</span>
                    <span className="desc">{r.acceptedCount} member{r.acceptedCount !== 1 ? 's' : ''}{r.pendingCount > 0 ? ` · ${r.pendingCount} pending` : ''}</span>
                  </span>
                </button>
              ))}
              {activeRows.length === 0 && <div className="su-muted">No active ventures yet — create one above.</div>}
            </div>
            <button className="su-btn su-btn-secondary su-btn-block su-mt-16" onClick={() => setManageOpen(o => !o)}>
              {manageOpen ? 'Hide venture management' : 'View all ventures'}
            </button>
          </div>
        </div>

        {/* --- Middle: Pending approvals --- */}
        <div className="su-card">
          <div className="su-title" style={{ fontSize: 15 }}>Pending approvals</div>
          <div className="su-subtitle" style={{ marginTop: 2 }}>Students interested in your ventures</div>
          <div className="su-subtabs su-mt-16">
            <button className={`su-subtab${filterProjectId === null ? ' active' : ''}`} onClick={() => setFilterProjectId(null)}>All ventures ({totalPending})</button>
            {activeRows.filter(r => r.pendingCount > 0).map(r => (
              <button key={r.project.id} className={`su-subtab${filterProjectId === r.project.id ? ' active' : ''}`} onClick={() => setFilterProjectId(r.project.id)}>
                {r.project.title} ({r.pendingCount})
              </button>
            ))}
          </div>
          {pendingList.length === 0 ? (
            <div className="su-empty">No pending applications right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingList.map(({ candidate, row }) => (
                <div key={`${row.project.id}-${candidate.studentId}`} className="su-flex su-justify-between su-items-center" style={{ border: '1px solid var(--su-border)', borderRadius: 'var(--su-radius-sm)', padding: '10px 14px' }}>
                  <div className="su-flex su-gap-10 su-items-center">
                    <span className="su-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(candidate.studentName)}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{candidate.studentName}</div>
                      <div className="su-muted" style={{ fontSize: 11.5 }}>{row.project.title}</div>
                    </div>
                  </div>
                  <button className="su-btn su-btn-sm su-btn-outline" onClick={() => setSelected({ candidate, row })}>Review</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- Right: candidate detail --- */}
        <div>
          {selected ? (
            <CandidateDetail selected={selected} ventureQuiz={ventureQuiz} onAct={act} onClose={() => setSelected(null)} />
          ) : (
            <div className="su-card su-empty" style={{ minHeight: 260 }}>Select a candidate from "Pending approvals" to review their profile.</div>
          )}
        </div>
      </div>

      {manageOpen && <ManageVentures rows={rows} onChanged={load} />}
    </div>
  );
}

function CreateVentureCard({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', type: 'academic_research' as VentureProjectType, requiredCourseCodes: '', preferredSkills: '', capacity: 2 });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createVentureProject(ADVISOR_PROFESSOR_ID, {
        title: form.title,
        description: form.description,
        type: form.type,
        requiredCourseCodes: form.requiredCourseCodes.split(',').map(s => s.trim()).filter(Boolean),
        preferredSkills: form.preferredSkills.split(',').map(s => s.trim()).filter(Boolean),
        capacity: Number(form.capacity) || 1,
        isActive: true,
      });
      setForm({ title: '', description: '', type: 'academic_research', requiredCourseCodes: '', preferredSkills: '', capacity: 2 });
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="su-btn su-btn-outline su-btn-block" onClick={() => setOpen(true)}>
        <IconPlus width={15} height={15} /> Create new venture
      </button>
    );
  }

  return (
    <form className="su-card su-pop" onSubmit={create}>
      <div className="su-title" style={{ fontSize: 15, marginBottom: 12 }}>New venture</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="su-input" placeholder="Title" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <input className="su-input" placeholder="Description" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <div className="su-flex su-gap-10">
          <select className="su-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as VentureProjectType })}>
            <option value="academic_research">Academic research</option>
            <option value="commercial_spinoff">Commercial spin-off</option>
          </select>
          <input className="su-input" type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} style={{ width: 90 }} />
        </div>
        <input className="su-input" placeholder="Required course codes (comma-separated)" value={form.requiredCourseCodes} onChange={e => setForm({ ...form, requiredCourseCodes: e.target.value })} />
        <input className="su-input" placeholder="Preferred skills (comma-separated)" value={form.preferredSkills} onChange={e => setForm({ ...form, preferredSkills: e.target.value })} />
      </div>
      {error && <div className="su-note danger su-mt-16">{error}</div>}
      <div className="su-flex su-gap-10 su-mt-16">
        <button type="button" className="su-btn su-btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="su-btn" disabled={busy}>Create</button>
      </div>
    </form>
  );
}

function CandidateDetail({
  selected,
  ventureQuiz,
  onAct,
  onClose,
}: {
  selected: SelectedCandidate;
  ventureQuiz: VentureQuizQuestionDTO[] | null;
  onAct: (matchId: string, status: 'accepted' | 'declined') => void;
  onClose: () => void;
}) {
  const { candidate, row } = selected;
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [interestAnswers, setInterestAnswers] = useState<Record<string, string> | null>(null);
  const [viewingCv, setViewingCv] = useState(false);

  useEffect(() => {
    setStudent(null);
    setInterestAnswers(null);
    api.getStudent(candidate.studentId).then(setStudent);
    api.getVentureInterestAnswers(candidate.studentId).then(a => setInterestAnswers(a.answers));
  }, [candidate.studentId]);

  const interestLabels = useMemo(() => {
    if (!ventureQuiz || !interestAnswers) return [];
    return ventureQuiz
      .map(q => {
        const chosen = interestAnswers[q.id];
        const option = q.options.find(o => o.id === chosen);
        return option ? { question: q.text, label: option.label } : null;
      })
      .filter((x): x is { question: string; label: string } => x !== null);
  }, [ventureQuiz, interestAnswers]);

  return (
    <div className="su-card su-pop" key={candidate.studentId}>
      <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="su-flex su-gap-14 su-items-center">
          <span className="su-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(candidate.studentName)}</span>
          <div>
            <div className="su-title" style={{ fontSize: 17 }}>{candidate.studentName}</div>
            <div className="su-muted" style={{ fontSize: 12.5 }}>
              ID: {candidate.studentId}{student ? ` · Level ${student.level} · ${student.facultyId}/${student.departmentId}` : ''}
            </div>
          </div>
        </div>
        {candidate.matchId && (candidate.status === 'applied' || candidate.status === 'suggested') ? (
          <div className="su-flex su-gap-8">
            <button className="su-btn su-btn-sm" style={{ background: 'var(--su-good)' }} onClick={() => onAct(candidate.matchId!, 'accepted')}>Accept</button>
            <button className="su-btn su-btn-sm su-btn-outline" onClick={() => onAct(candidate.matchId!, 'declined')}>Reject</button>
          </div>
        ) : (
          <span className="su-badge warn">Qualifies — awaiting student action</span>
        )}
      </div>
      {!candidate.matchId && (
        <div className="su-subtitle" style={{ marginTop: 8 }}>
          This student's score already clears the match threshold, but they haven't opened their own Venture Board or
          applied yet — accept/reject becomes available once they do.
        </div>
      )}

      {student && (
        <div className="su-stat-grid su-mt-16" style={{ gridTemplateColumns: 'repeat(2, minmax(140px,1fr))' }}>
          <div className="su-stat-card"><div className="su-stat-label">Cumulative GPA</div><div className="su-stat-value" style={{ color: student.cgpa < 2.0 ? 'var(--su-danger)' : undefined }}>{student.cgpa.toFixed(2)}</div></div>
          <div className="su-stat-card"><div className="su-stat-label">Warning counter</div><div className="su-stat-value">{student.probationCounter.count} / 6</div></div>
        </div>
      )}

      <div className="su-mt-16">
        <ScoreRow name="Course competency" pct={candidate.courseCompetencyScore} />
        <ScoreRow name="Skill alignment" pct={candidate.skillAlignmentScore} />
        <ScoreRow name="Academic trajectory" pct={candidate.academicTrajectoryScore} />
      </div>

      <div className="su-note su-mt-16">Interested venture: <b>{row.project.title}</b></div>

      {interestLabels.length > 0 && (
        <div className="su-mt-16">
          <div className="su-eyebrow" style={{ marginBottom: 8 }}>Interest signals (venture interest form)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {interestLabels.map(l => (
              <div key={l.question} style={{ fontSize: 12.5 }}><span className="su-muted">{l.question}</span> — {l.label}</div>
            ))}
          </div>
        </div>
      )}

      <div className="su-mt-16">
        <div className="su-eyebrow" style={{ marginBottom: 8 }}>Documents and links</div>
        {candidate.cvDataUrl ? (
          <div className="su-flex su-justify-between su-items-center" style={{ border: '1px solid var(--su-border)', borderRadius: 'var(--su-radius-sm)', padding: '10px 14px' }}>
            <span>CV — {candidate.cvFileName ?? 'attached'}</span>
            <button className="su-btn su-btn-sm su-btn-outline" onClick={() => setViewingCv(true)}>View</button>
          </div>
        ) : (
          <div className="su-muted" style={{ fontSize: 12.5 }}>No CV attached.</div>
        )}
      </div>

      <button className="su-btn su-btn-ghost su-btn-sm su-mt-16" onClick={onClose}>Close</button>

      {viewingCv && candidate.cvDataUrl && (
        <div className="su-modal-overlay" role="dialog" onMouseDown={e => e.target === e.currentTarget && setViewingCv(false)}>
          <div className="su-modal su-pop" style={{ maxWidth: 900, width: '90vw' }}>
            <div className="su-card" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 10 }}>
                <div className="su-title" style={{ fontSize: 15 }}>{candidate.studentName}'s CV</div>
                <button className="su-btn su-btn-sm su-btn-secondary" onClick={() => setViewingCv(false)}>Close</button>
              </div>
              <iframe title={`${candidate.studentName}'s CV`} src={candidate.cvDataUrl} style={{ flex: 1, width: '100%', border: '1px solid var(--su-border)', borderRadius: 8 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManageVentures({ rows, onChanged }: { rows: AdvisorVentureProjectRowDTO[]; onChanged: () => void }) {
  const [query, setQuery] = useState('');
  const filtered = rows.filter(r => !query.trim() || r.project.title.toLowerCase().includes(query.trim().toLowerCase()));

  const toggleActive = async (row: AdvisorVentureProjectRowDTO) => {
    await api.updateVentureProject(row.project.professorId, row.project.id, { isActive: !row.project.isActive });
    onChanged();
  };

  return (
    <div className="su-card su-mt-20 su-fade">
      <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="su-title" style={{ fontSize: 16 }}>Manage all ventures</div>
        <SearchBox value={query} onChange={setQuery} placeholder="Search ventures" />
      </div>
      <div className="su-stagger su-mt-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(r => (
          <div className="su-card" key={r.project.id}>
            <div className="su-flex su-justify-between su-items-center">
              <div className="su-title" style={{ fontSize: 15 }}>{r.project.title}</div>
              <span className={`su-badge ${r.project.isActive ? 'ok' : 'neutral'}`}>{r.project.isActive ? 'active' : 'archived'}</span>
            </div>
            <div className="su-subtitle">{r.project.description}</div>
            <div className="su-muted" style={{ fontSize: 12, marginBottom: 12 }}>
              {r.project.type === 'commercial_spinoff' ? 'Commercial spin-off' : 'Academic research'} · capacity {r.project.capacity} · {r.acceptedCount} member{r.acceptedCount !== 1 ? 's' : ''} · required: {r.project.requiredCourseCodes.join(', ') || '—'}
            </div>
            <button className="su-btn su-btn-sm su-btn-ghost" onClick={() => toggleActive(r)}>{r.project.isActive ? 'Archive' : 'Reactivate'}</button>
          </div>
        ))}
        {filtered.length === 0 && <div className="su-empty">No ventures match “{query}”.</div>}
      </div>
      <div className="su-flex su-items-center su-gap-8 su-mt-16" style={{ color: 'var(--su-text-muted)', fontSize: 12 }}>
        <IconLayers width={14} height={14} /> {rows.length} total · <IconPeople width={14} height={14} /> {rows.reduce((s, r) => s + r.acceptedCount, 0)} accepted members
      </div>
    </div>
  );
}

// "Venture board" tab — rebuilt to match venture-board-advisor.pdf: a
// professor (advisor OR the Vice President, when posting their own
// ventures) owns and sees only THEIR OWN ventures — post/edit/archive,
// review candidates for the projects they themselves posted, never anyone
// else's. This used to show every advisor's postings pooled together under
// one shared 'advisor-owned' attribution anchor (fixed once 5 real advisor
// identities existed), and the VP's own board used to ALSO cross-view
// every advisor's ventures — per explicit request, that cross-advisor view
// has been removed from the Venture Board entirely: the VP's own board
// (VpVentureBoard.tsx) now reuses this exact same component, scoped to
// 'vp-owned' only, with no special-cased "view everyone" mode left in this
// file at all. Cross-advisor oversight of funding now lives on the VP's
// Innovation Topography page instead (see VpInnovationTopography.tsx's
// "Venture Grant Requests" section) — this file only ever shows one
// professor's own postings, whoever's logged in. A three-pane live
// dashboard: My venture (left) → Pending approvals (middle, filterable by
// venture) → selected candidate's full profile (right, Accept/Reject).
// "View all ventures" expands full project management (create/edit/
// archive) below. Students are the only role that ever sees every
// professor's projects together — PortalVentureBoard.tsx, unrelated to
// this file, is intentionally unscoped for exactly that reason.
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, AdvisorVentureProjectRowDTO, StudentDetail, VentureCandidateDTO, VentureProjectType, VentureQuizQuestionDTO } from '../../api/client';
import { Loading, ScoreRow, SearchBox } from '../../portal/ui/Primitives';
import { IconLayers, IconPeople, IconPlus } from '../../portal/ui/Icons';
import { ResearchDetails } from '../../portal/venture/VentureProjectCard';
import { useAuth } from '../../auth/AuthContext';
import { readFileAsDataUrl } from '../../lib/readFileAsDataUrl';

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

/** `professorId` overrides the attribution new projects get created
 *  under — VpVentureBoard.tsx passes `professorId="vp-owned"` (its own
 *  singleton anchor). Left unset, it defaults to the real logged-in
 *  advisor's own id (from AuthContext) — new projects attribute to them by
 *  name, and the board always fetches/shows only that one professorId's
 *  own ventures, never anyone else's — whoever is logged in. */
export function AdvisorVentureBoard({ professorId }: { professorId?: string } = {}) {
  const { auth } = useAuth();
  const ownAdvisorId = auth?.role === 'advisor' ? auth.advisorId : undefined;
  const effectiveProfessorId = professorId ?? ownAdvisorId ?? '';

  const [rows, setRows] = useState<AdvisorVentureProjectRowDTO[] | null>(null);
  const [ventureQuiz, setVentureQuiz] = useState<VentureQuizQuestionDTO[] | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedCandidate | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.advisorVentureProjects(effectiveProfessorId).then(setRows).catch(e => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => {
    load();
    api.ventureQuiz().then(setVentureQuiz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveProfessorId]);

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

      {/* Projects live in a narrow sidebar; applicant review gets the
          whole rest of the page instead of being squeezed into a third
          equal column — reviewing an applicant's full profile (scores,
          GPA, CV) needs real width, not 1/3 of it. Clicking "Review"
          expands that applicant's data directly under their own row (an
          accordion, not a separate panel elsewhere on the page). */}
      <div className="su-flex su-gap-18" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* --- Sidebar: My venture --- */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <CreateVentureCard professorId={effectiveProfessorId} onCreated={load} />
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

        {/* --- Main: Pending approvals, full remaining width --- */}
        <div className="su-card" style={{ flex: 1, minWidth: 320 }}>
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
              {pendingList.map(({ candidate, row }) => {
                const isOpen = selected?.candidate.studentId === candidate.studentId && selected?.row.project.id === row.project.id;
                return (
                  <div key={`${row.project.id}-${candidate.studentId}`} style={{ border: '1px solid var(--su-border)', borderRadius: 'var(--su-radius-sm)', overflow: 'hidden' }}>
                    <div className="su-flex su-justify-between su-items-center" style={{ padding: '10px 14px' }}>
                      <div className="su-flex su-gap-10 su-items-center">
                        <span className="su-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(candidate.studentName)}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{candidate.studentName}</div>
                          <div className="su-muted" style={{ fontSize: 11.5 }}>{row.project.title}</div>
                        </div>
                      </div>
                      <button className="su-btn su-btn-sm su-btn-outline" onClick={() => setSelected(isOpen ? null : { candidate, row })}>
                        {isOpen ? 'Hide' : 'Review'}
                      </button>
                    </div>
                    {/* The applicant's full data, directly under their own
                        name/row — not a separate panel elsewhere. */}
                    {isOpen && (
                      <div style={{ borderTop: '1px solid var(--su-border)', padding: 14, background: 'var(--su-surface-2)' }}>
                        <CandidateDetail selected={selected!} ventureQuiz={ventureQuiz} onAct={act} onClose={() => setSelected(null)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {manageOpen && <ManageVentures rows={rows} onChanged={load} />}
    </div>
  );
}

const BLANK_FORM = {
  title: '', description: '', type: 'academic_research' as VentureProjectType, requiredCourseCodes: '', preferredSkills: '', capacity: 2,
  // VP epic — "research portal": optional, all blank by default so a plain
  // open-position project posts exactly as it always has.
  authorsText: '', publishedPaperUrl: '', conferenceName: '', impactFactor: '', labName: '',
  // Graduation Project epic — off by default, same "plain post unless
  // opted in" philosophy as the research-portal fields above.
  isGraduationProject: false,
};

/** "Name <link>" or bare "Name" per line — kept as free text rather than a
 *  repeating-row form widget, matching how requiredCourseCodes/preferredSkills
 *  are already just comma-separated text above. */
function parseAuthors(text: string): { name: string; link?: string }[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const m = line.match(/^(.*?)\s*<(https?:\/\/[^>]+)>$/);
    return m ? { name: m[1].trim(), link: m[2].trim() } : { name: line };
  });
}

function CreateVentureCard({ professorId, onCreated }: { professorId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createVentureProject(professorId, {
        title: form.title,
        description: form.description,
        type: form.type,
        requiredCourseCodes: form.requiredCourseCodes.split(',').map(s => s.trim()).filter(Boolean),
        preferredSkills: form.preferredSkills.split(',').map(s => s.trim()).filter(Boolean),
        capacity: Number(form.capacity) || 1,
        isActive: true,
        authors: parseAuthors(form.authorsText),
        publishedPaperUrl: form.publishedPaperUrl.trim() || undefined,
        conferenceName: form.conferenceName.trim() || undefined,
        impactFactor: form.impactFactor.trim() ? Number(form.impactFactor) : undefined,
        labName: form.labName.trim() || undefined,
        isGraduationProject: form.isGraduationProject || undefined,
      });
      setForm(BLANK_FORM);
      setShowResearch(false);
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
        {/* Real bug reported live: this row's capacity number input was
            overflowing the create-venture card at narrower widths — the
            type select can run wide ("Academic research"/"Commercial
            spin-off") with no room left for the number input beside it,
            and this row had no wrap behavior to fall back on unlike the
            rest of this form. flexWrap + a stable min/max width on the
            select fixes it without changing the layout at normal widths. */}
        <div className="su-flex su-gap-10" style={{ flexWrap: 'wrap' }}>
          <select
            className="su-input"
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value as VentureProjectType })}
            style={{ flex: '1 1 200px', minWidth: 0 }}
          >
            <option value="academic_research">Academic research</option>
            <option value="commercial_spinoff">Commercial spin-off</option>
          </select>
          <input
            className="su-input"
            type="number"
            min="1"
            value={form.capacity}
            onChange={e => setForm({ ...form, capacity: Number(e.target.value) })}
            style={{ width: 90, flexShrink: 0 }}
          />
        </div>
        <label className="su-flex su-gap-8 su-items-center" style={{ fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isGraduationProject} onChange={e => setForm({ ...form, isGraduationProject: e.target.checked })} />
          This is a graduation project (student capstone, on the {form.type === 'commercial_spinoff' ? 'commercial spin-off' : 'academic research'} track above)
        </label>
        <input className="su-input" placeholder="Required course codes (comma-separated)" value={form.requiredCourseCodes} onChange={e => setForm({ ...form, requiredCourseCodes: e.target.value })} />
        <input className="su-input" placeholder="Preferred skills (comma-separated)" value={form.preferredSkills} onChange={e => setForm({ ...form, preferredSkills: e.target.value })} />

        <button type="button" className="su-btn su-btn-ghost su-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowResearch(s => !s)}>
          {showResearch ? 'Hide' : 'Add'} published-research details (optional)
        </button>
        {showResearch && (
          <div className="su-note" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              className="su-input"
              placeholder={'Authors, one per line — "Name" or "Name <https://link>"'}
              rows={3}
              value={form.authorsText}
              onChange={e => setForm({ ...form, authorsText: e.target.value })}
            />
            <input className="su-input" placeholder="Published paper URL" value={form.publishedPaperUrl} onChange={e => setForm({ ...form, publishedPaperUrl: e.target.value })} />
            <div className="su-flex su-gap-10">
              <input className="su-input" placeholder="Conference" value={form.conferenceName} onChange={e => setForm({ ...form, conferenceName: e.target.value })} />
              <input className="su-input" type="number" step="0.001" min="0" placeholder="Impact factor" value={form.impactFactor} onChange={e => setForm({ ...form, impactFactor: e.target.value })} style={{ width: 130 }} />
            </div>
            <input className="su-input" placeholder="Lab" value={form.labName} onChange={e => setForm({ ...form, labName: e.target.value })} />
          </div>
        )}
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

  // No name/avatar header here — the row this expands under (in
  // AdvisorVentureBoard's "Pending approvals" list) already shows the
  // applicant's name; this is deliberately just their data, under it.
  return (
    <div className="su-pop" key={candidate.studentId}>
      <div className="su-flex su-justify-between su-items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="su-muted" style={{ fontSize: 12.5 }}>
          ID: {candidate.studentId}{student ? ` · Level ${student.level} · ${student.facultyId}/${student.departmentId}` : ''}
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

      {viewingCv && candidate.cvDataUrl && createPortal(
        // Portalled straight to <body> rather than left in place: this
        // component's own root is a `.su-pop`-animated card, and any
        // ancestor with a non-none `transform` (which `.su-pop`'s
        // fill-mode:both animation leaves behind even after it finishes)
        // becomes the containing block for `position: fixed` descendants —
        // so a naively-nested fullscreen overlay was rendering sized to
        // THIS card, not the viewport, and getting flex-shrunk down to a
        // few hundred px. Portalling to body sidesteps that entirely.
        //
        // The outer `.su` wrapper below matters just as much as the portal
        // itself: every `--su-*` color token is scoped to `.su` (and its
        // dark-mode overrides target `:root[data-theme] .su`), so anything
        // portalled to <body> — outside the layout's own `.su` tree — sees
        // NONE of them. Without this wrapper the buttons here silently fall
        // back to the unrelated legacy `styles.css` theme instead of this
        // one, which is exactly why the Close button looked off-theme.
        <div className="su">
          <div className="su-modal-overlay" role="dialog" aria-label={`${candidate.studentName}'s CV`} onMouseDown={e => e.target === e.currentTarget && setViewingCv(false)}>
            <div className="su-modal su-modal-fullscreen su-pop">
              <div className="su-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 10 }}>
                  <div className="su-title" style={{ fontSize: 15 }}>{candidate.studentName}'s CV{candidate.cvFileName ? ` — ${candidate.cvFileName}` : ''}</div>
                  <button className="su-btn su-btn-sm su-btn-secondary" onClick={() => setViewingCv(false)}>Close</button>
                </div>
                <iframe title={`${candidate.studentName}'s CV`} src={candidate.cvDataUrl} style={{ flex: 1, width: '100%', border: '1px solid var(--su-border)', borderRadius: 8 }} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/** "Request grant" for one project's funding ask — separate from Project
 *  Collider's own VP-initiated micro-funding tool. Always shown inline on
 *  each project card in ManageVentures below, regardless of the project's
 *  active/archived status (an archived project's team might still need
 *  funding to wrap up) — including a project that's currently active and
 *  fully registered, per explicit request that this option be genuinely
 *  obvious rather than easy to miss. The VP's decision (approve/decline)
 *  no longer happens here — it's moved to the VP's Innovation Topography
 *  page (see VpInnovationTopography.tsx's "Venture Grant Requests"
 *  section) alongside Project Collider's own funding oversight, so all
 *  cross-professor funding review lives in one place instead of being
 *  split across two pages. */
function GrantRequestPanel({ row, onChanged }: { row: AdvisorVentureProjectRowDTO; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [timelineFile, setTimelineFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = row.project.grantRequest;

  const submitRequest = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const timelinePlan = timelineFile ? { fileName: timelineFile.name, dataUrl: await readFileAsDataUrl(timelineFile) } : undefined;
      await api.requestVentureGrant(row.project.professorId, row.project.id, n, note, timelinePlan);
      setAmount(''); setNote(''); setTimelineFile(null); setOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (request?.status === 'pending') {
    return (
      <div className="su-note warn su-mt-16" style={{ fontSize: 12 }}>
        <div><b>Grant requested:</b> {request.amount.toLocaleString()} EGP{request.note ? ` — ${request.note}` : ''}</div>
        {request.timelinePlanFileName && <div className="su-muted" style={{ marginTop: 2 }}>Timeline plan attached — {request.timelinePlanFileName}</div>}
        <div className="su-muted su-mt-16">Awaiting the Vice President's decision (Innovation Topography).</div>
      </div>
    );
  }

  return (
    <div className="su-mt-16" style={{ borderTop: '1px dashed var(--su-border)', paddingTop: 12 }}>
      {request && (
        <div className="su-muted" style={{ fontSize: 11.5, marginBottom: 6 }}>
          Last request: {request.amount.toLocaleString()} EGP —{' '}
          <span className={request.status === 'approved' ? 'su-good' : 'su-danger'} style={{ color: request.status === 'approved' ? 'var(--su-good)' : 'var(--su-danger)' }}>{request.status}</span>
          {request.decisionNote ? ` (${request.decisionNote})` : ''}
        </div>
      )}
      {open ? (
        <div className="su-flex su-gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="su-input" style={{ maxWidth: 110 }} type="number" min={1} placeholder="Amount (EGP)" value={amount} onChange={e => setAmount(e.target.value)} />
          <input className="su-input" style={{ maxWidth: 200 }} placeholder="What it's for" value={note} onChange={e => setNote(e.target.value)} />
          <label className="su-flex su-items-center su-gap-8" style={{ fontSize: 11.5 }} title="Optional — a PDF timeline plan for the funded work, reviewable by the VP inline">
            <span className="su-muted">Timeline plan (PDF, optional):</span>
            <input type="file" accept=".pdf" onChange={e => setTimelineFile(e.target.files?.[0] ?? null)} style={{ maxWidth: 170, fontSize: 12 }} />
          </label>
          <button type="button" className="su-btn su-btn-sm" disabled={busy || !amount} onClick={submitRequest}>{busy ? 'Requesting…' : 'Send request'}</button>
          <button type="button" className="su-btn su-btn-sm su-btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      ) : (
        // A real, filled button — not a subtle ghost/outline one — so the
        // option to apply for funding is obvious on every project card,
        // active or not, rather than something an advisor has to notice.
        <button type="button" className="su-btn su-btn-sm su-btn-block" onClick={() => setOpen(true)}>💰 Apply for a grant</button>
      )}
      {error && <div className="su-note danger su-mt-16" style={{ fontSize: 11.5 }}>{error}</div>}
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
            {r.project.isGraduationProject && <span className="su-badge info" style={{ marginBottom: 8 }}>Graduation project</span>}
            <div className="su-muted" style={{ fontSize: 12, marginBottom: 12 }}>
              {r.project.type === 'commercial_spinoff' ? 'Commercial spin-off' : 'Academic research'} · capacity {r.project.capacity} · {r.acceptedCount} member{r.acceptedCount !== 1 ? 's' : ''} · required: {r.project.requiredCourseCodes.join(', ') || '—'}
            </div>
            <ResearchDetails project={r.project} />
            <button className="su-btn su-btn-sm su-btn-ghost" onClick={() => toggleActive(r)}>{r.project.isActive ? 'Archive' : 'Reactivate'}</button>
            <GrantRequestPanel row={r} onChanged={onChanged} />
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

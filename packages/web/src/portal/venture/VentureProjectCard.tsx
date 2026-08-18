// One venture/project row — reused by both the main Venture Board browse
// list and the Discover-venture wizard's final results step. §16.4/§16.5:
// interest can be expressed on ANY project shown here, not only ones that
// cleared the display threshold (a below-threshold row has matchId: null
// until this fires); a CV attachment is optional.
import { useState } from 'react';
import { VentureMatchResultDTO, VentureProjectDTO } from '../../api/client';
import { readFileAsDataUrl } from '../../lib/readFileAsDataUrl';
import { ScoreRow } from '../ui/Primitives';

/** VP epic — "research portal": renders whichever of the optional
 *  published-research fields a project actually has (all optional, so a
 *  plain open-position project renders nothing extra, same as before this
 *  epic). Shared between the student-facing card below and the advisor/VP
 *  console's own project list. */
export function ResearchDetails({ project }: { project: Pick<VentureProjectDTO, 'authors' | 'publishedPaperUrl' | 'conferenceName' | 'impactFactor' | 'labName'> }) {
  const hasAny = (project.authors && project.authors.length > 0) || project.publishedPaperUrl || project.conferenceName || project.impactFactor !== undefined || project.labName;
  if (!hasAny) return null;
  return (
    <div className="su-note" style={{ margin: '10px 0', fontSize: 12.5 }}>
      <div className="su-eyebrow" style={{ marginBottom: 6 }}>Published research</div>
      {project.authors && project.authors.length > 0 && (
        <div>
          <b>Authors:</b>{' '}
          {project.authors.map((a, i) => (
            <span key={a.name + i}>
              {i > 0 && ', '}
              {a.link ? <a href={a.link} target="_blank" rel="noreferrer">{a.name}</a> : a.name}
            </span>
          ))}
        </div>
      )}
      {project.publishedPaperUrl && (
        <div><b>Paper:</b> <a href={project.publishedPaperUrl} target="_blank" rel="noreferrer">{project.publishedPaperUrl}</a></div>
      )}
      {project.conferenceName && <div><b>Conference:</b> {project.conferenceName}</div>}
      {project.impactFactor !== undefined && <div><b>Impact factor:</b> {project.impactFactor}</div>}
      {project.labName && <div><b>Lab:</b> {project.labName}</div>}
    </div>
  );
}

export function VentureProjectCard({ match, onExpressInterest }: { match: VentureMatchResultDTO; onExpressInterest: (projectId: string, cv?: { fileName: string; dataUrl: string }) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const canApply = match.status === 'suggested' || match.status === 'unscored';

  const express = async () => {
    setBusy(true);
    try {
      const cv = file ? { fileName: file.name, dataUrl: await readFileAsDataUrl(file) } : undefined;
      await onExpressInterest(match.project.id, cv);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="su-card su-hover su-pop">
      <div className="su-flex su-justify-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div className="su-title" style={{ fontSize: 16 }}>{match.project.title}</div>
          <div className="su-muted" style={{ marginTop: 2 }}>Hosted by {match.project.professorName ?? 'a faculty member'}</div>
        </div>
        <div className="su-flex su-gap-8" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {match.project.isGraduationProject && <span className="su-badge info">Graduation project</span>}
          <span className="su-badge neutral">{match.project.type === 'commercial_spinoff' ? 'Commercial spin-off' : 'Academic research'}</span>
        </div>
      </div>
      <div className="su-subtitle" style={{ margin: '10px 0' }}>{match.project.description}</div>

      <ResearchDetails project={match.project} />

      <ScoreRow name="Course competency" pct={match.courseCompetencyScore} />
      <ScoreRow name="Skill / interest alignment" pct={match.skillAlignmentScore} />
      <ScoreRow name="Academic trajectory" pct={match.academicTrajectoryScore} />

      <div className="su-flex su-justify-between su-items-center su-mt-16" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span className="su-badge ok">Overall {Math.round(match.total * 100)}%</span>
        {canApply ? (
          <div className="su-flex su-gap-10 su-items-center" style={{ flexWrap: 'wrap' }}>
            <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ maxWidth: 200, fontSize: 12 }} />
            <button className="su-btn su-btn-sm" disabled={busy} onClick={express}>{file ? 'Express Interest & Submit CV' : 'Express Interest'}</button>
          </div>
        ) : (
          <span className="su-badge info">{match.status}</span>
        )}
      </div>
    </div>
  );
}

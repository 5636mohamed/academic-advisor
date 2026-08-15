// Spec §16.4 — the gold-highlighted card injected above the course slips
// on the Plan Results screen when a match clears the display threshold.
// Purely additive: never counted toward the credit cap, never a course.
// Shows which professor hosts the project, and lets the student attach a
// CV (optional) in the same action as expressing interest.
import { useRef, useState } from 'react';
import { VentureMatchResultDTO } from '../api/client';
import { readFileAsDataUrl } from '../lib/readFileAsDataUrl';

export function VentureMatchCard({
  match,
  onExpressInterest,
}: {
  match: VentureMatchResultDTO;
  onExpressInterest?: (cv?: { fileName: string; dataUrl: string }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(match.status !== 'suggested');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const express = async () => {
    if (!onExpressInterest) return;
    setBusy(true);
    try {
      const file = fileInputRef.current?.files?.[0];
      const cv = file ? { fileName: file.name, dataUrl: await readFileAsDataUrl(file) } : undefined;
      await onExpressInterest(cv);
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card venture-card">
      <div className="venture-eyebrow">Venture Match · {Math.round(match.total * 100)}%</div>
      <div className="venture-title">{match.project.title}</div>
      <p className="muted" style={{ marginTop: -4, marginBottom: 8 }}>
        Hosted by {match.project.professorName ?? 'a faculty member'}
      </p>
      <p className="sub" style={{ marginBottom: 10 }}>{match.project.description}</p>
      {done ? (
        <span className="badge ok">Interest expressed — professor notified</span>
      ) : onExpressInterest ? (
        <div>
          <div className="form-row">
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => setFileName(e.target.files?.[0]?.name ?? null)} />
          </div>
          <button disabled={busy} onClick={express}>
            {fileName ? 'Express Interest & Submit CV' : 'Express Interest'}
          </button>
          <div className="muted" style={{ marginTop: 6 }}>Attaching a CV (PDF only, so the professor can view it directly on the site) is optional but recommended.</div>
        </div>
      ) : (
        <span className="muted">Not yet applied — the student can express interest from their own portal.</span>
      )}
    </div>
  );
}

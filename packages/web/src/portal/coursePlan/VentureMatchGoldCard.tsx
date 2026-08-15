// Re-themed §16.4 gold Venture Match card (see components/VentureMatchCard.tsx
// for the advisor-console original) — injected above the plan when the
// advising cycle attaches one, purely additive, never counted as a course.
import { useRef, useState } from 'react';
import { VentureMatchResultDTO } from '../../api/client';
import { readFileAsDataUrl } from '../../lib/readFileAsDataUrl';

export function VentureMatchGoldCard({ match, onExpressInterest }: { match: VentureMatchResultDTO; onExpressInterest: (cv?: { fileName: string; dataUrl: string }) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(match.status !== 'suggested');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const express = async () => {
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
    <div className="su-venture-card su-mt-16 su-pop">
      <div className="su-venture-eyebrow">Venture Match · {Math.round(match.total * 100)}%</div>
      <div style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 6px' }}>{match.project.title}</div>
      <div className="su-muted" style={{ marginBottom: 8 }}>Hosted by {match.project.professorName ?? 'a faculty member'}</div>
      <div className="su-subtitle" style={{ marginBottom: 12 }}>{match.project.description}</div>
      {done ? (
        <span className="su-badge ok">Interest expressed — professor notified</span>
      ) : (
        <div>
          <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => setFileName(e.target.files?.[0]?.name ?? null)} style={{ marginBottom: 10 }} />
          <div>
            <button className="su-btn su-btn-sm" disabled={busy} onClick={express}>
              {fileName ? 'Express Interest & Submit CV' : 'Express Interest'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

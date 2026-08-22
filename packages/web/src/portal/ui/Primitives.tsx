// Small, reusable building blocks shared across the redesigned student
// portal screens (see /UI Design Student/*.pdf) — kept deliberately generic
// so each page composes them rather than re-implementing the same card /
// stat / progress-bar chrome. All classNames come from student-theme.css
// (the `.su-*` namespace), never a raw style unless it's a data-driven value
// (a bar's width/color, etc.).
import { ReactNode, useEffect, useState } from 'react';
import { IconSearch } from './Icons';

export function StatCard({
  label,
  value,
  unit,
  sub,
  subTone = 'muted',
  accent = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  subTone?: 'muted' | 'warn' | 'good';
  accent?: boolean;
}) {
  return (
    <div className="su-stat-card">
      <div className="su-stat-label">{label}</div>
      <div className={`su-stat-value${accent ? ' accent' : ''}`}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {sub && <div className={`su-stat-sub${subTone === 'warn' ? ' warn' : ''}`}>{sub}</div>}
    </div>
  );
}

export function Section({
  eyebrow,
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`su-card ${className}`}>
      {(title || right) && (
        <div className="su-flex su-justify-between su-items-center su-gap-14" style={{ flexWrap: 'wrap' }}>
          <div>
            {eyebrow && <div className="su-eyebrow">{eyebrow}</div>}
            {title && <div className="su-title">{title}</div>}
          </div>
          {right}
        </div>
      )}
      {subtitle && <div className="su-subtitle">{subtitle}</div>}
      {children && <div style={{ marginTop: title || subtitle ? 16 : 0 }}>{children}</div>}
    </div>
  );
}

/** Real system policy is 6 warning semesters before mandatory
 *  suspension/transfer (ProbationCounterPill's same "Warning N/6"), so the
 *  segmented track below is 6 segments wide — not the mockup's inconsistent
 *  "out of 8" label, since matching the actual bylaws value takes priority
 *  over a literal pixel copy. */
export function ProbationTrack({ count, cap = 6 }: { count: number; cap?: number }) {
  return (
    <div className="su-segments">
      {Array.from({ length: cap }).map((_, i) => (
        <div className="su-segment" key={i}>
          {i < count && <div className="fill" style={{ animationDelay: `${i * 70}ms` }} />}
        </div>
      ))}
    </div>
  );
}

const barTone = (cgpa: number) => (cgpa >= 3.0 ? 'good' : cgpa < 2.0 ? 'danger' : 'warn');

/** CGPA color-key legend — every CGPA trend chart across every portal
 *  (student, advisor, VP) reuses this one component and its same 3
 *  `--su-*` tone tokens, so the color meaning never drifts between
 *  screens: green = good standing (>= 3.0), yellow = at-risk (2.0-3.0),
 *  red = probation (< 2.0) — the exact `barTone` thresholds the bars
 *  themselves already use above. */
export function CgpaLegend() {
  const items: Array<{ tone: 'good' | 'warn' | 'danger'; label: string }> = [
    { tone: 'good', label: 'Good standing (≥ 3.00)' },
    { tone: 'warn', label: 'At-risk (2.00–2.99)' },
    { tone: 'danger', label: 'Probation (< 2.00)' },
  ];
  return (
    <div className="su-flex su-gap-14" style={{ flexWrap: 'wrap', marginTop: 10, fontSize: 11.5 }}>
      {items.map(item => (
        <div className="su-flex su-gap-8 su-items-center" key={item.tone}>
          <span className="su-quick-dot" style={{ marginTop: 0, background: `var(--su-${item.tone})` }} />
          <span className="su-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function CgpaBarChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length === 0) return <div className="su-muted">No CGPA history yet.</div>;
  return (
    <div className="su-barchart">
      <div className="su-barchart-rows">
        {points.map((p, i) => (
          <div className="su-bar-col" key={p.label}>
            {/* Contrast audit (live user request): text needs the darkened
                "-text" variant (--su-good/danger/warn all fail WCAG AA as
                plain readable text — see student-theme.css's own token
                comments) — the bar's own fill below stays the original
                token, since a solid-color fill was never the problem. */}
            <div className="su-bar-value" style={{ color: `var(--su-${barTone(p.value)}-text)` }}>{p.value.toFixed(2)}</div>
            <div
              className="su-bar-shape"
              style={{
                height: `${Math.max(6, (Math.min(p.value, 4) / 4) * 100)}%`,
                background: `var(--su-${barTone(p.value)})`,
                animationDelay: `${i * 70}ms`,
              }}
            />
            <div className="su-bar-label">{p.label}</div>
          </div>
        ))}
      </div>
      <CgpaLegend />
    </div>
  );
}

export function ScoreRow({ name, pct }: { name: string; pct: number }) {
  return (
    <div className="su-score-row">
      <div className="name">{name}</div>
      <div className="track"><div className="fill" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
      <div className="pct">{Math.round(pct * 100)}%</div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="su-search">
      <IconSearch />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'Search…'} />
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="su-loading su-fade">
      <div className="su-spinner" />
      <div>{label}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="su-empty su-fade">{children}</div>;
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="su-toast">{message}</div>;
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const node = msg ? <Toast message={msg} onDone={() => setMsg(null)} /> : null;
  return { show: setMsg, node };
}

export function letterClass(letter: string) {
  return `su-letter-${letter.replace('+', 'p')}`;
}

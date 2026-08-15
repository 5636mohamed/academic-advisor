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

export function CgpaBarChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length === 0) return <div className="su-muted">No CGPA history yet.</div>;
  return (
    <div className="su-barchart">
      <div className="su-barchart-rows">
        {points.map((p, i) => (
          <div className="su-bar-col" key={p.label}>
            <div className="su-bar-value" style={{ color: `var(--su-${barTone(p.value)})` }}>{p.value.toFixed(2)}</div>
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

// Generic step-wizard shell: left sidebar with numbered steps (done / current
// / upcoming) + a top "STEP X OF N" progress bar, matching
// department-quiz.pdf / Discover-venture.pdf. The two real wizards
// (Department Fit Quiz, Venture Discover) both plug their own step content
// into `children` — this component only owns the chrome/progress, never the
// question logic.
import { ReactNode } from 'react';
import { IconCheck } from './Icons';

export function WizardShell({
  title,
  steps,
  current,
  children,
}: {
  title: string;
  steps: string[];
  current: number; // 0-based
  children: ReactNode;
}) {
  const pct = steps.length > 1 ? Math.round((current / (steps.length - 1)) * 100) : 0;
  return (
    <div className="su-wizard su-page">
      <div className="su-card su-wizard-steps-card">
        <div className="su-title" style={{ fontSize: 16 }}>{title}</div>
        <ol className="su-wizard-steps">
          {steps.map((label, i) => {
            const state = i < current ? 'done' : i === current ? 'current' : '';
            return (
              <li className={`su-wizard-step ${state}`} key={label}>
                <span className="num">{i < current ? <IconCheck width={12} height={12} strokeWidth={3} /> : i + 1}</span>
                {label}
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <div className="su-wizard-progress-row">
          <span className="step-of">Step {current + 1} of {steps.length}</span>
          <span className="pct">{pct}% Complete</span>
        </div>
        <div className="su-wizard-progress-track">
          <div className="su-wizard-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="su-card su-pop" key={current}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function OptionRow({
  letter,
  label,
  selected,
  onClick,
}: {
  letter: string;
  label: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`su-option${selected ? ' selected' : ''}`} onClick={onClick}>
      <span className="letter">{letter}</span>
      <span>{label}</span>
    </button>
  );
}

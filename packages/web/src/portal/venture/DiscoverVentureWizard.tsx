// "Discover venture" wizard — Discover-venture.pdf. §16.1's Venture Gate
// (yes/no) plus the 3-question Venture Interest Form (VENTURE_QUIZ), one
// step at a time, finishing on the real ranked ventureMatches() results —
// exactly the same data/endpoints PortalVentureBoard's inline form always
// used, just presented as a step wizard instead of one long page.
import { useEffect, useState } from 'react';
import { api, VentureMatchResultDTO, VentureQuizQuestionDTO } from '../../api/client';
import { Loading } from '../ui/Primitives';
import { OptionRow, WizardShell } from '../ui/WizardShell';
import { VentureProjectCard } from './VentureProjectCard';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const STEP_LABELS = ['Basic Background', 'Analytical Aptitude', 'Project Engineering', 'Logic & Programming', 'Recommendation'];

export function DiscoverVentureWizard({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [quiz, setQuiz] = useState<VentureQuizQuestionDTO[] | null>(null);
  const [gate, setGate] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0); // 0 = gate, 1..quiz.length = questions, last = results
  const [matches, setMatches] = useState<VentureMatchResultDTO[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.ventureQuiz().then(setQuiz); }, []);

  if (!quiz) return <Loading label="Loading the interest form…" />;

  const totalSteps = quiz.length + 2; // gate + questions + recommendation
  const isGate = step === 0;
  const isRecommendation = step === totalSteps - 1;
  const question = !isGate && !isRecommendation ? quiz[step - 1] : null;

  const submitGate = async (value: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await api.setVentureGateAnswer(studentId, value);
      setGate(value);
      if (value) setStep(1);
      else {
        setMatches(await api.ventureMatches(studentId));
        setStep(totalSteps - 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.setVentureInterestAnswers(studentId, answers);
      setMatches(await api.ventureMatches(studentId));
      setStep(totalSteps - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const express = async (projectId: string, cv?: { fileName: string; dataUrl: string }) => {
    await api.expressInterestInProject(studentId, projectId, cv);
    setMatches(await api.ventureMatches(studentId));
  };

  return (
    <div className="su-modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="su-modal su-pop" style={{ maxWidth: 900 }}>
        <div className="su-card" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
          <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 10 }}>
            <div className="su-title" style={{ fontSize: 16 }}>Venture Interest Form</div>
            <button className="su-icon-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <WizardShell title="Progress" steps={STEP_LABELS} current={Math.min(step, STEP_LABELS.length - 1)}>
            {error && <div className="su-note danger su-mt-16" style={{ marginTop: 0, marginBottom: 16 }}>{error}</div>}

            {isGate && (
              <>
                <div className="su-title" style={{ marginBottom: 10 }}>
                  Are you actively seeking research collaboration, lab placements, or startup spin-off opportunities
                  this semester?
                </div>
                <div className="su-fit-grid su-mt-16" style={{ marginTop: 0, marginBottom: 20 }}>
                  <button className={`su-choice-card${gate === true ? ' selected' : ''}`} onClick={() => submitGate(true)} disabled={busy}>
                    <span style={{ fontWeight: 800 }}>Yes, show me matches</span>
                  </button>
                  <button className={`su-choice-card${gate === false ? ' selected' : ''}`} onClick={() => submitGate(false)} disabled={busy}>
                    <span style={{ fontWeight: 800 }}>Not this semester</span>
                  </button>
                </div>
              </>
            )}

            {question && (
              <>
                <div className="su-title" style={{ marginBottom: 16 }}>{question.text}</div>
                <div className="su-option-list">
                  {question.options.map((o, i) => (
                    <OptionRow key={o.id} letter={LETTERS[i] ?? '?'} label={o.label} selected={answers[question.id] === o.id} onClick={() => setAnswers({ ...answers, [question.id]: o.id })} />
                  ))}
                </div>
                <div className="su-flex su-justify-between">
                  <button className="su-btn su-btn-secondary" onClick={() => setStep(s => Math.max(0, s - 1))}>Previous Step</button>
                  {step < quiz.length ? (
                    <button className="su-btn" disabled={!answers[question.id]} onClick={() => setStep(s => s + 1)}>Next Step</button>
                  ) : (
                    <button className="su-btn" disabled={!answers[question.id] || busy} onClick={finish}>See My Matches</button>
                  )}
                </div>
              </>
            )}

            {isRecommendation && (
              <div className="su-fade">
                <div className="su-title" style={{ marginBottom: 4 }}>Your Matches</div>
                <div className="su-subtitle" style={{ marginBottom: 16 }}>Ranked by fit to your transcript and interests.</div>
                {!matches ? (
                  <Loading />
                ) : matches.length === 0 ? (
                  <div className="su-empty">No active projects to show right now — check back later.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {matches.map(m => <VentureProjectCard key={m.project.id} match={m} onExpressInterest={express} />)}
                  </div>
                )}
                <button className="su-btn su-btn-secondary su-mt-16" onClick={onClose}>Done</button>
              </div>
            )}
          </WizardShell>
        </div>
      </div>
    </div>
  );
}

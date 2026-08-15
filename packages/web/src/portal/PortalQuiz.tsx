// "Department Quiz" tab — department-quiz.pdf's step wizard. §6's real
// 4-question best-fit quiz (QUIZ in deptFitEngine.ts) maps exactly onto the
// mockup's 5-step sidebar (4 questions + a "Recommendation" step), so this
// wizard asks the real questions one at a time instead of QuizContent's
// original all-at-once form, then finishes on a real departmentFit()
// result. The actual transfer *request* action stays a single feature
// living on Course Plan → Probation Repair (the real advising-cycle engine)
// — this screen links there rather than re-implementing it.
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, DeptFitResultDTO, QuizQuestionDTO } from '../api/client';
import { Loading, ScoreRow } from './ui/Primitives';
import { OptionRow, WizardShell } from './ui/WizardShell';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const STEP_LABELS = ['Basic Background', 'Analytical Aptitude', 'Project Engineering', 'Logic & Programming', 'Recommendation'];

export function PortalQuiz() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizQuestionDTO[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<DeptFitResultDTO[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentDeptId, setCurrentDeptId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.quiz().then(setQuiz);
    api.getStudent(id).then(s => { setAnswers(s.quizAnswers); setCurrentDeptId(s.departmentId); });
  }, [id]);

  if (!id) return null;
  if (!quiz) return <Loading label="Loading your quiz…" />;

  const steps = [...quiz.map(q => q.text), 'Recommendation'];
  const submit = async () => {
    setBusy(true);
    try {
      await api.setQuizAnswers(id, answers);
      setResults(await api.departmentFit(id));
      setStep(quiz.length);
    } finally {
      setBusy(false);
    }
  };

  const isRecommendationStep = step >= quiz.length;
  const q = quiz[step];
  const top = results?.[0];
  const current = results?.find(r => r.id === currentDeptId);

  return (
    <WizardShell title="Quiz Progress" steps={STEP_LABELS.length === steps.length ? STEP_LABELS : steps.map((_, i) => `Step ${i + 1}`)} current={isRecommendationStep ? quiz.length : step}>
      {!isRecommendationStep && q && (
        <>
          <div className="su-title" style={{ marginBottom: 16 }}>Question {step + 1}: {q.text}</div>
          <div className="su-option-list">
            {q.options.map((o, i) => (
              <OptionRow key={o.id} letter={LETTERS[i] ?? '?'} label={o.label} selected={answers[q.id] === o.id} onClick={() => setAnswers({ ...answers, [q.id]: o.id })} />
            ))}
          </div>
          <div className="su-flex su-justify-between">
            <button className="su-btn su-btn-secondary" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>Previous Step</button>
            {step < quiz.length - 1 ? (
              <button className="su-btn" disabled={!answers[q.id]} onClick={() => setStep(s => s + 1)}>Next Step</button>
            ) : (
              <button className="su-btn" disabled={!answers[q.id] || busy} onClick={submit}>See My Recommendation</button>
            )}
          </div>
        </>
      )}

      {isRecommendationStep && results && (
        <div className="su-fade">
          <div className="su-title">Your Best-Fit Departments</div>
          <div className="su-subtitle" style={{ marginBottom: 16 }}>
            Combined 50% quiz answers / 30% your grades in each department's gateway courses / 20% alumni outcomes.
          </div>

          {top && (
            <div className="su-fit-card highlight su-pop" style={{ marginBottom: 16 }}>
              <div className="su-fit-card-top">
                <div>
                  <div className="su-eyebrow" style={{ color: 'var(--su-accent)' }}>Highest aptitude match</div>
                  <div className="su-fit-name">{top.name}</div>
                </div>
                <span className="su-badge solid">{Math.round(top.total * 100)}% Fit</span>
              </div>
              {current && current.id !== top.id && (
                <div className="su-subtitle" style={{ marginTop: 10 }}>
                  Your current department scores {Math.round(current.total * 100)}% fit by this same measure.
                </div>
              )}
            </div>
          )}

          <div className="su-card">
            {results.map(r => <ScoreRow key={r.id} name={r.id === currentDeptId ? `${r.name} (current)` : r.name} pct={r.total} />)}
          </div>

          {top && currentDeptId && top.id !== currentDeptId && (
            <div className="su-note su-mt-16">
              Curious whether switching makes sense for your CGPA trajectory? Run it through the real advising
              engine on Course Plan → Probation Repair, which can start an official transfer request.
              <div className="su-mt-16">
                <button className="su-btn su-btn-sm" onClick={() => navigate(`/portal/${id}/course-plan?mode=probation`)}>Go to Course Plan</button>
              </div>
            </div>
          )}

          <button className="su-btn su-btn-secondary su-mt-16" onClick={() => { setStep(0); setResults(null); }}>Retake quiz</button>
        </div>
      )}
    </WizardShell>
  );
}

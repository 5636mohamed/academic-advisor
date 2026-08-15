// Shared content for the best-fit department quiz, reused by both the
// advisor's DepartmentFitQuiz page and the student portal's PortalQuiz page.
import { useEffect, useState } from 'react';
import { api, DeptFitResultDTO, QuizQuestionDTO } from '../../api/client';

export function QuizContent({ studentId }: { studentId: string }) {
  const [quiz, setQuiz] = useState<QuizQuestionDTO[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<DeptFitResultDTO[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.quiz().then(setQuiz);
    api.getStudent(studentId).then(s => setAnswers(s.quizAnswers));
  }, [studentId]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.setQuizAnswers(studentId, answers);
      setResults(await api.departmentFit(studentId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Best-Fit Department Quiz</h2>
        <p className="sub">Combined with your grades in each department's gateway courses and alumni outcomes (50% quiz / 30% grades / 20% alumni).</p>
        {!quiz && <div className="loading">Loading questions…</div>}
        {quiz?.map(q => (
          <div key={q.id} className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{q.text}</div>
            {q.options.map(o => (
              <label key={o.id} style={{ display: 'block', marginBottom: 4, fontWeight: 400 }}>
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === o.id}
                  onChange={() => setAnswers({ ...answers, [q.id]: o.id })}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                {o.label}
              </label>
            ))}
          </div>
        ))}
        <button disabled={busy || !quiz} onClick={submit}>See my best-fit departments</button>
      </div>

      {results && (
        <div className="card">
          <h2>Results</h2>
          {results.map(r => (
            <div className="dept-card" key={r.id}>
              <div className="dept-name">{r.name}</div>
              <div className="dept-bars">
                <div className="fit-bar-track">
                  <div className="fit-bar-fill" style={{ width: `${Math.round(r.total * 100)}%` }} />
                </div>
                <div className="muted">
                  quiz {Math.round(r.quizScore * 100)}% · grades {Math.round(r.gwScore * 100)}% · alumni {Math.round(r.alumScore * 100)}%
                </div>
              </div>
              <div className="dept-score">{Math.round(r.total * 100)}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

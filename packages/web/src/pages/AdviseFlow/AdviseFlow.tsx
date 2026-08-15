// Spec §8/§10 — the full "Advise Me" orchestration screen: retake gate →
// plan → (conditionally) transfer recommendation → transfer confirm →
// re-run.
import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api, AdvisingActionDTO } from '../../api/client';
import { StudentNavTabs } from '../../components/StudentNavTabs';
import { RetakeGateStep } from './RetakeGateStep';
import { PlanResultsStep } from './PlanResultsStep';
import { TransferRecommendationStep } from './TransferRecommendationStep';
import { TransferConfirmStep } from './TransferConfirmStep';
import { VentureMatchCard } from '../../components/VentureMatchCard';

type Step =
  | { kind: 'gate' }
  | { kind: 'loading' }
  | { kind: 'result'; result: AdvisingActionDTO; cgpa: number; forcedShowPlan: boolean }
  | { kind: 'transfer-confirm'; result: AdvisingActionDTO; cgpa: number; transferKind: 'internal' | 'external'; targetId: string }
  | { kind: 'error'; message: string };

export function AdviseFlow() {
  const { id } = useParams<{ id: string }>();
  const { reloadStudents } = useOutletContext<{ reloadStudents: () => void }>();
  const [step, setStep] = useState<Step>({ kind: 'gate' });

  if (!id) return null;

  const runCycle = async (considerRetakes: boolean) => {
    setStep({ kind: 'loading' });
    try {
      await api.setRetakePreference(id, considerRetakes);
      const result = await api.advise(id);
      const student = await api.getStudent(id);
      setStep({ kind: 'result', result, cgpa: student.cgpa, forcedShowPlan: false });
      reloadStudents();
    } catch (e) {
      setStep({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const restart = () => setStep({ kind: 'gate' });

  return (
    <div>
      <StudentNavTabs id={id} />
      {step.kind === 'gate' && <RetakeGateStep onAnswer={runCycle} />}
      {step.kind === 'loading' && <div className="loading">Running the advising cycle…</div>}
      {step.kind === 'error' && (
        <div className="card">
          <div className="note" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{step.message}</div>
          <button className="secondary" onClick={restart} style={{ marginTop: 10 }}>Start over</button>
        </div>
      )}
      {step.kind === 'result' && (
        <>
          {/* §16.4 — read-only here: the advisor is viewing the student's own
              match, not acting on their behalf (see VentureMatchCard's
              omitted onExpressInterest). */}
          {step.result.ventureMatch && <VentureMatchCard match={step.result.ventureMatch} />}
          {(step.result.action === 'SHOW_PLAN' || step.forcedShowPlan) ? (
            <>
              <PlanResultsStep result={step.result} cgpa={step.cgpa} />
              <button className="secondary" onClick={restart}>Run again</button>
            </>
          ) : (
            <TransferRecommendationStep
              studentId={id}
              cgpa={step.cgpa}
              result={step.result}
              onShowPlanAnyway={() => setStep({ ...step, forcedShowPlan: true })}
              onStartReview={(kind, candidateId) =>
                setStep({ kind: 'transfer-confirm', result: step.result, cgpa: step.cgpa, transferKind: kind, targetId: candidateId })
              }
            />
          )}
        </>
      )}
      {step.kind === 'transfer-confirm' && (
        <TransferConfirmStep
          studentId={id}
          kind={step.transferKind}
          targetId={step.targetId}
          onCancel={() => setStep({ kind: 'result', result: step.result, cgpa: step.cgpa, forcedShowPlan: true })}
          onDone={() => {
            reloadStudents();
            restart(); // spec §8 step 10 — re-run the whole cycle in the new context
          }}
        />
      )}
    </div>
  );
}

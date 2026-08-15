// "Probation Repair" mode — the real §4/§8 advising-cycle engine (the same
// one PortalAdvise.tsx used to drive on its own "Advise Me" tab): retake
// gate → POST /students/:id/advise → either the SHOW_PLAN roster
// (course-plan.pdf) or a transfer recommendation (transfer-recommendation.pdf)
// depending on what the real branch logic decides, with the §16.4 venture
// match card injected the same way it always was.
import { useState } from 'react';
import { api, AdvisingActionDTO, DeptFitResultDTO, StudentDetail } from '../../api/client';
import { categoryTag, creditCapDisplay } from '../lib/studentUiHelpers';
import { CatalogEntry } from '../lib/useCatalogMap';
import { Loading } from '../ui/Primitives';
import { AcademicPerformanceGate } from './AcademicPerformanceGate';
import { defaultCategoryTag, PlanRosterTable } from './PlanRosterTable';
import { computePlanProjection, PlanSummary } from './PlanSummary';
import { TransferConfirm } from './TransferConfirm';
import { TransferRecommendation } from './TransferRecommendation';
import { VentureMatchGoldCard } from './VentureMatchGoldCard';

type Step =
  | { kind: 'gate' }
  | { kind: 'loading' }
  | { kind: 'result'; result: AdvisingActionDTO; forcedShowPlan: boolean }
  | { kind: 'transfer-confirm'; result: AdvisingActionDTO; transferKind: 'internal' | 'external'; targetId: string }
  | { kind: 'error'; message: string };

export function ProbationRepairTab({
  studentId,
  student,
  catalog,
  completedCredits,
  onGoDashboard,
}: {
  studentId: string;
  student: StudentDetail;
  catalog: Map<string, CatalogEntry>;
  completedCredits: number | null;
  onGoDashboard: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: 'gate' });
  const [deptFit, setDeptFit] = useState<DeptFitResultDTO[] | null>(null);

  const runAdvise = async () => {
    setStep({ kind: 'loading' });
    try {
      const result = await api.advise(studentId);
      if (result.action === 'RECOMMEND_INTERNAL_TRANSFER') api.departmentFit(studentId).then(setDeptFit);
      setStep({ kind: 'result', result, forcedShowPlan: false });
    } catch (e) {
      setStep({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const afterGate = async (considerRetakes: boolean) => {
    await api.setRetakePreference(studentId, considerRetakes);
    runAdvise();
  };

  const restart = () => setStep({ kind: 'gate' });
  const cap = creditCapDisplay(student.cgpa);

  if (step.kind === 'gate') return <AcademicPerformanceGate onAnswer={afterGate} onSkip={onGoDashboard} />;
  if (step.kind === 'loading') return <Loading label="Running the probation-repair advising cycle…" />;
  if (step.kind === 'error') {
    return (
      <div className="su-card">
        <div className="su-note danger">{step.message}</div>
        <button className="su-btn su-btn-secondary su-mt-16" onClick={restart}>Start over</button>
      </div>
    );
  }

  if (step.kind === 'transfer-confirm') {
    return (
      <TransferConfirm
        studentId={studentId}
        kind={step.transferKind}
        targetId={step.targetId}
        onCancel={() => setStep({ kind: 'result', result: step.result, forcedShowPlan: true })}
        onDone={restart}
      />
    );
  }

  // step.kind === 'result'
  const { result, forcedShowPlan } = step;
  const showPlan = result.action === 'SHOW_PLAN' || forcedShowPlan;
  const isInternal = result.action === 'RECOMMEND_INTERNAL_TRANSFER';
  const candidates = isInternal ? deptFit ?? [] : result.suggestedFaculties ?? [];
  const currentEntry = isInternal ? candidates.find(c => c.id === student.departmentId) : undefined;

  return (
    <div className="su-fade">
      {student.cgpa < 2.0 && (
        <div className="su-note danger su-mt-16" style={{ marginTop: 0, marginBottom: 16 }}>
          <b>Probation-repair mode active.</b> Because your CGPA is below 2.00, this plan is weighted toward expected
          grade quality over speed-to-graduation.
        </div>
      )}

      {result.ventureMatch && (
        <VentureMatchGoldCard
          match={result.ventureMatch}
          onExpressInterest={async cv => { await api.expressInterestInProject(studentId, result.ventureMatch!.project.id, cv); }}
        />
      )}

      {showPlan ? (
        <>
          <PlanSummary
            {...computePlanProjection(result.plan, catalog, student.cgpa, completedCredits)}
            currentCgpa={student.cgpa}
            cap={cap.cap}
            capReason={cap.reason}
          />
          <PlanRosterTable plan={result.plan} catalog={catalog} categoryTagFor={c => defaultCategoryTag(c, catalog, categoryTag)} />
          <button className="su-btn su-btn-secondary su-mt-16" onClick={restart}>Run again</button>
        </>
      ) : isInternal && !deptFit ? (
        <Loading label="Scoring department fit…" />
      ) : (
        <TransferRecommendation
          result={result}
          currentCgpa={student.cgpa}
          candidates={candidates}
          currentLabel={isInternal ? 'Current department' : 'Current faculty'}
          currentEntry={currentEntry}
          onDismiss={() => setStep({ ...step, forcedShowPlan: true })}
          requestBusy={false}
          onRequestTransfer={() => {
            const top = candidates[0];
            if (!top) return;
            setStep({ kind: 'transfer-confirm', result, transferKind: isInternal ? 'internal' : 'external', targetId: top.id });
          }}
        />
      )}
    </div>
  );
}

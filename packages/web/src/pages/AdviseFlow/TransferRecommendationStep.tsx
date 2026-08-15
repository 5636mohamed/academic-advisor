// Spec §10 step 5 — shown only when action !== 'SHOW_PLAN'. Two buttons:
// "See the in-major plan anyway" (fallback to the plan as-is) and
// "Start transfer review."
import { useEffect, useState } from 'react';
import { AdvisingActionDTO, api, DeptFitResultDTO } from '../../api/client';
import { TransferExplanationCard } from '../../components/TransferExplanationCard';

export function TransferRecommendationStep({
  studentId,
  cgpa,
  result,
  onShowPlanAnyway,
  onStartReview,
}: {
  studentId: string;
  cgpa: number;
  result: AdvisingActionDTO;
  onShowPlanAnyway: () => void;
  onStartReview: (kind: 'internal' | 'external', candidateId: string, facultyId?: string) => void;
}) {
  const isInternal = result.action === 'RECOMMEND_INTERNAL_TRANSFER';
  const [deptFit, setDeptFit] = useState<DeptFitResultDTO[] | null>(null);

  useEffect(() => {
    if (isInternal) {
      api.departmentFit(studentId).then(setDeptFit);
    }
  }, [isInternal, studentId]);

  const candidates = isInternal ? deptFit ?? [] : result.suggestedFaculties ?? [];
  const top = candidates[0];

  return (
    <div>
      <TransferExplanationCard
        currentCgpa={cgpa}
        projectedCGPA={result.projectedCGPA}
        trendSlope={result.trendSlope}
        explain={result.explain}
        candidates={candidates}
        candidateLabel={isInternal ? 'Best-fit departments in your faculty' : 'Best-fit faculties'}
      />
      <div className="card" style={{ display: 'flex', gap: 10 }}>
        <button className="secondary" onClick={onShowPlanAnyway}>
          See the in-major plan anyway
        </button>
        <button
          disabled={!top}
          onClick={() => {
            if (!top) return;
            if (isInternal) onStartReview('internal', top.id);
            else onStartReview('external', top.id, top.id); // faculty id === candidate id at this tier
          }}
        >
          Start transfer review{top ? `: ${top.name}` : ''}
        </button>
      </div>
    </div>
  );
}

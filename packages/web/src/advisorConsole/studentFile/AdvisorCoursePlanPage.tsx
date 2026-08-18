// "Course Plan" sub-tab — course-plan advisor.pdf's three mode tabs, reusing
// the exact same generic FastGraduationTab / TargetCgpaTab / ProbationRepairTab
// components the student portal built (they only ever took studentId/
// student/catalog as props, never anything tied to the student's own
// session) — plus a fourth "Proposals" mode for the advisor-only §15.3
// dual-approval capability (approve/decline/propose alternate), which has
// no equivalent on the student side.
import { useEffect, useState } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { api, StudentDetail } from '../../api/client';
import { useCatalogMap } from '../../portal/lib/useCatalogMap';
import { Loading } from '../../portal/ui/Primitives';
import { FastGraduationTab } from '../../portal/coursePlan/FastGraduationTab';
import { TargetCgpaTab } from '../../portal/coursePlan/TargetCgpaTab';
import { ProbationRepairTab } from '../../portal/coursePlan/ProbationRepairTab';
import { AdvisorProposalsTab } from './AdvisorProposalsTab';

type Mode = 'fast' | 'target' | 'probation' | 'proposals';
const MODE_FROM_QUERY: Record<string, Mode> = { fast: 'fast', target: 'target', probation: 'probation', proposals: 'proposals' };

export function AdvisorCoursePlanPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { reload } = useOutletContext<{ reload: () => void }>();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [mode, setMode] = useState<Mode>(MODE_FROM_QUERY[params.get('mode') ?? ''] ?? 'fast');
  const { map: catalog, completedCredits } = useCatalogMap(id);

  useEffect(() => {
    if (id) api.getStudent(id).then(setStudent);
  }, [id]);

  if (!id) return null;
  if (!student) return <Loading label="Loading course plan…" />;

  return (
    <div>
      <div className="su-flex su-justify-between su-items-center" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="su-eyebrow">Auto-balanced algorithm strictly matching E-JUST credit limits</div>
          <div className="su-title" style={{ fontSize: 22 }}>Personalized Academic Recovery Plan</div>
        </div>
        <div className="su-modetabs">
          <button className={`su-modetab${mode === 'fast' ? ' active' : ''}`} onClick={() => setMode('fast')}>Fastest Graduation</button>
          <button className={`su-modetab${mode === 'target' ? ' active' : ''}`} onClick={() => setMode('target')}>Target CGPA Focus</button>
          <button className={`su-modetab${mode === 'probation' ? ' active' : ''}`} onClick={() => setMode('probation')}>Probation Repair</button>
          <button className={`su-modetab${mode === 'proposals' ? ' active' : ''}`} onClick={() => setMode('proposals')}>Proposals</button>
        </div>
      </div>

      {mode === 'fast' && (
        <FastGraduationTab
          studentId={id}
          student={student}
          catalog={catalog}
          completedCredits={completedCredits}
          onGoToRecommendations={() => setMode('proposals')}
          submitLabel="Approve"
          submitMessage="Proposals generated from this plan — review and approve them in the Proposals tab."
          recommendationsLinkLabel="Go to Proposals"
        />
      )}
      {mode === 'target' && <TargetCgpaTab studentId={id} student={student} catalog={catalog} completedCredits={completedCredits} />}
      {mode === 'probation' && (
        <ProbationRepairTab
          studentId={id}
          student={student}
          catalog={catalog}
          completedCredits={completedCredits}
          onGoDashboard={() => { reload(); setMode('fast'); }}
        />
      )}
      {mode === 'proposals' && <AdvisorProposalsTab studentId={id} studentName={student.name} />}
    </div>
  );
}

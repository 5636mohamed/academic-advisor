// "Course Plan" tab — course-plan.pdf's three mode tabs (Fastest Graduation
// / Target CGPA Focus / Probation Repair) plus a fourth internal sub-tab for
// the real dual-approval "My Recommendations" workflow, which has no home
// of its own in the mockup's fixed five-item topbar. Deep-linkable via
// `?mode=fast|target|probation|recommendations` — the Dashboard's Quick
// Access panel and mini-links use this.
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, StudentDetail } from '../api/client';
import { useCatalogMap } from './lib/useCatalogMap';
import { Loading } from './ui/Primitives';
import { FastGraduationTab } from './coursePlan/FastGraduationTab';
import { TargetCgpaTab } from './coursePlan/TargetCgpaTab';
import { ProbationRepairTab } from './coursePlan/ProbationRepairTab';
import { MyRecommendationsTab } from './coursePlan/MyRecommendationsTab';

type Mode = 'fast' | 'target' | 'probation' | 'recommendations';

const MODE_FROM_QUERY: Record<string, Mode> = { fast: 'fast', target: 'target', probation: 'probation', recommendations: 'recommendations' };

export function PortalCoursePlan() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [mode, setMode] = useState<Mode>(MODE_FROM_QUERY[params.get('mode') ?? ''] ?? 'fast');
  const { map: catalog, completedCredits } = useCatalogMap(id);

  useEffect(() => {
    if (id) api.getStudent(id).then(setStudent);
  }, [id]);

  if (!id) return null;
  if (!student) return <Loading label="Loading your course plan…" />;

  return (
    <div>
      <div className="su-flex su-justify-between su-items-center su-mt-16" style={{ marginTop: 0, marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="su-eyebrow">Auto-balanced algorithm strictly matching your credit limit</div>
          <div className="su-title" style={{ fontSize: 24 }}>Personalized Academic Recovery Plan</div>
        </div>
        <div className="su-modetabs">
          <button className={`su-modetab${mode === 'fast' ? ' active' : ''}`} onClick={() => setMode('fast')}>Fastest Graduation</button>
          <button className={`su-modetab${mode === 'target' ? ' active' : ''}`} onClick={() => setMode('target')}>Target CGPA Focus</button>
          <button className={`su-modetab${mode === 'probation' ? ' active' : ''}`} onClick={() => setMode('probation')}>Probation Repair</button>
          <button className={`su-modetab${mode === 'recommendations' ? ' active' : ''}`} onClick={() => setMode('recommendations')}>My Recommendations</button>
        </div>
      </div>

      {mode === 'fast' && (
        <FastGraduationTab studentId={id} student={student} catalog={catalog} completedCredits={completedCredits} onGoToRecommendations={() => setMode('recommendations')} />
      )}
      {mode === 'target' && <TargetCgpaTab studentId={id} student={student} catalog={catalog} completedCredits={completedCredits} />}
      {mode === 'probation' && (
        <ProbationRepairTab studentId={id} student={student} catalog={catalog} completedCredits={completedCredits} onGoDashboard={() => navigate(`/portal/${id}`)} />
      )}
      {mode === 'recommendations' && <MyRecommendationsTab studentId={id} />}
    </div>
  );
}

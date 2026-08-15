// Spec §0/§10 — the "Target-CGPA plan" baseline feature: re-weighted toward
// safety (below target) or speed (above target), independent of the full
// §4.2 advising-cycle branch decision.
import { useParams } from 'react-router-dom';
import { StudentNavTabs } from '../../components/StudentNavTabs';
import { TargetCgpaPlanContent } from './TargetCgpaPlanContent';

export function TargetCgpaPlanner() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <div>
      <StudentNavTabs id={id} />
      <TargetCgpaPlanContent studentId={id} />
    </div>
  );
}

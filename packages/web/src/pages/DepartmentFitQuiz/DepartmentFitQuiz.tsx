// Spec §0/§6/§10 — the 5-question best-fit department quiz, blended
// 50% quiz / 30% grades / 20% alumni.
import { useParams } from 'react-router-dom';
import { StudentNavTabs } from '../../components/StudentNavTabs';
import { QuizContent } from './QuizContent';

export function DepartmentFitQuiz() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <div>
      <StudentNavTabs id={id} />
      <QuizContent studentId={id} />
    </div>
  );
}

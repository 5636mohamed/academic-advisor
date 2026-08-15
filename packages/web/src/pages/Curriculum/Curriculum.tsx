import { useParams } from 'react-router-dom';
import { StudentNavTabs } from '../../components/StudentNavTabs';
import { CurriculumContent } from './CurriculumContent';

export function Curriculum() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <div>
      <StudentNavTabs id={id} />
      <CurriculumContent studentId={id} />
    </div>
  );
}

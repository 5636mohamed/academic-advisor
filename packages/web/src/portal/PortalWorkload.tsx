// AI Features Blueprint §3.1/§3.4 — "Workload" tab: the student's own
// Cognitive Load Heatmap view. Same fetch-on-mount pattern every other
// portal page already uses (PortalQuiz.tsx, PortalTranscript.tsx, etc.).
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, FrictionTimelineDTO } from '../api/client';
import { Loading } from './ui/Primitives';
import { FrictionTimeline } from './ui/FrictionTimeline';

export function PortalWorkload() {
  const { id } = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<FrictionTimelineDTO | null>(null);

  useEffect(() => {
    if (id) api.frictionTimeline(id).then(setTimeline);
  }, [id]);

  if (!timeline || !id) return <Loading label="Projecting your weekly workload…" />;
  return <FrictionTimeline timeline={timeline} studentId={id} onTimelineChange={setTimeline} />;
}

import { useEffect, useState, useCallback } from 'react';
import { api, StudentSummary } from '../api/client';

/** Sidebar student list, shared by every page via the Dashboard layout —
 *  refetchable so mutating actions (enroll, transfer, advise) can refresh
 *  the badges without a full page reload. */
export function useStudentList() {
  const [students, setStudents] = useState<StudentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api
      .listStudents()
      .then(setStudents)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(reload, [reload]);

  return { students, error, reload };
}

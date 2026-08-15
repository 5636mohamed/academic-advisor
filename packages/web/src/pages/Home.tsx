import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

/** Redirects to the first student so the app never lands on a blank page. */
export function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    api.listStudents().then(list => {
      if (list[0]) navigate(`/students/${list[0].id}`, { replace: true });
    });
  }, [navigate]);
  return <div className="loading">Loading…</div>;
}

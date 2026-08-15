// Shared "course code -> catalog info" lookup, built off the same
// /students/:id/curriculum endpoint the Curriculum tab already uses (§14's
// CATALOG, annotated per-student). Several redesigned screens need a
// course's name/credits/category alongside data that only carries the code
// (PlanCourseDTO, CourseProposalDTO) — this hook is the one place that join
// happens instead of every page re-fetching/re-deriving it.
import { useEffect, useState } from 'react';
import { api, CurriculumCourseDTO } from '../../api/client';

export interface CatalogEntry {
  name: string;
  credits: number;
  category: string;
}

export function useCatalogMap(studentId: string | undefined) {
  const [rows, setRows] = useState<CurriculumCourseDTO[] | null>(null);

  useEffect(() => {
    if (studentId) api.getCurriculum(studentId).then(setRows);
  }, [studentId]);

  const map = new Map<string, CatalogEntry>();
  rows?.forEach(r => map.set(r.course.code, { name: r.course.name, credits: r.course.credits, category: r.course.category }));

  const completedCredits = rows?.filter(r => r.status === 'passed').reduce((s, r) => s + r.course.credits, 0) ?? null;

  return { rows, map, completedCredits, loading: rows === null };
}

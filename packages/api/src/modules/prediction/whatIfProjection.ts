// Spec §15.2's CGPA-impact figure — two REAL §2.2 computeCGPA runs over the
// same transcript, swapping in either each course's expectedPoints or its
// bestCasePoints. Not an estimate; the same arithmetic §3.4 already uses.
import { EnrollmentRecord } from '@advisor/shared';
import { computeCGPA } from '../grading/cgpa';

export interface WhatIfCourse {
  courseCode: string;
  credits: number;
  expectedPoints: number;
  bestCasePoints: number;
}

export interface WhatIfResult {
  expectedProjectedCGPA: number;
  bestCaseProjectedCGPA: number;
}

/** Projects CGPA twice over `existingAttempts ∪ courses`: once using each
 *  course's realistic expectedPoints, once using its bestCasePoints. */
export function projectExpectedVsBestCase(
  existingAttempts: EnrollmentRecord[],
  existingCourseByCode: Record<string, { credits: number }>,
  courses: WhatIfCourse[],
  nextSemesterOrdinal: number
): WhatIfResult {
  const withPoints = (points: 'expectedPoints' | 'bestCasePoints') => {
    const synthetic: EnrollmentRecord[] = courses.map(c => ({
      courseCode: `__whatif_${c.courseCode}__`,
      attemptNumber: 1,
      pct: 0,
      letter: '',
      points: c[points],
      isRetake: false,
      countsInCgpa: true,
      semesterOrdinal: nextSemesterOrdinal,
    }));
    const courseByCode = {
      ...existingCourseByCode,
      ...Object.fromEntries(courses.map(c => [`__whatif_${c.courseCode}__`, { credits: c.credits }])),
    };
    return computeCGPA({ latestAttempts: [...existingAttempts, ...synthetic], courseByCode });
  };

  return {
    expectedProjectedCGPA: withPoints('expectedPoints'),
    bestCaseProjectedCGPA: withPoints('bestCasePoints'),
  };
}

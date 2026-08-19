// AI Features Blueprint §1.8 — institutional bottleneck detection.
//
// Honest scoping note: every real seeded student and every course in
// CATALOG belongs to the same single department (ECE) — there's no second
// full catalog to compare against (see deptFitEngine.ts's
// OTHER_FACULTY_DEPARTMENTS comment, simulateUnderDepartment.ts's header).
// So with today's real data, this aggregation will only ever surface one
// department's cells — it's written to be genuinely multi-department-
// capable (groups by whatever departmentId values actually appear), not
// hardcoded to 'ECE', so it grows correctly if a second catalog is ever
// seeded. What IS real and meaningful with just one department: the
// per-WEEK comparison ("week 8 chronically overloads, regardless of
// department") — that axis doesn't need a second department to be a
// genuine, non-trivial finding.
//
// Data source: real completed EnrollmentRecords (db.getTranscript) across
// every student, grouped by the semesterOrdinal EACH student actually
// completed that course in (not the catalog's nominal offering semester —
// a retake or an out-of-sequence attempt has its own real semesterOrdinal
// on the transcript row). That gives genuine multi-semester historical
// friction data without a separate persisted log.
import { weeklyFriction } from './frictionScore.service';
import { SyllabusMilestone, InstitutionalFrictionCell } from '@advisor/shared';
import weights from '../../config/predictionWeights.json';
import { SEMESTER_WEEKS } from '../../db/seed/seedSyllabusMilestones';

export interface StudentTranscriptRow {
  courseCode: string;
  semesterOrdinal: number;
}

export interface StudentForBottleneck {
  departmentId: string;
  transcript: StudentTranscriptRow[];
}

interface CellKey { departmentId: string; semesterOrdinal: number; }

export function computeInstitutionalBottlenecks(
  studentsData: StudentForBottleneck[],
  milestonesByCourse: Record<string, SyllabusMilestone[]>,
  creditsFor: (code: string) => number | undefined
): InstitutionalFrictionCell[] {
  // Group each student's completed courses by (departmentId, semesterOrdinal)
  // — the real cohort of "students who were in department D taking their
  // department's courses in semester ordinal S."
  const cohorts = new Map<string, { key: CellKey; courseCodesByStudent: string[][] }>();
  for (const s of studentsData) {
    const bySemester = new Map<number, string[]>();
    for (const row of s.transcript) {
      (bySemester.get(row.semesterOrdinal) ?? bySemester.set(row.semesterOrdinal, []).get(row.semesterOrdinal)!).push(row.courseCode);
    }
    for (const [semesterOrdinal, courseCodes] of bySemester) {
      const cacheKey = `${s.departmentId}::${semesterOrdinal}`;
      if (!cohorts.has(cacheKey)) cohorts.set(cacheKey, { key: { departmentId: s.departmentId, semesterOrdinal }, courseCodesByStudent: [] });
      cohorts.get(cacheKey)!.courseCodesByStudent.push(courseCodes);
    }
  }

  // Per cohort, per week: mean friction score + fraction over burnoutThreshold.
  const cells: Array<InstitutionalFrictionCell & { semesterOrdinal: number }> = [];
  for (const { key, courseCodesByStudent } of cohorts.values()) {
    if (courseCodesByStudent.length === 0) continue;
    const perStudentWeekly = courseCodesByStudent.map(codes => weeklyFriction(codes, milestonesByCourse, creditsFor));
    for (let week = 1; week <= SEMESTER_WEEKS; week++) {
      const scoresThisWeek = perStudentWeekly.map(readings => readings[week - 1].frictionScore);
      const mean = scoresThisWeek.reduce((s, v) => s + v, 0) / scoresThisWeek.length;
      const overThreshold = scoresThisWeek.filter(v => v > weights.friction.burnoutThreshold).length;
      cells.push({
        departmentId: key.departmentId,
        semesterOrdinal: key.semesterOrdinal,
        weekNumber: week,
        meanFrictionScore: Math.round(mean * 10) / 10,
        burnoutRiskFraction: Math.round((overThreshold / scoresThisWeek.length) * 1000) / 1000,
        isConsistentBottleneck: false, // filled in below
      });
    }
  }

  // Top-decile threshold across (dept, semester, week) cells that actually
  // HAD a milestone (score > 0) — most weeks have no milestone at all, and
  // including those zero cells degenerates the percentile cutoff toward 0
  // (a single nonzero score would then trivially count as "top decile"),
  // defeating the whole point of the consistency check on any dataset
  // sparse enough for zeros to dominate.
  const meanScores = cells.map(c => c.meanFrictionScore).filter(v => v > 0).sort((a, b) => a - b);
  const decileIdx = Math.floor(meanScores.length * (1 - weights.friction.bottleneckTopDecile));
  const topDecileCutoff = meanScores[Math.min(decileIdx, meanScores.length - 1)] ?? Infinity;

  // "Consistently overloads week W": in the top decile in >= N of the last
  // M available semesters for that (department, week) pair.
  const availableSemestersByDept = new Map<string, number[]>();
  for (const c of cells) {
    const list = availableSemestersByDept.get(c.departmentId) ?? [];
    if (!list.includes(c.semesterOrdinal)) list.push(c.semesterOrdinal);
    availableSemestersByDept.set(c.departmentId, list);
  }
  for (const list of availableSemestersByDept.values()) list.sort((a, b) => b - a); // most recent first

  for (const cell of cells) {
    const recentSemesters = (availableSemestersByDept.get(cell.departmentId) ?? []).slice(0, weights.friction.bottleneckLookbackSemesters);
    const hitsInRecentSemesters = recentSemesters.filter(sem => {
      const match = cells.find(c => c.departmentId === cell.departmentId && c.semesterOrdinal === sem && c.weekNumber === cell.weekNumber);
      return match && match.meanFrictionScore >= topDecileCutoff;
    }).length;
    cell.isConsistentBottleneck = hitsInRecentSemesters >= weights.friction.bottleneckMinConsistentSemesters;
  }

  // Collapse across semesters into one (department, week) cell for the UI —
  // mean-of-means across the available semesters, consistent flag as computed.
  const collapsed = new Map<string, InstitutionalFrictionCell & { _count: number }>();
  for (const cell of cells) {
    const key = `${cell.departmentId}::${cell.weekNumber}`;
    const existing = collapsed.get(key);
    if (!existing) {
      collapsed.set(key, { departmentId: cell.departmentId, weekNumber: cell.weekNumber, meanFrictionScore: cell.meanFrictionScore, burnoutRiskFraction: cell.burnoutRiskFraction, isConsistentBottleneck: cell.isConsistentBottleneck, _count: 1 });
    } else {
      existing.meanFrictionScore = (existing.meanFrictionScore * existing._count + cell.meanFrictionScore) / (existing._count + 1);
      existing.burnoutRiskFraction = (existing.burnoutRiskFraction * existing._count + cell.burnoutRiskFraction) / (existing._count + 1);
      existing.isConsistentBottleneck = existing.isConsistentBottleneck || cell.isConsistentBottleneck;
      existing._count += 1;
    }
  }

  return Array.from(collapsed.values()).map(({ _count, ...rest }) => ({
    ...rest,
    meanFrictionScore: Math.round(rest.meanFrictionScore * 10) / 10,
    burnoutRiskFraction: Math.round(rest.burnoutRiskFraction * 1000) / 1000,
  }));
}

import { describe, it, expect } from 'vitest';
import { weeklyFriction, frictionTrend, buildFrictionTimeline, recommendTaskMoves, MOVABLE_MILESTONE_TYPES } from '../../../src/modules/friction/frictionScore.service';
import { SyllabusMilestone } from '@advisor/shared';

const milestonesByCourse: Record<string, SyllabusMilestone[]> = {
  A: [
    { id: 'A::3::quiz', courseCode: 'A', weekNumber: 3, type: 'quiz', title: 'A quiz' },
    { id: 'A::7::midterm', courseCode: 'A', weekNumber: 7, type: 'midterm', title: 'A midterm' },
    { id: 'A::14::final', courseCode: 'A', weekNumber: 14, type: 'final', title: 'A final' },
  ],
  B: [
    { id: 'B::7::midterm', courseCode: 'B', weekNumber: 7, type: 'midterm', title: 'B midterm' }, // same week as A's midterm
    { id: 'B::14::final', courseCode: 'B', weekNumber: 14, type: 'final', title: 'B final' },
  ],
};
const credits = (code: string) => (code === 'A' ? 3 : 2);

describe('weeklyFriction — §1.7', () => {
  it('produces exactly SEMESTER_WEEKS (14) readings', () => {
    const readings = weeklyFriction(['A'], milestonesByCourse, credits);
    expect(readings).toHaveLength(14);
    expect(readings.map(r => r.weekNumber)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  });

  it('a week with no milestones scores 0 and carries no burnout risk', () => {
    const readings = weeklyFriction(['A'], milestonesByCourse, credits);
    const week1 = readings.find(r => r.weekNumber === 1)!;
    expect(week1.frictionScore).toBe(0);
    expect(week1.burnoutRisk).toBe(false);
    expect(week1.contributingMilestones).toEqual([]);
  });

  it('a lone milestone scores baseWeight x credits x 1 (no overlap penalty)', () => {
    const readings = weeklyFriction(['A'], milestonesByCourse, credits);
    const week3 = readings.find(r => r.weekNumber === 3)!;
    // quiz weight (1) x 3 credits x overlapPenalty(1, since only 1 milestone) = 3
    expect(week3.frictionScore).toBe(3);
  });

  it('clustering two milestones in the same week scores MORE than the sum of each alone (overlap penalty)', () => {
    const readingsBoth = weeklyFriction(['A', 'B'], milestonesByCourse, credits);
    const week7Both = readingsBoth.find(r => r.weekNumber === 7)!;

    const readingsAOnly = weeklyFriction(['A'], milestonesByCourse, credits);
    const week7A = readingsAOnly.find(r => r.weekNumber === 7)!;
    const readingsBOnly = weeklyFriction(['B'], milestonesByCourse, credits);
    const week7B = readingsBOnly.find(r => r.weekNumber === 7)!;

    expect(week7Both.frictionScore).toBeGreaterThan(week7A.frictionScore + week7B.frictionScore);
    expect(week7Both.contributingMilestones).toHaveLength(2);
  });

  it('unknown course codes contribute nothing rather than throwing', () => {
    const readings = weeklyFriction(['DOES-NOT-EXIST'], milestonesByCourse, credits);
    expect(readings.every(r => r.frictionScore === 0)).toBe(true);
  });

  describe('doneIds — "mark done" recalculation', () => {
    it('a done milestone drops its weight from the score entirely', () => {
      const readings = weeklyFriction(['A'], milestonesByCourse, credits, new Set(['A::3::quiz']));
      const week3 = readings.find(r => r.weekNumber === 3)!;
      expect(week3.frictionScore).toBe(0);
    });

    it('a done milestone still appears in contributingMilestones, marked done', () => {
      const readings = weeklyFriction(['A'], milestonesByCourse, credits, new Set(['A::3::quiz']));
      const week3 = readings.find(r => r.weekNumber === 3)!;
      expect(week3.contributingMilestones).toHaveLength(1);
      expect(week3.contributingMilestones[0]).toMatchObject({ id: 'A::3::quiz', done: true });
    });

    it('a not-done milestone in the SAME response is marked done: false', () => {
      const readings = weeklyFriction(['A'], milestonesByCourse, credits, new Set(['A::3::quiz']));
      const week7 = readings.find(r => r.weekNumber === 7)!;
      expect(week7.contributingMilestones[0].done).toBe(false);
    });

    it('marking ONE of two clustered milestones done also recalculates the overlap penalty (drops toward the solo score of the remaining one)', () => {
      const bothPending = weeklyFriction(['A', 'B'], milestonesByCourse, credits);
      const week7Both = bothPending.find(r => r.weekNumber === 7)!;

      const oneDone = weeklyFriction(['A', 'B'], milestonesByCourse, credits, new Set(['B::7::midterm']));
      const week7OneDone = oneDone.find(r => r.weekNumber === 7)!;

      const aSolo = weeklyFriction(['A'], milestonesByCourse, credits).find(r => r.weekNumber === 7)!;

      expect(week7OneDone.frictionScore).toBeLessThan(week7Both.frictionScore);
      expect(week7OneDone.frictionScore).toBe(aSolo.frictionScore); // no more overlap penalty — B's milestone no longer collides
    });

    it('marking every milestone in a week done drops that week to 0 and clears burnoutRisk', () => {
      const readings = weeklyFriction(['A', 'B'], milestonesByCourse, credits, new Set(['A::7::midterm', 'B::7::midterm']));
      const week7 = readings.find(r => r.weekNumber === 7)!;
      expect(week7.frictionScore).toBe(0);
      expect(week7.burnoutRisk).toBe(false);
      expect(week7.contributingMilestones.every(m => m.done)).toBe(true);
    });
  });
});

describe('frictionTrend — recency-weighted, reuses linearRegression.ts', () => {
  it('reports insufficient_history with fewer than minSnapshotsForTrend readings', () => {
    const t = frictionTrend([{ weekNumber: 1, frictionScore: 10, burnoutRisk: false, contributingMilestones: [] }]);
    expect(t.reading).toBe('insufficient_history');
    expect(t.slope).toBeNull();
  });

  it('rising scores are read as "worsening", not "improving"', () => {
    const readings = [1, 2, 3, 4].map(week => ({ weekNumber: week, frictionScore: week * 20, burnoutRisk: false, contributingMilestones: [] }));
    const t = frictionTrend(readings);
    expect(t.reading).toBe('worsening');
    expect(t.slope).toBeGreaterThan(0);
  });

  it('falling scores are read as "improving"', () => {
    const readings = [1, 2, 3, 4].map(week => ({ weekNumber: week, frictionScore: (5 - week) * 20, burnoutRisk: false, contributingMilestones: [] }));
    const t = frictionTrend(readings);
    expect(t.reading).toBe('improving');
    expect(t.slope).toBeLessThan(0);
  });
});

describe('buildFrictionTimeline', () => {
  it('bundles readings + trend together', () => {
    const timeline = buildFrictionTimeline(['A', 'B'], milestonesByCourse, credits);
    expect(timeline.readings).toHaveLength(14);
    expect(timeline.trend).toBeDefined();
  });
});

describe('weekOverrides — "move this task a week or two later"', () => {
  it('relocates a milestone\'s contribution to its overridden week, not its template week', () => {
    const readings = weeklyFriction(['A'], milestonesByCourse, credits, new Set(), { 'A::3::quiz': 5 });
    const week3 = readings.find(r => r.weekNumber === 3)!;
    const week5 = readings.find(r => r.weekNumber === 5)!;
    expect(week3.frictionScore).toBe(0); // moved away
    expect(week5.frictionScore).toBeGreaterThan(0); // now lands here
    expect(week5.contributingMilestones.map(m => m.id)).toContain('A::3::quiz');
  });

  it('moving a milestone OUT of a clustered week also recalculates that week\'s overlap penalty', () => {
    const clustered = weeklyFriction(['A', 'B'], milestonesByCourse, credits).find(r => r.weekNumber === 7)!;
    // Move A's midterm is not allowed in reality (exams are fixed), but the
    // math itself doesn't know that — this tests the pure relocation
    // mechanism, independent of the route-level movable-type restriction.
    const afterMove = weeklyFriction(['A', 'B'], milestonesByCourse, credits, new Set(), { 'A::7::midterm': 8 }).find(r => r.weekNumber === 7)!;
    expect(afterMove.frictionScore).toBeLessThan(clustered.frictionScore);
    expect(afterMove.contributingMilestones).toHaveLength(1);
  });

  it('an override past the semester length is simply never matched by any week 1..14 (no crash, just dropped from the visible window)', () => {
    const readings = weeklyFriction(['A'], milestonesByCourse, credits, new Set(), { 'A::3::quiz': 99 });
    expect(readings.every(r => !r.contributingMilestones.some(m => m.id === 'A::3::quiz'))).toBe(true);
  });
});

describe('recommendTaskMoves — "ease the heavy load"', () => {
  it('never recommends moving a fixed-date exam/deadline, only MOVABLE_MILESTONE_TYPES', () => {
    expect(MOVABLE_MILESTONE_TYPES).toEqual(expect.arrayContaining(['assignment', 'quiz', 'lab_report']));
    expect(MOVABLE_MILESTONE_TYPES).not.toContain('midterm');
    expect(MOVABLE_MILESTONE_TYPES).not.toContain('final');
  });

  it('suggests nothing for a week that is not burnout risk', () => {
    const readings = weeklyFriction(['A'], milestonesByCourse, credits); // A alone never crosses the real burnoutThreshold in this fixture
    const recs = recommendTaskMoves(readings, milestonesByCourse);
    expect(recs.find(r => r.weekNumber === 3)).toBeUndefined();
  });

  it('suggests nothing for a burnout week whose only contributors are fixed-type (exams/deadlines) — nothing safe to move', () => {
    const examOnly: Record<string, SyllabusMilestone[]> = {
      X: [{ id: 'X::5::final', courseCode: 'X', weekNumber: 5, type: 'final', title: 'X final' }],
      Y: [{ id: 'Y::5::final', courseCode: 'Y', weekNumber: 5, type: 'final', title: 'Y final' }],
    };
    const heavyCredits = () => 5;
    const readings = weeklyFriction(['X', 'Y'], examOnly, heavyCredits);
    const week5 = readings.find(r => r.weekNumber === 5)!;
    expect(week5.burnoutRisk).toBe(true); // two 5-credit finals clustered — definitely over threshold
    const recs = recommendTaskMoves(readings, examOnly);
    expect(recs.find(r => r.weekNumber === 5)).toBeUndefined();
  });

  it('recommends the target week with the genuinely lowest current score among the reachable candidates', () => {
    const scenario: Record<string, SyllabusMilestone[]> = {
      C: [
        { id: 'C::4::assignment', courseCode: 'C', weekNumber: 4, type: 'assignment', title: 'C hw' },
        { id: 'C::4::midterm', courseCode: 'C', weekNumber: 4, type: 'midterm', title: 'C midterm' },
      ],
      D: [{ id: 'D::4::midterm', courseCode: 'D', weekNumber: 4, type: 'midterm', title: 'D midterm' }],
      // Week 5 has something light; week 6 is completely empty (score 0) — the real lightest target.
      E: [{ id: 'E::5::quiz', courseCode: 'E', weekNumber: 5, type: 'quiz', title: 'E quiz' }],
    };
    const heavyCredits = () => 5; // pushes week 4's real score past the real burnoutThreshold (80)
    const readings = weeklyFriction(['C', 'D', 'E'], scenario, heavyCredits);
    expect(readings.find(r => r.weekNumber === 4)!.burnoutRisk).toBe(true);
    const recs = recommendTaskMoves(readings, scenario);
    const week4Rec = recs.find(r => r.weekNumber === 4);
    expect(week4Rec).toBeDefined();
    expect(week4Rec!.milestoneId).toBe('C::4::assignment'); // the only movable candidate that week
    expect(week4Rec!.suggestedNewWeek).toBe(6); // strictly lighter than week 5
  });

  it('a done milestone is never recommended for a move', () => {
    const readings = weeklyFriction(['A', 'B'], milestonesByCourse, credits, new Set(['A::7::midterm', 'B::7::midterm']));
    // both midterms done -> week 7 no longer burnout risk at all, nothing to recommend
    expect(recommendTaskMoves(readings, milestonesByCourse, new Set(['A::7::midterm', 'B::7::midterm']))).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { weeklyFriction, frictionTrend, buildFrictionTimeline } from '../../../src/modules/friction/frictionScore.service';
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

import { describe, it, expect } from 'vitest';
import { weeklyFriction, frictionTrend, buildFrictionTimeline } from '../../../src/modules/friction/frictionScore.service';
import { SyllabusMilestone } from '@advisor/shared';

const milestonesByCourse: Record<string, SyllabusMilestone[]> = {
  A: [
    { courseCode: 'A', weekNumber: 3, type: 'quiz', title: 'A quiz' },
    { courseCode: 'A', weekNumber: 7, type: 'midterm', title: 'A midterm' },
    { courseCode: 'A', weekNumber: 14, type: 'final', title: 'A final' },
  ],
  B: [
    { courseCode: 'B', weekNumber: 7, type: 'midterm', title: 'B midterm' }, // same week as A's midterm
    { courseCode: 'B', weekNumber: 14, type: 'final', title: 'B final' },
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

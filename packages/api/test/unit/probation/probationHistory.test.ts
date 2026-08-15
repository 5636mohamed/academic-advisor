// Confirms replayProbationHistory reproduces spec §11 Example E's exact
// table (1, 2, 0, 1, 2) when driven off a real CgpaSnapshot series, and that
// the first snapshot never arms the counter (§4.5).
import { describe, it, expect } from 'vitest';
import { replayProbationHistory } from '../../../src/modules/probation/probationHistory';

describe('replayProbationHistory', () => {
  it('reproduces Example E exactly off a snapshot series', () => {
    const snapshots = [
      { semesterId: 'sem1', semesterOrdinal: 1, semesterGpa: 2.5, cgpa: 2.5, cumulativeCredits: 16, isBaseSnapshot: false },
      { semesterId: 'sem2', semesterOrdinal: 2, semesterGpa: 1.88, cgpa: 1.88, cumulativeCredits: 30, isBaseSnapshot: false },
      { semesterId: 'sem3', semesterOrdinal: 3, semesterGpa: 1.79, cgpa: 1.79, cumulativeCredits: 44, isBaseSnapshot: false },
      { semesterId: 'sem4', semesterOrdinal: 4, semesterGpa: 2.04, cgpa: 2.04, cumulativeCredits: 58, isBaseSnapshot: false },
      { semesterId: 'sem5', semesterOrdinal: 5, semesterGpa: 1.95, cgpa: 1.95, cumulativeCredits: 72, isBaseSnapshot: false },
      { semesterId: 'sem6', semesterOrdinal: 6, semesterGpa: 1.70, cgpa: 1.70, cumulativeCredits: 86, isBaseSnapshot: false },
    ];
    const { counter, log } = replayProbationHistory('s1', snapshots);
    expect(counter.count).toBe(2);
    expect(counter.armed).toBe(true);
    // log[0] = not_armed_first_semester, then 1,2,reset,1,2
    expect(log.map(l => l.reason)).toEqual([
      'not_armed_first_semester',
      'increment_low_cgpa',
      'increment_low_cgpa',
      'reset_recovered',
      'increment_low_cgpa',
      'increment_low_cgpa',
    ]);
    expect(log.map(l => l.newCount)).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it('stops early once dismissal fires', () => {
    const snapshots = Array.from({ length: 8 }, (_, i) => ({
      semesterId: `sem${i + 1}`,
      semesterOrdinal: i + 1,
      semesterGpa: 1.2,
      cgpa: 1.2,
      cumulativeCredits: (i + 1) * 14,
      isBaseSnapshot: false,
    }));
    const { counter, log } = replayProbationHistory('s1', snapshots);
    expect(counter.count).toBe(6);
    // first semester (unarmed) + 6 increments = 7 log rows, not 8
    expect(log.length).toBe(7);
  });

  it('an empty snapshot list yields an unarmed, zeroed counter with no log', () => {
    const { counter, log } = replayProbationHistory('s1', []);
    expect(counter).toEqual({ studentId: 's1', count: 0, armed: false });
    expect(log).toEqual([]);
  });
});

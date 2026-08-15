// Covers spec §11 Examples D, E, F and §13 test checklist items 1-3.
import { describe, it, expect } from 'vitest';
import { onSemesterClose } from '../../../src/modules/probation/probationCounter.service';
import { DISMISSAL_THRESHOLD } from '@advisor/shared';

describe('onSemesterClose — §4.1', () => {
  it('increments exactly once per sub-2.00 armed semester (Example D)', () => {
    const r = onSemesterClose({
      studentId: 's1', semesterId: 'sem6', cgpaAtClose: 1.92,
      counter: { studentId: 's1', count: 0, armed: true },
    });
    expect(r.counter.count).toBe(1);
    expect(r.logEntry?.reason).toBe('increment_low_cgpa');
    expect(r.dismissed).toBe(false);
  });

  it('resets to 0 the semester CGPA recovers to >=2.00, mid-window (Example E)', () => {
    // sem5:1.88 -> 1, sem6:1.79 -> 2, sem7:2.04 -> reset 0, sem8:1.95 -> 1, sem9:1.70 -> 2
    let counter = { studentId: 's1', count: 0, armed: true };
    const cgpas = [1.88, 1.79, 2.04, 1.95, 1.70];
    const expected = [1, 2, 0, 1, 2];
    const reasons = ['increment_low_cgpa', 'increment_low_cgpa', 'reset_recovered', 'increment_low_cgpa', 'increment_low_cgpa'];

    cgpas.forEach((cgpa, i) => {
      const r = onSemesterClose({ studentId: 's1', semesterId: `sem${5 + i}`, cgpaAtClose: cgpa, counter });
      expect(r.counter.count).toBe(expected[i]);
      expect(r.logEntry?.reason).toBe(reasons[i]);
      counter = r.counter;
    });
  });

  it('does NOT accumulate as a lifetime tally — semester 9 is 2, not 4', () => {
    let counter = { studentId: 's1', count: 0, armed: true };
    for (const cgpa of [1.88, 1.79, 2.04, 1.95, 1.70]) {
      counter = onSemesterClose({ studentId: 's1', semesterId: 'x', cgpaAtClose: cgpa, counter }).counter;
    }
    expect(counter.count).toBe(2);
  });

  it('dismissal fires at exactly count===6, not before, not after (Example F)', () => {
    // A dismissed student is frozen (spec §4.1 `freeze(student)`), so a real
    // orchestrator never calls onSemesterClose again after dismissed===true.
    // This test mirrors that: it stops the loop the moment dismissal fires.
    let counter = { studentId: 's1', count: 0, armed: true };
    let dismissedAt = -1;
    for (let sem = 1; sem <= 8; sem++) {
      const r = onSemesterClose({ studentId: 's1', semesterId: `sem${sem}`, cgpaAtClose: 1.5, counter });
      counter = r.counter;
      if (r.dismissed) { dismissedAt = sem; break; }
    }
    expect(counter.count).toBe(DISMISSAL_THRESHOLD);
    expect(dismissedAt).toBe(6); // 6th consecutive armed low semester
  });

  it('a currently-0, still-passing semester produces no log entry', () => {
    const r = onSemesterClose({
      studentId: 's1', semesterId: 'x', cgpaAtClose: 3.10,
      counter: { studentId: 's1', count: 0, armed: true },
    });
    expect(r.logEntry).toBeNull();
    expect(r.counter.count).toBe(0);
  });

  it('an unarmed counter is a defensive no-op', () => {
    const r = onSemesterClose({
      studentId: 's1', semesterId: 'x', cgpaAtClose: 1.2,
      counter: { studentId: 's1', count: 0, armed: false },
    });
    expect(r.counter.count).toBe(0);
    expect(r.logEntry).toBeNull();
  });
});

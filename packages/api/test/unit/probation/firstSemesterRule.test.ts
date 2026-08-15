// Covers spec §11 Example G and §13 checklist items 4-6.
import { describe, it, expect } from 'vitest';
import { onFirstSemesterClose } from '../../../src/modules/probation/firstSemesterRule.service';

describe('onFirstSemesterClose — §4.5', () => {
  it('never arms the counter regardless of GPA (low GPA case)', () => {
    const r = onFirstSemesterClose({ studentId: 's1', semesterId: 'sem1', gpaAtClose: 1.65 });
    expect(r.counter.armed).toBe(false);
    expect(r.counter.count).toBe(0);
    expect(r.logEntry.reason).toBe('not_armed_first_semester');
  });

  it('never arms the counter regardless of GPA (passing GPA case)', () => {
    const r = onFirstSemesterClose({ studentId: 's1', semesterId: 'sem1', gpaAtClose: 3.4 });
    expect(r.counter.armed).toBe(false);
    expect(r.nextSemesterCreditCap).toBe(20);
  });

  it('applies the 16-credit half-load only when first-semester GPA < 2.00', () => {
    const low = onFirstSemesterClose({ studentId: 's1', semesterId: 'sem1', gpaAtClose: 1.99 });
    expect(low.nextSemesterCreditCap).toBe(16);

    const ok = onFirstSemesterClose({ studentId: 's1', semesterId: 'sem1', gpaAtClose: 2.00 });
    expect(ok.nextSemesterCreditCap).toBe(20);
  });
});

// Full walkthrough of §11 Example G: semester 1 (unarmed) -> semester 2
// (arming begins) -> semester 2 outcome determines whether counter starts.
import { describe, it, expect } from 'vitest';
import { onFirstSemesterClose } from '../../../src/modules/probation/firstSemesterRule.service';
import { onSemesterClose } from '../../../src/modules/probation/probationCounter.service';

describe('Level-1 student full first-year walkthrough — Example G', () => {
  it('semester 2 still below 2.00 -> this IS the first semester that counts', () => {
    const sem1 = onFirstSemesterClose({ studentId: 'yara', semesterId: 'sem1', gpaAtClose: 1.65 });
    expect(sem1.counter.count).toBe(0);
    expect(sem1.nextSemesterCreditCap).toBe(16);

    // Arming happens at the start of semester 2's evaluation window (spec §4.5)
    const armedCounter = { ...sem1.counter, armed: true };
    const sem2 = onSemesterClose({ studentId: 'yara', semesterId: 'sem2', cgpaAtClose: 1.80, counter: armedCounter });
    expect(sem2.counter.count).toBe(1);
    expect(sem2.logEntry?.reason).toBe('increment_low_cgpa');
  });

  it('semester 2 recovers to >=2.00 -> counter stays at 0 throughout', () => {
    const sem1 = onFirstSemesterClose({ studentId: 'yara2', semesterId: 'sem1', gpaAtClose: 1.65 });
    const armedCounter = { ...sem1.counter, armed: true };
    const sem2 = onSemesterClose({ studentId: 'yara2', semesterId: 'sem2', cgpaAtClose: 2.05, counter: armedCounter });
    expect(sem2.counter.count).toBe(0);
    expect(sem2.logEntry).toBeNull();
  });
});

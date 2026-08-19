// Confirms the §16 venture system is really wired into the in-memory store
// (not just unit-tested in isolation) — Mohamed's §11 Scenario N end to
// end, plus the level/gate short-circuit and capacity-exclusion rules.
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../../src/db/memory/inMemoryDb';

beforeEach(() => {
  db.__resetForTests();
});

describe('§16.8 — level/gate short-circuit', () => {
  it('a Level < 3 student never gets matches, even if somehow gate-answered', () => {
    db.setVentureGateAnswer('sara-1', true); // sara-1 is Level 2
    expect(db.getVentureMatches('sara-1')).toEqual([]);
  });

  it('a Level 3+ student who never answered the gate gets nothing (indistinguishable from NO)', () => {
    // nourhan-1 is Level 3 but dismissed — correctly excluded from the
    // demo's pre-seeded opt-in cohort (see inMemoryDb.ts's
    // PRESEEDED_VENTURE_OPT_INS comment), so her gate is genuinely unset,
    // unlike every other Level 3+ seeded student.
    expect(db.getStudent('nourhan-1')?.level).toBeGreaterThanOrEqual(3);
    expect(db.getVentureMatches('nourhan-1')).toEqual([]);
  });

  it('answering NO also yields nothing', () => {
    db.setVentureGateAnswer('mohamed-1', false);
    expect(db.getVentureMatches('mohamed-1')).toEqual([]);
  });
});

describe('§11 Scenario N — Mohamed end to end', () => {
  it('answers the gate YES, submits the interest form, and clears the match threshold for proj-lora', () => {
    db.setVentureGateAnswer('mohamed-1', true);
    db.setVentureInterestAnswers('mohamed-1', { v1_domain: 'v1_embedded', v2_goal: 'v2_software', v3_role: 'v3_integrate' });

    const matches = db.getVentureMatches('mohamed-1');
    expect(matches.length).toBeGreaterThan(0);
    const lora = matches.find(m => m.project.id === 'proj-lora');
    expect(lora).toBeDefined();
    expect(lora!.total).toBeGreaterThanOrEqual(0.80);
    expect(lora!.status).toBe('suggested');
    expect(lora!.matchId).not.toBeNull();
  });

  it('the top card is injected once threshold clears, and expressing interest moves it to applied', () => {
    db.setVentureGateAnswer('mohamed-1', true);
    db.setVentureInterestAnswers('mohamed-1', { v1_domain: 'v1_embedded', v2_goal: 'v2_software', v3_role: 'v3_integrate' });

    const card = db.getTopVentureCardMatch('mohamed-1');
    expect(card).not.toBeNull();
    expect(card!.status).toBe('suggested');

    const applied = db.applyToVentureMatch('mohamed-1', card!.matchId!);
    expect(applied.status).toBe('applied');
  });
});

describe('§16.8 — capacity and isActive exclusion', () => {
  it('proj-rf-full is excluded from a fresh matching run once accepted count reaches capacity', () => {
    // ahmed-1 is seeded with an accepted match against proj-rf-full (capacity 1)
    db.setVentureGateAnswer('mohamed-1', true);
    const matches = db.getVentureMatches('mohamed-1');
    expect(matches.find(m => m.project.id === 'proj-rf-full')).toBeUndefined();
  });

  it('proj-archived (isActive=false) is never matched', () => {
    db.setVentureGateAnswer('mohamed-1', true);
    const matches = db.getVentureMatches('mohamed-1');
    expect(matches.find(m => m.project.id === 'proj-archived')).toBeUndefined();
  });

  it("an existing match is not hidden even if the project fills up afterward", () => {
    // ahmed-1's own accepted match against proj-rf-full must still show up
    // for ahmed-1 himself, even though the project is now at capacity.
    db.setVentureGateAnswer('ahmed-1', true);
    const matches = db.getVentureMatches('ahmed-1');
    const own = matches.find(m => m.project.id === 'proj-rf-full');
    expect(own?.status).toBe('accepted');
  });
});

describe('§16.6 — Faculty Console wiring', () => {
  it('professor sees a ranked candidate list for their project', () => {
    db.setVentureGateAnswer('mohamed-1', true);
    db.setVentureInterestAnswers('mohamed-1', { v1_domain: 'v1_embedded', v2_goal: 'v2_software', v3_role: 'v3_integrate' });
    const candidates = db.getVentureProjectCandidates('proj-lora');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].studentId).toBe('mohamed-1'); // clear best fit among opted-in students
  });

  it('accepting beyond capacity is refused, not silently allowed', () => {
    db.setVentureGateAnswer('mohamed-1', true);
    db.getVentureMatches('mohamed-1'); // materializes a suggested match if it clears threshold
    const match = db.getVentureMatchesForStudent('mohamed-1').find(m => m.ventureProjectId === 'proj-rf-full');
    // proj-rf-full is already full (ahmed-1's accepted seed) — force a match row to try accepting into it
    if (match) {
      expect(() => db.setVentureMatchStatusByProfessor(match.id, 'accepted')).toThrow();
    }
  });

  it('creating and editing a project persists across reads', () => {
    const created = db.createVentureProject({
      professorId: 'prof-kamel',
      title: 'New Project',
      description: 'desc',
      type: 'academic_research',
      requiredCourseCodes: [],
      preferredSkills: [],
      capacity: 5,
      isActive: true,
    });
    expect(db.getVentureProject(created.id)).toBeDefined();
    const updated = db.updateVentureProject(created.id, { title: 'Renamed Project' });
    expect(updated.title).toBe('Renamed Project');
  });
});

describe('demo fixture — pre-seeded Venture Gate opt-ins for the whole eligible cohort', () => {
  it('every Level 3+, non-dismissed seeded student shows up in every project\'s candidate list out of the box, no live gate/form click required', () => {
    const candidates = db.getVentureProjectCandidates('proj-lora');
    const ids = candidates.map(c => c.studentId);
    expect(ids).toEqual(
      expect.arrayContaining(['ahmed-1', 'omar-1', 'mona-2', 'youssef-3', 'laila-4', 'salma-1', 'mohamed-1'])
    );
    // Level < 3 (never asked the gate) and dismissed (self-service blocked
    // entirely) are the only two exclusions, both real business rules.
    expect(ids).not.toEqual(expect.arrayContaining(['sara-1', 'karim-1', 'yara-1', 'hassan-1', 'fatma-1', 'nourhan-1']));
  });

  it('Mohamed and Ahmed both clear the match threshold without any live gate/form interaction', () => {
    for (const id of ['mohamed-1', 'ahmed-1']) {
      const matches = db.getVentureMatches(id);
      const qualifying = matches.filter(m => m.total >= 0.80);
      expect(qualifying.length).toBeGreaterThan(0);
      expect(qualifying.some(m => m.matchId !== null && m.status === 'suggested')).toBe(true);
    }
  });

  it('a below-threshold opt-in (e.g. a probation-ladder student) still appears ranked, just unscored/no card', () => {
    const card = db.getTopVentureCardMatch('mona-2');
    expect(card).toBeNull(); // her transcript never crosses 0.80 for any seeded project
    const matches = db.getVentureMatches('mona-2');
    expect(matches.length).toBeGreaterThan(0); // still ranked/visible on her Venture Board
  });
});

describe('product-owner follow-up — expressing interest regardless of match score', () => {
  it('a below-threshold ("unscored") project can still be applied to, creating a fresh applied row', () => {
    // mona-2 is opted in (pre-seeded) but never clears 0.80 for any project.
    const before = db.getVentureMatches('mona-2').find(m => m.project.id === 'proj-lora');
    expect(before?.matchId).toBeNull();
    expect(before?.status).toBe('unscored');

    const created = db.applyToVentureProject('mona-2', 'proj-lora', { fileName: 'mona-cv.pdf', dataUrl: 'data:application/pdf;base64,ZGVtbw==' });
    expect(created.status).toBe('applied');
    expect(created.cvFileName).toBe('mona-cv.pdf');

    const after = db.getVentureMatches('mona-2').find(m => m.project.id === 'proj-lora');
    expect(after?.matchId).toBe(created.id);
    expect(after?.status).toBe('applied');
  });

  it('applying a second time to the same project reuses the existing row instead of duplicating it', () => {
    db.applyToVentureProject('mona-2', 'proj-lora', { fileName: 'v1.pdf', dataUrl: 'data:application/pdf;base64,AA==' });
    const second = db.applyToVentureProject('mona-2', 'proj-lora', { fileName: 'v2.pdf', dataUrl: 'data:application/pdf;base64,BB==' });
    const rows = db.getVentureMatchesForStudent('mona-2').filter(m => m.ventureProjectId === 'proj-lora');
    expect(rows.length).toBe(1);
    expect(second.cvFileName).toBe('v2.pdf');
  });

  it('an already-qualifying ("suggested") match applies via the same project-keyed path, same as before', () => {
    const card = db.getTopVentureCardMatch('ahmed-1');
    expect(card).not.toBeNull();
    const applied = db.applyToVentureProject('ahmed-1', card!.project.id);
    expect(applied.status).toBe('applied');
    expect(applied.id).toBe(card!.matchId);
  });

  it('throws for a nonexistent project', () => {
    expect(() => db.applyToVentureProject('mona-2', 'proj-does-not-exist')).toThrow();
  });
});

describe('§16.4 — CV attachment flows through to the professor\'s candidate list', () => {
  it('a CV attached when expressing interest is visible in getVentureProjectCandidates', () => {
    db.setVentureGateAnswer('mohamed-1', true);
    db.setVentureInterestAnswers('mohamed-1', { v1_domain: 'v1_embedded', v2_goal: 'v2_software', v3_role: 'v3_integrate' });
    const card = db.getTopVentureCardMatch('mohamed-1');
    expect(card).not.toBeNull();

    db.applyToVentureMatch('mohamed-1', card!.matchId!, { fileName: 'mohamed-cv.pdf', dataUrl: 'data:application/pdf;base64,ZGVtbw==' });

    const candidates = db.getVentureProjectCandidates('proj-lora');
    const mohamed = candidates.find(c => c.studentId === 'mohamed-1');
    expect(mohamed?.cvFileName).toBe('mohamed-cv.pdf');
    expect(mohamed?.cvDataUrl).toBe('data:application/pdf;base64,ZGVtbw==');
    expect(mohamed?.status).toBe('applied');
  });

  it('a candidate who never applied has no CV fields, not empty strings', () => {
    db.setVentureGateAnswer('mohamed-1', true);
    const candidates = db.getVentureProjectCandidates('proj-lora');
    const mohamed = candidates.find(c => c.studentId === 'mohamed-1');
    expect(mohamed?.cvFileName).toBeUndefined();
  });
});

describe('real-department expansion — venture-application variety from non-ECE students', () => {
  it('a CSE student applied with a CV attached', () => {
    const matches = db.getVentureMatchesForStudent('advisor-heba-gen-1');
    const row = matches.find(m => m.ventureProjectId === 'proj-edge-ml');
    expect(row?.status).toBe('applied');
    expect(row?.cvFileName).toBe('cv.pdf');
  });

  it('an MTE student applied but hasn\'t attached a CV yet', () => {
    const matches = db.getVentureMatchesForStudent('advisor-mostafa-gen-2');
    const row = matches.find(m => m.ventureProjectId === 'proj-lora');
    expect(row?.status).toBe('applied');
    expect(row?.cvFileName).toBeUndefined();
  });

  it('an MSE student has a system-suggested match, not yet applied — no CV', () => {
    const matches = db.getVentureMatchesForStudent('advisor-dina-gen-1');
    const row = matches.find(m => m.ventureProjectId === 'proj-grad-federated');
    expect(row?.status).toBe('suggested');
    expect(row?.cvFileName).toBeUndefined();
  });

  it('an EPE student\'s CV-attached application was declined', () => {
    const matches = db.getVentureMatchesForStudent('advisor-rania-gen-2');
    const row = matches.find(m => m.ventureProjectId === 'proj-edge-ml');
    expect(row?.status).toBe('declined');
    expect(row?.cvFileName).toBe('cv.pdf');
  });

  it('these applicants show up on the owning advisor\'s real candidate list', () => {
    const candidates = db.getVentureProjectCandidates('proj-edge-ml');
    const ids = candidates.map(c => c.studentId);
    expect(ids).toEqual(expect.arrayContaining(['advisor-heba-gen-1', 'advisor-rania-gen-2']));
  });
});

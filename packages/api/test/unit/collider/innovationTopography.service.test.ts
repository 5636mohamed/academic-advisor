import { describe, it, expect } from 'vitest';
import { buildTopography } from '../../../src/modules/collider/innovationTopography.service';
import { Project } from '@advisor/shared';

function project(overrides: Partial<Project>): Project {
  return {
    id: 'p', title: 'p', description: '', type: 'academic_research', skills: [],
    members: [], stage: 'active', advisorId: 'a', fundingAllocations: [], createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildTopography — §1.6', () => {
  it('ignores idea/archived-stage projects', () => {
    const p1 = project({ stage: 'idea', skills: ['iot'], members: [{ id: 's1', isCollaborator: false, facultyId: 'ENG', departmentId: 'ECE' }] });
    const p2 = project({ id: 'p2', stage: 'archived', skills: ['iot'], members: [{ id: 's1', isCollaborator: false, facultyId: 'ENG', departmentId: 'ECE' }] });
    expect(buildTopography([p1, p2])).toEqual([]);
  });

  it('single-faculty project contributes to projectCount but NOT crossFacultyProjectCount', () => {
    const p = project({
      skills: ['iot'],
      members: [
        { id: 's1', isCollaborator: false, facultyId: 'ENG', departmentId: 'ECE' },
        { id: 's2', isCollaborator: false, facultyId: 'ENG', departmentId: 'ECE' },
      ],
    });
    const cells = buildTopography([p]);
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ facultyId: 'ENG', skill: 'iot', projectCount: 1, crossFacultyProjectCount: 0 });
  });

  it('a genuinely cross-faculty project increments crossFacultyProjectCount for EVERY faculty represented', () => {
    const p = project({
      skills: ['iot'],
      members: [
        { id: 's1', isCollaborator: false, facultyId: 'ENG', departmentId: 'ECE' },
        { id: 'c1', isCollaborator: true, facultyId: 'BUS', departmentId: 'BIS' },
      ],
    });
    const cells = buildTopography([p]);
    const eng = cells.find(c => c.facultyId === 'ENG')!;
    const bus = cells.find(c => c.facultyId === 'BUS')!;
    expect(eng.crossFacultyProjectCount).toBe(1);
    expect(bus.crossFacultyProjectCount).toBe(1);
  });

  it('one project with multiple skills produces one cell per (faculty, skill) pair', () => {
    const p = project({ skills: ['iot', 'lora'], members: [{ id: 's1', isCollaborator: false, facultyId: 'ENG', departmentId: 'ECE' }] });
    const cells = buildTopography([p]);
    expect(cells.map(c => c.skill).sort()).toEqual(['iot', 'lora']);
  });

  it('sorts by projectCount descending', () => {
    const popular = project({ id: 'popular', skills: ['iot'], members: [{ id: 's1', isCollaborator: false, facultyId: 'ENG', departmentId: 'ECE' }] });
    const rare = project({ id: 'rare', skills: ['finance'], members: [{ id: 's2', isCollaborator: false, facultyId: 'ENG', departmentId: 'ECE' }] });
    const another = project({ id: 'another', skills: ['iot'], members: [{ id: 's3', isCollaborator: false, facultyId: 'ENG', departmentId: 'ECE' }] });
    const cells = buildTopography([popular, rare, another]);
    expect(cells[0].skill).toBe('iot');
    expect(cells[0].projectCount).toBe(2);
  });
});

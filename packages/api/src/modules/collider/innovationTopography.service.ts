// AI Features Blueprint §1.6 — Innovation Topography aggregation. Pure
// grouping/counting, no new statistics beyond that.
import { Project, TopographyCell } from '@advisor/shared';

const ACTIVE_STAGES = new Set(['forming_team', 'active', 'matched_externally']);

export function buildTopography(projects: Project[]): TopographyCell[] {
  const cells = new Map<string, TopographyCell>();

  for (const project of projects) {
    if (!ACTIVE_STAGES.has(project.stage)) continue;
    const facultiesRepresented = new Set(project.members.map(m => m.facultyId));
    const isCrossFaculty = facultiesRepresented.size > 1;

    for (const facultyId of facultiesRepresented) {
      for (const skill of project.skills) {
        const key = `${facultyId}::${skill}`;
        const existing = cells.get(key) ?? { facultyId, skill, projectCount: 0, crossFacultyProjectCount: 0 };
        existing.projectCount += 1;
        if (isCrossFaculty) existing.crossFacultyProjectCount += 1;
        cells.set(key, existing);
      }
    }
  }

  return Array.from(cells.values()).sort((a, b) => b.projectCount - a.projectCount);
}

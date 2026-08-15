// Spec §7 — transfer engine types
export type TransferType = 'internal_department' | 'external_faculty';
export type CounterAction = 'retained' | 'reset';

export interface TransferRecommendation {
  type: 'RECOMMEND_INTERNAL_TRANSFER' | 'RECOMMEND_FACULTY_TRANSFER';
  candidates: Array<{ id: string; name: string; total: number; quizScore: number; gwScore: number; alumScore: number }>;
  basis: {
    currentCgpa: number;
    projectedCgpa: number;
    trendSlope: number | null;
  };
}

export interface TransferRecord {
  studentId: string;
  type: TransferType;
  fromDepartmentId?: string;
  toDepartmentId?: string;
  fromFacultyId?: string;
  toFacultyId?: string;
  effectiveSemesterId?: string;
  counterAction: CounterAction;
  recommendationBasis: unknown;
}

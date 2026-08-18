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

// VP epic — a transfer request no longer executes on the student's click.
// It becomes a 3-stage pending chain: student requests (pending_advisor) ->
// advisor approves (pending_vp) or declines (advisor_declined) -> VP
// approves (approved, and the transfer actually executes via the existing
// executeInternalTransferForStudent/executeExternalTransferForStudent) or
// declines (vp_declined).
export type TransferRequestStatus =
  | 'pending_advisor'
  | 'pending_vp'
  | 'advisor_declined'
  | 'vp_declined'
  | 'approved';

export interface TransferRequest {
  id: string;
  studentId: string;
  studentName: string;
  /** The student's advisor at request time — captured once, so a later
   *  roster change (not currently possible, but kept explicit) can never
   *  silently move an in-flight request to a different advisor's queue. */
  advisorId: string;
  type: TransferType;
  toFacultyId?: string;
  toDepartmentId?: string;
  status: TransferRequestStatus;
  createdAt: string;
  advisorDecidedAt?: string;
  vpDecidedAt?: string;
  declineReason?: string;
}

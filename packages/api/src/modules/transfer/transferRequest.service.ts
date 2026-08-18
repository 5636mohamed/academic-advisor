// VP epic — turns a student's transfer click from an instant execution into
// a 3-stage pending chain (student -> advisor -> Vice President). Pure
// state-transition functions, no DB access, same hexagonal style as
// proposal.service.ts — the in-memory store supplies ids/timestamps,
// persists the results, and (only on VP approval) calls the existing,
// unchanged executeInternalTransferForStudent/executeExternalTransferForStudent
// functions to actually commit the transfer.
import { TransferRequest, TransferType } from '@advisor/shared';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export interface CreateTransferRequestInput {
  studentId: string;
  studentName: string;
  advisorId: string;
  type: TransferType;
  toFacultyId?: string;
  toDepartmentId?: string;
}

/** Student clicks "Request transfer" — always starts pending_advisor,
 *  regardless of internal/external, since both now go through the same
 *  advisor-then-VP chain. */
export function createTransferRequest(input: CreateTransferRequestInput): TransferRequest {
  return {
    id: nextId('xfer'),
    studentId: input.studentId,
    studentName: input.studentName,
    advisorId: input.advisorId,
    type: input.type,
    toFacultyId: input.toFacultyId,
    toDepartmentId: input.toDepartmentId,
    status: 'pending_advisor',
    createdAt: new Date().toISOString(),
  };
}

/** Only valid from pending_advisor — the DB layer is expected to check
 *  `request.status === 'pending_advisor'` before calling this (mirrors how
 *  proposal.service.ts's callers already re-check status before mutating),
 *  so this function itself stays a pure, unconditional transition. */
export function advisorApproveRequest(request: TransferRequest): TransferRequest {
  return { ...request, status: 'pending_vp', advisorDecidedAt: new Date().toISOString() };
}

export function advisorDeclineRequest(request: TransferRequest, reason?: string): TransferRequest {
  return { ...request, status: 'advisor_declined', advisorDecidedAt: new Date().toISOString(), declineReason: reason?.trim() || undefined };
}

/** The DB layer only marks `approved` here — it's the one that actually
 *  calls the execute* functions, since only it has access to the student's
 *  live transcript/CGPA state this pure function deliberately never touches. */
export function vpApproveRequest(request: TransferRequest): TransferRequest {
  return { ...request, status: 'approved', vpDecidedAt: new Date().toISOString() };
}

export function vpDeclineRequest(request: TransferRequest, reason?: string): TransferRequest {
  return { ...request, status: 'vp_declined', vpDecidedAt: new Date().toISOString(), declineReason: reason?.trim() || undefined };
}

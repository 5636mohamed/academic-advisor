// Cross-cutting in-app notification system. Every role (student, advisor,
// Vice President) gets notified of decisions/requests that actually
// concern them — not a generic activity feed of everything happening
// system-wide. Same demo-grade rigor as the rest of this app: an
// in-memory list, polled by the client (no websockets/push infra) — real
// events, real timestamps, just not delivered over a live connection.
export type NotificationRole = 'student' | 'advisor' | 'vp';

export type NotificationType =
  | 'proposal_approved'
  | 'proposal_declined'
  | 'venture_match_accepted'
  | 'venture_match_declined'
  | 'venture_new_candidate'
  | 'transfer_submitted'
  | 'transfer_advisor_approved'
  | 'transfer_advisor_declined'
  | 'transfer_vp_approved'
  | 'transfer_vp_declined'
  | 'transfer_awaiting_vp'
  | 'task_rescheduled';

export interface Notification {
  id: string;
  role: NotificationRole;
  /** studentId, advisorId, or the literal 'vp' singleton — matches
   *  whatever id scheme that role already uses everywhere else in this
   *  app, not a new identity system. */
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Client-side route to navigate to when the notification is clicked —
   *  relative to that role's own portal root (e.g. 'workload',
   *  'students/ahmed-1'), resolved by the frontend, not an absolute URL. */
  link?: string;
  createdAt: string;
  read: boolean;
}

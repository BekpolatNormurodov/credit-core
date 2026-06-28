import { CaseStatus, Role, WorkflowDecision } from './enums';

export interface TransitionRule {
  from: CaseStatus;
  to: CaseStatus;
  role: Role;
  decision: WorkflowDecision;
  /** If true, requires at least one DIRECTOR_FINAL document to be attached. */
  requiresFinalDocs?: boolean;
}

/**
 * Single source of truth for allowed workflow transitions.
 * Used by the backend WorkflowService (guard + audit) and by the
 * frontends to decide which action buttons to show.
 */
export const TRANSITIONS: TransitionRule[] = [
  // Operator submits a draft → moderation queue.
  { from: CaseStatus.DRAFT, to: CaseStatus.MODERATION, role: Role.OPERATOR, decision: WorkflowDecision.SUBMIT },

  // Moderator approves → director, or returns → draft.
  { from: CaseStatus.MODERATION, to: CaseStatus.DIRECTOR_REVIEW, role: Role.MODERATOR, decision: WorkflowDecision.APPROVE },
  { from: CaseStatus.MODERATION, to: CaseStatus.DRAFT, role: Role.MODERATOR, decision: WorkflowDecision.RETURN },

  // Director approves (must attach 1–2 final docs) → admin, or returns → moderation.
  { from: CaseStatus.DIRECTOR_REVIEW, to: CaseStatus.ADMIN_FINALIZE, role: Role.DIRECTOR, decision: WorkflowDecision.APPROVE, requiresFinalDocs: true },
  { from: CaseStatus.DIRECTOR_REVIEW, to: CaseStatus.MODERATION, role: Role.DIRECTOR, decision: WorkflowDecision.RETURN },

  // Admin finalizes (KATM price + PDF + Excel) → done, or returns → director.
  { from: CaseStatus.ADMIN_FINALIZE, to: CaseStatus.FINALIZED, role: Role.ADMIN, decision: WorkflowDecision.FINALIZE },
  { from: CaseStatus.ADMIN_FINALIZE, to: CaseStatus.DIRECTOR_REVIEW, role: Role.ADMIN, decision: WorkflowDecision.RETURN },
];

export function findTransition(
  from: CaseStatus,
  role: Role,
  decision: WorkflowDecision,
): TransitionRule | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.role === role && t.decision === decision);
}

/** The status a given role acts on (their inbox). */
export const ROLE_INBOX_STATUS: Record<Role, CaseStatus | null> = {
  [Role.OPERATOR]: CaseStatus.DRAFT,
  [Role.MODERATOR]: CaseStatus.MODERATION,
  [Role.DIRECTOR]: CaseStatus.DIRECTOR_REVIEW,
  [Role.ADMIN]: CaseStatus.ADMIN_FINALIZE,
};

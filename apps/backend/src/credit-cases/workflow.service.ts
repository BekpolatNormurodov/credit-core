import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  CaseStatus,
  DocumentType,
  findTransition,
  Role,
  TransitionRule,
  WorkflowDecision,
} from '@credit-core/shared';

export interface TransitionContext {
  currentStatus: CaseStatus;
  role: Role;
  decision: WorkflowDecision;
  /** Documents currently attached to the case (to validate director final docs). */
  documentTypes: DocumentType[];
}

/**
 * Pure workflow rules — resolves and validates a transition.
 * Kept side-effect free so it can be unit-tested and reused.
 */
@Injectable()
export class WorkflowService {
  resolve(ctx: TransitionContext): TransitionRule {
    const rule = findTransition(ctx.currentStatus, ctx.role, ctx.decision);
    if (!rule) {
      throw new ForbiddenException(
        `"${ctx.currentStatus}" holatida "${ctx.role}" roli "${ctx.decision}" amalini bajara olmaydi`,
      );
    }
    if (rule.requiresFinalDocs && !ctx.documentTypes.includes(DocumentType.DIRECTOR_FINAL)) {
      throw new BadRequestException(
        'Tasdiqlashdan oldin kamida 1 ta yakuniy hujjat (DIRECTOR_FINAL) yuklang',
      );
    }
    return rule;
  }
}

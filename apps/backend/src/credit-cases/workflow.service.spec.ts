import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { CaseStatus, DocumentType, Role, WorkflowDecision } from '@credit-core/shared';
import { WorkflowService } from './workflow.service';

describe('WorkflowService', () => {
  const svc = new WorkflowService();

  it('allows operator to submit a draft', () => {
    const rule = svc.resolve({
      currentStatus: CaseStatus.DRAFT,
      role: Role.OPERATOR,
      decision: WorkflowDecision.SUBMIT,
      documentTypes: [],
    });
    expect(rule.to).toBe(CaseStatus.MODERATION);
  });

  it('allows admin to submit a draft', () => {
    const rule = svc.resolve({
      currentStatus: CaseStatus.DRAFT,
      role: Role.ADMIN,
      decision: WorkflowDecision.SUBMIT,
      documentTypes: [],
    });
    expect(rule.to).toBe(CaseStatus.MODERATION);
  });

  it('rejects a wrong-role transition (403)', () => {
    expect(() =>
      svc.resolve({
        currentStatus: CaseStatus.MODERATION,
        role: Role.OPERATOR,
        decision: WorkflowDecision.APPROVE,
        documentTypes: [],
      }),
    ).toThrow(ForbiddenException);
  });

  it('lets director sign (Imzolash) without any attached final doc — approval is final', () => {
    // Spec B: director approval finalizes the case directly — no admin step.
    // Feature C: no file attach required; the document set is generated on demand.
    const rule = svc.resolve({
      currentStatus: CaseStatus.DIRECTOR_REVIEW,
      role: Role.DIRECTOR,
      decision: WorkflowDecision.APPROVE,
      documentTypes: [],
    });
    expect(rule.to).toBe(CaseStatus.FINALIZED);
  });

  it('lets a moderator cancel a case in moderation', () => {
    const rule = svc.resolve({ currentStatus: CaseStatus.MODERATION, role: Role.MODERATOR, decision: WorkflowDecision.CANCEL, documentTypes: [] });
    expect(rule.to).toBe(CaseStatus.CANCELLED);
  });

  it('lets the director cancel from any active step', () => {
    const rule = svc.resolve({ currentStatus: CaseStatus.ADMIN_FINALIZE, role: Role.DIRECTOR, decision: WorkflowDecision.CANCEL, documentTypes: [] });
    expect(rule.to).toBe(CaseStatus.CANCELLED);
  });

  it('does not let an operator cancel (403)', () => {
    expect(() =>
      svc.resolve({ currentStatus: CaseStatus.MODERATION, role: Role.OPERATOR, decision: WorkflowDecision.CANCEL, documentTypes: [] }),
    ).toThrow(ForbiddenException);
  });

  it('lets the director reopen any active step back to DRAFT for re-entry', () => {
    for (const from of [CaseStatus.MODERATION, CaseStatus.DIRECTOR_REVIEW, CaseStatus.ADMIN_FINALIZE]) {
      const rule = svc.resolve({ currentStatus: from, role: Role.DIRECTOR, decision: WorkflowDecision.REOPEN, documentTypes: [] });
      expect(rule.to).toBe(CaseStatus.DRAFT);
    }
  });

  it('does not let a moderator reopen (403) — they use RETURN', () => {
    expect(() =>
      svc.resolve({ currentStatus: CaseStatus.MODERATION, role: Role.MODERATOR, decision: WorkflowDecision.REOPEN, documentTypes: [] }),
    ).toThrow(ForbiddenException);
  });
});

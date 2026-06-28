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

  it('requires final docs for director approval', () => {
    expect(() =>
      svc.resolve({
        currentStatus: CaseStatus.DIRECTOR_REVIEW,
        role: Role.DIRECTOR,
        decision: WorkflowDecision.APPROVE,
        documentTypes: [DocumentType.NOTARY],
      }),
    ).toThrow(BadRequestException);
  });

  it('lets director approve once a final doc is attached', () => {
    const rule = svc.resolve({
      currentStatus: CaseStatus.DIRECTOR_REVIEW,
      role: Role.DIRECTOR,
      decision: WorkflowDecision.APPROVE,
      documentTypes: [DocumentType.DIRECTOR_FINAL],
    });
    expect(rule.to).toBe(CaseStatus.ADMIN_FINALIZE);
  });

  it('admin finalizes', () => {
    const rule = svc.resolve({
      currentStatus: CaseStatus.ADMIN_FINALIZE,
      role: Role.ADMIN,
      decision: WorkflowDecision.FINALIZE,
      documentTypes: [],
    });
    expect(rule.to).toBe(CaseStatus.FINALIZED);
  });
});

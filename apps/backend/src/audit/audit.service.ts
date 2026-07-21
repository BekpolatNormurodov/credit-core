import { Injectable } from '@nestjs/common';
import { AuditAction, Role } from '@prisma/client';
import { AuditLogDto } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../auth/current-user.decorator';

/** Serialize an audit value to its stored text form (null for empty). */
export const stringifyValue = (v: unknown): string | null =>
  v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v);

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private write(action: AuditAction, user: RequestUser, p: { caseId?: string | null; field?: string; oldValue?: unknown; newValue?: unknown; reason?: string }) {
    return this.prisma.auditLog.create({
      data: {
        action,
        actorId: user.id,
        role: user.role as Role,
        caseId: p.caseId ?? null,
        field: p.field ?? null,
        oldValue: stringifyValue(p.oldValue),
        newValue: stringifyValue(p.newValue),
        reason: p.reason ?? null,
      },
    }).catch(() => undefined); // audit is a side-channel — a failed write must never break the business op
  }

  rateChange(u: RequestUser, caseId: string, oldRate: unknown, newRate: unknown, reason: string) {
    return this.write('RATE_CHANGE', u, { caseId, field: 'interestRate', oldValue: oldRate, newValue: newRate, reason });
  }
  splitChange(u: RequestUser, caseId: string, oldV: unknown, newV: unknown, reason?: string) {
    return this.write('SPLIT_CHANGE', u, { caseId, field: 'amountSplit', oldValue: oldV, newValue: newV, reason });
  }
  katmPrice(u: RequestUser, caseId: string, oldV: unknown, newV: unknown) {
    return this.write('KATM_PRICE', u, { caseId, field: 'katmPrice', oldValue: oldV, newValue: newV });
  }
  configChange(u: RequestUser, oldV: unknown, newV: unknown) {
    return this.write('CONFIG_CHANGE', u, { field: 'appConfig', oldValue: oldV, newValue: newV });
  }
  pause(u: RequestUser, caseId: string) { return this.write('PAUSE', u, { caseId }); }
  resume(u: RequestUser, caseId: string) { return this.write('RESUME', u, { caseId }); }
  caseCreate(u: RequestUser, caseId: string) { return this.write('CASE_CREATE', u, { caseId }); }
  caseUpdate(u: RequestUser, caseId: string) { return this.write('CASE_UPDATE', u, { caseId }); }
  // Log with caseId set while the case still exists; the delete then nulls it via onDelete: SetNull.
  // The case number is kept in newValue so the record stays meaningful after the case is gone.
  caseDelete(u: RequestUser, caseId: string, number?: string, reason?: string) { return this.write('CASE_DELETE', u, { caseId, field: 'status', newValue: number ?? 'deleted', reason }); }
  caseRestore(u: RequestUser, caseId: string, number?: string) { return this.write('CASE_RESTORE', u, { caseId, field: 'status', newValue: number ?? 'restored' }); }
  sectionSave(u: RequestUser, caseId: string, section: string) { return this.write('SECTION_SAVE', u, { caseId, field: section }); }
  transition(u: RequestUser, caseId: string, from: unknown, to: unknown) { return this.write('TRANSITION', u, { caseId, field: 'status', oldValue: from, newValue: to }); }
  /** Director signed the frozen document set with their E-IMZO key. */
  sign(u: RequestUser, caseId: string, manifestSha256: string, keyName: string) { return this.write('SIGN', u, { caseId, field: 'signature', newValue: { manifestSha256, key: keyName } }); }
  /**
   * A signing attempt that E-IMZO refused. Recorded because the refusal happens in the browser and
   * would otherwise leave nothing behind — a director reporting "it will not sign" and a server
   * with no trace of them ever trying.  is E-IMZO's own wording, not a softened version.
   */
  signFailed(u: RequestUser, caseId: string, stage: string, error: string) { return this.write('SIGN_FAILED', u, { caseId, field: stage, reason: error.slice(0, 300) }); }

  async list(q: { caseId?: string; actorId?: string; action?: string }): Promise<AuditLogDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { caseId: q.caseId, actorId: q.actorId, action: q.action as AuditAction | undefined },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id, action: r.action, actorName: r.actor.fullName, role: r.role,
      caseId: r.caseId, field: r.field, oldValue: r.oldValue, newValue: r.newValue, reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

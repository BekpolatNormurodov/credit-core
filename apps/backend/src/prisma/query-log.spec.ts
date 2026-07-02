import { shouldLogQuery } from './query-log.util';

describe('shouldLogQuery', () => {
  it('logs domain models but never the audit tables (recursion guard)', () => {
    expect(shouldLogQuery('CreditCase')).toBe(true);
    expect(shouldLogQuery('QueryLog')).toBe(false);
    expect(shouldLogQuery('RequestLog')).toBe(false);
    expect(shouldLogQuery('AuditLog')).toBe(false);
    expect(shouldLogQuery(null)).toBe(false);
    expect(shouldLogQuery(undefined)).toBe(false);
  });

  it('never logs transaction/session-control statements (the QueryLog insert emits these)', () => {
    expect(shouldLogQuery('BEGIN')).toBe(false);
    expect(shouldLogQuery('START TRANSACTION')).toBe(false);
    expect(shouldLogQuery('COMMIT')).toBe(false);
    expect(shouldLogQuery('ROLLBACK')).toBe(false);
    expect(shouldLogQuery('SET NAMES utf8mb4')).toBe(false);
  });
});

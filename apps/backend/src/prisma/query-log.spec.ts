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
});

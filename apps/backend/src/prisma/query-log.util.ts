// The audit tables themselves are never logged — prevents an infinite loop and noise.
const EXCLUDE = /querylog|requestlog|auditlog/i;
// A Prisma create emits BEGIN -> INSERT -> SELECT -> COMMIT. Logging a BEGIN/COMMIT would
// itself be a create emitting its own BEGIN/COMMIT -> logged again -> exponential recursion
// (the CPU/DB runaway). So never log transaction/session-control statements — only real DML.
const CONTROL = /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET|DEALLOCATE|PREPARE|EXECUTE)\b/i;

/** Whether a SQL statement (or model name) should be recorded in QueryLog. */
export const shouldLogQuery = (sql?: string | null): boolean =>
  !!sql && !EXCLUDE.test(sql) && !CONTROL.test(sql);

// Off by default: logging every query into the same DB doubles write load, so it's an
// opt-in debugging aid (QUERY_LOG=on), never an always-on feature.
export const queryLogEnabled = (): boolean => (process.env.QUERY_LOG ?? 'off') === 'on';

/** Leading SQL keyword (SELECT/INSERT/UPDATE/DELETE/…) used as the logged action. */
export const sqlVerb = (sql: string): string => sql.trim().split(/\s+/)[0]?.toUpperCase() || 'QUERY';

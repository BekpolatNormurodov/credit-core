// The audit tables themselves are never logged — prevents an infinite loop and noise.
const EXCLUDE = /querylog|requestlog|auditlog/i;

/** Whether a SQL statement (or model name) should be recorded in QueryLog. */
export const shouldLogQuery = (sql?: string | null): boolean => !!sql && !EXCLUDE.test(sql);

export const queryLogEnabled = (): boolean => (process.env.QUERY_LOG ?? 'on') !== 'off';

/** Leading SQL keyword (SELECT/INSERT/UPDATE/DELETE/…) used as the logged action. */
export const sqlVerb = (sql: string): string => sql.trim().split(/\s+/)[0]?.toUpperCase() || 'QUERY';

import { requestLogEntry } from './logging.interceptor';

describe('requestLogEntry', () => {
  it('builds a row from request/response parts', () => {
    const e = requestLogEntry('POST', '/api/cases', 'u1', 201, 42, '127.0.0.1');
    expect(e).toEqual({ method: 'POST', path: '/api/cases', userId: 'u1', statusCode: 201, durationMs: 42, ip: '127.0.0.1' });
  });
  it('allows null user/ip', () => {
    expect(requestLogEntry('GET', '/api/health', null, 200, 3, null).userId).toBeNull();
  });
});

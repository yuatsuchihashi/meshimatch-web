import { afterEach, expect, it, vi } from 'vitest';
import { scheduleGuard } from './schedule-api';
afterEach(() => vi.unstubAllEnvs());

it('allows the public localhost origin even when Next uses an internal hostname', () => {
  vi.stubEnv('MESHIMATCH_LOCAL_MODE', '1');
  const request = new Request('http://localhost:4317/api/schedules', { method: 'POST', headers: { host: '127.0.0.1:4317', origin: 'http://127.0.0.1:4317' } });
  expect(scheduleGuard(request)).toBeUndefined();
});
it('rejects cross-origin, malformed-origin and oversized writes', () => {
  vi.stubEnv('MESHIMATCH_LOCAL_MODE', '1');
  for (const origin of ['https://example.com', 'null']) {
    expect(scheduleGuard(new Request('http://localhost/api/schedules', { method: 'POST', headers: { origin } }))?.status).toBe(403);
  }
  expect(scheduleGuard(new Request('http://localhost/api/schedules', { method: 'POST', headers: { 'content-length': '30001' } }))?.status).toBe(413);
});
it('leaves the local prototype unavailable outside local mode', () => {
  vi.stubEnv('MESHIMATCH_LOCAL_MODE', '0'); vi.stubEnv('NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE', '0');
  expect(scheduleGuard()?.status).toBe(404);
});

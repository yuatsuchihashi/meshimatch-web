import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleError } from './schedule';

const { store } = vi.hoisted(() => ({ store: { create: vi.fn(), get: vi.fn(), update: vi.fn() } }));
vi.mock('@/lib/area-poll-store', () => ({ areaPollStore: store }));

import { POST } from '@/app/api/area-polls/route';
import { GET, PATCH } from '@/app/api/area-polls/[id]/route';

const context = () => ({ params: Promise.resolve({ id: 'example-poll' }) });
const endpoint = 'http://127.0.0.1:4317/api/area-polls';
function mutation(method: 'POST' | 'PATCH', data: unknown, origin = 'http://127.0.0.1:4317') {
  return new Request(endpoint, { method, headers: { host: '127.0.0.1:4317', origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

beforeEach(() => {
  vi.stubEnv('MESHIMATCH_LOCAL_MODE', '1');
  vi.stubEnv('NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE', '1');
  vi.resetAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe('area poll HTTP boundaries', () => {
  it('creates a poll through the store and returns its one-time host key', async () => {
    const result = { poll: { id: 'example-poll' }, hostToken: 'one-time-host-key' };
    store.create.mockReturnValue(result);
    const response = await POST(mutation('POST', { expectedCount: 3 }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(result);
    expect(store.create).toHaveBeenCalledWith({ expectedCount: 3 });
  });

  it('reads the public poll without caching editable responses', async () => {
    const poll = { id: 'example-poll', responses: [] };
    store.get.mockReturnValue(poll);
    const response = await GET(new Request(`${endpoint}/example-poll`), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ poll });
    expect(store.get).toHaveBeenCalledWith('example-poll');
  });

  it('passes updates to the correct poll and preserves authorization failures', async () => {
    store.update.mockImplementation(() => { throw new ScheduleError('編集権限がありません。', 403); });
    const response = await PATCH(mutation('PATCH', { action: 'confirm', token: 'wrong' }), context());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: '編集権限がありません。' });
    expect(store.update).toHaveBeenCalledWith('example-poll', { action: 'confirm', token: 'wrong' });
  });

  it('blocks every endpoint outside local mode before accessing storage', async () => {
    vi.stubEnv('MESHIMATCH_LOCAL_MODE', '0');
    vi.stubEnv('NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE', '0');
    expect((await POST(mutation('POST', {}))).status).toBe(404);
    expect((await GET(new Request(endpoint), context())).status).toBe(404);
    expect((await PATCH(mutation('PATCH', {}), context())).status).toBe(404);
    expect(store.create).not.toHaveBeenCalled();
    expect(store.get).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
  });

  it('rejects writes from another origin without invoking the store', async () => {
    expect((await POST(mutation('POST', {}, 'https://example.com'))).status).toBe(403);
    expect((await PATCH(mutation('PATCH', {}, 'https://example.com'), context())).status).toBe(403);
    expect(store.create).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
  });

  it('reports malformed request JSON as an input error', async () => {
    const response = await POST(new Request(endpoint, { method: 'POST', body: '{' }));
    expect(response.status).toBe(400);
    expect(store.create).not.toHaveBeenCalled();
  });
});

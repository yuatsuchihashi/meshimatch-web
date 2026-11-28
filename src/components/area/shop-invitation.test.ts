import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDiscoveryConfig } from '@/lib/instant/discovery-session';
import { shopCredentialsKey } from '@/components/shop/shop-client';
import { createShopInvitation, readShopDraft } from './shop-invitation';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}
describe('creating the shared shop invitation', () => {
  beforeEach(() => {
    const location = { href: 'http://localhost/instant?day=known&place=known&shop=adjust' };
    vi.stubGlobal('window', { location, history: { replaceState: (_data: unknown, _title: string, url: URL) => { location.href = url.href; } } });
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('reuses the host and the poll after a dropped create response', async () => {
    const attempts: { id: string; hostToken: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, request: RequestInit) => {
      const body = JSON.parse(String(request.body));
      attempts.push(body);
      expect(JSON.parse(localStorage.getItem(shopCredentialsKey(body.id))!)).toMatchObject({ hostToken: body.hostToken });
      if (attempts.length === 1) throw new TypeError('lost response');
      return Response.json({ poll: { id: body.id } });
    }));
    await expect(createShopInvitation(defaultDiscoveryConfig)).rejects.toThrow('lost response');
    const id = new URL(window.location.href).searchParams.get('shopDraft');
    expect(readShopDraft(id)?.config).toEqual(defaultDiscoveryConfig);
    expect(window.location.href).not.toContain(attempts[0].hostToken);
    await expect(createShopInvitation(defaultDiscoveryConfig)).resolves.toBe(id);
    expect(attempts[0]).toEqual(attempts[1]);
    expect(readShopDraft(id)).toBeNull();
  });

  it('requires a saved organizer credential before making a date-only invitation', async () => {
    const fetch = vi.fn(async () => Response.json({ poll: { id: 'date' } }));
    vi.stubGlobal('fetch', fetch);
    await expect(createShopInvitation(defaultDiscoveryConfig, 'date')).rejects.toThrow('日程のアンケートを作成したブラウザ');
    expect(fetch).not.toHaveBeenCalled();
    localStorage.setItem('meshimatch_schedule_v1_date', JSON.stringify({ hostToken: 'organizer' }));
    await expect(createShopInvitation(defaultDiscoveryConfig, 'date')).resolves.toBe('date');
    expect(fetch).toHaveBeenCalledWith('/api/shop-polls', expect.objectContaining({
      body: JSON.stringify({ scheduleId: 'date', hostToken: 'organizer', config: defaultDiscoveryConfig }),
    }));
  });
});

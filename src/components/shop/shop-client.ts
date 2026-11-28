import type { ShopPoll } from '@/lib/shop-poll';
import type { DiscoveryAnswer } from '@/lib/instant/discovery';
import { areaCredentialsKey } from '@/components/area/area-client';

export class PollRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type ShopRequest = {
  action: 'mine' | 'respond' | 'confirm' | 'reopen'; contextKey: string; token: string;
  responseId?: string; name?: string; answer?: DiscoveryAnswer; shopId?: string; shortlistVersion?: string;
};

export async function requestShopPoll(id: string, body?: ShopRequest): Promise<{ poll: ShopPoll; answer?: DiscoveryAnswer | null }> {
  const response = await fetch('/api/shop-polls/' + encodeURIComponent(id), body
    ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' }
    : { cache: 'no-store' });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new PollRequestError(response.status, details.error || '読み込みに失敗しました。もう一度お試しください。');
  }
  return response.json();
}

export type VoterKey = { id: string; token: string };
export type DeviceKeys = { hostToken?: string; responses: VoterKey[] };
export const shopCredentialsKey = (id: string) => 'meshimatch_shop_v1_' + id;

function readKeys(storageKey: string): DeviceKeys {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
    return {
      hostToken: typeof stored.hostToken === 'string' ? stored.hostToken : undefined,
      responses: Array.isArray(stored.responses) ? stored.responses.filter((item: VoterKey | null) =>
        item && typeof item.id === 'string' && typeof item.token === 'string' && item.token) : [],
    };
  } catch { return { responses: [] }; }
}

export function getDeviceKeys(poll: ShopPoll): DeviceKeys {
  if (poll.source === 'standalone') return readKeys(shopCredentialsKey(poll.id));
  if (poll.source === 'area') return readKeys(areaCredentialsKey(poll.areaPollId ?? poll.id));
  return poll.scheduleId ? readKeys('meshimatch_schedule_v1_' + poll.scheduleId) : { responses: [] };
}

export function saveStandaloneHost(id: string, hostToken: string) {
  const key = shopCredentialsKey(id);
  localStorage.setItem(key, JSON.stringify({ ...readKeys(key), hostToken }));
}

// Save the reply credential before sending. A lost HTTP response can then be retried as the same person.
export function standaloneVoter(id: string): VoterKey {
  const key = shopCredentialsKey(id);
  const saved = readKeys(key);
  if (saved.responses[0]) return saved.responses[0];
  const person = { id: crypto.randomUUID(), token: crypto.randomUUID() };
  try { localStorage.setItem(key, JSON.stringify({ ...saved, responses: [person] })); }
  catch { throw new Error('回答を保存するには、このブラウザでサイトデータの保存を許可してください。'); }
  return person;
}

export function errorText(error: unknown) {
  return error instanceof Error && !(error instanceof TypeError) ? error.message : '通信できませんでした。もう一度お試しください。';
}

import { saveStandaloneHost } from '@/components/shop/shop-client';
import { areas, modes, type DiscoveryConfig } from '@/lib/instant/discovery';

const draftKey = (id: string) => 'meshimatch_shop_create_v1_' + id;
type ShopDraft = { id: string; hostToken: string; config: DiscoveryConfig };

export function readShopDraft(id: string | null): ShopDraft | null {
  if (!id) return null;
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey(id)) || 'null');
    const config = draft?.config;
    return draft?.id === id && typeof draft.hostToken === 'string' && config &&
      Object.hasOwn(areas, config.areaId) && modes.includes(config.mode) &&
      [500, 1000, 2000].includes(config.radius) && Number.isInteger(config.partySize) &&
      config.partySize >= 2 && config.partySize <= 8 ? draft : null;
  } catch { return null; }
}

function standaloneRequest(config: DiscoveryConfig) {
  const url = new URL(window.location.href);
  const previous = readShopDraft(url.searchParams.get('shopDraft'));
  const current = previous?.config;
  const draft = previous && current && current.areaId === config.areaId && current.radius === config.radius &&
    current.partySize === config.partySize && current.mode === config.mode
    ? previous : { id: crypto.randomUUID(), hostToken: crypto.randomUUID(), config };
  try {
    sessionStorage.setItem(draftKey(draft.id), JSON.stringify(draft));
    saveStandaloneHost(draft.id, draft.hostToken);
  } catch {
    throw new Error('幹事の編集情報を保存できませんでした。ブラウザのサイトデータ設定を確認してください。');
  }
  url.searchParams.set('shopDraft', draft.id);
  window.history.replaceState(null, '', url);
  return draft;
}

export async function createShopInvitation(config: DiscoveryConfig, scheduleId?: string): Promise<string> {
  let payload;
  if (scheduleId) {
    const credential = JSON.parse(localStorage.getItem('meshimatch_schedule_v1_' + scheduleId) ?? '{}');
    if (!credential?.hostToken) throw new Error('日程のアンケートを作成したブラウザで、お店の設定を開いてください。');
    payload = { scheduleId, hostToken: credential.hostToken, config };
  } else {
    payload = standaloneRequest(config);
  }
  const response = await fetch('/api/shop-polls', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'アンケートを作成できませんでした。もう一度お試しください。');
  if (!scheduleId) {
    try { sessionStorage.removeItem(draftKey(data.poll.id)); } catch { /* The host key is already saved. */ }
  }
  return data.poll.id;
}

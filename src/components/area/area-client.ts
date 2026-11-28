import type { AccessTrip } from '@/lib/area-access';
import type { AreaPoll } from '@/lib/area-poll';

export type AreaCredential = { id: string; token: string; name: string; trip?: AccessTrip };
export type AreaCredentials = { hostToken?: string; responses: AreaCredential[] };
export const areaCredentialsKey = (id: string) => `meshimatch_area_poll_v1_${id}`;
export async function areaRequest(url: string, body?: unknown): Promise<{ poll: AreaPoll; hostToken?: string }> {
  const response = await fetch(url, body ? {
    method: url === '/api/area-polls' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '保存できませんでした。もう一度試してください。');
  return data;
}
export const areaErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'もう一度試してください。';

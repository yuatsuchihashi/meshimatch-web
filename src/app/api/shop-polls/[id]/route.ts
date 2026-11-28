import { NextResponse } from 'next/server';
import { scheduleGuard, scheduleRouteError } from '@/lib/schedule-api';
import { shopPollStore } from '@/lib/shop-poll-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const options = { headers: { 'Cache-Control': 'private, no-store' } };

export async function GET(_request: Request, { params }: Context) {
  const blocked = scheduleGuard();
  if (blocked) return blocked;
  try {
    return NextResponse.json({ poll: shopPollStore.get((await params).id) }, options);
  } catch (error) { return scheduleRouteError(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  const blocked = scheduleGuard(request);
  if (blocked) return blocked;
  try {
    return NextResponse.json(shopPollStore.update((await params).id, await request.json()), options);
  } catch (error) { return scheduleRouteError(error); }
}

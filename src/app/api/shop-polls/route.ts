import { NextResponse } from 'next/server';
import { scheduleGuard, scheduleRouteError } from '@/lib/schedule-api';
import { shopPollStore } from '@/lib/shop-poll-store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const blocked = scheduleGuard(request);
  if (blocked) return blocked;
  try {
    return NextResponse.json(shopPollStore.create(await request.json()), {
      status: 201, headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) { return scheduleRouteError(error); }
}

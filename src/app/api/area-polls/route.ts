import { NextResponse } from 'next/server';
import { areaPollStore } from '@/lib/area-poll-store';
import { scheduleGuard, scheduleRouteError } from '@/lib/schedule-api';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const blocked = scheduleGuard(request);
  if (blocked) return blocked;
  try {
    return NextResponse.json(areaPollStore.create(await request.json()), { status: 201 });
  } catch (error) {
    return scheduleRouteError(error);
  }
}

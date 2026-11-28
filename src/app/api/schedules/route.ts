import { NextResponse } from 'next/server';
import { scheduleStore } from '@/lib/schedule-store';
import { scheduleGuard, scheduleRouteError } from '@/lib/schedule-api';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const blocked = scheduleGuard(request);
  if (blocked) return blocked;
  try { return NextResponse.json(scheduleStore.create(await request.json()), { status: 201 }); }
  catch (error) { return scheduleRouteError(error); }
}

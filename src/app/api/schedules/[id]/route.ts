import { NextResponse } from 'next/server';
import { scheduleStore } from '@/lib/schedule-store';
import { scheduleGuard, scheduleRouteError } from '@/lib/schedule-api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const blocked = scheduleGuard();
  if (blocked) return blocked;
  try { return NextResponse.json({ poll: scheduleStore.get((await context.params).id) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return scheduleRouteError(error); }
}
export async function PATCH(request: Request, context: Context) {
  const blocked = scheduleGuard(request);
  if (blocked) return blocked;
  try { return NextResponse.json({ poll: scheduleStore.update((await context.params).id, await request.json()) }); }
  catch (error) { return scheduleRouteError(error); }
}

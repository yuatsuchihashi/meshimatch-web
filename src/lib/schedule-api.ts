import { NextResponse } from 'next/server';
import { isLocalMode } from './local-mode';
import { ScheduleError } from './schedule';

export function scheduleRouteError(error: unknown) {
  if (error instanceof ScheduleError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ error: '入力内容を読み取れませんでした。' }, { status: 400 });
  console.error('Schedule request failed', error instanceof Error ? error.message : 'unknown');
  return NextResponse.json({ error: '保存できませんでした。もう一度試してください。' }, { status: 500 });
}
export function scheduleGuard(request?: Request) {
  if (!isLocalMode()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (request) {
    const origin = request.headers.get('origin');
    // Next's internal request URL may use a different hostname from the public
    // localhost URL. Compare against the incoming Host, not the internal URL.
    const host = request.headers.get('host') ?? new URL(request.url).host;
    if (origin) {
      try {
        if (new URL(origin).host !== host || new URL(origin).protocol !== new URL(request.url).protocol) {
          return NextResponse.json({ error: '送信元を確認してください。' }, { status: 403 });
        }
      } catch { return NextResponse.json({ error: '送信元を確認してください。' }, { status: 403 }); }
    }
    if (Number(request.headers.get('content-length') ?? 0) > 30_000) return NextResponse.json({ error: '入力が長すぎます。' }, { status: 413 });
  }
}

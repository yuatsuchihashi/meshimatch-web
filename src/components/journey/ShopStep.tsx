'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Coffee, Utensils } from 'lucide-react';
import type { ShopPoll } from '@/lib/shop-poll';
import { getDeviceKeys } from '@/components/shop/shop-client';
import styles from './ShopStep.module.css';

type StepState = { poll: ShopPoll; ownIds: string[]; host: boolean };

function isScheduleHost(id: string) {
  try {
    return Boolean(JSON.parse(localStorage.getItem('meshimatch_schedule_v1_' + id) || '{}')?.hostToken);
  } catch { return false; }
}

type PendingState = { message: string; setupHref?: string };
export function ShopStep({ id, person, setupScheduleId }: { id: string; person?: string; setupScheduleId?: string }) {
  const [state, setState] = useState<StepState | null>(null);
  const [pending, setPending] = useState<PendingState | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let version = 0;
    async function refresh() {
      const request = ++version;
      try {
        const response = await fetch(`/api/shop-polls/${id}`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (controller.signal.aborted || request !== version) return;
          setState(null);
          if (setupScheduleId && response.status === 409) {
            const setupHref = isScheduleHost(setupScheduleId) ? '/instant?schedule=' + setupScheduleId : undefined;
            setPending({ setupHref, message: setupHref ? '幹事がお店を探すエリアと用途を設定できます。' : '幹事がエリアと用途を設定すると、ここからお店の希望を回答できます。' });
          } else setPending({ message: data.error || 'お店のアンケートを読み込めませんでした。' });
          return;
        }
        const { poll }: { poll: ShopPoll } = await response.json();
        if (!controller.signal.aborted && request === version) {
          const keys = getDeviceKeys(poll);
          setPending(null);
          setState({ poll, ownIds: keys.responses.map(key => key.id), host: Boolean(keys.hostToken) });
        }
      } catch {
        if (!controller.signal.aborted && request === version) {
          setPending({ message: '通信を確認しています。画面に戻ると自動で再読み込みします。' });
        }
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 12000);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [id, setupScheduleId]);
  const href = `/shop/${id}`;
  if (pending) return <section className={styles.step}><div className={styles.text}><div><h2>お店のアンケート</h2><p>{pending.message}</p></div></div>
    {pending.setupHref && <Link className={styles.button} href={pending.setupHref}>お店のアンケートを準備する<ArrowRight size={17}/></Link>}
  </section>;
  if (!state) return <p className={styles.observer} role="status">お店のアンケートを読み込み中…</p>;
  const { poll, host, ownIds } = state;
  const mine = poll.participants.filter(item => ownIds.includes(item.id) && (!person || item.id === person));
  const answered = poll.participants.filter(item => item.answered).length;
  const remaining = poll.config.partySize - answered;
  const unanswered = mine.filter(item => !item.answered);
  const decision = poll.candidates.find(item => item.shopId === poll.selectedShopId);
  const canAnswer = !decision && unanswered.length > 0;
  const target = canAnswer && unanswered.length === 1 ? href + '?person=' + encodeURIComponent(unanswered[0].id) : href;
  let title = 'お店選びの回答状況';
  let action = 'お店選びを見る';
  let detail = `参加する${poll.config.partySize}人のうち、${answered}人が回答済みです。`;
  if (poll.pendingArea) {
    if (!mine.length) return null;
    const topic = poll.config.mode === '食事' ? 'レストラン' : 'カフェ';
    title = canAnswer ? '続いて、' + topic + 'の希望を教えてください' : topic + 'の希望は回答済みです';
    action = canAnswer ? topic + 'の希望に回答する' : '回答状況を見る';
    detail = canAnswer ? '場所の回答は保存しました。' : '集合エリアが決まると、参加者の希望から候補を選びます。';
  } else if (decision) {
    title = decision.shop.name.replace('（サンプル）', '');
    action = '決まったお店を見る';
    detail = 'このお店に決まりました。';
  } else if (canAnswer) {
    title = poll.config.mode === '食事' ? 'どんなレストランがいい？' : 'どんなカフェがいい？';
    detail = `参加する${poll.config.partySize}人でお店を選びます。`;
    action = 'お店の希望を答える';
  } else if (!remaining) {
    title = poll.candidates.length ? 'お店の候補がそろいました' : '条件に合うお店がありません';
    action = poll.candidates.length ? (host ? '候補からお店を決める' : 'お店の候補を見る') : '条件と結果を見る';
    detail = poll.candidates.length ? `全員の希望をもとに${poll.candidates.length}店に絞りました。` : (mine.length ? '自分の回答を確認できます。' : '参加者がそれぞれの回答を確認できます。');
  } else if (mine.length) {
    title = 'お店の希望は回答済みです';
  } else if (!host) {
    return <p className={styles.observer}>お店は当日の参加者で選んでいます。<Link href={href}>お店選びの状況を見る</Link></p>;
  }
  return <section className={styles.step}><div className={styles.text}>
    {poll.config.mode === '食事' ? <Utensils size={20} aria-hidden/> : <Coffee size={20} aria-hidden/>}
    <div><h2>{title}</h2><p>{detail}</p></div></div>
    <Link className={styles.button} href={target}>{action}<ArrowRight size={17}/></Link>
  </section>;
}

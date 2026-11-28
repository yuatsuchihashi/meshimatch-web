'use client';

import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { suggestionLink } from '@/lib/area-access';
import type { ShopPoll } from '@/lib/shop-poll';
import { errorText, requestShopPoll } from './shop-client';
import { ShopCard } from './ShopCard';
import css from './shop.module.css';

export function ShopResults({ poll, hostToken, onUpdate, refresh }: {
  poll: ShopPoll; hostToken?: string; onUpdate: (poll: ShopPoll) => void; refresh: () => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = poll.candidates.find(candidate => candidate.shopId === poll.selectedShopId);
  async function decide(action: 'confirm' | 'reopen', shopId?: string) {
    if (!hostToken || busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await requestShopPoll(poll.id, { action, shopId, token: hostToken, contextKey: poll.contextKey, shortlistVersion: poll.shortlistVersion });
      onUpdate(data.poll);
      setConfirming(null);
    } catch (reason) { setError(errorText(reason)); refresh(); }
    finally { setBusy(false); }
  }
  const confirmation = (label: string, action: 'confirm' | 'reopen', shopId?: string) => <div className={css.confirm}>
    <p>{label}</p><button className={css.primary} type="button" disabled={busy} onClick={() => void decide(action, shopId)}>
      {busy ? '保存中…' : action === 'confirm' ? '決定して共有する' : 'お店選びを再開する'}
    </button>
    <button type="button" className={css.textButton} onClick={() => setConfirming(null)} disabled={busy}>キャンセル</button>
  </div>;
  return <section className={css.results}>
    {error && <p role="alert" className={css.error}>{error}</p>}
    {selected ? <>
      <h2><Check size={21}/> 集合するお店</h2>
      <ShopCard candidate={selected} config={poll.config}/>
      {hostToken && (confirming === 'reopen' ? confirmation('お店の決定を取り消し、もう一度候補を選べるようにしますか？', 'reopen')
        : <button type="button" className={css.textButton} onClick={() => setConfirming('reopen')}><RotateCcw size={15}/> お店を選び直す</button>)}
    </> : <>
      <h2>みんなのお店候補</h2>
      {poll.candidates.length > 0 ? <>
        <p className={css.sub}>{hostToken ? '写真とメニューを見比べて、集まるお店を選んでください。' : '幹事がお店を決めると、ここに表示されます。'}</p>
        <div className={css.cards}>{poll.candidates.map(candidate => <ShopCard key={candidate.shopId} candidate={candidate} config={poll.config}>
          {hostToken && (confirming === candidate.shopId ? confirmation(`${candidate.shop.name}に決めますか？`, 'confirm', candidate.shopId)
            : <button type="button" className={css.select} disabled={busy} onClick={() => setConfirming(candidate.shopId)}>このお店にする</button>)}
        </ShopCard>)}</div>
      </> : <div className={css.panel}><h3>今の条件に合うお店がありません</h3>
        <p>このエリアのサンプル店舗では、全員の必須条件に合う候補が見つかりませんでした。</p>
        <p>入力を確かめたい方は、自分の回答を見直せます。</p>
      </div>}
    </>}
    {poll.candidates.length > 0 && <p className={css.note}>この試作のお店・メニュー・口コミはサンプルです。写真はイメージです。</p>}
    {!!poll.suggestions.length && <details className={css.suggestions}><summary>参加者が紹介したお店（{poll.suggestions.length}件）</summary>
      <p className={css.note}>リンク先のメニューや予算はお店のページで確認できます。</p>
      <ul>{poll.suggestions.map((item, i) => {
        const link = suggestionLink(item.text);
        return <li key={i}>{link ? <a href={link} target="_blank" rel="noopener noreferrer">{item.text}</a> : item.text}</li>;
      })}</ul>
    </details>}
  </section>;
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Copy, MapPin, UserRound, UsersRound } from 'lucide-react';
import { areas } from '@/lib/instant/discovery';
import { meetingCities } from '@/lib/meeting-areas';
import { dateLabel, periodLabel, timezoneLabel } from '@/lib/schedule';
import type { ShopPoll } from '@/lib/shop-poll';
import { errorText, getDeviceKeys, PollRequestError, requestShopPoll, type DeviceKeys } from './shop-client';
import { ShopAnswerForm } from './ShopAnswerForm';
import { ShopResults } from './ShopResults';
import css from './shop.module.css';

function ShopGathering({ poll, device, requestedPerson, onUpdate, refresh }: {
  poll: ShopPoll; device: DeviceKeys; requestedPerson?: string; onUpdate: (poll: ShopPoll) => void; refresh: () => void;
}) {
  const [editor, setEditor] = useState<string | null | undefined>(undefined);
  const [received, setReceived] = useState('');
  const [share, setShare] = useState<'hidden' | 'copied' | 'manual'>('hidden');
  const localVoters = poll.participants.filter(person => device.responses.some(key => key.id === person.id));
  const loneVoter = device.responses.length === 1 && localVoters.length === 1 ? localVoters[0] : null;
  const requested = localVoters.find(voter => voter.id === requestedPerson);
  const preferredVoters = requested ? [requested, ...localVoters.filter(voter => voter.id !== requested.id)] : localVoters;
  const selected = Boolean(poll.selectedShopId);
  const expected = poll.config.partySize;
  const answered = poll.participants.filter(item => item.answered).length;
  const pending = poll.pendingArea;
  const pendingDate = Boolean(pending && poll.scheduleId && !poll.dateOption);
  const decisions = pendingDate ? '日程と集合エリア' : '集合エリア';
  const complete = !pending && answered >= expected;
  const shopType = poll.config.mode === '食事' ? 'レストラン' : 'カフェ';
  const canJoin = poll.source === 'standalone' && !localVoters.length && !selected && poll.participants.length < expected;
  const autoOpenRegistered = loneVoter && !loneVoter.answered &&
    (requested ? requested.id === loneVoter.id : !requestedPerson && !device.hostToken);
  const openId = editor === undefined ? (autoOpenRegistered ? loneVoter.id : canJoin && !device.hostToken ? 'join' : null) : editor;
  const joining = openId === 'join' && canJoin;
  const person = poll.participants.find(item => item.id === openId);
  const key = device.responses.find(item => item.id === openId);
  const displayName = (person: ShopPoll['participants'][number]) => {
    const sameName = poll.participants.filter(item => item.name === person.name);
    return sameName.length < 2 ? person.name : person.name + '（' + (sameName.findIndex(item => item.id === person.id) + 1) + '人目）';
  };
  const roomPath = '/shop/' + encodeURIComponent(poll.id);
  const upstreamPath = poll.scheduleId ? '/schedule/' + encodeURIComponent(poll.scheduleId)
    : poll.areaPollId ? '/area/' + encodeURIComponent(poll.areaPollId) : undefined;
  const invitePath = !selected && upstreamPath && (pending || !poll.source) ? upstreamPath : roomPath;
  const link = new URL(invitePath, window.location.origin).href;
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const inviteField = useRef<HTMLInputElement>(null);
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setShare('copied'); }
    catch { setShare('manual'); inviteField.current?.select(); }
  }
  function openPerson(id: string) {
    setReceived('');
    setEditor(id);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const editing = !selected && Boolean(joining || (person && key));
  const hostInvite = !editing && answered < expected && !selected && Boolean(device.hostToken);
  const managePath = pendingDate ? '/schedule/' + poll.scheduleId : '/area/' + poll.areaPollId;
  const ownActions = !selected && (canJoin ? <section className={css.voters}><button type="button" className={css.primary} onClick={() => openPerson('join')}>
        <UserRound size={16}/>自分の希望を回答する<ArrowRight size={16}/>
      </button></section> : localVoters.length ? <section className={css.voters}>
        {(device.responses.length > 1 || localVoters.length > 1) && <h2>どなたが回答しますか？</h2>}
        {preferredVoters.map(person => <button type="button" className={person.answered ? css.personal : css.primary} key={person.id}
          onClick={() => openPerson(person.id)}>
          <UserRound size={16}/>{device.responses.length > 1 ? displayName(person) + 'さんの' : ''}{person.answered ? '回答を見直す' : 'お店の希望を回答する'}<ArrowRight size={16}/>
        </button>)}
      </section> : null);
  return <>
    <header className={css.header}>
      {poll.title && <p className={css.event}>{poll.title}</p>}
      <h1>{selected ? 'お店が決まりました' : poll.config.mode === '食事' ? 'みんなでレストラン選び' : 'みんなでカフェ選び'}</h1>
      <div className={css.metadata}>
        {poll.dateOption && <span title={timezoneLabel(poll.timezone)}><CalendarDays size={16}/>{dateLabel(poll.dateOption.date)} {periodLabel(poll.dateOption)}</span>}
        <span><MapPin size={16}/>{pending ? meetingCities[pending.cityId].label + ' · 集合エリア調整中' : areas[poll.config.areaId]?.label}</span><span><UsersRound size={16}/>{expected}人</span>
      </div>
    </header>
    {hostInvite && <section className={`${css.panel} ${css.invite}`}>
      <h2>{pending ? '集まりの招待リンク' : poll.source === 'standalone' ? 'みんなを招待しよう' : 'お店のアンケートを共有'}</h2>
      <p>{pending ? '同じリンクで、' + (poll.scheduleId ? '日程・場所・' : '場所と') + shopType + 'の希望をまとめて回答できます。' : 'このリンクを送ると、それぞれが自分のタイミングで回答できます。'}</p>
      <div className={css.inviteRow}>
        <input ref={inviteField} aria-label="招待リンク" value={link} readOnly onFocus={event => event.target.select()}/>
        <button type="button" onClick={() => void copyLink()}><span aria-live="polite">{share === 'copied' ? 'コピーしました' : 'リンクをコピー'}</span></button>
      </div>
      {share === 'manual' && <p role="status" className={css.note}>リンクを選択してコピーしてください。</p>}
      {loopback && <p className={css.note}>ローカル版のリンクはこのPCで開けます。</p>}
    </section>}
    {!selected && (joining || (person && key)) ? <ShopAnswerForm key={openId} poll={poll} voter={key} name={person && displayName(person)} onBack={() => setEditor(null)}
      refresh={refresh} onSaved={updated => {
        onUpdate(updated); setEditor(null); setReceived(pending ? (poll.scheduleId ? '日程・場所・' : '場所と') + shopType + 'の回答が完了しました。' : 'お店の希望を送信しました。');
        window.scrollTo({ top: 0, behavior: 'instant' });
      }}/> : <>
      {received && <p role="status" className={css.receipt}><Check size={16}/>{received}</p>}
      {!complete && ownActions}
      {!selected && !complete && <section className={css.panel}>
        <h2>{pending ? decisions + 'を調整中です' : 'お店の希望を集めています'}</h2><p className={css.count}>{answered} / {expected}人が{pending ? shopType + 'の希望を' : ''}回答</p>
        <progress value={answered} max={expected} aria-label="お店の希望の回答状況"/>
        <p>{pending ? decisions + 'が決まり、当日参加する人の希望がそろうと、ここに候補が表示されます。' : 'あと' + (expected - answered) + '人が回答すると、お店の候補が出ます。'}</p>
        {pending && device.hostToken && <Link className={css.manage} href={managePath + '?view=results'}>{pendingDate ? '日程' : '集合エリア'}の調整へ<ArrowRight size={16}/></Link>}
        {poll.participants.length > 0 && <details className={css.roster}><summary>回答状況を見る</summary><ul>{poll.participants.map(person =>
          <li key={person.id}><span>{displayName(person)}</span><span>{person.answered ? '回答済み' : '未回答'}</span></li>)}</ul></details>}
      </section>}
      {(complete || selected) && <ShopResults key={poll.shortlistVersion} poll={poll} hostToken={device.hostToken} onUpdate={onUpdate} refresh={refresh}/>}
      {complete && ownActions}
      {!complete && !selected && !canJoin && !localVoters.length && <p className={css.notice}>{pending && upstreamPath
        ? <Link href={upstreamPath}>{device.responses.length ? '自分の参加状況と場所の回答を確認する' : '招待リンクから回答を始める'}</Link>
        : poll.source === 'area'
        ? '場所のアンケートに回答したブラウザで、自分のお店の希望を回答できます。'
        : device.responses.length ? '確定した日程に「参加できる」と回答した方がお店の希望を回答できます。'
          : '日程に回答したブラウザで開くと、自分のお店の希望を回答できます。'}</p>}
      {!hostInvite && <div className={css.sharing}>
        <button type="button" className={css.textButton} onClick={() => void copyLink()}><Copy size={15}/>{selected ? '決まったお店のリンクをコピー' : 'この集まりのリンクをコピー'}</button>
        {share === 'copied' && <span role="status">コピーしました</span>}
        {share === 'manual' && <input aria-label="共有リンク" readOnly value={link} onFocus={event => event.target.select()}/>}
        {loopback && <p className={css.note}>ローカル版のリンクはこのPCで開けます。</p>}
      </div>}
    </>}
  </>;
}

export function ShopPollFlow({ id, requestedPerson }: { id: string; requestedPerson?: string }) {
  const [poll, setPoll] = useState<ShopPoll | null>(null);
  const [device, setDevice] = useState<DeviceKeys>({ responses: [] });
  const [error, setError] = useState('');
  const [contextNotice, setContextNotice] = useState('');
  const revision = useRef(0);
  const lastContext = useRef('');
  const apply = useCallback((next: ShopPoll) => {
    if (lastContext.current && lastContext.current !== next.contextKey) setContextNotice('日程・場所・参加者が変わりました。新しい集まりの内容を確認してください。');
    lastContext.current = next.contextKey;
    setDevice(getDeviceKeys(next)); setPoll(next); setError('');
  }, []);
  const onUpdate = useCallback((next: ShopPoll) => { revision.current++; apply(next); }, [apply]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const current = ++revision.current;
    try {
      const data = await requestShopPoll(id);
      if (!signal?.aborted && current === revision.current) apply(data.poll);
    } catch (reason) {
      if (signal?.aborted || current !== revision.current) return;
      if (reason instanceof PollRequestError && [403, 404, 409].includes(reason.status)) setPoll(null);
      setError(errorText(reason));
    }
  }, [id, apply]);
  useEffect(() => {
    const lifecycle = new AbortController();
    const update = () => { if (document.visibilityState === 'visible') void refresh(lifecycle.signal); };
    const initial = window.setTimeout(() => void refresh(lifecycle.signal), 0);
    const interval = window.setInterval(update, 15000);
    window.addEventListener('focus', update);
    window.addEventListener('storage', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      lifecycle.abort();
      window.clearTimeout(initial); window.clearInterval(interval);
      window.removeEventListener('focus', update); window.removeEventListener('storage', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);
  const back = poll?.scheduleId ? { path: '/schedule/' + poll.scheduleId + '?view=results', label: '日程の結果へ' }
    : poll?.areaPollId ? { path: '/area/' + poll.areaPollId + '?view=results', label: '場所の結果へ' }
    : { path: '/home', label: 'ホームへ' };
  return <main className={css.screen}><div className={css.shell}>
    <nav className={css.nav}><Link href={back.path}><ArrowLeft size={16}/>{back.label}</Link><Link href="/home" aria-label="meshimatch ホームへ">meshimatch</Link></nav>
    {contextNotice && <p role="status" className={css.notice}>{contextNotice}</p>}
    {error && <div role="alert" className={css.error}>{error} <button type="button" onClick={() => void refresh()}>もう一度読み込む</button></div>}
    {poll ? <ShopGathering key={poll.contextKey} poll={poll} device={device} requestedPerson={requestedPerson} refresh={refresh} onUpdate={onUpdate}/>
      : !error && <p role="status">集まりを読み込んでいます…</p>}
  </div></main>;
}

'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Eye, ShieldCheck } from 'lucide-react';
import { PillButton } from '@/components/v2';
import { RestaurantSurvey } from './RestaurantSurvey';
import { CafeSurvey } from './CafeSurvey';
import { SurveyChoices as CafeChoices } from './SurveyChoices';
import {
  areas, modes, needLabels,
  noiseLabels, styleLabels, distanceMeters, freshAnswer, needFor,
  rankShops, formatDiscoveryPrice, resolveDiscoveryAgreement, restaurantGenreLabels,
  freshCafePreferences, cafeOrdersFor, scoreCafeOrder, cafeReasonLabels, restaurantReasonLabels, refineDiscoveryAnswers,
  discoveryShops, type CafeFeedback, type DiscoveryAnswer, type DiscoveryCandidate, type DiscoveryConfig,
} from '@/lib/instant/discovery';
import {
  DISCOVERY_SESSION_KEY, defaultDiscoveryConfig, newDiscoverySession, parseDiscoverySession,
  discoverySessionShortlist, usesCafeSurvey, usesAdaptiveSurvey, type DiscoverySession,
} from '@/lib/instant/discovery-session';
import styles from '@/app/instant/instant.module.css';
import extra from './DiscoveryFlow.module.css';
import type { SchedulePoll } from '@/lib/schedule';
import type { AreaPoll } from '@/lib/area-poll';
import { meetingAreas } from '@/lib/meeting-areas';
import { shouldFindShop } from '@/lib/shop-plan';
import { AreaSetup } from '@/components/area/AreaSetup';
import { readShopDraft } from '@/components/area/shop-invitation';

type Screen = 'start' | 'round' | 'top3' | 'ticket';

// Keep legacy sessions on their existing route. New local sessions use the menu-aware flow.
export function InstantDiscoveryBoundary({ screen, children }: { screen: Screen; children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState<DiscoverySession | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [hasNativeSession, setHasNativeSession] = useState(false);
  const local = process.env.NEXT_PUBLIC_MESHIMATCH_LOCAL_MODE === '1';
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DISCOVERY_SESSION_KEY);
      setHasNativeSession(Boolean(raw));
      setSession(parseDiscoverySession(raw));
    }
    catch { setStorageError(true); }
    setLoaded(true);
  }, []);
  if (!local) return children;
  if (!loaded) return <main className={styles.screen}><p className={styles.desc}>読み込み中…</p></main>;
  if (screen !== 'start' && !session && !storageError) {
    if (!hasNativeSession) return children;
    return <main className={styles.screen}><section className={`${styles.shell} ${styles.panel} ${styles.stack}`}>
      <h1 className={styles.title}>新しいアンケートを試す</h1>
      <p className={styles.desc}>試作を更新しました。最初から回答して試せます。</p>
      <a className={styles.anchorPill} href="/instant?mode=cafe">カフェのアンケートへ</a>
    </section></main>;
  }
  return <DiscoveryFlow screen={screen} initialSession={session} initialError={storageError} />;
}

function Choices({ title, options, selected, onChange }: {
  title: string; options: Record<string, string>; selected: string | string[];
  onChange: (value: string) => void;
}) {
  return <fieldset className={extra.fieldset}><legend>{title}</legend><div className={styles.choiceChipGrid}>
    {Object.entries(options).map(([value, label]) => {
      const active = Array.isArray(selected) ? selected.includes(value) : selected === value;
      return <button key={value} type="button" aria-pressed={active}
        className={`${styles.answerChip} ${extra.choice} ${active ? styles.answerChipSelected : ''}`}
        onClick={() => onChange(value)}>{label}</button>;
    })}
  </div></fieldset>;
}

function DiscoveryFlow({ screen, initialSession, initialError }: {
  screen: Screen; initialSession: DiscoverySession | null; initialError: boolean;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession ?? newDiscoverySession(defaultDiscoveryConfig));
  const [config, setConfig] = useState<DiscoveryConfig>(() => ({
    ...session.config,
    mode: modes.includes(session.config.mode) ? session.config.mode : defaultDiscoveryConfig.mode,
  }));
  const [draft, setDraft] = useState<DiscoveryAnswer>(freshAnswer);
  const [revealed, setRevealed] = useState(() => screen === 'round' && initialSession?.answers.length === 0 && new URLSearchParams(window.location.search).get('first') === '1');
  const [voteRevealed, setVoteRevealed] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [reactions, setReactions] = useState<CafeFeedback[]>([]);
  const [error, setError] = useState(initialError ? 'このブラウザで一時保存を利用できません。保存を許可して再読み込みしてください。' : '');
  const [scheduledPoll, setScheduledPoll] = useState<SchedulePoll | null>(null);
  const [areaPoll, setAreaPoll] = useState<AreaPoll | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [contextError, setContextError] = useState('');
  const candidates = useMemo(() => rankShops(session.config, session.answers), [session.config, session.answers]);
  const cafeFlow = usesCafeSurvey(session);
  const adaptiveFlow = usesAdaptiveSurvey(session);
  const batch = discoverySessionShortlist(session, candidates);
  const hasMoreCandidates = adaptiveFlow
    ? candidates.some(candidate => !(session.seenIds ?? []).includes(candidate.shop.id) && !batch.some(item => item.shop.id === candidate.shop.id))
    : session.offset + 3 < candidates.length;
  const needsInformation = adaptiveFlow && batch.some(candidate => {
    const statuses = (session.feedback ?? []).map(ballot => ballot.find(item => item.shopId === candidate.shop.id)?.status);
    return statuses.length === session.config.partySize && statuses.every(status => status === 'yes' || status === 'more') && statuses.includes('more');
  });
  const currentIndex = session.answers.length;
  const voterIndex = session.votes.length;
  const winner = candidates.find(candidate => candidate.shop.id === session.winnerId);

  useEffect(() => {
    if (screen !== 'start') return;
    const controller = new AbortController();
    async function loadContext() {
      try {
        const params = new URLSearchParams(window.location.search);
        const load = async (url: string) => {
          const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? '設定を読み込めませんでした。');
          return data;
        };
        const areaId = params.get('area');
        const agreedArea: AreaPoll | null = areaId ? (await load(`/api/area-polls/${encodeURIComponent(areaId)}`)).poll : null;
        if (agreedArea && !agreedArea.selectedAreaId) throw new Error('エリアはまだ決まっていません。エリア調整の画面で確認してください。');
        const queryScheduleId = params.get('schedule')?.trim() || null;
        const scheduleId = agreedArea?.scheduleId || queryScheduleId;
        if (agreedArea?.scheduleId && queryScheduleId && agreedArea.scheduleId !== queryScheduleId) throw new Error('日程とエリア調整の組み合わせが一致しません。');
        const scheduled: SchedulePoll | null = scheduleId ? (await load(`/api/schedules/${encodeURIComponent(scheduleId)}`)).poll : null;
        if (!agreedArea && scheduled?.areaPollId) {
          router.replace(`/area/${scheduled.areaPollId}`);
          return;
        }
        if (scheduled && !scheduled.selectedOptionId && (agreedArea || scheduled.placePlan !== 'adjust')) throw new Error('日程はまだ決まっていません。先に日程を確認してください。');
        if (agreedArea && scheduled && (agreedArea.scheduleId !== scheduled.id || (agreedArea.scheduleOptionId !== null && agreedArea.scheduleOptionId !== scheduled.selectedOptionId) || (!agreedArea.attendanceBased && agreedArea.expectedCount !== scheduled.expectedCount))) {
          throw new Error('日程が変更されています。新しくエリア調整を始めてください。');
        }
        if (agreedArea?.selectedAreaId && shouldFindShop(scheduled, agreedArea) &&
            (agreedArea.shopPlan === 'adjust' || scheduled?.shopPlan === 'adjust')) {
          router.replace('/shop/' + encodeURIComponent(agreedArea.id));
          return;
        }
        if (!agreedArea && scheduled?.selectedOptionId && scheduled.placePlan === 'known' && scheduled.shopPlan === 'adjust') {
          const configured = await fetch('/api/shop-polls/' + encodeURIComponent(scheduled.id), { signal: controller.signal, cache: 'no-store' });
          if (configured.ok) {
            router.replace('/shop/' + encodeURIComponent(scheduled.id));
            return;
          }
          if (configured.status !== 409 && configured.status !== 404) throw new Error('お店の設定を読み込めませんでした。');
        }
        const selected = agreedArea ? meetingAreas.find(area => area.id === agreedArea.selectedAreaId) : null;
        if (agreedArea && (!selected || !areas[selected.discoveryAreaId])) throw new Error('このエリアのお店をまだ表示できません。');
        if (controller.signal.aborted) return;
        setScheduledPoll(scheduled); setAreaPoll(agreedArea);
        if (selected && agreedArea) setConfig(current => ({ ...current, areaId: selected.discoveryAreaId, partySize: agreedArea.expectedCount, mode: agreedArea.mode }));
        else if (scheduled) {
          const optionId = scheduled.selectedOptionId;
          const partySize = optionId ? scheduled.responses.filter(person => person.answers[optionId] === 'yes').length : scheduled.expectedCount;
          setConfig(current => ({ ...current, partySize }));
        } else if (!agreedArea) {
          const draft = readShopDraft(params.get('shopDraft'));
          if (draft) setConfig(draft.config);
        }
      } catch (error) {
        if (!controller.signal.aborted) setContextError(error instanceof Error ? error.message : '設定を読み込めませんでした。');
      } finally {
        if (!controller.signal.aborted) setContextReady(true);
      }
    }
    void loadContext();
    return () => controller.abort();
  }, [screen, router]);

  useEffect(() => {
    if (screen === 'start' && new URLSearchParams(window.location.search).get('mode') === 'cafe') {
      setConfig(current => ({ ...current, mode: 'カフェ・軽食' }));
    }
    if (screen === 'start' && new URLSearchParams(window.location.search).get('mode') === 'restaurant') {
      setConfig(current => ({ ...current, mode: '食事' }));
    }
    if (screen === 'round' && session.answers.length === session.config.partySize) router.replace('/instant/top3');
    if ((screen === 'top3' || screen === 'ticket') && session.answers.length < session.config.partySize) router.replace('/instant/round');
    if (screen === 'ticket' && session.answers.length === session.config.partySize && !session.winnerId) router.replace('/instant/top3');
  }, [router, screen, session.answers.length, session.config.partySize, session.winnerId]);

  function commit(next: DiscoverySession, route?: string) {
    try {
      sessionStorage.setItem(DISCOVERY_SESSION_KEY, JSON.stringify(next));
      setSession(next);
      setError('');
      if (route) router.push(route);
      return true;
    } catch {
      setError('回答を一時保存できませんでした。ブラウザの保存設定を確認してから、もう一度押してください。');
      return false;
    }
  }
  function saveAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentIndex >= session.config.partySize) return;
    if (session.config.mode === 'どちらでも' && !draft.need) return;
    const need = needFor(session.config, draft);
    const answer = ['cafe', 'drink'].includes(need) ? { ...draft, cafe: draft.cafe ?? freshCafePreferences() } : draft;
    const answers = [...session.answers, answer];
    if (commit({ ...session, answers }, answers.length === session.config.partySize ? '/instant/top3' : undefined)) {
      setDraft(freshAnswer()); setRevealed(false);
    }
  }
  function openVote() {
    setReactions((session.feedback?.[voterIndex] ?? []).filter(item => batch.some(candidate => candidate.shop.id === item.shopId)));
    setPicks([]);
    setVoteRevealed(true);
  }
  function updateReaction(shopId: string, status: CafeFeedback['status'], reason?: string) {
    setReactions(current => [...current.filter(item => item.shopId !== shopId), { shopId, status, reason }]);
  }
  function submitVote() {
    if (session.votes.length >= session.config.partySize) return;
    if (adaptiveFlow && !batch.every(candidate => reactions.some(item => item.shopId === candidate.shop.id))) return;
    const ballot = adaptiveFlow ? reactions.filter(item => item.status === 'yes').map(item => item.shopId) : picks;
    const votes = [...session.votes, ballot];
    const feedback = [...(session.feedback ?? [])];
    if (adaptiveFlow) feedback[voterIndex] = reactions;
    const complete = votes.length === session.config.partySize;
    const winnerId = resolveDiscoveryAgreement(batch.map(candidate => candidate.shop.id), votes, session.config.partySize);
    if (commit({ ...session, votes, feedback, winnerId, ballotPhase: complete ? 'result' : 'handoff' })) {
      setPicks([]); setReactions([]); setVoteRevealed(false);
    }
  }
  function redraw() {
    const seenIds = [...new Set([...(session.seenIds ?? []), ...batch.map(candidate => candidate.shop.id)])];
    const answers = adaptiveFlow ? refineDiscoveryAnswers(session.answers, session.feedback ?? []) : session.answers;
    commit({ ...session, answers, seenIds, offset: session.offset + 3, votes: [], feedback: [], winnerId: null, ballotPhase: 'shortlist' });
    setPicks([]); setReactions([]); setVoteRevealed(false);
  }
  function card(candidate: DiscoveryCandidate, voting = false) {
    const shop = candidate.shop;
    const menuList = voting ? candidate.choices[voterIndex] : shop.menus;
    const reaction = reactions.find(item => item.shopId === shop.id);
    const showOrderExamples = cafeFlow && (!voting || session.answers[voterIndex].cafe !== undefined);
    const orders = showOrderExamples ? (voting ? candidate.orders?.[voterIndex] ?? [] : cafeOrdersFor(
      { ...session.config, mode: 'カフェ・軽食' }, shop, { ...freshAnswer(), cafe: freshCafePreferences() })) : [];
    const sortedOrders = [...orders].sort((a, b) => {
      if (voting) {
        const answer = session.answers[voterIndex];
        const difference = (scoreCafeOrder(session.config, shop, b, answer) ?? 0) - (scoreCafeOrder(session.config, shop, a, answer) ?? 0);
        if (difference) return difference;
      }
      return a.total - b.total;
    });
    const examples = [
      sortedOrders.find(order => order.menus.length === 1),
      sortedOrders.find(order => order.menus.some(menu => menu.kind === 'drink') && order.menus.some(menu => menu.kind === 'dessert')),
      sortedOrders.find(order => order.menus.some(menu => menu.kind === 'drink') && order.menus.some(menu => menu.kind === 'food')),
    ].filter((order): order is NonNullable<typeof order> => order !== undefined);
    return <article key={shop.id} className={extra.card}>
      <h2>{shop.name}</h2>
      <p className={extra.note}>{restaurantGenreLabels(shop).join('・')}{shop.acceptsDrinkOnly ? ' カフェ' : ''}</p>
      <p className={extra.note}>約{Math.round(distanceMeters(shop.coordinates, areas[session.config.areaId].center))}m（直線） · ★{shop.rating}（{shop.reviewCount}件）<br />
        {cafeFlow && <>{(shop.atmosphereTags ?? [shop.style]).map(tag => styleLabels[tag]).join('・')} · </>}{noiseLabels[shop.noise]}</p>
      {session.answers.some(answer => answer.restaurant) && <p className={extra.note}>
        入店待ちの目安（仮）：{shop.estimatedWaitMinutes == null ? '未確認' : `約${shop.estimatedWaitMinutes}分`}
      </p>}
      {showOrderExamples && <section className={extra.orderExamples}>
        <strong>{voting ? 'あなたの予算・条件で選べる注文例' : '合計金額の例'}</strong>
        <ul className={extra.menu}>{examples.map(order => <li key={order.label}>{order.label}<br /><b>{formatDiscoveryPrice(session.config, order.total)}</b></li>)}</ul>
        {shop.drinkRequired && <p className={extra.note}>飲み物の注文が必要なお店です。</p>}
      </section>}
      <details className={extra.details} open={voting && reaction?.status === 'more' ? true : undefined}>
        <summary>{voting ? 'あなたの条件で注文できるものを確認' : 'メニューをもっと見る'}</summary>
        <ul className={extra.menu}>{menuList.map(menu => <li key={menu.id}>{menu.name} · {formatDiscoveryPrice(session.config, menu.price)}</li>)}</ul>
        {cafeFlow && <p className={extra.note}>店舗の写真は未登録です。この試作では雰囲気・メニュー・合計金額を確認できます。</p>}
      </details>
      {voting && (adaptiveFlow ? <div className={extra.reaction}>
        <CafeChoices title="このお店、どう？" options={{ yes: '行ってもいい', more: 'もう少し知りたい', no: '今回は難しい' }}
          selected={reaction?.status ?? ''} onChange={value => updateReaction(shop.id, value as CafeFeedback['status'])} />
        {reaction?.status === 'no' && <CafeChoices title="気になる理由（任意）" options={session.answers[voterIndex].restaurant ? restaurantReasonLabels : cafeReasonLabels}
          selected={reaction.reason ?? ''} onChange={reason => updateReaction(shop.id, 'no', reaction.reason === reason ? undefined : reason)} />}
      </div> : <button type="button" aria-pressed={picks.includes(shop.id)}
        className={`${styles.answerChip} ${picks.includes(shop.id) ? styles.answerChipSelected : ''}`}
        onClick={() => setPicks(current => current.includes(shop.id) ? current.filter(id => id !== shop.id) : [...current, shop.id])}>
        {picks.includes(shop.id) ? '✓ 行ってもいい' : '○ 行ってもいい'}
      </button>)}
    </article>;
  }

  let title = '';
  let kicker = '';
  let content: ReactNode;
  if (screen === 'start') {
    const shopKnown = !shouldFindShop(scheduledPoll, areaPoll);
    title = areaPoll?.selectedAreaId || scheduledPoll?.placePlan === 'known'
      ? (shopKnown ? '集まりの設定' : 'お店選びの設定')
      : scheduledPoll ? '集合エリアの設定' : '集まりの予定、どこまで決まってる？';
    kicker = '幹事の設定';
    content = contextError ? <section className={`${styles.panel} ${styles.stack}`}><p className={extra.error} role="alert">{contextError}</p>
      <PillButton variant="ghost" onClick={() => window.location.assign('/instant')}>設定をやり直す</PillButton></section>
      : <AreaSetup config={config} onChange={setConfig} onLegacyStart={() => commit(newDiscoverySession(config), '/instant/round?first=1')}
        scheduledPoll={scheduledPoll} areaPoll={areaPoll} loadingContext={!contextReady} />;
  } else if (screen === 'round') {
    kicker = `${Math.min(currentIndex + 1, session.config.partySize)} / ${session.config.partySize}人目 · ${areas[session.config.areaId].label}`;
    title = revealed ? (session.config.mode === 'カフェ・軽食' ? '今日のカフェ、どうしよう？' : '今日の好みを教えて') : '次の人に渡してください';
    if (!revealed) content = <section className={`${styles.panel} ${styles.stack}`}>
      <div className={styles.privateCover}><ShieldCheck size={32} /><h2>{currentIndex + 1}人目の方へ</h2><p className={styles.desc}>回答はほかの人に見せずに進めます。</p></div>
      <PillButton variant="cta" icon={<Eye size={18} />} onClick={() => setRevealed(true)}>回答を開く</PillButton>
    </section>;
    else {
      const need = needFor(session.config, draft);
      if (['cafe', 'drink'].includes(need)) {
        content = <CafeSurvey key={currentIndex} draft={draft} config={session.config}
          lastPerson={currentIndex + 1 === session.config.partySize} onChange={setDraft} onSubmit={saveAnswer} />;
      } else if (need === 'main' || need === 'any') {
        content = <RestaurantSurvey key={currentIndex} draft={draft} config={session.config}
          lastPerson={currentIndex + 1 === session.config.partySize} onChange={setDraft} onSubmit={saveAnswer} />;
      } else {
        content = <section className={`${styles.panel} ${styles.stack}`}>
          <Choices title="どのくらい食べたい？" options={needLabels} selected={draft.need}
            onChange={need => setDraft({ ...draft, need })} />
        </section>;
      }
      if (session.config.mode === 'どちらでも' && need) {
        content = <>{content}<PillButton variant="ghost" onClick={() => setDraft({ ...draft, need: '', cafe: undefined, restaurant: undefined })}>食事・お茶を選び直す</PillButton></>;
      }
    }
  } else if (screen === 'ticket') {
    title = 'ここに決まり！'; kicker = '全員が行ってもいい店';
    content = <div className={styles.stack}>{winner && card(winner)}<PillButton variant="ghost" onClick={() => router.push('/instant')}>もう一度試す</PillButton></div>;
  } else if (!batch.length) {
    title = '全員の条件に合う店がありません'; kicker = '今回の結果';
    content = <section className={`${styles.panel} ${styles.stack}`}><p>このエリアの仮DBの範囲で判定しました。検索範囲や各自の条件を見直せます。</p><PillButton variant="cta" onClick={() => router.push('/instant')}>条件を設定し直す</PillButton></section>;
  } else if (session.ballotPhase === 'result') {
    title = winner ? '全員の○が重なりました' : needsInformation ? 'もう少し確認したい候補があります' : '全員の○が重なる店がありません'; kicker = '投票結果';
    content = <section className={styles.stack}>
      {winner ? <>{card(winner)}<PillButton variant="cta" onClick={() => router.push('/instant/ticket')}>このお店に決定</PillButton></> : <>
        <p className={extra.note}>{needsInformation ? '追加情報を確認してから、もう一度判断できます。' : hasMoreCandidates ? 'まだ投票していない候補があります。' : '範囲内の候補はすべて確認済みです。'}</p>
        {needsInformation && <PillButton variant="cta" onClick={() => commit({ ...session, votes: [], winnerId: null, ballotPhase: 'handoff' })}>情報を確認して投票し直す</PillButton>}
        {hasMoreCandidates && <PillButton variant="cta" onClick={redraw}>別の候補を見る</PillButton>}
        <PillButton variant="ghost" onClick={() => router.push('/instant')}>条件を設定し直す</PillButton>
      </>}
    </section>;
  } else if (session.ballotPhase === 'handoff') {
    kicker = `${voterIndex + 1} / ${session.config.partySize}人目 · 非公開投票`;
    title = voteRevealed ? '行ってもいい店は？' : `${voterIndex + 1}人目の方へ`;
    content = voteRevealed ? <section className={styles.stack}>
      <p className={extra.note}>{adaptiveFlow ? 'それぞれのお店に、今の気持ちで答えてください。' : 'いくつでも選べます。'}</p>{batch.map(candidate => card(candidate, true))}
      <PillButton variant="cta" onClick={submitVote} disabled={adaptiveFlow && !batch.every(candidate => reactions.some(item => item.shopId === candidate.shop.id))}>{adaptiveFlow ? '回答を隠して次へ' : picks.length ? '選択を確定して隠す' : 'どの店も難しい'}</PillButton>
    </section> : <section className={`${styles.panel} ${styles.stack}`}>
      <div className={styles.privateCover}><ShieldCheck size={32} /><p className={styles.desc}>自分の投票画面を開いてください。</p></div>
      <PillButton variant="cta" icon={<Eye size={18} />} onClick={openVote}>投票を開く</PillButton>
    </section>;
  } else {
    title = 'みんなの候補'; kicker = '全員が注文できる料理のあるお店';
    content = <section className={styles.stack}><p className={extra.note}>希望をもとに並べた最大3店です。全員の「行ってもいい」が重なる店を探します。</p>
      {batch.map(candidate => card(candidate))}<PillButton variant="cta" onClick={() => commit({ ...session, votes: [], winnerId: null, ballotPhase: 'handoff' })}>非公開で投票する</PillButton>
    </section>;
  }
  return <main className={styles.screen}><div className={`${styles.shell} ${extra.shell}`}>
    {screen === 'start' && <Link className={extra.homeLink} href="/home"><ArrowLeft size={16} aria-hidden />ホームへ</Link>}
    <header className={styles.header}><span className={styles.eyebrow}>{kicker}</span><h1 className={styles.title}>{title}</h1></header>
    {screen === 'round' && currentIndex === 0 && <Link className={extra.sharedSurveyLink}
      href="/instant?day=known&place=known&shop=adjust">リンクでみんなに回答してもらう<ArrowRight size={16} aria-hidden /></Link>}
    {error && <p className={extra.error} role="alert">{error}</p>}{content}
    <p className={extra.note}>{screen === 'start' ? '試作版 · お店と所要時間はサンプルです。' : `${discoveryShops.length}店舗の架空DBによる実験版。所在地・価格・評価・食事制限への対応は仮の設定です。`}</p>
  </div></main>;
}

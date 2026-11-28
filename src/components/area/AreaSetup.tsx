'use client';

import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Check, MapPin, Utensils } from 'lucide-react';
import { PillButton } from '@/components/v2';
import { areas, modes, nearbyShops, type DiscoveryConfig } from '@/lib/instant/discovery';
import { meetingAreas, meetingCities, type MeetingCityId } from '@/lib/meeting-areas';
import { dateLabel, periodLabel, timezoneLabel, type PlacePlan, type ShopPlan, type SchedulePoll } from '@/lib/schedule';
import { createShopInvitation } from './shop-invitation';
import type { AreaPoll } from '@/lib/area-poll';
import { areaCredentialsKey, areaErrorMessage, areaRequest } from './area-client';
import base from '@/app/instant/instant.module.css';
import shared from '@/components/instant/DiscoveryFlow.module.css';
import styles from './AreaSetup.module.css';

function planChoice(value: string | null): PlacePlan | null {
  return value === 'known' || value === 'adjust' ? value : null;
}

export function AreaSetup({ config, onChange, onLegacyStart, scheduledPoll, areaPoll, loadingContext }: {
  config: DiscoveryConfig; onChange: (config: DiscoveryConfig) => void; onLegacyStart: () => void;
  scheduledPoll: SchedulePoll | null; areaPoll: AreaPoll | null; loadingContext: boolean;
}) {
  const router = useRouter();
  const query = useSearchParams();
  const [chosenCity, setChosenCity] = useState<MeetingCityId | null>(null);
  const [busy, setBusy] = useState(false);
  const creatingShop = useRef(false);
  const [error, setError] = useState('');
  const areaMode = areaPoll?.selectedAreaId ? 'known' : scheduledPoll?.placePlan ?? planChoice(query.get('place'));
  const dayMode = scheduledPoll || areaPoll ? 'known' : planChoice(query.get('day'));
  const recordedPlan = scheduledPoll?.shopPlan ?? areaPoll?.shopPlan;
  const legacyShop = Boolean((scheduledPoll || areaPoll) && !recordedPlan);
  const shopMode: ShopPlan | null = scheduledPoll || areaPoll
    ? recordedPlan ?? 'adjust'
    : query.get('shop') === 'skip' ? 'skip' : planChoice(query.get('shop'));
  const complete = !loadingContext && dayMode && areaMode && shopMode;
  const steps = [
    ...(dayMode === 'adjust' ? ['日程調整'] : []),
    ...(areaMode === 'adjust' ? ['エリア調整'] : []),
    ...(shopMode === 'adjust' ? ['お店選び'] : []),
  ];
  const cityId = chosenCity ?? meetingAreas.find(area => area.discoveryAreaId === config.areaId)?.cityId ?? 'tokyo';
  const scheduled = scheduledPoll?.options.find(option => option.id === scheduledPoll.selectedOptionId);
  const shops = nearbyShops(config);

  function choose(key: 'day' | 'place' | 'shop', value: ShopPlan) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState(null, '', url);
  }

  function startDateSetup(place: PlacePlan, shop: ShopPlan) {
    const previousPage = new URL(window.location.href);
    const draftId = previousPage.searchParams.get('draft') || crypto.randomUUID();
    previousPage.searchParams.set('draft', draftId);
    previousPage.searchParams.set('day', 'adjust');
    previousPage.searchParams.set('place', place);
    previousPage.searchParams.set('shop', shop);
    window.history.replaceState(null, '', previousPage);
    router.push(`/schedule?place=${place}&shop=${shop}&draft=${encodeURIComponent(draftId)}`);
  }

  async function startSharedShop() {
    if (creatingShop.current) return;
    creatingShop.current = true;
    setBusy(true); setError('');
    try {
      const id = await createShopInvitation(config, scheduledPoll?.id);
      router.replace('/shop/' + encodeURIComponent(id));
    } catch (error) {
      setError(error instanceof TypeError ? '通信できませんでした。もう一度お試しください。' : areaErrorMessage(error));
      creatingShop.current = false; setBusy(false);
    }
  }

  async function createPoll() {
    setBusy(true); setError('');
    try {
      localStorage.setItem('meshimatch_area_storage_check', '1'); localStorage.removeItem('meshimatch_area_storage_check');
      const scheduleHostToken = scheduledPoll?.placePlan === 'adjust'
        ? JSON.parse(localStorage.getItem(`meshimatch_schedule_v1_${scheduledPoll.id}`) ?? '{}').hostToken : undefined;
      const data = await areaRequest('/api/area-polls', { cityId, shopPlan: shopMode, attendanceBased: scheduledPoll?.placePlan === 'adjust', method: cityId === 'tokyo' ? 'access-demo' : undefined, expectedCount: config.partySize, mode: config.mode, scheduleHostToken, scheduleId: scheduledPoll?.id ?? null });
      const key = areaCredentialsKey(data.poll.id);
      const previous = JSON.parse(localStorage.getItem(key) ?? '{"responses":[]}');
      localStorage.setItem(key, JSON.stringify({ ...previous, hostToken: data.hostToken }));
      router.push(scheduledPoll?.placePlan === 'adjust' ? `/share/schedule/${scheduledPoll.id}` : `/share/area/${data.poll.id}`);
    } catch (error) { setError(areaErrorMessage(error)); setBusy(false); }
  }

  const combinedSurvey = areaMode === 'adjust' && shopMode === 'adjust' && !legacyShop;
  const shopLabel = config.mode === '食事' ? 'レストラン' : 'カフェ';
  const areaHint = combinedSurvey
    ? `参加者はひとつのリンクから、${scheduledPoll?.placePlan === 'adjust' ? '日程、' : ''}場所、${shopLabel}の希望の順に回答できます。`
    : scheduledPoll?.placePlan === 'adjust' ? '日程と場所を1本のリンクで共有できます。' : '参加者にはリンクから回答してもらえます。';
  const areaSetupNeeded = complete && dayMode === 'known' && (areaMode === 'adjust' || shopMode === 'adjust');
  return <div className={base.stack}>
    {scheduled && scheduledPoll && <div className={shared.scheduleLink}><CalendarDays size={20} /><div>
      <strong>{dateLabel(scheduled.date)} · {periodLabel(scheduled)}</strong><small>{timezoneLabel(scheduledPoll.timezone)} · <Link href={`/schedule/${scheduledPoll.id}`}>日程調整を見る</Link></small>
    </div></div>}
    {scheduledPoll && !scheduled && <div className={styles.setupSummary}>
      <span><Check size={17} />日程の候補を準備済み · {scheduledPoll.options.length}枠</span>
      <Link href={`/schedule/${scheduledPoll.id}`}>日程だけ先に共有</Link>
    </div>}
    {!loadingContext && !areaPoll && <div className={styles.statusGrid}>
      {!scheduledPoll && <StatusChoice title="日程" icon={<CalendarDays size={19} />} value={dayMode} change={value => choose('day', value)} />}
      {!scheduledPoll?.placePlan && <StatusChoice title="集合エリア" icon={<MapPin size={19} />} value={areaMode} change={value => choose('place', value)} />}
      {!scheduledPoll && <StatusChoice withSkip title="お店（カフェ・レストラン）" icon={<Utensils size={19} />} value={shopMode} change={value => choose('shop', value)} />}
    </div>}
    {complete && steps.length > 0 && !areaPoll && !scheduledPoll && <nav aria-label="今回の流れ" className={styles.flow}>
      <strong>今回の流れ</strong><ol>{steps.map(step => <li key={step}>{step}</li>)}</ol>
    </nav>}
    {complete && steps.length === 0 && <section className={styles.complete} aria-label="設定完了">
      <p>調整する項目はありません。</p><Link href="/home">ホームへ戻る</Link>
    </section>}
    {complete && dayMode === 'adjust' && <PillButton variant="cta" onClick={() => startDateSetup(areaMode, shopMode)}>アンケート作成に進む</PillButton>}

    {areaSetupNeeded && <section className={`${base.panel} ${base.stack}`} aria-label={areaMode === 'known' ? 'エリアが決まっている場合の設定' : 'エリア調整の設定'}>
      {areaMode === 'known' ? <>
        {areaPoll?.selectedAreaId === config.areaId && <div className={styles.confirmedArea}><Check size={18} /><div><strong>みんなで選んだエリア</strong><Link href={`/area/${areaPoll.id}`}>回答を見る</Link></div></div>}
        <div className={shared.fields}>
          <label>集合エリア<select className={base.select} value={config.areaId} disabled={Boolean(areaPoll?.selectedAreaId)} onChange={event => onChange({ ...config, areaId: event.target.value })}>
            {Object.entries(meetingCities).map(([id, city]) => <optgroup key={id} label={city.label}>{meetingAreas.filter(area => area.cityId === id).map(area => <option key={area.id} value={area.discoveryAreaId}>{areas[area.discoveryAreaId].label}</option>)}</optgroup>)}
          </select></label>
          <label>集合地点からの範囲<select className={base.select} value={config.radius} onChange={event => onChange({ ...config, radius: Number(event.target.value) })}>
            {[500, 1000, 2000].map(radius => <option key={radius} value={radius}>{radius < 1000 ? `${radius}m以内` : `${radius / 1000}km以内`}</option>)}
          </select></label>
        </div>
      </> : <>
        <fieldset className={styles.cityField}><legend>集まる都市</legend><div className={styles.cityChoices}>
          {Object.entries(meetingCities).map(([id, city]) => <button key={id} type="button" aria-pressed={cityId === id}
            onClick={() => setChosenCity(id as MeetingCityId)}><MapPin size={16} />{city.label}{cityId === id && <Check size={15} />}</button>)}
        </div></fieldset>
      </>}
      {scheduledPoll || areaPoll ? <p className={styles.setupCount}>{scheduled ? '確定した日程の参加者' : '参加人数'}　{config.partySize}人</p> :
      <div className={shared.fields}><label>参加人数<select className={base.select} value={config.partySize} onChange={event => onChange({ ...config, partySize: Number(event.target.value) })}>
        {Array.from({ length: 7 }, (_, index) => <option key={index} value={index + 2}>{index + 2}人</option>)}
      </select></label></div>}
      {shopMode === 'adjust' && <fieldset className={shared.fieldset}><legend>探したいお店</legend><div className={base.choiceChipGrid}>
        {modes.map(mode => <button key={mode} type="button" aria-pressed={config.mode === mode}
          className={`${base.answerChip} ${shared.choice} ${config.mode === mode ? base.answerChipSelected : ''}`} onClick={() => onChange({ ...config, mode })}>{mode === '食事' ? 'レストラン' : mode}</button>)}
      </div></fieldset>}
      {areaMode === 'known' ? <p className={styles.hint}>{legacyShop ? 'この端末で1人ずつ回答します。' : 'リンクを送ると、各自の端末から好きなタイミングで回答できます。'}</p>
        : <p className={styles.hint}>{areaHint}</p>}
      {error && <p className={shared.error} role="alert">{error}</p>}
      <PillButton variant="cta" disabled={busy || loadingContext || areaMode === 'known' && !shops.length}
        onClick={areaMode === 'known' ? (legacyShop ? onLegacyStart : () => void startSharedShop()) : () => void createPoll()}>
        {busy ? '作成中…' : loadingContext ? '設定を確認中…' : areaMode === 'known' ? (legacyShop ? 'お店のアンケートを始める' : 'お店のアンケートを作る') : combinedSurvey ? 'アンケートを作成する' : '場所のアンケートを作成する'}
      </PillButton>
    </section>}
  </div>;
}


const planLabels = { known: '決まっている', adjust: 'みんなで調整', skip: '調整しない' } as const;

function StatusChoice({ title, icon, value, change, withSkip = false }: {
  title: string; icon: React.ReactNode; value: ShopPlan | null; change: (value: ShopPlan) => void; withSkip?: boolean;
}) {
  const choices: ShopPlan[] = withSkip ? ['known', 'adjust', 'skip'] : ['known', 'adjust'];
  return <fieldset className={styles.statusField}><legend>{icon} {title}</legend>
    <div className={withSkip ? styles.shopStatusButtons : styles.statusButtons}>{choices.map(choice =>
      <button type="button" key={choice} aria-pressed={value === choice} onClick={() => change(choice)}>
        {value === choice && <Check size={16} />}{planLabels[choice]}
      </button>)}</div>
  </fieldset>;
}

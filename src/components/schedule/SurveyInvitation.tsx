'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Copy, Eye } from 'lucide-react';
import { ShopStep } from '@/components/journey/ShopStep';
import { meetingCities, type MeetingCityId } from '@/lib/meeting-areas';
import { areaCredentialsKey } from '@/components/area/area-client';
import styles from './ScheduleFlow.module.css';
import share from './SurveyInvitation.module.css';

type ScheduleSummary = {
  id: string; closed: boolean; optionCount: number; canDecide: boolean;
  responses: { id: string; complete: boolean; canAttend: boolean }[];
};
type AreaSummary = {
  id: string; cityId: string; mode: string; count: number; closed: boolean;
  responseIds: string[]; eligibleIds?: string[];
};
type Props = { shopStage?: { id: string; setupScheduleId?: string }; findShop: boolean; path: string; title?: string; count: number; date?: ScheduleSummary; area?: AreaSummary };

function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
function useDeviceRecord(key?: string) {
  const record = useSyncExternalStore(subscribe, () => {
    try { return (key && localStorage.getItem(key)) || '{}'; }
    catch { return '{}'; }
  }, () => null);
  if (record === null) return null;
  try {
    const saved = JSON.parse(record);
    const ids: string[] = Array.isArray(saved.responses) ? saved.responses.flatMap((entry: { id?: string; token?: string } | null) =>
      typeof entry?.id === 'string' && entry.token ? [entry.id] : []) : [];
    return { ids, host: Boolean(saved.hostToken) };
  } catch { return { ids: [], host: false }; }
}

type PersonalAction = { label: string; href: string; action: string; areaAnswered?: boolean };
function nextAction({ path, count, date, area }: Props, dateIds: string[], areaIds: string[]): PersonalAction {
  const people = date?.responses.filter(person => dateIds.includes(person.id)) ?? [];
  const ownArea = area?.responseIds.filter(id => areaIds.includes(id)) ?? [];
  const person = people[0];
  const review = (label: string, areaAnswered = false) => ({ label, href: '', action: '', areaAnswered });
  if (people.length > 1 || ownArea.length > 1) return review('この端末で複数人が回答しています');
  if (date && !person) {
    if (date.closed || date.responses.length >= count) return review('日程の回答受付は終了しました');
    return { label: '自分の回答', href: path + '?view=answer', action: area ? '日程と場所に回答する' : '日程に回答する' };
  }
  if (person && !person.complete && !date?.closed) {
    return { label: '新しい日程候補があります', href: path + '?view=answer', action: '日程の回答を更新する' };
  }
  if (area && person && (area.eligibleIds ? !area.eligibleIds.includes(person.id) : !person.canAttend)) {
    return review(area.eligibleIds ? '場所は当日の参加者で調整します' : '全候補が×のため、場所の回答は不要です');
  }
  if (area && !ownArea.length && !area.responseIds.includes(person?.id ?? '')) {
    if (area.closed || area.responseIds.length >= area.count) return review('場所の回答受付は終了しました');
    return { label: date ? '日程は回答済みです' : '自分の回答',
      href: `/area/${area.id}?view=answer${person ? '&person=' + encodeURIComponent(person.id) : ''}`, action: '場所に回答する' };
  }
  return review(date && area ? '日程と場所は回答済みです' : date ? '日程は回答済みです' : '場所は回答済みです', Boolean(area));
}

export function SurveyInvitation(props: Props) {
  const { path, title, count, date, area } = props;
  const dateMember = useDeviceRecord(date && `meshimatch_schedule_v1_${date.id}`);
  const areaMember = useDeviceRecord(area && areaCredentialsKey(area.id));
  const router = useRouter();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const input = useRef<HTMLInputElement>(null);
  const collectingTogether = Boolean(area && props.shopStage && !area.closed);
  const shopTopic = area?.mode === '食事' ? 'レストランの希望' : 'カフェの希望';
  const topics = [date && '日程', area && '場所', collectingTogether && shopTopic].filter(Boolean).join('・');
  const action = dateMember && areaMember ? nextAction(props, dateMember.ids, areaMember.ids) : undefined;
  const actionLabel = collectingTogether && (action?.action === '場所に回答する' || action?.action === '日程と場所に回答する')
    ? (action.action === '場所に回答する' ? '場所・' : '日程・場所・') + shopTopic + 'に回答する' : action?.action;
  const decision = dateMember?.host && date?.canDecide
    ? { href: '/schedule/' + date.id + '?view=results', label: '日程を決める' }
    : areaMember?.host && area && !area.closed && (!date || date.closed) && area.responseIds.length === area.count
      ? { href: '/area/' + area.id + '?view=results', label: 'エリアの候補を確認する' } : undefined;
  const shopStage = props.shopStage;
  const finished = (!date || date.closed) && (!area || area.closed);

  // A poll can change in another tab while the organizer has the invitation open.
  useEffect(() => {
    const refresh = () => router.refresh();
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); };
  }, [router]);
  useEffect(() => {
    if (copyState === 'manual') { input.current?.focus(); input.current?.select(); }
  }, [copyState]);
  async function copy() {
    try { await navigator.clipboard.writeText(window.location.origin + path); setCopyState('copied'); }
    catch { setCopyState('manual'); }
  }
  const localOnly = useSyncExternalStore(subscribe, () => ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname), () => false);
  return <main className={styles.screen}><div className={styles.inviteShell}>
    <nav className={styles.nav}><Link href="/home" aria-label="meshimatch ホームへ" className={styles.brand}>meshimatch</Link></nav>
    <header className={styles.header}><span className={styles.eyebrow}><Check size={16}/>{shopStage && finished ? 'お店選びへ' : finished ? '調整完了' : 'アンケート作成完了'}</span>
      <h1>{shopStage && finished ? '集まりを共有しよう' : finished ? '結果を共有しよう' : 'みんなに共有しよう'}</h1>
    </header>
    <section className={styles.panel}><h2>{title === 'みんなの日程調整' || !title ? topics + 'のアンケート' : title}</h2>
      <p className={styles.inviteMeta}>{[count + '人（幹事を含む）', date && '日程' + date.optionCount + '候補', area && meetingCities[area.cityId as MeetingCityId]?.label, props.findShop && area?.mode].filter(Boolean).join(' · ')}</p>
      {collectingTogether && <p className={styles.help}>このリンクから、{date ? '日程・場所' : '場所'}に続けて{shopTopic}まで回答できます。</p>}
      <button className={styles.inviteCopy} onClick={() => void copy()}>{copyState === 'copied' ? <Check size={17}/> : <Copy size={17}/>}
        <span aria-live="polite">{copyState === 'copied' ? 'コピーしました' : finished ? '集まりのリンクをコピー' : '招待リンクをコピー'}</span></button>
      {localOnly && <p className={share.localNote}>ローカル版のリンクは、この端末で開けます。</p>}
      {copyState === 'manual' && <label className={styles.field}>リンクを選択してコピー
        <input ref={input} readOnly value={window.location.origin + path} onFocus={event => event.target.select()}/></label>}
      <Link className={styles.previewLink} href={path + '?view=preview'}><Eye size={16}/>参加者の画面をプレビュー</Link>
    </section>
    {shopStage && (finished || (action && !action.href)) && <ShopStep {...shopStage} />}
    <section className={share.personal} aria-label="自分の回答">
      {!finished && action && (!collectingTogether || !action.areaAnswered) && <><h2>{action.label}</h2>{action.href && <Link className={share.answer} href={action.href}>{actionLabel}<ArrowRight size={16}/></Link>}</>}
      <Link className={action?.href ? styles.previewLink : share.answer} href={decision?.href ?? (path + '?view=results')}>{decision?.label ?? 'みんなの回答状況を見る'}<ArrowRight size={16}/></Link>
    </section>
  </div></main>;
}

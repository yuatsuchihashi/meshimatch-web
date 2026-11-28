'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { PillButton } from '@/components/v2';
import { MAX_SCHEDULE_OPTIONS, availabilityLabels, availabilitySymbols, canConfirmDate, completedResponses, dateLabel, periodLabel, summarizeOption,
  timePeriods, timezoneLabel, todayInZone, type PlacePlan, type Availability, type ScheduleOption, type SchedulePoll } from '@/lib/schedule';
import { shouldFindShop } from '@/lib/shop-plan';
import { sharedShopStage } from '@/lib/shared-shop-stage';
import { ShopStep } from '@/components/journey/ShopStep';
import { areaRequest } from '@/components/area/area-client';
import type { AreaPoll } from '@/lib/area-poll';
import { meetingCities, type MeetingCityId } from '@/lib/meeting-areas';
import { readDeviceName } from '@/lib/device-profile';
import { creationDraftKey, readCreationDraft, type DraftDay } from './creation-draft';
import styles from './ScheduleFlow.module.css';
import { ScheduleDecision } from './ScheduleDecision';
import decisionStyles from './ScheduleDecision.module.css';
import vote from './ScheduleVote.module.css';
import createStyles from './ScheduleCreateUX.module.css';

type Credential = { id: string; token: string; name: string };
type Credentials = { hostToken?: string; responses: Credential[] };
const storageKey = (id: string) => `meshimatch_schedule_v1_${id}`;

async function request(url: string, body?: unknown) {
  const response = await fetch(url, body ? {
    method: url === '/api/schedules' ? 'POST' : 'PATCH',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '読み込めませんでした。もう一度試してください。');
  return data as { poll: SchedulePoll; hostToken?: string };
}
const message = (error: unknown) => error instanceof Error ? error.message : 'もう一度試してください。';
type DayDraft = { id: string; date: string; slots: ScheduleOption[] };

function newDay(date: string): DayDraft {
  return { id: crypto.randomUUID(), date, slots: [] };
}

const stamps = [
  { period: 'morning', label: '朝', icon: 'sunrise' },
  { period: 'lunch', label: '昼', icon: 'sun' },
  { period: 'afternoon', label: '午後', icon: 'sun' },
  { period: 'evening', label: '夜', icon: 'moon' },
] as const;

function Frame({ children, back, backLabel }: { children: React.ReactNode; back?: string; backLabel?: string }) {
  return <main className={styles.screen}><div className={styles.shell}>
    <nav className={styles.nav}>{back ? <Link href={back}><ArrowLeft size={17} />{backLabel}</Link> : <span />}
      <Link href="/home" aria-label="meshimatch ホームへ" className={styles.brand}>meshimatch<span>みんなで、楽しみを決めよう。</span></Link></nav>
    {children}
  </div></main>;
}

function DayEditor({ day, minimum, remaining, existing = [], onChange, onRemove, scope }: {
  day: DayDraft; minimum: string; remaining: number; existing?: ScheduleOption[];
  onChange: (day: DayDraft) => void; onRemove?: () => void; scope?: string;
}) {
  const { date, slots } = day;
  const saved = existing.filter(item => item.date === date);
  const has = (period: ScheduleOption['period']) => slots.some(item => item.period === period);
  const locked = (period: ScheduleOption['period']) => saved.some(item => item.period === period);
  const add = (period: ScheduleOption['period']): ScheduleOption => ({ id: crypto.randomUUID(), date, period });
  const set = (next: ScheduleOption[]) => {
    const order: ScheduleOption['period'][] = ['morning', 'lunch', 'afternoon', 'evening', 'anytime', 'custom'];
    onChange({ ...day, slots: next.sort((a, b) => order.indexOf(a.period) - order.indexOf(b.period)) });
  };
  function toggle(period: ScheduleOption['period']) {
    set(has(period) ? slots.filter(item => item.period !== period) : [...slots, add(period)]);
  }
  const missing = stamps.filter(({ period }) => !has(period) && !locked(period));
  return <div className={styles.optionEditor}>
    {!scope && <label><span className={styles.srOnly}>候補日</span><input aria-label="候補日" type="date" min={minimum} required value={date}
      onChange={event => {
        const nextDate = event.target.value;
        onChange({ ...day, date: nextDate, slots: slots.filter(item => item.period === 'custom' ||
          !existing.some(saved => saved.date === nextDate && saved.period === item.period)).map(item => ({ ...item, date: nextDate })) });
      }} /></label>}
    {onRemove && <button type="button" className={styles.iconButton} aria-label={`${date}の候補を削除`} onClick={onRemove}><Trash2 size={17} /></button>}
    <fieldset className={styles.periodPicker}><legend className={styles.srOnly}>時間帯（複数選択）</legend>
      <div className={styles.timeStampRow}>{stamps.map(({ period, label, icon }) =>
        <button key={period} type="button" className={styles.timeStamp} aria-label={`${scope ?? date}の時間帯 ${label}`}
          aria-pressed={has(period) || locked(period)} disabled={locked(period) || (!has(period) && remaining <= 0)} onClick={() => toggle(period)}>
          <span className={styles.stampIcon} aria-hidden="true" style={{ maskImage: `url(/icons/schedule/${icon}.svg)`, WebkitMaskImage: `url(/icons/schedule/${icon}.svg)` }} />
          <span>{label}</span>{(has(period) || locked(period)) && <Check size={13} className={styles.stampCheck} />}
        </button>)}</div>
      <button type="button" className={styles.textButton} disabled={!missing.length || missing.length > remaining}
        onClick={() => set([...slots, ...missing.map(stamp => add(stamp.period))])}>朝から夜まですべて選ぶ</button>
      <div className={styles.extraChoices}>
        <button type="button" aria-pressed={has('anytime') || locked('anytime')} disabled={locked('anytime') || (!has('anytime') && remaining <= 0)}
          onClick={() => toggle('anytime')}>{timePeriods.anytime}</button>
        <button type="button" disabled={remaining <= 0} onClick={() => set([...slots, add('custom')])}><Plus size={13} />時刻を指定</button>
      </div>
    </fieldset>
    {slots.filter(slot => slot.period === 'custom').map(slot => <div key={slot.id} className={styles.customTime}>
      {(['start', 'end'] as const).map(key => <label key={key}>{key === 'start' ? '開始' : '終了'}
        <input aria-label={key === 'start' ? '開始時刻' : '終了時刻'} type="time" step="60" required value={slot[key] ?? ''}
          onChange={event => set(slots.map(item => item.id === slot.id ? { ...item, [key]: event.target.value } : item))} /></label>)}
      <button type="button" className={styles.iconButton} aria-label="指定した時刻を削除" onClick={() => set(slots.filter(item => item.id !== slot.id))}><Trash2 size={16}/></button>
    </div>)}
  </div>;
}

function Calendar({ days, full, timezone, onToggle }: { days: DayDraft[]; full: boolean; timezone: string; onToggle: (date: string) => void }) {
  const today = todayInZone(timezone);
  const [month, setMonth] = useState(() => (days.find(day => day.date >= today)?.date ?? today).slice(0, 7));
  const [year, number] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, number, 0)).getUTCDate();
  function move(amount: number) {
    const date = new Date(Date.UTC(year, number - 1 + amount, 1));
    setMonth(date.toISOString().slice(0, 7));
  }
  return <section className={styles.calendar} aria-label="候補日を選ぶカレンダー">
    <div className={styles.calendarHeader}><strong>{year}年{number}月</strong><div>
      <button type="button" className={styles.iconButton} aria-label="前の月" disabled={month <= today.slice(0, 7)} onClick={() => move(-1)}><ChevronLeft size={20} /></button>
      <button type="button" className={styles.iconButton} aria-label="次の月" disabled={year >= 2099 && number === 12} onClick={() => move(1)}><ChevronRight size={20} /></button>
    </div></div>
    <div className={styles.calendarGrid}>
      {['日', '月', '火', '水', '木', '金', '土'].map(day => <span key={day} className={styles.weekday}>{day}</span>)}
      {Array.from({ length: firstDay }, (_, index) => <span key={`blank${index}`} />)}
      {Array.from({ length: dayCount }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        const selected = days.some(day => day.date === date);
        return <button key={date} type="button" className={`${styles.day} ${selected ? styles.selectedDay : ''}`}
          disabled={date < today || (!selected && full)} aria-pressed={selected} aria-label={dateLabel(date, true)}
          onClick={() => onToggle(date)}>{index + 1}{selected && <span className={styles.dayDot} />}</button>;
      })}
    </div>
  </section>;
}

type CreateProps = { placePlan?: PlacePlan; shopPlan?: SchedulePoll['shopPlan']; draftId: string };
const subscribeToMount = () => () => {};
const mounted = () => true;
const renderingOnServer = () => false;

export function ScheduleCreate(props: CreateProps) {
  const hydrated = useSyncExternalStore(subscribeToMount, mounted, renderingOnServer);
  if (!hydrated) return <Frame><p role="status">候補日を読み込み中…</p></Frame>;
  return <ScheduleCreateForm key={props.draftId} {...props} />;
}

function ScheduleCreateForm({ placePlan, shopPlan, draftId }: CreateProps) {
  const router = useRouter();
  const [saved] = useState(() => readCreationDraft(draftId));
  const [title, setTitle] = useState(saved?.title ?? '');
  const [description, setDescription] = useState(saved?.description ?? '');
  const [expectedCount, setExpectedCount] = useState(saved?.expectedCount ?? 3);
  const [timezone, setTimezone] = useState(saved?.timezone ?? 'Asia/Tokyo');
  const [days, setDays] = useState<DraftDay[]>(saved?.days ?? []);
  const [commonSlots, setCommonSlots] = useState<ScheduleOption[]>(saved?.commonSlots ?? []);
  useEffect(() => {
    try {
      sessionStorage.setItem(creationDraftKey(draftId), JSON.stringify({ title, description, expectedCount, timezone, days, commonSlots }));
    } catch { /* The form still works when this browser cannot keep a draft. */ }
  }, [draftId, title, description, expectedCount, timezone, days, commonSlots]);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [individualOpen, setIndividualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const slotsFor = (day: typeof days[number]) => day.individual ? day.slots : commonSlots;
  // Each actual date/time needs its own stable ID, even when several dates share the same time.
  const options = days.flatMap(day => slotsFor(day).map(slot => ({ ...slot, date: day.date, id: `${day.id}-${slot.id}` })));
  const remaining = MAX_SCHEDULE_OPTIONS - options.length;
  const commonDays = days.filter(day => !day.individual);
  // Reserve one slot for each selected date that still needs a time.
  const emptyDays = days.filter(day => !slotsFor(day).length);
  const freeSlots = remaining - emptyDays.length;
  const commonRemaining = Math.floor((remaining - emptyDays.filter(day => day.individual).length) / Math.max(1, commonDays.length));
  const remainingForDay = (day: DraftDay) => freeSlots + (slotsFor(day).length ? 0 : 1);
  const firstIncomplete = days.find(day => !slotsFor(day).length || slotsFor(day).some(slot =>
    slot.period === 'custom' && (!slot.start || !slot.end || slot.start >= slot.end)));
  const outOfRange = days.find(day => day.date < todayInZone(timezone));
  const limitReached = freeSlots < 1;
  function toggle(date: string) {
    if (days.some(day => day.date === date)) {
      setDays(current => current.filter(day => day.date !== date));
      return;
    }
    if (limitReached) return;
    const added: DraftDay = newDay(date);
    if (commonSlots.length > freeSlots) {
      added.individual = true;
      setIndividualOpen(true);
      setEditingDay(added.id);
    }
    setDays(current => [...current, added].sort((a, b) => a.date.localeCompare(b.date)));
  }
  function slotSummary(slots: ScheduleOption[]) {
    return slots.map(slot => slot.period === 'custom' && (!slot.start || !slot.end) ? '時刻を入力' :
      stamps.find(stamp => stamp.period === slot.period)?.label ?? periodLabel(slot)).join('・') || '未選択';
  }
  async function create(event: FormEvent) {
    event.preventDefault(); if (busy || !options.length || firstIncomplete || outOfRange) return;
    setBusy(true); setError('');
    try {
      // Verify storage before creating an event so its management key isn't lost.
      localStorage.setItem('meshimatch_schedule_storage_check', '1');
      localStorage.removeItem('meshimatch_schedule_storage_check');
      const data = await request('/api/schedules', { title, description, expectedCount, timezone, options, placePlan, shopPlan });
      localStorage.setItem(storageKey(data.poll.id), JSON.stringify({ hostToken: data.hostToken, responses: [] }));
      try { sessionStorage.removeItem(creationDraftKey(draftId)); } catch { /* Optional local draft. */ }
      router.replace(placePlan === 'adjust' ? `/instant?schedule=${data.poll.id}` : `/share/schedule/${data.poll.id}`);
    } catch (error) { setError(message(error)); setBusy(false); }
  }
  const setupQuery = new URLSearchParams({ day: 'adjust', draft: draftId });
  if (placePlan) setupQuery.set('place', placePlan);
  if (shopPlan) setupQuery.set('shop', shopPlan);
  return <Frame back={`/instant?${setupQuery}`} backLabel="幹事の設定">
    <header className={styles.header}>
      <h1>候補日はいつにする？</h1><p>みんなに聞きたい日を、まとめて選んでください。</p></header>
    <form onSubmit={create} className={styles.createGrid}>
      <div className={styles.stack}>
        <section className={styles.panel}><div className={styles.sectionHeader}><h2>候補日</h2><span className={styles.pill} aria-live="polite">{days.length}日選択</span></div>
          <Calendar days={days} full={limitReached} timezone={timezone} onToggle={toggle} />
          {days.length > 0 && <a className={styles.dateNext} href="#candidate-times">{firstIncomplete ? `${days.length}日分の時間帯を選ぶ` : `${options.length}候補の時間帯を確認`}<ArrowRight size={15}/></a>}
        </section>
      </div>
      <aside id="candidate-times" className={`${styles.panel} ${styles.candidateAside} ${createStyles.times}`}>
        <div className={styles.sectionHeader}><h2>候補の時間帯</h2><span className={styles.pill} aria-live="polite">{options.length ? `${options.length}/${MAX_SCHEDULE_OPTIONS}候補` : `最大${MAX_SCHEDULE_OPTIONS}候補`}</span></div>
        {commonDays.length > 0 || !days.length ? <>
          <p className={createStyles.scope}>{commonDays.length > 1 ? `${commonDays.length}日分をまとめて選択` : commonDays.length === 1 ? dateLabel(commonDays[0].date) : '選んだ日すべてに適用'} <small>複数可</small></p>
          <DayEditor day={{ id: 'common', date: '', slots: commonSlots }} scope="共通" minimum={todayInZone(timezone)}
            remaining={commonRemaining} onChange={next => setCommonSlots(next.slots)} />
        </> : null}
        {days.length > 0 && <details className={createStyles.individual} open={individualOpen} onToggle={event => setIndividualOpen(event.currentTarget.open)}>
          <summary>日ごとに時間帯を変える</summary>
          {days.map(day => <div key={day.id} className={createStyles.dayRow}>
            <button type="button" className={createStyles.dayToggle} aria-expanded={editingDay === day.id}
              aria-label={`${dateLabel(day.date)}の時間帯を変更`} onClick={() => setEditingDay(editingDay === day.id ? null : day.id)}>
              <strong>{dateLabel(day.date)}</strong><span>{slotSummary(slotsFor(day))}</span><ChevronRight size={15}/>
            </button>
            {editingDay === day.id && <>
              <DayEditor day={{ ...day, slots: slotsFor(day) }} scope={day.date} minimum={todayInZone(timezone)} remaining={remainingForDay(day)}
                onChange={next => setDays(current => current.map(item => item.id === day.id ? { ...next, individual: true } : item))} />
              {day.individual && <button type="button" className={styles.textButton}
                disabled={commonSlots.length - day.slots.length > remainingForDay(day)}
                onClick={() => setDays(current => current.map(item => item.id === day.id ? { ...item, individual: false, slots: [] } : item))}>共通の時間帯に戻す</button>}
            </>}
          </div>)}
        </details>}
        {firstIncomplete && <p className={createStyles.hint} role="status">{firstIncomplete.individual
          ? <button type="button" onClick={() => { setIndividualOpen(true); setEditingDay(firstIncomplete.id); }}>{dateLabel(firstIncomplete.date)}の時間帯を確認してください</button>
          : commonSlots.length ? '開始と終了の時刻を確認してください。' : '時間を決めずに募集するなら「時間はあとで」を選べます。'}</p>}
        {limitReached && <p className={createStyles.hint}>追加できるのは合計{MAX_SCHEDULE_OPTIONS}候補までです。</p>}
        {outOfRange && <p className={styles.error}>{dateLabel(outOfRange.date)}は選んだタイムゾーンでは過去の日付です。
          <button type="button" className={styles.textButton} onClick={() => toggle(outOfRange.date)}>この候補日を外す</button></p>}
        <section className={styles.groupSettings} aria-label="集まりの設定">
          <div className={styles.twoFields}><label className={styles.field}>参加人数 <span className={styles.muted}>幹事も含む</span>
            <select value={expectedCount} onChange={event => setExpectedCount(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => <option key={index} value={index + 2}>{index + 2}人</option>)}</select></label>
            <label className={styles.field}>日程のタイムゾーン<select value={timezone} onChange={event => setTimezone(event.target.value)}>
              <option value="Asia/Tokyo">日本時間</option><option value="America/Argentina/Buenos_Aires">ブエノスアイレス時間</option><option value="UTC">UTC</option>
            </select></label></div>
          <details className={styles.optionalSettings}><summary>名前・ひとことを追加</summary>
          <label className={styles.field}>集まりの名前 <span className={styles.muted}>任意</span><input maxLength={80} value={title} placeholder="例：週末、みんなでごはん" onChange={event => setTitle(event.target.value)} /></label>
          <label className={styles.field}>ひとこと <span className={styles.muted}>任意</span><textarea maxLength={500} rows={2} value={description} placeholder="久しぶりに集まろう。場所はあとで相談！" onChange={event => setDescription(event.target.value)} /></label>
          </details>
        </section>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <PillButton type="submit" variant="cta" disabled={busy || !options.length || Boolean(firstIncomplete || outOfRange)} className={styles.fullButton}>
          {busy ? '作成中…' : placePlan === 'adjust' ? '日程を保存して、場所の設定へ' : 'アンケートを作成して共有へ'}<ArrowRight size={17} /></PillButton>
      </aside>
    </form>
  </Frame>;
}

type PendingVote = { person: Credential; name: string; answers: Record<string, Availability>; comment: string };
const pendingVoteKey = (id: string) => `meshimatch_pending_vote_${id}`;

// Keep a new guest's draft within this tab until they submit it.
function readPendingVote(poll: SchedulePoll): PendingVote | undefined {
  try {
    const raw = JSON.parse(sessionStorage.getItem(pendingVoteKey(poll.id)) ?? 'null');
    if (!raw || typeof raw.person?.id !== 'string' || typeof raw.person.token !== 'string'
      || typeof raw.name !== 'string' || typeof raw.comment !== 'string' || !raw.answers
      || poll.responses.some(item => item.id === raw.person.id)) return;
    const answers: Record<string, Availability> = {};
    for (const option of poll.options) {
      if (['yes', 'maybe', 'no'].includes(raw.answers[option.id])) answers[option.id] = raw.answers[option.id];
    }
    return { person: raw.person, name: raw.name, answers, comment: raw.comment };
  } catch { return; }
}

function VoteOptions({ options, answers, change }: {
  options: ScheduleOption[]; answers: Record<string, Availability>;
  change: (answers: Record<string, Availability>) => void;
}) {
  const [lastFill, setLastFill] = useState<string[]>([]);
  const byDay = new Map<string, ScheduleOption[]>();
  for (const option of options) {
    const day = byDay.get(option.date);
    if (day) day.push(option); else byDay.set(option.date, [option]);
  }
  const missing = options.filter(option => !answers[option.id]);
  function fill(value: Availability) {
    const next = { ...answers };
    for (const option of missing) next[option.id] = value;
    setLastFill(missing.map(option => option.id));
    change(next);
  }
  function undoFill() {
    const next = { ...answers };
    for (const id of lastFill) delete next[id];
    change(next);
    setLastFill([]);
  }
  return <div className={vote.ballot}>
    {options.length > 1 && <div className={vote.tools}>
      {missing.length > 0 ? <a href={`#vote-${missing[0].id}`} aria-label={`最初の未回答の候補へ（残り${missing.length}件）`}>未回答 {missing.length}件 ↓</a>
        : <span role="status"><Check size={15} />全候補を選択済み</span>}
      {missing.length > 0 ? <div className={vote.bulk} aria-label="未回答の候補をまとめて選択">
        {(['yes', 'no'] as const).map(value => <button type="button" key={value} aria-label={`未回答${missing.length}件を${availabilitySymbols[value]}にする`} onClick={() => fill(value)}>残りを{availabilitySymbols[value]}</button>)}
      </div> : lastFill.length > 0 && <button type="button" className={vote.undo} onClick={undoFill}>一括選択を戻す</button>}
    </div>}
    <div className={vote.key}><span>○ 参加できる</span><span>△ 条件付き</span><span>× 難しい</span></div>
    {[...byDay.keys()].sort().map(date => <section className={vote.day} key={date} aria-label={dateLabel(date, true)}>
      <h3>{dateLabel(date)}</h3>
      {byDay.get(date)!.map(option => <div key={option.id} id={`vote-${option.id}`} tabIndex={-1} role="group" aria-label={`${dateLabel(date)} ${periodLabel(option)}`} className={vote.row}>
        <span>{periodLabel(option)}</span>
        {(['yes', 'maybe', 'no'] as const).map(value => <button type="button" key={value} aria-pressed={answers[option.id] === value}
          className={vote[value]} aria-label={`${dateLabel(date)} ${periodLabel(option)} ${availabilityLabels[value]}`}
          onClick={() => { setLastFill(current => current.filter(id => id !== option.id)); change({ ...answers, [option.id]: value }); }}>{availabilitySymbols[value]}</button>)}
      </div>)}
    </section>)}
  </div>;
}

export function ScheduleDetail({ id, view }: { id: string; view?: string }) {
  const preview = view === 'preview';
  const router = useRouter();
  const [poll, setPoll] = useState<SchedulePoll | null>(null);
  const [area, setArea] = useState<AreaPoll | null>(null);
  const [credentials, setCredentials] = useState<Credentials>({ responses: [] });
  const [editing, setEditing] = useState<Credential | null>(null);
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Record<string, Availability>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addedDay, setAddedDay] = useState<DayDraft | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const focusDecision = useRef(false);
  const confirmedHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (poll?.selectedOptionId && focusDecision.current) {
      focusDecision.current = false;
      confirmedHeading.current?.focus();
    }
  }, [poll?.selectedOptionId]);


  const refresh = useCallback(async () => {
    try {
      const { poll: latest } = await request(`/api/schedules/${id}`);
      setPoll(current => current && current.updatedAt > latest.updatedAt ? current : latest);
      if (latest.areaPollId) void areaRequest(`/api/area-polls/${latest.areaPollId}`).then(({ poll: next }) => {
        setArea(current => current && current.updatedAt > next.updatedAt ? current : next);
      }).catch(() => { /* Date voting remains available while place details load. */ });
      setError('');
      return latest;
    }
    catch (error) { setError(message(error)); return null; }
  }, [id]);
  useEffect(() => {
    let active = true;
    let saved: Credentials = { responses: [] };
    setShareUrl(`${window.location.origin}/schedule/${id}`);
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey(id)) ?? '{"responses":[]}');
      if (!preview && raw && Array.isArray(raw.responses)) saved = raw;
    } catch { setNotice('このブラウザでは編集情報を読み込めませんでした。'); }
    setCredentials(saved);
    setEditing(null);
    void refresh().then(latest => {
      if (!active || !latest) return;
      const existing = saved.responses.find(item => latest.responses.some(response => response.id === item.id));
      const start = view === 'answer' || (!view && !saved.hostToken && !existing);
      if (!preview && (!start || latest.selectedOptionId || (!existing && latest.responses.length >= latest.expectedCount))) return;
      const draft = !preview && !existing ? readPendingVote(latest) : undefined;
      const person = existing ?? draft?.person ?? { id: crypto.randomUUID(), token: crypto.randomUUID(),
        name: !preview && !saved.responses.length ? readDeviceName() : '' };
      const response = latest.responses.find(item => item.id === person.id);
      setEditing(person); setName(response?.name ?? draft?.name ?? person.name); setAnswers(response?.answers ?? draft?.answers ?? {}); setComment(response?.comment ?? draft?.comment ?? '');
      if (draft) setNotice('入力途中の日程を復元しました。');
    });
    return () => { active = false; };
  }, [id, view, preview, refresh]);
  useEffect(() => {
    if (editing || busy || confirming) return;
    const update = () => { void refresh(); };
    const timer = window.setInterval(update, 10000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, [refresh, editing, busy, confirming]);

  useEffect(() => {
    if (preview || !editing || !poll || poll.id !== id || poll.responses.some(item => item.id === editing.id)) return;
    try {
      if ((!name || name === editing.name) && !comment && !Object.keys(answers).length) {
        sessionStorage.removeItem(pendingVoteKey(id));
      } else {
        sessionStorage.setItem(pendingVoteKey(id), JSON.stringify({ person: editing, name, answers, comment }));
      }
    } catch { /* Voting also works when the browser disallows drafts. */ }
  }, [answers, comment, editing, id, name, poll, preview]);

  async function edit(credential?: Credential) {
    const latest = await refresh();
    if (!latest || latest.selectedOptionId) return;
    const draft = !preview && !credential && !credentials.responses.length ? readPendingVote(latest) : undefined;
    const active = credential ?? draft?.person ?? { id: crypto.randomUUID(), token: crypto.randomUUID(),
      name: !preview && !credentials.responses.length ? readDeviceName() : '' };
    const response = latest.responses.find(response => response.id === active.id);
    setEditing(active); setName(response?.name ?? draft?.name ?? active.name); setAnswers(response?.answers ?? draft?.answers ?? {}); setComment(response?.comment ?? draft?.comment ?? ''); setNotice(draft ? '入力途中の日程を復元しました。' : '');
  }
  async function saveAnswer(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    if (preview) {
      router.push(poll?.areaPollId ? `/area/${poll.areaPollId}?view=preview` : `/share/schedule/${id}`);
      return;
    }
    setBusy(true); setError('');
    try {
      // Save the key first. A network retry updates the same answer instead of adding a duplicate.
      const nextCredentials = { ...credentials, responses: [...credentials.responses.filter(item => item.id !== editing.id), { ...editing, name: name.trim() }] };
      localStorage.setItem(storageKey(id), JSON.stringify(nextCredentials));
      setCredentials(nextCredentials);
      const data = await request(`/api/schedules/${id}`, { action: 'respond', responseId: editing.id, token: editing.token, name, answers, comment });
      setPoll(data.poll); setEditing(null);
      try { sessionStorage.removeItem(pendingVoteKey(id)); } catch { /* The vote is saved on the server. */ }
      if (data.poll.areaPollId && Object.values(answers).some(answer => answer !== 'no') && (view === 'answer' || !poll?.responses.some(item => item.id === editing.id))) {
        router.push(`/area/${data.poll.areaPollId}?view=answer&person=${encodeURIComponent(editing.id)}`);
      } else {
        setNotice('回答を保存しました。あとから変更できます。');
      }
    } catch (error) {
      setError(message(error));
      // Keep the draft, but show any new options or confirmation made while answering.
      try { setPoll((await request(`/api/schedules/${id}`)).poll); } catch { /* Original error remains visible. */ }
    }
    finally { setBusy(false); }
  }
  async function manage(action: 'confirm' | 'reopen' | 'add-option', optionId?: string) {
    setBusy(true); setError('');
    try {
      const data = await request(`/api/schedules/${id}`, { action, token: credentials.hostToken, optionId, options: addedDay?.slots });
      focusDecision.current = action === 'confirm';
      setPoll(data.poll); setAdding(false); setConfirming(null);
      setNotice(action === 'add-option' ? '候補を追加しました。回答済みの人にも、新しい候補への回答をお願いしましょう。' : action === 'reopen' ? '日程調整を再開しました。' : '日程を決定しました！');
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setNotice('共有リンクをコピーしました。'); }
    catch { setNotice('下のリンクを選択してコピーしてください。'); }
  }
  if (!poll) return <Frame><section className={styles.panel}>
    {error ? <><p role="alert" className={styles.error}>{error}</p><PillButton onClick={() => void refresh()}>もう一度読み込む</PillButton></> : <p role="status">日程調整を読み込み中…</p>}
  </section></Frame>;
  const confirmed = poll.options.find(option => option.id === poll.selectedOptionId);
  const shopStage = sharedShopStage(poll, area);
  const complete = completedResponses(poll);
  const answered = poll.options.filter(option => answers[option.id]).length;
  const localResponses = credentials.responses.filter(item => poll.responses.some(response => response.id === item.id));
  const canChooseDate = Boolean(credentials.hostToken && !confirmed && poll.options.some(option => canConfirmDate(poll, option.id)));
  const decision = <ScheduleDecision poll={poll} host={Boolean(credentials.hostToken)} busy={busy} confirming={confirming}
    select={setConfirming} confirm={optionId => void manage('confirm', optionId)} />;
  const currentCredential = localResponses[0];
  const newResponse = editing && !poll.responses.some(response => response.id === editing.id);

  const myDateAnswers = poll.responses.filter(response => localResponses.some(person => person.id === response.id));
  const attending = myDateAnswers.filter(response => Object.values(response.answers).some(answer => answer !== 'no'));
  const missingPlace = area?.attendanceBased ? attending.filter(person => !area.responses.some(reply => reply.id === person.id)) : [];
  const finishedBoth = Boolean(area?.attendanceBased && attending.length && !missingPlace.length &&
    attending.every(person => poll.options.every(option => person.answers[option.id])));
  const placeResults = poll.areaPollId ? `/area/${poll.areaPollId}?view=results` : '';
  const placeHeading = missingPlace.length ? '続いて、場所の希望を教えてください' : finishedBoth ? '日程と場所の回答が済みました' : '集まる場所';
  const showPlacePanel = poll.placePlan === 'adjust' && !(confirmed && poll.areaPollId) &&
    (credentials.hostToken || !area?.attendanceBased || attending.length > 0);

  const city = area && (meetingCities[area.cityId as MeetingCityId]?.label ?? area.cityId);
  const purpose = area && shouldFindShop(poll, area) ? area.mode : undefined;
  const title = poll.title === 'みんなの日程調整' && city ? city + (purpose ? 'で' + purpose : 'での集まり') : poll.title;
  const collectShop = Boolean(shopStage && area?.attendanceBased && area.shopPlan === 'adjust');
  const shopLabel = area?.mode === 'カフェ・軽食' ? 'カフェの希望' : 'レストランの希望';
  const invitation = <section className={`${styles.panel} ${styles.sharePanel}`}><div><h2>参加者を招待</h2><p className={styles.help}>{collectShop ? `各自の端末で、日程、場所、${shopLabel}を続けて回答できます。` : shopStage ? 'このリンクからお店選びに進めます。' : poll.areaPollId ? 'このリンクから日程と場所の両方に回答できます。' : 'リンクを開くと日程に回答できます。'}</p></div>
        <div className={styles.shareActions}><input aria-label="共有リンク" readOnly value={shareUrl} onFocus={event => event.target.select()} /><button type="button" className={styles.copyButton} onClick={() => void copyLink()}><Copy size={16} />リンクをコピー</button></div>{credentials.hostToken && <Link href={`/share/schedule/${id}`}>共有画面を見る</Link>}
      </section>;

  const sharePath = `/share/schedule/${id}`;
  const backToShare = preview || Boolean(credentials.hostToken);
  const back = backToShare ? sharePath : editing ? `/schedule/${id}?view=results` : undefined;
  return <Frame back={back} backLabel={backToShare ? '共有画面へ' : 'この集まりの回答状況'}>
    <header className={styles.header}><span className={styles.eyebrow}><CalendarDays size={16} />{confirmed ? '日程が決まりました' : 'みんなの予定を合わせよう'}</span>
      <h1>{title}</h1>{poll.description && <p className={styles.description}>{poll.description}</p>}
      <div className={styles.meta}><span><Users size={15} />{poll.expectedCount}人</span><span>{timezoneLabel(poll.timezone)}</span><span>{poll.options.length}候補</span>{city && poll.title !== 'みんなの日程調整' && <span>{[city, purpose].filter(Boolean).join(' · ')}</span>}</div>
    </header>
    {preview && <div className={styles.notice}>参加者プレビュー · 回答は保存されません<Link href={`/share/schedule/${id}`}>共有画面へ</Link></div>}
    {notice && <p className={styles.notice} role="status"><Check size={17} />{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {confirmed && !preview && <section className={styles.confirmed}>
      <span className={styles.confirmedIcon}><Check size={25} /></span><div><p>決定した日程</p><h2 tabIndex={-1} ref={confirmedHeading}>{dateLabel(confirmed.date, true)} · {periodLabel(confirmed)}</h2><span>{timezoneLabel(poll.timezone)} · {summarizeOption(poll, confirmed.id).yes}人が参加</span></div>
      {poll.areaPollId && !area?.selectedAreaId && <Link className={styles.primaryLink} href={`/area/${poll.areaPollId}`}>{credentials.hostToken && poll.attendanceBased ? `参加する${summarizeOption(poll, confirmed.id).yes}人の場所調整へ` : '場所の回答状況を見る'}<ArrowRight size={17} /></Link>}
      {credentials.hostToken && !shopStage && shouldFindShop(poll, area) && poll.placePlan !== 'adjust' && <Link className={styles.primaryLink} href={`/instant?schedule=${poll.id}`}>お店を選ぶ<ArrowRight size={17} /></Link>}
      {credentials.hostToken && <button type="button" className={styles.textButton} disabled={busy} onClick={() => void manage('reopen')}>日程調整を再開する</button>}
    </section>}

    {!preview && !editing && shopStage && <ShopStep {...shopStage} />}
    {editing && (!confirmed || preview) ? <form onSubmit={saveAnswer} className={`${styles.panel} ${styles.answerForm}`}>
      <div className={styles.sectionHeader}><h2>参加できる日を教えてね</h2><span className={styles.pill}>{answered}/{poll.options.length}回答</span></div>
      {poll.areaPollId && <p className={styles.eyebrow}>{collectShop ? `1 / 3　日程 → 場所 → ${shopLabel}` : '1 / 2　日程 → 場所'}</p>}
      <label className={styles.field}>お名前<input id="vote-name" required maxLength={40} autoComplete="name" value={name} placeholder="みんなに分かる名前" onChange={event => setName(event.target.value)} /></label>
      <VoteOptions key={editing.id} options={poll.options} answers={answers} change={setAnswers}/>
      <details key={editing.id + '-note'} className={vote.notes} open={comment ? true : undefined}>
        <summary>補足を添える（任意）</summary>
        <label className={styles.field}>みんなに伝えたいこと<textarea maxLength={500} rows={2} value={comment}
          placeholder="例：金曜の夜は19時以降なら参加できます" onChange={event => setComment(event.target.value)} /></label>
      </details>
      {!preview && (!name.trim() || answered < poll.options.length) && <p className={vote.missing}>
        {!name.trim() ? <a href="#vote-name">名前を入力する</a> : <a href={`#vote-${poll.options.find(option => !answers[option.id])!.id}`}>未回答の候補へ（あと{poll.options.length - answered}件）</a>}
      </p>}
      <div className={styles.buttonRow}><PillButton variant="ghost" disabled={busy} onClick={() => { if (preview) router.push(`/share/schedule/${id}`); else { setEditing(null); setError(''); } }}>戻る</PillButton>
        <PillButton type="submit" variant="cta" disabled={busy || (!preview && (!name.trim() || answered < poll.options.length))} formNoValidate={preview}>{busy ? '保存中…' : preview ? poll.areaPollId ? '場所の回答画面を見る' : 'プレビューを終える' : (newResponse || view === 'answer') && poll.areaPollId && Object.values(answers).some(answer => answer !== 'no') ? '日程を保存して、場所の回答へ' : '回答を保存する'}</PillButton></div>
    </form> : <>
      {canChooseDate && decision}
      {!confirmed && <section className={styles.responseBar}><div><strong>{complete}<span> / {poll.expectedCount}人が全候補に回答</span></strong><div className={styles.progress}><span style={{ width: `${complete / poll.expectedCount * 100}%` }} /></div></div>
        <div className={styles.buttonRow}><button type="button" className={styles.iconButton} aria-label="回答状況を更新" onClick={() => void refresh()}><RefreshCw size={17} /></button>
          {!currentCredential && poll.responses.length >= poll.expectedCount
            ? <p className={styles.help}>参加人数分の回答がそろいました。編集するには、回答したブラウザで開いてください。</p>
            : <PillButton variant="cta" disabled={busy} onClick={() => void edit(currentCredential)}>{currentCredential ? '自分の回答を編集' : '日程に回答する'}</PillButton>}</div>
      </section>}
      {!confirmed && localResponses.length > 0 && <div className={styles.localEditors}>
        {localResponses.length > 1 && localResponses.map(item => <button key={item.id} type="button" className={styles.textButton} onClick={() => void edit(item)}>{item.name}の回答を編集</button>)}
        {!collectShop && poll.responses.length < poll.expectedCount && <button type="button" className={styles.textButton} onClick={() => void edit()}>同じ端末で別の人の回答を追加</button>}
      </div>}
    {showPlacePanel && <section className={`${styles.panel} ${styles.sharePanel}`}>
      <div><h2>{placeHeading}</h2><p className={styles.help}>{missingPlace.length ? '入力した日程は保存されています。' : finishedBoth ? '幹事が日程を決めたら、参加する人の希望から場所の候補を出します。' : poll.areaPollId ? '場所の回答状況を確認できます。' : credentials.hostToken ? '続けて場所のアンケートを用意できます。' : '幹事が場所のアンケートを準備しています。'}</p></div>
      {missingPlace.length ? missingPlace.map(person => <Link key={person.id} className={styles.primaryLink} href={`/area/${area!.id}?view=answer&person=${encodeURIComponent(person.id)}`}>{myDateAnswers.length > 1 ? person.name + 'の場所の回答へ' : '場所に回答する'}<ArrowRight size={17}/></Link>)
        : poll.areaPollId ? <Link className={finishedBoth ? styles.textButton : styles.primaryLink} href={finishedBoth || area?.attendanceBased ? placeResults : `/area/${poll.areaPollId}`}>{finishedBoth || area?.attendanceBased ? '場所の回答状況を見る' : '場所のアンケートを開く'}</Link>
        : credentials.hostToken && <Link className={styles.primaryLink} href={`/instant?schedule=${poll.id}`}>場所のアンケートを作る<ArrowRight size={17}/></Link>}
    </section>}
      {credentials.hostToken && complete < poll.expectedCount ? invitation : <details className={styles.shareDisclosure}>
        <summary>招待リンクを表示</summary>{invitation}
      </details>}
      {!canChooseDate && decision}
      {poll.responses.length > 0 && <details className={decisionStyles.breakdown}><summary>全員の回答一覧{poll.responses.some(response => response.comment) ? '・補足を見る' : 'を見る'}</summary>
        <p className={decisionStyles.tableHint}>横にスクロールして確認できます。</p>
        <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.srOnly}>{poll.title}の日程別の回答一覧</caption>
          <thead><tr><th scope="col">候補日時</th>{poll.responses.map(response => <th scope="col" key={response.id}>{response.name}</th>)}</tr></thead>
          <tbody>{poll.options.map(option => <tr key={option.id}><th scope="row">{dateLabel(option.date)}<small>{periodLabel(option)}</small></th>{poll.responses.map(response => {
            const value = response.answers[option.id];
            return <td key={response.id} className={value === 'yes' ? styles.yesCell : ''} aria-label={`${response.name} ${value ? availabilityLabels[value] : '未回答'}`}>{value ? availabilitySymbols[value] : '—'}</td>;
          })}</tr>)}</tbody></table></div>
        {poll.responses.some(response => response.comment) && <div className={styles.comments}><h3>みんなの補足</h3>{poll.responses.filter(response => response.comment).map(response => <div key={response.id}><strong>{response.name}</strong><p>{response.comment}</p></div>)}</div>}
      </details>}
      {credentials.hostToken && !confirmed && <section className={styles.addSection}>
        {!adding ? <button type="button" className={styles.addButton} disabled={poll.options.length >= MAX_SCHEDULE_OPTIONS} onClick={() => { setAdding(true); setAddedDay(newDay(todayInZone(poll.timezone))); }}><Plus size={18} />合う日がなければ、候補を追加</button>
          : <form className={styles.panel} onSubmit={event => { event.preventDefault(); void manage('add-option'); }}>
            <h2>候補日時を追加</h2>{addedDay && <DayEditor day={addedDay} minimum={todayInZone(poll.timezone)} remaining={MAX_SCHEDULE_OPTIONS - poll.options.length - addedDay.slots.length} existing={poll.options} onChange={setAddedDay} />}
            <p className={styles.help}>これまでの回答は残ります。追加した候補には、全員があらためて回答します。</p>
            <div className={styles.buttonRow}><PillButton variant="ghost" disabled={busy} onClick={() => setAdding(false)}>戻る</PillButton><PillButton type="submit" disabled={busy || !addedDay?.slots.length}>{busy ? '追加中…' : '候補を追加'}</PillButton></div>
          </form>}
      </section>}
    </>}
  </Frame>;
}

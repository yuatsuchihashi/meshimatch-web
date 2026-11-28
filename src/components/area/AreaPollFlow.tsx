'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Compass, Copy, MapPin, Star, UsersRound } from 'lucide-react';
import { shouldFindShop } from '@/lib/shop-plan';
import { sharedShopStage } from '@/lib/shared-shop-stage';
import { ShopStep } from '@/components/journey/ShopStep';
import { PillButton } from '@/components/v2';
import { commonAreaCandidates, summarizeArea, type AreaPoll } from '@/lib/area-poll';
import { meetingAreas, meetingCities, type MeetingCityId } from '@/lib/meeting-areas';
import { canConfirmDate, dateLabel, periodLabel, timezoneLabel, type SchedulePoll } from '@/lib/schedule';
import { areaCredentialsKey, areaErrorMessage, areaRequest, type AreaCredential, type AreaCredentials } from './area-client';
import { AccessSurvey, emptyTrip } from './AccessSurvey';
import { AccessCards } from './AccessCards';
import { readDeviceName } from '@/lib/device-profile';
import { parseTrip, suggestionLink } from '@/lib/area-access';
import styles from './AreaPollFlow.module.css';
import guest from './AreaParticipant.module.css';

type AreaView = { id: string; view?: string; person?: string };

function datePerson(poll: AreaPoll, person?: string): AreaCredential | undefined {
  if (!poll.scheduleId || poll.scheduleId !== poll.id) return;
  try {
    const saved = JSON.parse(localStorage.getItem(`meshimatch_schedule_v1_${poll.scheduleId}`) ?? '{}');
    const people: AreaCredential[] = Array.isArray(saved.responses) ? saved.responses : [];
    const eligible = people.filter(item => !poll.eligibleResponseIds || poll.eligibleResponseIds.includes(item.id));
    return person ? eligible.find(item => item.id === person) : eligible.find(item => !poll.responses.some(r => r.id === item.id));
  } catch { return; }
}

export function AreaPollFlow(props: AreaView) {
  return <AreaPollSession key={[props.id, props.view, props.person].join('/')} {...props} />;
}

function AreaPollSession({ id, view, person }: AreaView) {
  const router = useRouter();
  const preview = view === 'preview';
  const [poll, setPoll] = useState<AreaPoll | null>(null);
  const [schedule, setSchedule] = useState<SchedulePoll | null>(null);
  const [credentials, setCredentials] = useState<AreaCredentials>({ responses: [] });
  const [editing, setEditing] = useState<AreaCredential | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string[]>([]);
  const [cannotAttend, setCannotAttend] = useState(false);
  const [trip, setTrip] = useState(emptyTrip);
  const [viewer, setViewer] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [origin, setOrigin] = useState('');
  const [localDateIds, setLocalDateIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start' });
  }, [editing, step, poll?.selectedAreaId]);

  const refresh = useCallback(async () => {
    try {
      const data = await areaRequest(`/api/area-polls/${id}`);
      setPoll(current => current && current.updatedAt > data.poll.updatedAt ? current : data.poll);
      if (data.poll.scheduleId) {
        const response = await fetch(`/api/schedules/${data.poll.scheduleId}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? '日程を確認できませんでした。');
        const linked: SchedulePoll = result.poll;
        setSchedule(linked);
        try {
          const saved = JSON.parse(localStorage.getItem(`meshimatch_schedule_v1_${linked.id}`) ?? '{}');
          const ids = new Set(Array.isArray(saved.responses) ? saved.responses.map((entry: { id: string }) => entry.id) : []);
          setLocalDateIds(linked.responses.filter(response => ids.has(response.id)).map(response => response.id));
        } catch { setLocalDateIds([]); }
      }
      setError('');
      return data.poll;
    } catch (error) { setSchedule(null); setError(areaErrorMessage(error)); return null; }
  }, [id]);

  useEffect(() => {
    let active = true;
    setOrigin(window.location.origin);
    let remembered: AreaCredentials = { responses: [] };
    try {
      const raw = JSON.parse(localStorage.getItem(areaCredentialsKey(id)) ?? '{"responses":[]}');
      if (raw && Array.isArray(raw.responses)) remembered = {
        hostToken: typeof raw.hostToken === 'string' ? raw.hostToken : undefined,
        responses: raw.responses.filter((item: AreaCredential) => item && typeof item.id === 'string' && typeof item.token === 'string'),
      };
      if (preview) remembered = { responses: [] };
      setCredentials(remembered);
    } catch { setNotice('このブラウザでは編集情報を読み込めませんでした。'); }
    void refresh().then(latest => {
      if (!active || !latest) return;
      const fresh = (): AreaCredential => ({ id: crypto.randomUUID(), token: crypto.randomUUID(),
        name: !preview && !remembered.responses.length && latest.method !== 'access-demo' ? readDeviceName() : '' });
      if (preview) { setEditing(fresh()); return; }
      if (view === 'results' || latest.selectedAreaId || (remembered.hostToken && view !== 'answer')) return;
      const linked = datePerson(latest, person);
      const own = remembered.responses.find(item => latest.responses.some(response => response.id === item.id)
        && (!person || item.id === person));
      const personalShopSurvey = latest.shopPlan === 'adjust' && (!latest.scheduleId || latest.attendanceBased);
      if (own && (personalShopSurvey || view !== 'answer' || person)) return;
      if (!own && (latest.responses.length >= latest.expectedCount || (latest.attendanceBased && !linked))) return;
      const respondent = own ?? linked ?? fresh();
      const response = latest.responses.find(item => item.id === respondent.id);
      setEditing(respondent); setName(response?.name ?? respondent.name);
      setTrip(respondent.trip ? { anywhere: false, ...respondent.trip } : emptyTrip);
      setAllowed(response?.allowedAreaIds ?? []); setPreferred(response?.preferredAreaIds ?? []); setCannotAttend(response?.cannotAttend ?? false);
    });
    return () => { active = false; };
  }, [id, view, person, preview, refresh]);
  useEffect(() => {
    if (editing || busy) return;
    const update = () => { void refresh(); };
    const timer = window.setInterval(update, 10000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, [refresh, editing, busy]);

  async function openAnswer(credential?: AreaCredential) {
    const latest = await refresh();
    if (!latest || latest.selectedAreaId) return;
    const linked = datePerson(latest);
    if (!credential && latest.attendanceBased && !linked) return;
    const active: AreaCredential = credential ?? linked ?? { id: crypto.randomUUID(), token: crypto.randomUUID(),
      name: !preview && !credentials.responses.length && latest.method !== 'access-demo' ? readDeviceName() : '' };
    const response = latest.responses.find(response => response.id === active.id);
    setTrip(active.trip ? { anywhere: false, ...active.trip } : emptyTrip);
    setAllowed(response?.allowedAreaIds ?? []); setPreferred(response?.preferredAreaIds ?? []);
    setCannotAttend(response?.cannotAttend ?? false);
    setName(response?.name ?? active.name); setEditing(active); setStep(1); setNotice('');
  }
  function toggleAllowed(areaId: string) {
    const next = allowed.includes(areaId) ? allowed.filter(id => id !== areaId) : [...allowed, areaId];
    setAllowed(next); setPreferred(current => current.filter(id => next.includes(id))); setCannotAttend(false);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing || preview) return;
    setBusy(true); setError('');
    try {
      const submittedTrip = poll?.method ? parseTrip(shouldFindShop(schedule, poll) ? trip : { ...trip, suggestion: undefined }) : undefined;
      const remembered = { ...credentials, responses: [...credentials.responses.filter(item => item.id !== editing.id), { ...editing, name: name.trim(), trip: submittedTrip }] };
      localStorage.setItem(areaCredentialsKey(id), JSON.stringify(remembered));
      setCredentials(remembered);
      const data = await areaRequest(`/api/area-polls/${id}`, { action: 'respond', fromSchedule: Boolean(poll && datePerson(poll, editing.id)), responseId: editing.id, token: editing.token, name,
        allowedAreaIds: allowed, preferredAreaIds: preferred, cannotAttend, ...submittedTrip });
      setPoll(data.poll); setNotice('');
      const saved = data.poll.responses.find(response => response.id === editing.id);
      if (collectShop && saved && !saved.cannotAttend && (!data.poll.eligibleResponseIds || data.poll.eligibleResponseIds.includes(saved.id))) {
        router.push(`/shop/${id}?person=${encodeURIComponent(saved.id)}`);
        return;
      }
      setEditing(null);
      if (view !== 'results' || person !== editing.id) {
        router.replace(`/area/${id}?view=results&person=${encodeURIComponent(editing.id)}`, { scroll: false });
      }
    } catch (error) {
      await refresh();
      setError(areaErrorMessage(error));
    } finally { setBusy(false); }
  }
  async function manage(action: 'confirm' | 'reopen', areaId?: string) {
    setBusy(true); setError('');
    try {
      const data = await areaRequest(`/api/area-polls/${id}`, { action, token: credentials.hostToken, areaId });
      setPoll(data.poll); setNotice(action === 'confirm' ? '集まるエリアが決まりました！' : 'エリア調整を再開しました。');
    } catch (error) { await refresh(); setError(areaErrorMessage(error)); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(shareUrl); setNotice('招待リンクをコピーしました。'); }
    catch { setNotice('リンクを選択してコピーしてください。'); }
  }
  const frame = (children: React.ReactNode) => <main className={styles.screen}><div className={styles.shell}>
    <nav className={styles.nav}>
      {preview ? <Link href={poll?.scheduleId === id ? `/schedule/${id}?view=preview` : `/share/area/${id}`}><ArrowLeft size={17} />{poll?.scheduleId === id ? '日程のプレビューへ' : '共有画面へ'}</Link>
        : poll?.scheduleId ? <Link href={`/schedule/${poll.scheduleId}?view=results`}><ArrowLeft size={17} />日程調整へ</Link>
        : credentials.hostToken ? <Link href="/instant"><ArrowLeft size={17} />幹事の設定へ</Link> : <span />}
      {preview ? <span className={styles.brand}>meshimatch</span> : <Link href="/home" aria-label="meshimatch ホームへ" className={styles.brand}>meshimatch</Link>}
    </nav>
    {children}
  </div></main>;
  if (!poll) return frame(<section className={styles.panel}>{error ? <><p className={styles.error} role="alert">{error}</p><PillButton onClick={() => void refresh()}>もう一度読み込む</PillButton></> : <p role="status">エリア調整を読み込み中…</p>}</section>);

  const access = poll.method === 'access-demo';
  const city = meetingCities[poll.cityId as MeetingCityId]?.label ?? poll.cityId;
  const options = meetingAreas.filter(area => poll.areaIds.includes(area.id));
  const candidates = commonAreaCandidates(poll);
  const findShop = shouldFindShop(schedule, poll);
  const shopStage = sharedShopStage(schedule, poll);
  const visibleCandidates = showAll ? candidates : candidates.slice(0, 3);
  const selected = options.find(area => area.id === poll.selectedAreaId);
  const allAllowed = options.length > 0 && options.every(area => allowed.includes(area.id));
  const localResponses = credentials.responses.filter(item => poll.responses.some(response => response.id === item.id));
  const currentCredential = localResponses.find(item => item.id === person) ?? localResponses.at(-1);
  const personalTrip = localResponses.length === 1 ? currentCredential?.trip : localResponses.find(person => person.id === viewer)?.trip;
  const hasTravel = poll.accessOptions?.some(option => option.inboundRange != null);
  const complete = poll.responses.length === poll.expectedCount;
  const scheduledOption = schedule?.options.find(option => option.id === (poll.scheduleOptionId ?? schedule?.selectedOptionId));
  const scheduleChanged = Boolean(poll.scheduleId && schedule && ((poll.scheduleOptionId !== null && schedule.selectedOptionId !== poll.scheduleOptionId) || (!poll.attendanceBased && schedule.expectedCount !== poll.expectedCount)));
  const checkingSchedule = Boolean(poll.scheduleId && !schedule);
  const blocked = busy || scheduleChanged || checkingSchedule;
  const host = !preview && Boolean(credentials.hostToken);
  const myDateResponses = schedule?.responses.filter(item => localDateIds.includes(item.id) && (!person || item.id === person)) ?? [];
  const dateAnsweredHere = myDateResponses.some(item => schedule?.options.every(option => item.answers[option.id]));
  const answeredBoth = currentCredential && (poll.attendanceBased
    ? myDateResponses.some(item => item.id === currentCredential.id && schedule?.options.every(option => item.answers[option.id]))
    : dateAnsweredHere && myDateResponses.length === 1 && localResponses.length === 1);
  const pendingRoster = poll.attendanceBased && !poll.eligibleResponseIds;
  const needsDate = poll.attendanceBased && !datePerson(poll) && !currentCredential;
  const outsideRoster = Boolean(poll.eligibleResponseIds && myDateResponses.length && !myDateResponses.some(item => poll.eligibleResponseIds?.includes(item.id)));
  const invitePath = poll.scheduleId === poll.id ? `/share/schedule/${poll.id}` : `/share/area/${poll.id}`;
  const pendingDate = schedule && !schedule.selectedOptionId && !scheduleChanged;
  const shareSchedule = schedule?.placePlan === 'adjust' && schedule.areaPollId === poll.id;
  const shareUrl = origin + (shareSchedule ? `/schedule/${schedule.id}` : `/area/${poll.id}`);
  const remaining = poll.expectedCount - poll.responses.length;
  const extraSuggestions = (poll.suggestions ?? []).filter(suggestion =>
    !access || !complete || selected || !poll.accessOptions?.some(option => option.areaId === suggestion.areaId));
  const hostCanDecideDate = host && schedule?.options.some(option => canConfirmDate(schedule, option.id));
  const dateClosedToNewResponses = Boolean(schedule && schedule.responses.length >= schedule.expectedCount);
  const scheduleAction = hostCanDecideDate ? '日程を決める' : dateAnsweredHere || dateClosedToNewResponses ? '日程の回答を見る' : '日程に回答する';
  const dateHref = schedule ? `/schedule/${schedule.id}?view=${hostCanDecideDate || dateAnsweredHere || dateClosedToNewResponses || schedule.selectedOptionId ? 'results' : 'answer'}` : '';
  const collectShop = Boolean(shopStage && poll.shopPlan === 'adjust' && (!poll.scheduleId || poll.attendanceBased));
  const shopLabel = poll.mode === 'カフェ・軽食' ? 'カフェの希望' : 'レストランの希望';
  const continueShop = collectShop && !cannotAttend;
  const submitLabel = busy ? '保存中…' : continueShop ? `場所を保存して、${shopLabel}へ` : '場所の回答を保存する';
  const previewNext = <Link className={styles.primaryLink} href={continueShop ? `/shop/${id}?view=preview` : invitePath}>{continueShop ? `${shopLabel}の回答画面を見る` : 'プレビューを終える'}</Link>;

  return frame(<>
    <header className={styles.header}><span className={styles.eyebrow}><Compass size={17} />{schedule?.title ?? '集合エリアのアンケート'}</span>
      <h1 ref={headingRef} tabIndex={-1}>{editing ? access ? '集まる場所に希望はある？' : step === 1 ? 'どのあたりなら集まれる？' : cannotAttend ? 'みんなに、状況を伝えよう。' : 'その中で、行きたい場所は？' : selected ? `${selected.label}に決まりました` : outsideRoster && !host ? '今回は場所の回答は不要です' : complete && !pendingRoster ? '集まる街の候補' : answeredBoth ? '日程と場所の回答を受け付けました' : currentCredential ? '場所の回答を受け付けました' : 'どこで集まる？'}</h1>
      <div className={styles.meta}><span><MapPin size={15} />{city}</span><span><UsersRound size={15} />{poll.expectedCount}人</span>{findShop && <span>{poll.mode}</span>}</div>
      {scheduledOption && schedule && <Link className={styles.date} href={`/schedule/${schedule.id}?view=${preview ? 'preview' : 'results'}`}><CalendarDays size={14} />{dateLabel(scheduledOption.date)} · {periodLabel(scheduledOption)}<span>{timezoneLabel(schedule.timezone)}</span></Link>}
    </header>

    {preview && <div className={styles.notice}>参加者プレビュー · 回答は保存されません<Link href={invitePath}>共有画面へ</Link></div>}
    {editing && (shareSchedule || continueShop) && <p className={styles.eyebrow}>{shareSchedule ? (continueShop ? '2 / 3' : '2 / 2') : '1 / 2'}　場所{continueShop && ` → ${shopLabel}`}</p>}
    {notice && <p className={styles.notice} role="status"><Check size={17} />{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {scheduleChanged && <section className={styles.changed} role="alert"><h2>日程が変わっています</h2><p>この回答は、以前の日程のものです。新しい日程でエリアを調整しましょう。</p>
      <Link href={schedule?.selectedOptionId ? `/instant?schedule=${poll.scheduleId}` : `/schedule/${poll.scheduleId}`}>日程を確認する<ArrowRight size={15} /></Link></section>}
    {checkingSchedule && <p className={styles.help} role="status">日程を確認しています…</p>}

    {editing && (!selected || preview) && (!scheduleChanged || preview) && access ? <form className={`${styles.panel} ${styles.survey}`} onSubmit={save}>
      <AccessSurvey mode={findShop ? poll.mode : null} trip={trip} change={setTrip} />
      {preview ? previewNext : <div className={styles.formActions}><PillButton variant="ghost" disabled={busy} onClick={() => setEditing(null)}>回答状況を見る</PillButton><PillButton type="submit" disabled={blocked || (!trip.anywhere && (!trip.origin || !trip.onward)) || Boolean(findShop && trip.suggestion && !trip.suggestion.text.trim())}>{submitLabel}</PillButton></div>}
    </form> : editing && (!selected || preview) && (!scheduleChanged || preview) ? <form className={`${styles.panel} ${styles.survey}`} onSubmit={event => { if (step === 1) { event.preventDefault(); if (allowed.length || cannotAttend) setStep(2); } else void save(event); }}>
      <ol className={styles.steps}><li className={step === 1 ? styles.activeStep : ''}><span>1</span>行けるエリア</li><li className={step === 2 ? styles.activeStep : ''}><span>2</span>希望の場所</li></ol>
      {step === 1 ? <>
        <div className={styles.question}><h2>集まれるエリアをすべて選んでね</h2><p>今回、無理なく行ける場所を選んでください。</p><span className={styles.countPill}>{allowed.length}か所選択</span></div>
        <button type="button" className={styles.anywhere} aria-pressed={allAllowed} onClick={() => { setAllowed(allAllowed ? [] : [...poll.areaIds]); setCannotAttend(false); if (allAllowed) setPreferred([]); }}><Check size={16} />この一覧のエリアなら、どこでも大丈夫</button>
        <fieldset className={styles.choicesField}><legend className={styles.srOnly}>行けるエリア（複数選択）</legend><div className={styles.areaGrid}>
          {options.map(area => <button key={area.id} type="button" className={`${styles.areaChoice} ${allowed.includes(area.id) ? styles.allowedChoice : ''}`}
            aria-pressed={allowed.includes(area.id)} onClick={() => toggleAllowed(area.id)}><MapPin size={17} strokeWidth={1.6} /><span>{area.label}</span><span className={styles.choiceCheck} aria-hidden="true">{allowed.includes(area.id) && <Check size={14} />}</span></button>)}
        </div></fieldset>
        <button type="button" className={styles.noneChoice} aria-pressed={cannotAttend} onClick={() => { setCannotAttend(!cannotAttend); setAllowed([]); setPreferred([]); }}>この一覧に行けるエリアがない</button>
        <p className={styles.help}>選んでいないエリアを、行ける場所として扱うことはありません。</p>
        <div className={styles.formActions}><PillButton variant="ghost" disabled={busy} onClick={() => setEditing(null)}>一覧へ戻る</PillButton><PillButton type="submit" disabled={(!allowed.length && !cannotAttend) || blocked}>次へ<ArrowRight size={16} /></PillButton></div>
      </> : <>
        {cannotAttend ? <div className={styles.noneSummary}><Compass size={26} strokeWidth={1.5} /><h2>行けるエリアがない、と伝えます</h2><p>無理に選ばなくて大丈夫。みんなの回答を見て、別の場所も相談しましょう。</p></div> : <>
        <div className={styles.question}><h2>特に行きたいところはある？</h2><p>あれば2つまで。希望がなければ、そのままでOK。</p><span className={styles.countPill}>任意 · {preferred.length}/2</span></div>
        <fieldset className={styles.choicesField}><legend className={styles.srOnly}>特に行きたいエリア（任意・2つまで）</legend><div className={styles.areaGrid}>
          {options.filter(area => allowed.includes(area.id)).map(area => <button key={area.id} type="button"
            className={`${styles.areaChoice} ${preferred.includes(area.id) ? styles.preferredChoice : ''}`} aria-pressed={preferred.includes(area.id)}
            disabled={preferred.length >= 2 && !preferred.includes(area.id)} onClick={() => setPreferred(current => current.includes(area.id) ? current.filter(id => id !== area.id) : [...current, area.id])}>
            <Star size={17} strokeWidth={1.6} /><span>{area.label}</span><span className={styles.choiceCheck} aria-hidden="true">{preferred.includes(area.id) && <Check size={14} />}</span></button>)}
        </div></fieldset>
        <button type="button" className={styles.textButton} onClick={() => setPreferred([])}>特にこだわりはない</button></>}
        <label className={styles.nameField}>表示名 <span>任意</span><input maxLength={40} value={name} placeholder="未入力でも回答できます" onChange={event => setName(event.target.value)} /></label>
        <p className={styles.help}>エリアの回答と希望は、参加者みんなに共有されます。</p>
        <div className={styles.formActions}><PillButton variant="ghost" disabled={busy} onClick={() => setStep(1)}>戻る</PillButton>{preview ? previewNext : <PillButton type="submit" disabled={(!allowed.length && !cannotAttend) || blocked}>{submitLabel}</PillButton>}</div>
      </>}
    </form> : <>
      {selected && <section className={styles.decided}><span className={styles.decidedIcon}><Check size={27} /></span><div>
        <strong>{pendingDate ? '日程を調整中です' : '集合エリアが決定しました'}</strong>
        {pendingDate && <p>日程の回答状況は、引き続き同じリンクから確認できます。</p>}
      </div>
        {pendingDate ? <Link className={styles.primaryLink} href={`/schedule/${schedule.id}`}>{scheduleAction}<ArrowRight size={17} /></Link>
          : !shopStage && findShop && host && !blocked && !poll.scheduleId ? <Link className={styles.primaryLink} href={`/instant?area=${poll.id}${poll.scheduleId ? `&schedule=${poll.scheduleId}` : ''}`}>この端末でお店選びを始める<ArrowRight size={17} /></Link> : null}
        {credentials.hostToken && <button type="button" className={styles.textButton} disabled={blocked} onClick={() => void manage('reopen')}>エリアを見直す</button>}
      </section>}
      {shopStage && !blocked && !preview && <ShopStep {...shopStage} person={person} />}
      {outsideRoster && !host && !selected && <section className={guest.nextAction}>
        <p>集合エリアは、決定した日程に○を付けた{poll.expectedCount}人で調整しています。</p>
        <Link className={guest.inlineLink} href={dateHref}>日程の回答を見る<ArrowRight size={16}/></Link>
      </section>}
      {!selected && (!outsideRoster || host) && <>
        {(!complete || pendingRoster) && <section className={guest.nextAction}>
          <div className={guest.progressInfo}>
            <strong>{poll.responses.length} / {poll.expectedCount}人が場所に回答</strong>
            <div className={styles.progress}><span style={{ width: `${poll.responses.length / poll.expectedCount * 100}%` }} /></div>
          </div>
          {currentCredential?.trip?.anywhere && <span className={guest.savedChoice}><Check size={15}/>場所の希望：どこでも大丈夫</span>}
          {pendingRoster && (currentCredential || complete)
            ? <p>{hostCanDecideDate ? '日程を選ぶと、その日に参加する人の回答から街を絞れます。' : '幹事が日程を決めたら、その日に参加する人の回答から街を絞ります。'}</p>
            : currentCredential ? <p>あと{remaining}人が場所に回答すると、街の候補がここに表示されます。</p>
            : !needsDate && <p>{access ? '場所をみんなに合わせるか、行きやすい駅を伝えるか選べます。' : '今回、集まれるエリアを教えてください。'}</p>}
          {!complete && !currentCredential && !needsDate && <PillButton variant="cta" disabled={blocked} onClick={() => void openAnswer()}>場所のアンケートに回答する<ArrowRight size={16} /></PillButton>}
          {needsDate && !complete && (pendingRoster && !dateClosedToNewResponses
            ? <Link className={guest.inlineLink} href={dateHref}>先に日程に回答する<ArrowRight size={16}/></Link>
            : <p>{pendingRoster ? '日程に回答したブラウザから、場所の希望を伝えられます。' : '決定した日程に○を付けた方は、日程に回答したブラウザから場所を回答できます。'}</p>)}
          {pendingDate && (currentCredential || complete || hostCanDecideDate) && <Link className={hostCanDecideDate || !dateAnsweredHere ? styles.primaryLink : guest.inlineLink} href={dateHref}>{scheduleAction}<ArrowRight size={16}/></Link>}
        </section>}
        {complete && pendingDate && !pendingRoster && !host && <Link className={guest.inlineLink} href={dateHref}><CalendarDays size={16} />{scheduleAction}<ArrowRight size={15} /></Link>}
        {complete && !pendingRoster && (access ? <section className={styles.candidates} aria-label="エリアの比較"><p className={guest.resultHelp}>{!hasTravel && poll.accessOptions?.length ? '全員が「どこでも大丈夫」と回答しました。幹事が集まる街を選べます。' : host ? (findShop ? '移動時間とお店を見比べて、集まる街を選んでください。' : 'みんなの移動時間を見比べて、集まる街を選んでください。') : '全員の回答がそろいました。幹事が街を選ぶと、ここに表示されます。'}</p>
            {hasTravel && localResponses.length > 1 && <label className={styles.tripField}>自分の移動時間を見る<select value={viewer} onChange={e => setViewer(e.target.value)}><option value="">参加者を選ぶ</option>{localResponses.filter(p => p.trip && !p.trip.anywhere).map(p => <option key={p.id} value={p.id}>{poll.responses.find(r => r.id === p.id)?.name}</option>)}</select></label>}
            <AccessCards options={poll.accessOptions ?? []} suggestions={poll.suggestions ?? []} trip={personalTrip}
              canConfirm={Boolean(credentials.hostToken)} disabled={blocked} confirm={areaId => void manage('confirm', areaId)} /></section>
          : candidates.length ? <section className={styles.candidates}><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>全員の「行ける」が重なった場所</span><h2>みんなが集まれるエリア</h2></div><span className={styles.countPill}>{candidates.length}候補</span></div>
            <div className={styles.candidateGrid}>{visibleCandidates.map(candidate => {
              const area = options.find(area => area.id === candidate.areaId)!;
              return <article className={styles.candidateCard} key={area.id}><span className={styles.okBadge}><Check size={13} />全員OK</span><MapPin className={styles.candidateIcon} size={25} strokeWidth={1.5} /><h3>{area.label}</h3>
                <p>{candidate.preferenceCount ? <><Star size={14} />{candidate.preferenceCount}人が「行きたい」</> : 'みんなが行けるエリア'}</p>
                {credentials.hostToken ? <button type="button" disabled={blocked} onClick={() => void manage('confirm', area.id)}>このエリアに決める<ArrowRight size={15} /></button> : <small>幹事がエリアを決定します</small>}
              </article>;
            })}</div>
            {candidates.length > 3 && <button type="button" className={styles.textButton} onClick={() => setShowAll(!showAll)}>{showAll ? '候補を3つにまとめる' : `ほかの共通候補も見る（${candidates.length - 3}件）`}</button>}
            <p className={styles.help}>全員が選んだエリアだけを表示し、希望の多い順に並べています。</p>
          </section> : <section className={styles.conflict}><span className={styles.waitingIcon}><Compass size={27} strokeWidth={1.5} /></span><h2>全員に共通するエリアが、まだありません</h2><p>行ける場所が分かれています。下の回答一覧を見ながら、みんなで相談してみよう。</p>
            {currentCredential && <PillButton variant="ghost" disabled={blocked} onClick={() => void openAnswer(currentCredential)}>行けるエリアを見直す</PillButton>}
          </section>)}
      </>}
      {!selected && localResponses.length > 0 && <div className={guest.editActions}>
        {localResponses.map(credential => <button type="button" className={styles.textButton} key={credential.id} disabled={blocked} onClick={() => void openAnswer(credential)}>
          {localResponses.length === 1 ? '自分の回答を編集' : `${poll.responses.find(response => response.id === credential.id)?.name}の回答を編集`}</button>)}
        {!collectShop && !complete && (!poll.attendanceBased || datePerson(poll)) && <button type="button" className={styles.textButton} disabled={blocked} onClick={() => void openAnswer()}>同じ端末で次の人が回答</button>}
      </div>}
      {!complete && !selected && <details className={guest.share} open={host ? true : undefined}>
        <summary>参加者を招待する</summary>
        <div className={guest.shareContent}>
          {host && <Link href={invitePath}>共有画面を見る</Link>}
          {collectShop ? <p>各自の端末で、{shareSchedule ? '日程、場所、' : '場所と'}{shopLabel}を続けて回答できます。</p> : shareSchedule && <p>このリンクから、日程と場所の両方に回答できます。</p>}
          <div className={styles.shareActions}><input aria-label="招待リンク" readOnly value={shareUrl} onFocus={event => event.target.select()} />
            <button type="button" disabled={checkingSchedule || !origin} onClick={() => void copy()}><Copy size={16} />リンクをコピー</button></div>
        </div>
      </details>}
      {findShop && !!extraSuggestions.length && <section className={styles.panel}><h2>みんなのおすすめ</h2><ul>{extraSuggestions.map((item, index) => {
        const href = suggestionLink(item.text);
        const area = options.find(a => a.id === item.areaId);
        return <li key={index}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">お店のリンクを開く</a> : item.text}{area && `（${area.label}）`}</li>;
      })}</ul></section>}
      {!access && <section className={styles.panel}><div className={styles.sectionHeader}><h2>みんなの回答一覧</h2><span className={styles.tableHint}>横にスクロールできます</span></div>
        <div className={styles.legend}><span><Check size={14} />行ける</span><span><Star size={14} />特に行きたい</span><span>— 選択なし</span></div>
        {poll.responses.length ? <div className={styles.tableScroll}><table className={styles.table}><caption className={styles.srOnly}>{city}のエリア別の回答一覧</caption><thead><tr><th scope="col">エリア</th>{poll.responses.map(response => <th key={response.id} scope="col" title={response.name}>{response.name}{response.cannotAttend && <small>行ける候補なし</small>}</th>)}<th scope="col">行ける人数</th></tr></thead>
          <tbody>{options.map(area => <tr key={area.id}><th scope="row">{area.label}</th>{poll.responses.map(response => {
            const canGo = response.allowedAreaIds.includes(area.id); const wantsTo = response.preferredAreaIds.includes(area.id);
            return <td key={response.id} aria-label={`${response.name} ${wantsTo ? '行ける・特に行きたい' : canGo ? '行ける' : '選択なし'}`} className={canGo ? styles.allowedCell : ''}>{wantsTo ? <Star size={18} /> : canGo ? <Check size={19} /> : '—'}</td>;
          })}<td className={styles.totalCell}>{summarizeArea(poll, area.id).allowedCount}/{poll.expectedCount}</td></tr>)}</tbody></table></div>
          : <p className={styles.help}>まだ回答がありません。自分の行けるエリアを回答してみよう。</p>}
        <p className={styles.help}>移動時間の自動計算ではなく、本人が回答した「行けるエリア」をもとに集計しています。</p>
      </section>}
    </>}
    {access && <p className={guest.demo}>{findShop ? '東京版サンプル · 移動時間と店舗データは架空です。' : '東京版サンプル · 移動時間は架空です。'}</p>}
  </>);
}

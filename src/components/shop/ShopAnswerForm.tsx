'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CafeSurvey } from '@/components/instant/CafeSurvey';
import { RestaurantSurvey } from '@/components/instant/RestaurantSurvey';
import { readDeviceName, maxDeviceNameLength } from '@/lib/device-profile';
import { freshAnswer, type DiscoveryAnswer } from '@/lib/instant/discovery';
import type { ShopPoll } from '@/lib/shop-poll';
import { errorText, requestShopPoll, standaloneVoter, type VoterKey } from './shop-client';
import css from './shop.module.css';

export function ShopAnswerForm({ poll, voter, name, onBack, onSaved, refresh }: {
  poll: ShopPoll; voter?: VoterKey; name?: string; onBack: () => void; onSaved: (poll: ShopPoll) => void; refresh: () => void;
}) {
  const { id, contextKey } = poll;
  const responseId = voter?.id;
  const token = voter?.token;
  const [draft, setDraft] = useState<DiscoveryAnswer | null>(() => voter ? null : freshAnswer());
  const [displayName, setDisplayName] = useState(readDeviceName);
  const nameInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    if (!responseId || !token) return;
    let active = true;
    requestShopPoll(id, { action: 'mine', responseId, token, contextKey }).then(({ answer }) => {
      if (active) { setDraft(answer ?? freshAnswer()); setError(''); }
    }).catch(reason => { if (active) setError(errorText(reason)); });
    return () => { active = false; };
  }, [id, contextKey, responseId, token, attempt]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || submitting.current) return;
    if (!voter && !displayName.trim()) {
      setError('回答に使う名前を入力してください。');
      nameInput.current?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const identity = voter ?? standaloneVoter(id);
      const data = await requestShopPoll(id, { action: 'respond', contextKey, responseId: identity.id, token: identity.token,
        ...(!voter ? { name: displayName.trim() } : {}), answer: draft });
      onSaved(data.poll);
    } catch (reason) {
      setError(errorText(reason));
      refresh();
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const Survey = poll.config.mode === '食事' ? RestaurantSurvey : CafeSurvey;
  return <section>
    {poll.pendingArea && <p className={css.step}>{poll.scheduleId ? '3 / 3　日程 → 場所 → ' : '2 / 2　場所 → '}{poll.config.mode === '食事' ? 'レストラン' : 'カフェ'}</p>}
    <div className={css.sectionHeading}><h2>{name ? name + 'さんの希望' : 'あなたのお店の希望'}</h2>
      <button className={css.textButton} onClick={onBack} disabled={saving}>集まりに戻る</button>
    </div>
    {!voter && <label className={css.nameField}>回答に使う名前
      <input ref={nameInput} value={displayName} maxLength={maxDeviceNameLength} autoComplete="nickname"
        placeholder="ニックネームでもOK" required disabled={saving} onChange={event => setDisplayName(event.target.value)}/>
    </label>}
    <p className={css.formNote}>希望は非公開です。参加者には名前と回答状況が表示されます。</p>
    {error && <p role="alert" className={css.error}>{error}{!draft && <button onClick={() => setAttempt(value => value + 1)}>もう一度読み込む</button>}</p>}
    {draft ? <fieldset className={css.survey} disabled={saving}><Survey lastPerson config={poll.config} pendingArea={poll.pendingArea} draft={draft}
      onChange={setDraft} onSubmit={save} submitLabel={saving ? '送信中…' : 'お店の希望を送信する'}/></fieldset> : !error && <p role="status">回答を準備しています…</p>}
  </section>;
}

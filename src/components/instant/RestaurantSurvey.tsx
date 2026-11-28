'use client';

import { useState } from 'react';
import { PillButton } from '@/components/v2';
import { SurveyChoices } from './SurveyChoices';
import {
  surveyCurrency, restaurantGenres, availableRestaurantGenres, firstGenres,
  dietLabels, heatOptions, restaurantNoiseLabels, restaurantVenuePreferenceLabels, freshRestaurantPreferences,
  type DiscoveryAnswer, type DiscoveryConfig,
} from '@/lib/instant/discovery';
import type { ShopPoll } from '@/lib/shop-poll';
import styles from '@/app/instant/instant.module.css';
import extra from './DiscoveryFlow.module.css';

function toggled(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}

export function RestaurantSurvey({ draft, config, pendingArea, lastPerson, submitLabel, onChange, onSubmit }: {
  draft: DiscoveryAnswer; config: DiscoveryConfig; pendingArea?: ShopPoll['pendingArea']; lastPerson: boolean; submitLabel?: string;
  onChange: (answer: DiscoveryAnswer) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [step, setStep] = useState(0);
  const preferences = draft.restaurant ?? freshRestaurantPreferences();
  const available = availableRestaurantGenres(config, draft, pendingArea?.areaIds);
  const previous = restaurantGenres.filter(genre => preferences.genres.includes(genre.id) && !available.includes(genre));
  const first = firstGenres(available);
  const rest = available.filter(genre => !first.some(item => item.id === genre.id));
  const labels = (items: typeof first) => Object.fromEntries(items.map(genre => [genre.id, genre.label]));
  function toggleGenre(id: string) {
    const selected = toggled(preferences.genres, id);
    onChange({ ...draft, restaurant: { ...preferences, genres: selected,
      important: preferences.important.filter(key => Object.hasOwn(restaurantVenuePreferenceLabels, key) || selected.includes(key)),
    } });
  }
  return <form className={`${styles.panel} ${styles.stack}`} onSubmit={event => {
    if (step < 2) {
      event.preventDefault();
      onChange({ ...draft, restaurant: preferences });
      setStep(step + 1);
    } else onSubmit(event);
  }}>
    <p className={extra.step}>質問 {step + 1} / 3 · すべて任意</p>
    {step === 0 && <>
      <SurveyChoices title="どんな料理が気になる？" options={labels(first)}
        selected={preferences.genres} onChange={toggleGenre} />
      {rest.length > 0 && <details className={extra.details}><summary>ほかのジャンルを見る（{rest.length}）</summary>
        <SurveyChoices title="ほかのジャンル" options={labels(rest)} selected={preferences.genres} onChange={toggleGenre} />
      </details>}
      {previous.length > 0 && <SurveyChoices title="選択済みの希望（現在の条件では該当店なし）"
        options={labels(previous)} selected={preferences.genres} onChange={toggleGenre} />}
      <p className={extra.note}>{pendingArea ? '候補エリアにあるジャンルから、いくつでも選べます。' : 'いくつでも選べます。料理はお店で決めても大丈夫。'}</p>
      {!available.length && <p className={extra.note}>今の条件に合う料理が見つかりません。</p>}
      {restaurantGenres.filter(genre => preferences.genres.includes(genre.id)).map(genre => <section key={genre.id} className={extra.followup}>
        <h2 className={styles.sectionTitle}>{genre.label}</h2>
        <SurveyChoices title="どのくらい食べたい？" options={{ nice: '気になる', important: '今回はこれが食べたい' }}
          selected={preferences.important.includes(genre.id) ? 'important' : 'nice'} onChange={strength => onChange({ ...draft, restaurant: {
            ...preferences, important: strength === 'important'
              ? [...new Set([...preferences.important, genre.id])]
              : preferences.important.filter(key => key !== genre.id),
          } })} />
      </section>)}
      <PillButton variant="cta" onClick={() => { onChange({ ...draft, restaurant: preferences }); setStep(1); }}>次へ</PillButton>
      <PillButton variant="ghost" onClick={() => {
        onChange({ ...draft, restaurant: { ...preferences, genres: [], details: {},
          important: preferences.important.filter(key => Object.hasOwn(restaurantVenuePreferenceLabels, key)),
        } });
        setStep(1);
      }}>料理はおまかせで進む</PillButton>
    </>}
    {step === 1 && <>
      <SurveyChoices title="どんなお店がいい？" options={restaurantVenuePreferenceLabels}
        selected={preferences.important.filter(key => Object.hasOwn(restaurantVenuePreferenceLabels, key))}
        onChange={key => onChange({ ...draft, restaurant: { ...preferences, important: toggled(preferences.important, key) } })} />
      <p className={extra.note}>重視したいことを、いくつでも選べます。</p>
      {preferences.important.includes('noise') && <section className={extra.followup}>
        <SurveyChoices title="どんなにぎやかさがいい？" options={restaurantNoiseLabels}
          selected={preferences.noisePreferences ?? []} onChange={value => onChange({ ...draft, restaurant: {
            ...preferences, noisePreferences: toggled(preferences.noisePreferences ?? [], value),
          } })} />
        <p className={extra.note}>許容できるものを複数選べます。</p>
        <PillButton variant="ghost" onClick={() => onChange({ ...draft, restaurant: {
          ...preferences, noisePreferences: [], important: preferences.important.filter(key => key !== 'noise'),
        } })}>にぎやかさはおまかせ</PillButton>
      </section>}
      {preferences.important.includes('wait') && <p className={extra.note}>入店までの待ち時間の目安が短いお店を優先します。</p>}
      {preferences.important.includes('rating') && <details className={extra.details}>
        <summary>口コミ評価の比較方法</summary>
        <p className={extra.note}>星の平均と口コミ件数を使います。件数が少ない評価ほど基準値に寄せて比較します。</p>
        <p className={extra.note}>基準値は星4.2・30件相当という試作用の仮設定です。</p>
      </details>}
      <PillButton variant="cta" onClick={() => setStep(2)}>次へ</PillButton>
      <PillButton variant="ghost" onClick={() => {
        onChange({ ...draft, restaurant: { ...preferences,
          important: preferences.important.filter(key => !Object.hasOwn(restaurantVenuePreferenceLabels, key)),
        } });
        setStep(2);
      }}>お店はおまかせで進む</PillButton>
      <PillButton variant="ghost" onClick={() => setStep(0)}>戻る</PillButton>
    </>}
    {step === 2 && <>
      <h2 className={styles.restaurantName}>予算・外せない条件は？</h2>
      <label className={extra.fields}>料理の予算（1人分・{surveyCurrency(config, pendingArea?.cityId)}）
        <input className={styles.input} type="number" min="1" step="1" inputMode="numeric" value={draft.budget}
          placeholder="指定なし" onChange={event => onChange({ ...draft, budget: event.target.value, restaurant: preferences })} />
      </label>
      <details className={extra.details}><summary>食事制限を追加</summary>
        <SurveyChoices title="食べられる料理の条件（複数可）" options={dietLabels}
          selected={draft.diet} onChange={key => onChange({ ...draft, diet: toggled(draft.diet, key), restaurant: preferences })} />
      </details>
      <details className={extra.details}><summary>食べられる辛さを指定</summary>
        <SurveyChoices title="どの辛さまで食べられる？" options={heatOptions}
          selected={draft.heat} onChange={key => onChange({ ...draft, heat: draft.heat === key ? '' : key, restaurant: preferences })} />
      </details>
      <PillButton variant="cta" type="submit">{submitLabel ?? (lastPerson ? '回答を隠して候補を見る' : '回答を隠して次の人へ')}</PillButton>
      <PillButton variant="ghost" onClick={() => setStep(1)}>戻る</PillButton>
    </>}
  </form>;
}

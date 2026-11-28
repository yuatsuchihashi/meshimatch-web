'use client';

import { useState } from 'react';
import { PillButton } from '@/components/v2';
import { SurveyChoices as CafeChoices, AtmosphereChoices } from './SurveyChoices';
import {
  surveyCurrency, dietLabels, cafeDetailLabels, cafePlanLabels,
  freshCafePreferences, venuePreferenceLabels as venueLabels, type DiscoveryAnswer, type DiscoveryConfig,
} from '@/lib/instant/discovery';
import type { ShopPoll } from '@/lib/shop-poll';
import styles from '@/app/instant/instant.module.css';
import extra from './DiscoveryFlow.module.css';

const foodLabels: Record<string, string> = { dessert: 'スイーツ', light: '軽食' };

function toggled(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}

export function CafeSurvey({ draft, config, pendingArea, lastPerson, submitLabel, onChange, onSubmit }: {
  draft: DiscoveryAnswer; config: DiscoveryConfig; pendingArea?: ShopPoll['pendingArea']; lastPerson: boolean; submitLabel?: string;
  onChange: (answer: DiscoveryAnswer) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [step, setStep] = useState(0);
  const cafe = draft.cafe ?? freshCafePreferences();
  function toggleFood(value: string) {
    if (value === 'later' || value === 'none') {
      onChange({ ...draft, cafe: { ...cafe,
        interests: cafe.interests.filter(key => !Object.hasOwn(foodLabels, key)),
        important: cafe.important.filter(key => !Object.hasOwn(foodLabels, key)),
        undecided: value === 'later' ? [...new Set([...cafe.undecided, 'food'])] : cafe.undecided.filter(key => key !== 'food'),
        foodDecision: value === 'later' ? 'onsite' : 'none',
      } });
      return;
    }
    const interests = toggled(cafe.interests, value);
    onChange({ ...draft, cafe: { ...cafe, interests,
      important: cafe.important.filter(key => !Object.hasOwn(foodLabels, key) || interests.includes(key)),
      undecided: cafe.undecided.filter(key => key !== 'food'),
      foodDecision: interests.some(key => Object.hasOwn(foodLabels, key)) ? 'selected' : 'unspecified',
    } });
  }
  function toggleVenue(value: string) {
    onChange({ ...draft, cafe: { ...cafe,
      interests: cafe.interests.filter(key => key !== value),
      important: toggled(cafe.important, value),
    } });
  }
  function toggleDetail(key: string, value: string) {
    const details = toggled(cafe.details[key] ?? [], value);
    onChange({ ...draft, cafe: { ...cafe, details: { ...cafe.details, [key]: details },
      undecided: cafe.undecided.filter(item => item !== key) } });
  }
  function decideLater(key: string) {
    const undecided = toggled(cafe.undecided, key);
    onChange({ ...draft, cafe: { ...cafe, undecided,
      details: { ...cafe.details, [key]: [] } } });
  }
  const foodSelection = cafe.interests.filter(key => Object.hasOwn(foodLabels, key));
  if (cafe.foodDecision === 'none') foodSelection.push('none');
  if (cafe.foodDecision === 'onsite') foodSelection.push('later');
  return <form className={`${styles.panel} ${styles.stack}`} onSubmit={event => {
    if (step < 2) { event.preventDefault(); setStep(step + 1); }
    else onSubmit(event);
  }}>
    <p className={extra.step}>質問 {step + 1} / 3 · すべて任意</p>
    {step === 0 && <>
      <CafeChoices title="何か食べたいものはある？"
        options={{ ...foodLabels, later: 'お店で決めたい', none: '今は特になし' }}
        selected={foodSelection} onChange={toggleFood} />
      {cafe.interests.filter(key => Object.hasOwn(foodLabels, key)).map(key => <section key={key} className={extra.followup}>
        <CafeChoices title={`${foodLabels[key]}、気になるものは？`}
          options={cafeDetailLabels[key]} selected={cafe.details[key] ?? []} onChange={value => toggleDetail(key, value)} />
        <button type="button" className={`${styles.answerChip} ${cafe.undecided.includes(key) ? styles.answerChipSelected : ''}`}
          aria-pressed={cafe.undecided.includes(key)} onClick={() => decideLater(key)}>お店で決めたい</button>
        <CafeChoices title="どのくらい食べたい？" options={{ nice: 'あればうれしい', important: '食べたい' }}
          selected={cafe.important.includes(key) ? 'important' : 'nice'} onChange={value => onChange({ ...draft, cafe: {
            ...cafe, important: value === 'important' ? [...new Set([...cafe.important, key])] : cafe.important.filter(item => item !== key),
          } })} />
      </section>)}
      <PillButton variant="cta" onClick={() => { onChange({ ...draft, cafe }); setStep(1); }}>次へ</PillButton>
    </>}
    {step === 1 && <>
      <CafeChoices title="どんなお店がいい？" options={venueLabels}
        selected={cafe.important.filter(key => Object.hasOwn(venueLabels, key))} onChange={toggleVenue} />
      <p className={extra.note}>重視したいことを、いくつでも選べます。</p>
      {cafe.important.includes('atmosphere') && <section className={extra.followup}>
        <AtmosphereChoices selected={cafe.details.atmosphere ?? []}
          onChange={value => toggleDetail('atmosphere', value)} />
        <button type="button" className={`${styles.answerChip} ${cafe.undecided.includes('atmosphere') ? styles.answerChipSelected : ''}`}
          aria-pressed={cafe.undecided.includes('atmosphere')} onClick={() => decideLater('atmosphere')}>候補を見て決めたい</button>
      </section>}
      <PillButton variant="cta" onClick={() => setStep(2)}>次へ</PillButton>
      <PillButton variant="ghost" onClick={() => {
        onChange({ ...draft, cafe: { ...cafe,
          interests: cafe.interests.filter(key => !Object.hasOwn(venueLabels, key)),
          important: cafe.important.filter(key => !Object.hasOwn(venueLabels, key)),
        } });
        setStep(2);
      }}>お店はおまかせで進む</PillButton>
      <PillButton variant="ghost" onClick={() => setStep(0)}>戻る</PillButton>
    </>}
    {step === 2 && <>
      <h2 className={styles.restaurantName}>予算・外せない条件は？</h2>
      <label className={extra.fields}>自分の注文の予算（1人分・{surveyCurrency(config, pendingArea?.cityId)}）
        <input className={styles.input} type="number" min="1" step="1" inputMode="numeric" value={draft.budget}
          placeholder="指定なし" onChange={event => onChange({ ...draft, budget: event.target.value, cafe })} />
      </label>
      <details className={extra.details}><summary>予算の計算に、食べ物も含めたい</summary>
        <CafeChoices title="今考えている注文（任意）" options={cafePlanLabels}
          selected={cafe.plan} onChange={plan => onChange({ ...draft, cafe: { ...cafe, plan } })} />
        <p className={extra.note}>「まだ決めない」なら、予算内の注文例を候補で比べられます。</p>
      </details>
      <details className={extra.details}><summary>食事制限を追加</summary>
        <CafeChoices title="食べられるものの条件（複数可）" options={dietLabels}
          selected={draft.diet} onChange={value => onChange({ ...draft, diet: toggled(draft.diet, value), cafe })} />

      </details>
      <PillButton variant="cta" type="submit">{submitLabel ?? (lastPerson ? '回答を隠して候補を見る' : '回答を隠して次の人へ')}</PillButton>
      <PillButton variant="ghost" onClick={() => setStep(1)}>戻る</PillButton>
    </>}
  </form>;
}

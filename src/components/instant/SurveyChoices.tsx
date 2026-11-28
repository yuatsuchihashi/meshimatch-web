'use client';

import { cafeDetailLabels } from '@/lib/instant/discovery';
import styles from '@/app/instant/instant.module.css';
import extra from './DiscoveryFlow.module.css';

export function SurveyChoices({ title, options, selected, onChange }: {
  title: string; options: Record<string, string>; selected: string | string[];
  onChange: (value: string) => void;
}) {
  return <fieldset className={extra.fieldset}><legend>{title}</legend>
    <div className={styles.choiceChipGrid}>
      {Object.entries(options).map(([value, label]) => {
        const active = Array.isArray(selected) ? selected.includes(value) : selected === value;
        return <button key={value} type="button" aria-pressed={active}
          className={`${styles.answerChip} ${extra.choice} ${active ? styles.answerChipSelected : ''}`}
          onClick={() => onChange(value)}>{label}</button>;
      })}
    </div>
  </fieldset>;
}

const atmospherePhotoPositions: Record<string, { left: string; top: string }> = {
  green: { left: '0', top: '0' },
  bright: { left: '-100%', top: '0' },
  classic: { left: '0', top: '-100%' },
  modern: { left: '-100%', top: '-100%' },
};

export function AtmosphereChoices({ selected, onChange }: {
  selected: string[]; onChange: (value: string) => void;
}) {
  return <fieldset className={extra.fieldset}>
    <legend>どんな空間が気になる？</legend>
    <div className={extra.atmosphereGrid}>
      {Object.entries(cafeDetailLabels.atmosphere).map(([value, label]) => {
        const active = selected.includes(value);
        return <button key={value} type="button" aria-pressed={active}
          className={`${extra.atmosphereChoice} ${active ? extra.atmosphereSelected : ''}`}
          onClick={() => onChange(value)}>
          <span className={extra.atmospherePhoto}>
            {/* A shared contact sheet keeps all four photographic choices in one local asset. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/cafe/atmosphere-references.png" alt="" loading="lazy" decoding="async"
              width={1536} height={1024} className={extra.atmosphereImage}
              style={atmospherePhotoPositions[value]} />
          </span>
          <span className={extra.atmosphereLabel}>{label}{active && <span aria-hidden="true"> ✓</span>}</span>
        </button>;
      })}
    </div>
    <p className={extra.note}>雰囲気を選ぶための参考イメージです（AI生成）。複数選べます。</p>
  </fieldset>;
}


import { ArrowRight } from 'lucide-react';
import { suggestionLink, tripMinutes, type AccessOption, type AccessTrip, type ShopSuggestion } from '@/lib/area-access';
import { meetingAreas } from '@/lib/meeting-areas';
import styles from './AccessCards.module.css';

export function AccessCards({ options, suggestions, trip, canConfirm, disabled, confirm }: {
  options: AccessOption[]; suggestions: ShopSuggestion[]; trip?: AccessTrip;
  canConfirm: boolean; disabled: boolean; confirm: (areaId: string) => void;
}) {
  return <>
    <div className={styles.grid}>{options.map(option => {
      const leg = trip && tripMinutes(trip, option.areaId);
      const range = option.inboundRange;
      const name = meetingAreas.find(area => area.id === option.areaId)?.label ?? option.areaId;
      const shops = suggestions.filter(s => s.areaId === option.areaId);
      return <article key={option.areaId} className={styles.card}>
        <header><h3>{name}</h3><p>{option.reason}</p></header>
        {range && <div className={styles.travel}>
          {leg ? <><span>あなたの行き<strong>{leg.inbound}分</strong></span><span>解散後<strong>{leg.onward === null ? '未定' : leg.onward + '分'}</strong></span></>
            : <span>駅を回答した人の行き<strong>{range[0] === range[1] ? range[0] : range.join('〜')}分</strong></span>}
        </div>}
        {(shops.length > 0 || option.shop) && <div className={styles.venue}>
          <small>{shops.length ? '参加者のおすすめ' : 'この街のお店'}</small>
          {shops.length ? shops.map((s, i) => {
            const url = suggestionLink(s.text);
            return url ? <a key={i} href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname} でお店を見る</a> : <strong key={i}>{s.text}</strong>;
          }) : <><strong>{option.shop?.replace('（サンプル）', '')}</strong><span>{option.menu}</span></>}
        </div>}
        {canConfirm && <button type="button" disabled={disabled} onClick={() => confirm(option.areaId)}>{name}に決める<ArrowRight size={15} /></button>}
      </article>;
    })}</div>
    {options.some(option => option.worst !== null) && <details className={styles.calculation}><summary>みんなの移動時間を比べる</summary>
      <p>各自にとっていちばん移動が短い街と比べて、何分余分にかかるかを計算しました。帰りが未定の人は行きだけを比べます。</p>
      <ul>{options.map(o => <li key={o.areaId}>{meetingAreas.find(a => a.id === o.areaId)?.label}<span>最も差が大きい人で ＋{o.worst}分</span></li>)}</ul>
    </details>}
  </>;
}
